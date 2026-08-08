<?php

/**
 * Lagos Connect - Reel Controller
 * ============================================================
 * Unified reel feed for citizens and admins.
 * Citizens can upload reels (scoped to their LGA).
 * Admins can delete any reel.
 * All reels go live immediately.
 */
class ReelController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /reels ────────────────────────────────────────────────────────
    // Every published reel, from every LGA.
    //
    // This used to return only reels whose lga_id matched the viewer's, plus
    // admin reels flagged target_all_lgas. Citizen uploads are written with
    // target_all_lgas = 0 and the uploader's own lga_id, so in practice a
    // citizen reel was visible only to people in that same LGA — often just
    // the person who posted it. Admin reels set the flag, which is why those
    // were the only ones everybody could see.
    //
    // Reels are a state-wide feed: anyone can watch anything. LGA is retained
    // on the row for attribution and admin filtering, but no longer gates who
    // sees it.

    public function getForLGA(): void {
        if (!Settings::is('reels_enabled')) {
            Response::json([]); return;
        }
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $p      = Paginator::params($_GET, 10);

        $total = (int) $this->db
            ->query('SELECT COUNT(*) FROM reels WHERE status = "published"')
            ->fetchColumn();

        $stmt = $this->db->prepare('
            SELECT r.*,
                   COALESCE(u.username, r.author_name) AS resolved_author_name,
                   COALESCE(u.avatar_url, r.author_avatar_url) AS resolved_author_avatar,
                   EXISTS(
                     SELECT 1 FROM reel_likes rl
                     WHERE rl.reel_id = r.reel_id AND rl.user_id = ?
                   ) AS is_liked
            FROM reels r
            LEFT JOIN users u ON u.id = r.author_id
            WHERE r.status = "published"
            ORDER BY r.published_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$userId, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /reels/:reelId ────────────────────────────────────────────────

    public function getByReelId(string $reelId): void {
        $auth = requireRole('citizen');

        $stmt = $this->db->prepare('
            SELECT r.*, COALESCE(u.username, r.author_name) AS resolved_author_name,
                   COALESCE(u.avatar_url, r.author_avatar_url) AS resolved_author_avatar,
                   EXISTS(
                     SELECT 1 FROM reel_likes rl
                     WHERE rl.reel_id = r.reel_id AND rl.user_id = ?
                   ) AS is_liked
            FROM reels r LEFT JOIN users u ON u.id = r.author_id
            WHERE r.reel_id = ? AND r.status = "published"
        ');
        $stmt->execute([$auth['userId'], $reelId]);
        $reel = $stmt->fetch();

        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        $this->db->prepare('UPDATE reels SET views = views + 1 WHERE reel_id = ?')
                 ->execute([$reelId]);
        $reel['views']++;

        Response::json($this->format($reel));
    }

    // ── POST /reels/upload ────────────────────────────────────────────────
    // Citizen reel upload — multipart/form-data
    // Fields: file (required), caption (optional), hashtags (optional JSON array)

    public function upload(): void {
        if (!Settings::is('reels_enabled')) {
            Response::error('FEATURE_DISABLED', 'Reels are currently disabled.', 403);
        }
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $lgaId  = $auth['lgaId'];

        if (empty($_FILES['file'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "file".', 422);
        }

        $file = $_FILES['file'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        // Validate MIME type
        $mime = Mime::detect($file['tmp_name']);
        $allowedMimes = [
            'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        ];
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'Only video and image files are supported.', 422);
        }

        // Max 150MB
        $maxBytes = 150 * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            Response::error('VALIDATION_ERROR', 'File must not exceed 150MB.', 422);
        }

        // For videos — enforce 60 second limit via Cloudinary response
        $isVideo = str_starts_with($mime, 'video/');

        // Parse optional fields
        $caption  = trim($_POST['caption']  ?? '');
        $hashtagsRaw = $_POST['hashtags'] ?? '[]';
        $hashtags = json_decode($hashtagsRaw, true) ?: [];

        // Fetch user info
        $userStmt = $this->db->prepare('SELECT name, username, avatar_url, lga_name FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);

        // Upload video/image to S3
        try {
            $ext      = S3::mimeToExt($mime);
            $folder   = 'reels/' . $lgaId;
            $videoKey = S3::makeKey($folder, $ext);
            $videoUrl = S3::upload($file['tmp_name'], $videoKey, $mime);

            // Thumbnail — sent by client as 'thumbnail' field (canvas frame grab)
            $thumbUrl = null;
            if (!empty($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
                $thumbFile = $_FILES['thumbnail'];
                $thumbMime = Mime::detect($thumbFile['tmp_name']);
                $thumbKey  = S3::makeKey('thumbnails', S3::mimeToExt($thumbMime));
                $thumbUrl  = S3::upload($thumbFile['tmp_name'], $thumbKey, $thumbMime);
            }

            $cloudData = [
                'secure_url'    => $videoUrl,
                'thumbnail_url' => $thumbUrl,
                'public_id'     => $videoKey,
                'duration'      => 0,
            ];
        } catch (RuntimeException $e) {
            Response::error('UPLOAD_ERROR', 'Media upload failed: ' . $e->getMessage(), 500);
        }

        // Generate reel_id
        $chars  = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $suffix = implode('', array_map(
            fn() => $chars[random_int(0, strlen($chars) - 1)],
            array_fill(0, 6, null)
        ));
        $reelId = "reel_{$suffix}";

        $stmt = $this->db->prepare('
            INSERT INTO reels
                (reel_id, lga_id, lga_name, target_all_lgas, is_admin,
                 caption, hashtags, video_url, thumbnail_url, duration,
                 cloudinary_id, views, likes, shares, comment_count,
                 author_id, author_name, author_handle, author_avatar_url,
                 status, published_at, created_at, updated_at)
            VALUES
                (?, ?, ?, 1, 0,
                 ?, ?, ?, ?, ?,
                 ?, 0, 0, 0, 0,
                 ?, ?, ?, ?,
                 "published", NOW(), NOW(), NOW())
        ');
        // target_all_lgas is 1: a citizen reel is for the whole state. lga_id
        // is still recorded above so the reel can be attributed to, and
        // filtered by, the LGA it came from.

        $authorHandle = isset($user['username']) ? '@' . $user['username'] : null;

        $stmt->execute([
            $reelId,
            $lgaId,
            $user['lga_name'],
            $caption ?: null,
            json_encode($hashtags),
            $cloudData['secure_url'],
            $cloudData['thumbnail_url'],
            $cloudData['duration'],
            $cloudData['public_id'],
            $userId,
            $user['username'] ?? $user['name'],
            $authorHandle,
            $user['avatar_url'],
        ]);

        $reelStmt = $this->db->prepare('
            SELECT r.*, COALESCE(u.username, r.author_name) AS resolved_author_name,
                   COALESCE(u.avatar_url, r.author_avatar_url) AS resolved_author_avatar
            FROM reels r LEFT JOIN users u ON u.id = r.author_id
            WHERE r.reel_id = ?
        ');
        $reelStmt->execute([$reelId]);
        $reel = $reelStmt->fetch();

        // Notify subscribers
        $subStmt = $this->db->prepare('SELECT follower_id FROM reel_subscriptions WHERE target_id = ?');
        $subStmt->execute([$userId]);
        $subscribers = $subStmt->fetchAll(PDO::FETCH_COLUMN);
        $authorName = $user['username'] ?? $user['name'];
        foreach ($subscribers as $followerId) {
            NotificationService::send($this->db, (int) $followerId, [
                'category'    => 'Community',
                'priority'    => 'normal',
                'title'       => "@{$authorName} posted a new reel",
                'body'        => $caption ? '"' . mb_substr($caption, 0, 80) . '"' : 'Check it out.',
                'linkTo'      => "/reels/{$reelId}",
                'templateKey' => 'notifTemplates.newReel',
                'templateVars'=> ['actorName' => $authorName],
            ], 'notif_community');
        }

        Response::json($this->format($reel), 201);
    }

    // ── POST /reels/:reelId/like ──────────────────────────────────────────

    public function toggleLike(string $reelId): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];

        $stmt = $this->db->prepare('SELECT id FROM reels WHERE reel_id = ?');
        $stmt->execute([$reelId]);
        if (!$stmt->fetch()) Response::error('NOT_FOUND', 'Reel not found.', 404);

        $checkStmt = $this->db->prepare('SELECT reel_id FROM reel_likes WHERE reel_id = ? AND user_id = ?');
        $checkStmt->execute([$reelId, $userId]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            $this->db->prepare('DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?')
                     ->execute([$reelId, $userId]);
            $this->db->prepare('UPDATE reels SET likes = GREATEST(0, likes - 1) WHERE reel_id = ?')
                     ->execute([$reelId]);
            $liked = false;
        } else {
            $this->db->prepare('INSERT IGNORE INTO reel_likes (reel_id, user_id, created_at) VALUES (?, ?, NOW())')
                     ->execute([$reelId, $userId]);
            $this->db->prepare('UPDATE reels SET likes = likes + 1 WHERE reel_id = ?')
                     ->execute([$reelId]);
            $liked = true;
        }

        $reelRow = $this->db->prepare('SELECT likes, author_id, caption FROM reels WHERE reel_id = ?');
        $reelRow->execute([$reelId]);
        $reelData = $reelRow->fetch();
        $likes = (int) $reelData['likes'];

        // Notify reel owner when liked (not when unliked, not self-like)
        if ($liked && $reelData['author_id'] && (int) $reelData['author_id'] !== $userId) {
            $likerStmt = $this->db->prepare('SELECT name, username, avatar_url FROM users WHERE id = ?');
            $likerStmt->execute([$userId]);
            $liker = $likerStmt->fetch();
            if ($liker) {
                $preview = $reelData['caption'] ? '"' . mb_substr($reelData['caption'], 0, 60) . '"' : 'They liked your recent reel.';
                NotificationService::send($this->db, (int) $reelData['author_id'], [
                    'category'       => 'Community',
                    'priority'       => 'normal',
                    'title'          => ($liker['username'] ?? $liker['name']) . ' liked your reel',
                    'body'           => $preview,
                    'actorName'      => $liker['username'] ?? $liker['name'],
                    'actorAvatarUrl' => $liker['avatar_url'],
                    'linkTo'         => "/reels/{$reelId}",
                    'templateKey'    => 'notifTemplates.reelLiked',
                    'templateVars'   => ['actorName' => $liker['username'] ?? $liker['name']],
                ], 'notif_reel_likes');
            }
        }

        Response::json(['liked' => $liked, 'likes' => $likes, 'reelId' => $reelId]);
    }

    // ── GET /reels/:reelId/comments ───────────────────────────────────────

    public function getComments(string $reelId): void {
        requireRole('citizen');
        $p = Paginator::params($_GET, 20);

        // parentId decides which slice of the thread we return:
        //   absent → the top-level comments (parent_id IS NULL), newest first,
        //            like TikTok's main list;
        //   set    → the replies under that one comment, OLDEST first, so a
        //            thread reads top-to-bottom in the order it was written.
        $parentId = isset($_GET['parentId']) && $_GET['parentId'] !== ''
            ? (int) $_GET['parentId']
            : null;

        if ($parentId === null) {
            $where  = 'c.reel_id = ? AND c.parent_id IS NULL';
            $params = [$reelId];
            $order  = 'c.created_at DESC';
        } else {
            $where  = 'c.reel_id = ? AND c.parent_id = ?';
            $params = [$reelId, $parentId];
            $order  = 'c.created_at ASC';
        }

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM reel_comments c WHERE $where");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Join the user so the comment shows their CURRENT name and picture,
        // not the snapshot taken when they commented. The stored user_name /
        // avatar_url are a fallback for a since-deleted account; on their own
        // they were often null, which is why comments showed only an initial.
        $stmt = $this->db->prepare("
            SELECT c.*, u.username AS u_username, u.name AS u_name, u.avatar_url AS u_avatar
              FROM reel_comments c
              LEFT JOIN users u ON u.id = c.user_id
             WHERE $where
             ORDER BY $order LIMIT ? OFFSET ?
        ");
        $stmt->execute([...$params, $p['limit'], $p['offset']]);

        $items = array_map(fn($c) => [
            'id'         => (int) $c['id'],
            'reelId'     => $c['reel_id'],
            'parentId'   => $c['parent_id'] !== null ? (int) $c['parent_id'] : null,
            'userId'     => (int) $c['user_id'],
            'userName'   => $c['u_username'] ?: $c['u_name'] ?: $c['user_name'],
            'avatarUrl'  => $c['u_avatar'] ?: $c['avatar_url'],
            'text'       => $c['text'],
            'replyCount' => (int) ($c['reply_count'] ?? 0),
            'createdAt'  => $c['created_at'],
        ], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── POST /reels/:reelId/comments ──────────────────────────────────────

    public function addComment(string $reelId): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];
        $text = trim($body['text'] ?? '');
        if (!$text) Response::error('VALIDATION_ERROR', 'Comment cannot be empty.', 422);

        // A reply carries the id of the comment it answers. We flatten it onto
        // the ROOT of that thread: if the target is itself a reply, we hang the
        // new one under the same root, so the tree never grows past two levels
        // (exactly how TikTok behaves).
        $parentReq = isset($body['parentId']) && $body['parentId'] !== ''
            ? (int) $body['parentId']
            : null;
        $rootId       = null;   // parent_id we store (a root comment id, or null)
        $notifyUserId = null;   // author of the comment being replied to
        if ($parentReq !== null) {
            $pStmt = $this->db->prepare('SELECT id, parent_id, user_id FROM reel_comments WHERE id = ? AND reel_id = ?');
            $pStmt->execute([$parentReq, $reelId]);
            $parent = $pStmt->fetch();
            if (!$parent) Response::error('NOT_FOUND', 'The comment you are replying to no longer exists.', 404);
            $rootId       = $parent['parent_id'] !== null ? (int) $parent['parent_id'] : (int) $parent['id'];
            $notifyUserId = (int) $parent['user_id'];
        }

        $userStmt = $this->db->prepare('SELECT name, username, avatar_url FROM users WHERE id = ?');
        $userStmt->execute([$auth['userId']]);
        $user = $userStmt->fetch();
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);

        $stmt = $this->db->prepare('
            INSERT INTO reel_comments (reel_id, user_id, parent_id, user_name, avatar_url, text, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ');
        $stmt->execute([$reelId, $auth['userId'], $rootId, $user['username'] ?? $user['name'], $user['avatar_url'], $text]);
        $commentId = (int) $this->db->lastInsertId();

        // comment_count on the reel counts every comment, replies included, so
        // the tab badge matches the total conversation. reply_count is bumped
        // only on the root so the "View N replies" toggle is accurate.
        $this->db->prepare('UPDATE reels SET comment_count = comment_count + 1 WHERE reel_id = ?')
                 ->execute([$reelId]);
        if ($rootId !== null) {
            $this->db->prepare('UPDATE reel_comments SET reply_count = reply_count + 1 WHERE id = ?')
                     ->execute([$rootId]);
        }

        $actorName = $user['username'] ?? $user['name'];

        // Notify the person being replied to (skip self). Falls back to the
        // reel owner for a top-level comment.
        $notifyTarget = $rootId !== null ? $notifyUserId : null;
        if ($notifyTarget === null) {
            $reelOwnerStmt = $this->db->prepare('SELECT author_id FROM reels WHERE reel_id = ?');
            $reelOwnerStmt->execute([$reelId]);
            $reelOwner = $reelOwnerStmt->fetch();
            $notifyTarget = $reelOwner ? (int) $reelOwner['author_id'] : null;
        }
        if ($notifyTarget && $notifyTarget !== $auth['userId']) {
            NotificationService::send($this->db, $notifyTarget, [
                'category'       => 'Community',
                'priority'       => 'normal',
                'title'          => $actorName . ($rootId !== null ? ' replied to your comment' : ' commented on your reel'),
                'body'           => '"' . mb_substr($text, 0, 80) . '"',
                'actorName'      => $actorName,
                'actorAvatarUrl' => $user['avatar_url'],
                'linkTo'         => "/reels/{$reelId}",
                'templateKey'    => $rootId !== null ? 'notifTemplates.reelReplied' : 'notifTemplates.reelCommented',
                'templateVars'   => ['actorName' => $actorName],
            ], 'notif_reel_comments');
        }

        Response::json([
            'id'         => $commentId,
            'reelId'     => $reelId,
            'parentId'   => $rootId,
            'userId'     => $auth['userId'],
            'userName'   => $actorName,
            'avatarUrl'  => $user['avatar_url'],
            'text'       => $text,
            'replyCount' => 0,
            'createdAt'  => gmdate('Y-m-d\TH:i:s\Z'),
        ], 201);
    }

    // ── POST /reels/:reelId/report — citizen ─────────────────────────────

    public function reportReel(string $reelId): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $body   = Validator::jsonBody() ?? [];

        $reason  = trim($body['reason']  ?? '');
        $details = trim($body['details'] ?? '');

        if (!$reason) {
            Response::error('VALIDATION_ERROR', 'A reason is required.', 422);
        }

        $allowedReasons = ['Inappropriate', 'Spam', 'Misinformation', 'Harassment', 'Violence', 'Other'];
        if (!in_array($reason, $allowedReasons, true)) {
            Response::error('VALIDATION_ERROR', 'Invalid reason.', 422);
        }

        // Check reel exists
        $reelStmt = $this->db->prepare('SELECT reel_id FROM reels WHERE reel_id = ?');
        $reelStmt->execute([$reelId]);
        if (!$reelStmt->fetch()) {
            Response::error('NOT_FOUND', 'Reel not found.', 404);
        }

        try {
            $this->db->prepare('
                INSERT INTO reel_reports (reel_id, user_id, reason, details, status, created_at)
                VALUES (?, ?, ?, ?, "pending", NOW())
            ')->execute([$reelId, $userId, $reason, $details ?: null]);
        } catch (\PDOException $e) {
            if (str_contains($e->getMessage(), 'Duplicate')) {
                Response::error('ALREADY_REPORTED', 'You have already reported this reel.', 409);
            }
            throw $e;
        }

        Response::json(['reported' => true], 201);
    }

    // ── GET /reels/by/:userId — public ───────────────────────────────────

    public function getByUser(int $userId): void {
        $p = Paginator::params($_GET, 20);

        $countStmt = $this->db->prepare('SELECT COUNT(*) FROM reels WHERE author_id = ? AND status = "published"');
        $countStmt->execute([$userId]);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare('
            SELECT r.*, COALESCE(u.username, r.author_name) AS resolved_author_name,
                   COALESCE(u.avatar_url, r.author_avatar_url) AS resolved_author_avatar
            FROM reels r LEFT JOIN users u ON u.id = r.author_id
            WHERE r.author_id = ? AND r.status = "published"
            ORDER BY r.published_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$userId, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /reels/:reelId/subscription ──────────────────────────────────

    public function getSubscription(string $reelId): void {
        $auth = requireRole('citizen');

        $reelStmt = $this->db->prepare('SELECT author_id FROM reels WHERE reel_id = ?');
        $reelStmt->execute([$reelId]);
        $reel = $reelStmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        $targetId = (int) $reel['author_id'];
        $stmt = $this->db->prepare('SELECT id FROM reel_subscriptions WHERE follower_id = ? AND target_id = ?');
        $stmt->execute([$auth['userId'], $targetId]);

        Response::json(['subscribed' => (bool) $stmt->fetch(), 'targetId' => $targetId]);
    }

    // ── POST /reels/:reelId/subscribe ─────────────────────────────────────

    public function subscribe(string $reelId): void {
        $auth = requireRole('citizen');

        $reelStmt = $this->db->prepare('SELECT author_id FROM reels WHERE reel_id = ?');
        $reelStmt->execute([$reelId]);
        $reel = $reelStmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        $targetId = (int) $reel['author_id'];
        if ($targetId === $auth['userId']) {
            Response::error('VALIDATION_ERROR', 'You cannot subscribe to yourself.', 422);
        }

        $this->db->prepare('INSERT IGNORE INTO reel_subscriptions (follower_id, target_id) VALUES (?, ?)')
                 ->execute([$auth['userId'], $targetId]);

        Response::json(['subscribed' => true, 'targetId' => $targetId]);
    }

    // ── DELETE /reels/:reelId/subscribe ──────────────────────────────────

    public function unsubscribe(string $reelId): void {
        $auth = requireRole('citizen');

        $reelStmt = $this->db->prepare('SELECT author_id FROM reels WHERE reel_id = ?');
        $reelStmt->execute([$reelId]);
        $reel = $reelStmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        $targetId = (int) $reel['author_id'];
        $this->db->prepare('DELETE FROM reel_subscriptions WHERE follower_id = ? AND target_id = ?')
                 ->execute([$auth['userId'], $targetId]);

        Response::json(['subscribed' => false, 'targetId' => $targetId]);
    }

    // ── DELETE /reels/:reelId — admin only ───────────────────────────────

    // ── DELETE /reels/:id  (citizen — own reels only) ────────────────────

    public function deleteOwn(string $reelId): void {
        $auth = requireRole('citizen');

        $stmt = $this->db->prepare('SELECT author_id, cloudinary_id FROM reels WHERE reel_id = ?');
        $stmt->execute([$reelId]);
        $reel = $stmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);
        if ((int) $reel['author_id'] !== $auth['userId']) {
            Response::error('FORBIDDEN', 'You can only delete your own reels.', 403);
        }

        if ($reel['cloudinary_id']) {
            try { S3::delete($reel['cloudinary_id']); } catch (RuntimeException) {}
        }

        $this->db->prepare('DELETE FROM reels WHERE reel_id = ?')->execute([$reelId]);
        $this->db->prepare('DELETE FROM reel_comments WHERE reel_id = ?')->execute([$reelId]);
        $this->db->prepare('DELETE FROM reel_likes WHERE reel_id = ?')->execute([$reelId]);

        Response::json(['deleted' => true]);
    }

    // ── DELETE /reels/:id  (admin) ────────────────────────────────────────

    public function adminDelete(string $reelId): void {
        requireRole('admin');

        $stmt = $this->db->prepare('SELECT cloudinary_id, video_url FROM reels WHERE reel_id = ?');
        $stmt->execute([$reelId]);
        $reel = $stmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        if ($reel['cloudinary_id']) {
            try { S3::delete($reel['cloudinary_id']); } catch (RuntimeException) {}
        }

        $this->db->prepare('DELETE FROM reels WHERE reel_id = ?')->execute([$reelId]);
        $this->db->prepare('DELETE FROM reel_comments WHERE reel_id = ?')->execute([$reelId]);
        $this->db->prepare('DELETE FROM reel_likes WHERE reel_id = ?')->execute([$reelId]);

        Response::json(['deleted' => true]);
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private function format(array $r): array {
        $hashtags = json_decode($r['hashtags'] ?? '[]', true) ?: [];
        // Ensure timestamps are in ISO 8601 format with timezone
        $publishedAt = $r['published_at'] ? date('c', strtotime($r['published_at'])) : null;
        $createdAt = $r['created_at'] ? date('c', strtotime($r['created_at'])) : null;
        
        return [
            'reelId'          => $r['reel_id'],
            'lgaId'           => $r['lga_id'] ? (int) $r['lga_id'] : null,
            'lgaName'         => $r['lga_name'],
            'targetAllLGAs'   => (bool) $r['target_all_lgas'],
            'isAdmin'         => (bool) ($r['is_admin'] ?? false),
            'caption'         => $r['caption'],
            'hashtags'        => $hashtags,
            'videoUrl'        => $r['video_url'],
            'thumbnailUrl'    => $r['thumbnail_url'],
            'duration'        => (int) $r['duration'],
            'views'           => (int) $r['views'],
            'likes'           => (int) $r['likes'],
            // Whether the requesting user has already liked this reel, so the
            // heart renders filled on load instead of resetting every refresh.
            // Queries that do not select is_liked fall back to false.
            'isLiked'         => (bool) ($r['is_liked'] ?? false),
            'shares'          => (int) $r['shares'],
            'commentCount'    => (int) $r['comment_count'],
            'authorId'        => (int) $r['author_id'],
            'authorName'      => $r['resolved_author_name'] ?? $r['author_name'],
            'authorHandle'    => isset($r['resolved_author_name']) ? '@' . $r['resolved_author_name'] : $r['author_handle'],
            'authorAvatarUrl' => $r['resolved_author_avatar'] ?? $r['author_avatar_url'],
            'status'          => $r['status'],
            'publishedAt'     => $publishedAt,
            'createdAt'       => $createdAt,
        ];
    }
}