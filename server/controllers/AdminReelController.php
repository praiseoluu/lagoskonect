<?php

/**
 * KTG Connect — Admin Reel Controller
 * ============================================================
 * Endpoints:
 *   GET    /admin/reels              — paginated list with filters
 *   GET    /admin/reels/metrics      — stat cards data
 *   POST   /admin/reels/upload       — upload reel to Cloudinary
 *   POST   /admin/reels              — create reel record after upload
 *   GET    /admin/reels/:id          — single reel
 *   PATCH  /admin/reels/:id          — update reel
 *   DELETE /admin/reels/:id          — delete reel + Cloudinary cleanup
 *   PATCH  /admin/reels/:id/pause    — toggle published/paused
 *   POST   /admin/reels/reach        — estimate reach for LGA selection
 */
class AdminReelController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/reels ──────────────────────────────────────────────────

    public function list(): void {
        $this->requireAdmin();
        $p      = Paginator::params($_GET, 10);
        $tab    = trim($_GET['tab']    ?? 'all');
        $search = trim($_GET['search'] ?? '');
        $lgaId  = (int) ($_GET['lgaId'] ?? 0);

        $where  = ['1=1'];
        $params = [];

        if ($tab === 'published') { $where[] = 'r.status = "published"'; }
        elseif ($tab === 'paused') { $where[] = 'r.status = "paused"'; }

        if ($search) {
            $where[]  = '(r.caption LIKE ?)';
            $like     = "%{$search}%";
            $params[] = $like;
        }

        if ($lgaId) {
            $where[]  = '(r.lga_id = ? OR EXISTS (SELECT 1 FROM reel_lga_targets rlt WHERE rlt.reel_id = r.reel_id AND rlt.lga_id = ?))';
            $params[] = $lgaId;
            $params[] = $lgaId;
        }

        $whereStr = implode(' AND ', $where);

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM reels r WHERE {$whereStr}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT r.*, u.name AS author_name
            FROM reels r
            LEFT JOIN users u ON u.id = r.author_id
            WHERE {$whereStr}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([...$params, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /admin/reels/metrics ──────────────────────────────────────────

    public function metrics(): void {
        $this->requireAdmin();

        $total = (int) $this->db->query(
            'SELECT COUNT(*) FROM reels WHERE status = "published"'
        )->fetchColumn();

        // Flagged reels — pending reports needing moderation
        $flagged = (int) $this->db->query(
            'SELECT COUNT(DISTINCT reel_id) FROM reel_reports WHERE status = "pending"'
        )->fetchColumn();

        // Total views across all published reels
        $totalViews = (int) $this->db->query(
            'SELECT COALESCE(SUM(views), 0) FROM reels WHERE status = "published"'
        )->fetchColumn();

        // Health index
        $allCount    = (int) $this->db->query('SELECT COUNT(*) FROM reels')->fetchColumn();
        $healthIndex = $allCount > 0 ? round(($total / $allCount) * 100, 1) : 0;

        // Engagement rate: interactions / active users
        $interactions = (int) $this->db->query(
            'SELECT COALESCE(SUM(likes + comment_count), 0) FROM reels WHERE status = "published"'
        )->fetchColumn();
        $activeUsers = (int) $this->db->query(
            'SELECT COUNT(*) FROM users WHERE role = "citizen" AND status = "active"'
        )->fetchColumn();
        $engagementRate = $activeUsers > 0
            ? round(min(100, ($interactions / $activeUsers) * 100), 1)
            : 0;

        Response::json([
            'totalPublished'  => $total,
            'flaggedCount'    => $flagged,
            'totalViews'      => $totalViews,
            'healthIndex'     => $healthIndex,
            'engagementRate'  => $engagementRate,
        ]);
    }

    // ── POST /admin/reels/upload ──────────────────────────────────────────
    // Upload video to Cloudinary. Returns { videoUrl, thumbnailUrl, cloudinaryId, duration }

    public function uploadVideo(): void {
        $this->requireAdmin();

        if (empty($_FILES['file'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "file".', 422);
        }

        $file = $_FILES['file'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        // 100MB limit (Cloudinary free plan)
        if ($file['size'] > 100 * 1024 * 1024) {
            Response::error('VALIDATION_ERROR', 'File size must not exceed 100MB.', 422);
        }

        $allowedMimes = ['video/mp4', 'video/quicktime', 'video/webm'];
        $mime = mime_content_type($file['tmp_name']);
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'Only MP4, MOV, or WebM video files are allowed.', 422);
        }

        try {
            $mime      = mime_content_type($file['tmp_name']);
            $ext       = S3::mimeToExt($mime);
            $videoKey  = S3::makeKey('admin_reels', $ext);
            $videoUrl  = S3::upload($file['tmp_name'], $videoKey, $mime);

            // Thumbnail — optional, uploaded by client as 'thumbnail' field
            $thumbUrl = null;
            if (!empty($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
                $thumbFile = $_FILES['thumbnail'];
                $thumbMime = mime_content_type($thumbFile['tmp_name']);
                $thumbKey  = S3::makeKey('thumbnails', S3::mimeToExt($thumbMime));
                $thumbUrl  = S3::upload($thumbFile['tmp_name'], $thumbKey, $thumbMime);
            }

            Response::json([
                'videoUrl'     => $videoUrl,
                'thumbnailUrl' => $thumbUrl,
                'cloudinaryId' => $videoKey,
                'duration'     => 0,
                'width'        => 0,
                'height'       => 0,
            ]);
        } catch (RuntimeException $e) {
            Response::error('UPLOAD_ERROR', $e->getMessage(), 500);
        }
    }

    // ── POST /admin/reels ─────────────────────────────────────────────────

    public function create(): void {
        $auth = $this->requireAdmin();

        // Fetch admin name for author attribution
        $adminStmt = $this->db->prepare('SELECT name FROM admins WHERE id = ?');
        $adminStmt->execute([$auth['adminId'] ?? 0]);
        $adminName = $adminStmt->fetchColumn() ?: 'Admin';
        $body = Validator::jsonBody() ?? [];

        if (empty($body['videoUrl'])) {
            Response::error('VALIDATION_ERROR', 'videoUrl is required. Upload video first.', 422);
        }

        $targetAll = (bool) ($body['targetAllLgas'] ?? false);
        $lgaIds    = $body['lgaIds'] ?? [];

        if (!$targetAll && empty($lgaIds)) {
            Response::error('VALIDATION_ERROR', 'Select at least one LGA or target all LGAs.', 422);
        }

        // Generate reel_id
        $reelId = 'reel_' . bin2hex(random_bytes(4));

        $stmt = $this->db->prepare('
            INSERT INTO reels (
                reel_id, author_id, author_name, lga_id, lga_name,
                target_all_lgas, is_admin,
                caption, hashtags,
                video_url, thumbnail_url, cloudinary_id,
                duration, views, likes, shares, comment_count,
                delivery_push, delivery_sms, delivery_email,
                allow_comments, status,
                published_at, created_at, updated_at
            ) VALUES (
                ?, NULL, ?, ?, ?,
                ?, 1,
                ?, ?,
                ?, ?, ?,
                ?, 0, 0, 0, 0,
                ?, ?, ?,
                ?, ?,
                NOW(), NOW(), NOW()
            )
        ');

        $lgaId   = !$targetAll && count($lgaIds) === 1 ? (int) $lgaIds[0] : null;
        $lgaName = $lgaId ? $this->lgaName($lgaId) : null;

        $stmt->execute([
            $reelId,
            $adminName,
            $lgaId, $lgaName,
            $targetAll ? 1 : 0,
            trim($body['caption']  ?? ''),
            json_encode($body['hashtags'] ?? []),
            $body['videoUrl'],
            $body['thumbnailUrl']  ?? null,
            $body['cloudinaryId']  ?? null,
            (int) ($body['duration'] ?? 0),
            ($body['deliveryPush']  ?? true)  ? 1 : 0,
            ($body['deliverySms']   ?? false) ? 1 : 0,
            ($body['deliveryEmail'] ?? false) ? 1 : 0,
            ($body['allowComments'] ?? true)  ? 1 : 0,
            'published',
        ]);

        // Sync LGA targets
        if (!$targetAll && !empty($lgaIds)) {
            $this->syncLgaTargets($reelId, $lgaIds);
        }

        $reel = $this->fetchFull($reelId);
        Response::json($this->format($reel), 201);
    }

    // ── GET /admin/reels/:id ──────────────────────────────────────────────

    public function getById(string $id): void {
        $this->requireAdmin();
        $reel = $this->fetchFull($id);
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);
        Response::json($this->format($reel));
    }

    // ── PATCH /admin/reels/:id ────────────────────────────────────────────

    public function update(string $id): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $stmt = $this->db->prepare('SELECT * FROM reels WHERE reel_id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) Response::error('NOT_FOUND', 'Reel not found.', 404);

        $fields = [];
        $values = [];

        foreach (['caption' => 'caption'] as $key => $col) {
            if (array_key_exists($key, $body)) {
                $fields[] = "{$col} = ?";
                $values[] = trim($body[$key]);
            }
        }

        foreach ([
            'allowComments' => 'allow_comments',
            'deliveryPush'  => 'delivery_push',
            'deliverySms'   => 'delivery_sms',
            'deliveryEmail' => 'delivery_email',
        ] as $key => $col) {
            if (array_key_exists($key, $body)) {
                $fields[] = "{$col} = ?";
                $values[] = $body[$key] ? 1 : 0;
            }
        }

        if (!empty($fields)) {
            $fields[]  = 'updated_at = NOW()';
            $values[]  = $id;
            $this->db->prepare('UPDATE reels SET ' . implode(', ', $fields) . ' WHERE reel_id = ?')
                     ->execute($values);
        }

        if (array_key_exists('lgaIds', $body)) {
            $this->db->prepare('DELETE FROM reel_lga_targets WHERE reel_id = ?')->execute([$id]);
            if (!empty($body['lgaIds'])) $this->syncLgaTargets($id, $body['lgaIds']);
        }

        Response::json($this->format($this->fetchFull($id)));
    }

    // ── DELETE /admin/reels/:id ───────────────────────────────────────────

    public function delete(string $id): void {
        $this->requireAdmin();
        $stmt = $this->db->prepare('SELECT cloudinary_id, video_url FROM reels WHERE reel_id = ?');
        $stmt->execute([$id]);
        $reel = $stmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        if ($reel['cloudinary_id']) {
            try { S3::delete($reel['cloudinary_id']); } catch (RuntimeException) {}
        }

        $this->db->prepare('DELETE FROM reel_lga_targets WHERE reel_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM reels WHERE reel_id = ?')->execute([$id]);
        Response::json(['deleted' => true]);
    }

    // ── PATCH /admin/reels/:id/pause ──────────────────────────────────────

    public function togglePause(string $id): void {
        $this->requireAdmin();
        $stmt = $this->db->prepare('SELECT status FROM reels WHERE reel_id = ?');
        $stmt->execute([$id]);
        $reel = $stmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        $newStatus = $reel['status'] === 'paused' ? 'published' : 'paused';
        $this->db->prepare('UPDATE reels SET status = ?, updated_at = NOW() WHERE reel_id = ?')
                 ->execute([$newStatus, $id]);

        Response::json(['reelId' => $id, 'status' => $newStatus]);
    }

    // ── POST /admin/reels/reach ───────────────────────────────────────────

    public function estimateReach(): void {
        $this->requireAdmin();
        $body      = Validator::jsonBody() ?? [];
        $lgaIds    = $body['lgaIds']      ?? [];
        $targetAll = (bool) ($body['targetAllLgas'] ?? false);

        if ($targetAll) {
            $activeUsers = (int) $this->db->query(
                'SELECT COUNT(*) FROM users WHERE role = "citizen" AND status = "active"'
            )->fetchColumn();
        } elseif (empty($lgaIds)) {
            $activeUsers = 0;
        } else {
            $ph   = implode(',', array_fill(0, count($lgaIds), '?'));
            $stmt = $this->db->prepare(
                "SELECT COUNT(*) FROM users WHERE role = 'citizen' AND status = 'active' AND lga_id IN ({$ph})"
            );
            $stmt->execute($lgaIds);
            $activeUsers = (int) $stmt->fetchColumn();
        }

        // Engagement estimate: activeUsers * avg engagement rate (30-day)
        $totalInteractions = (int) $this->db->query(
            'SELECT COALESCE(SUM(likes + comment_count), 0) FROM reels WHERE status = "published"'
        )->fetchColumn();
        $totalActive = (int) $this->db->query(
            'SELECT COUNT(*) FROM users WHERE role = "citizen" AND status = "active"'
        )->fetchColumn();
        $avgEngagementRate = $totalActive > 0
            ? min(1, $totalInteractions / $totalActive)
            : 0.3; // default 30% if no data yet

        $estimatedEngagement = (int) round($activeUsers * $avgEngagementRate);

        Response::json([
            'reach'               => $activeUsers,
            'estimatedEngagement' => $estimatedEngagement,
            'engagementRate'      => $totalActive > 0
                ? round($avgEngagementRate * 100, 1)
                : 30,
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private function requireAdmin(): array {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? (function_exists('apache_request_headers')
                ? (apache_request_headers()['Authorization'] ?? '')
                : '');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            Response::error('UNAUTHENTICATED', 'Authorization token required.', 401);
        }
        $token = substr($authHeader, 7);
        try {
            $payload = JWT::decode($token, JWT_SECRET);
        } catch (RuntimeException) {
            Response::error('UNAUTHENTICATED', 'Invalid or expired token.', 401);
        }
        if (($payload['type'] ?? '') !== 'admin') {
            Response::error('FORBIDDEN', 'Admin access required.', 403);
        }

        $role = $payload['role'] ?? '';
        if (!in_array($role, ['super_admin', 'admin'], true)) {
            http_response_code(403);
            echo json_encode(['error' => ['code' => 'FORBIDDEN', 'message' => 'Insufficient privileges.']]);
            exit;
        }

        // Check blacklist
        $blStmt = $this->db->prepare(
            "SELECT 1 FROM jwt_blacklist WHERE token_hash = ? AND expires_at > NOW() LIMIT 1"
        );
        $blStmt->execute([hash('sha256', $token)]);
        if ($blStmt->fetchColumn()) {
            http_response_code(401);
            echo json_encode(['error' => ['code' => 'TOKEN_REVOKED', 'message' => 'Token has been revoked.']]);
            exit;
        }

        return $payload;
    }

    private function fetchFull(string $reelId): ?array {
        $stmt = $this->db->prepare('
            SELECT r.*, u.name AS author_name
            FROM reels r
            LEFT JOIN users u ON u.id = r.author_id
            WHERE r.reel_id = ?
        ');
        $stmt->execute([$reelId]);
        $reel = $stmt->fetch();
        if (!$reel) return null;

        $lgaStmt = $this->db->prepare('
            SELECT l.id, l.name FROM reel_lga_targets rlt
            JOIN lgas l ON l.id = rlt.lga_id WHERE rlt.reel_id = ?
        ');
        $lgaStmt->execute([$reelId]);
        $reel['lga_targets'] = $lgaStmt->fetchAll();
        return $reel;
    }

    private function lgaName(int $lgaId): ?string {
        $stmt = $this->db->prepare('SELECT name FROM lgas WHERE id = ?');
        $stmt->execute([$lgaId]);
        return $stmt->fetchColumn() ?: null;
    }

    private function syncLgaTargets(string $reelId, array $lgaIds): void {
        $stmt = $this->db->prepare('INSERT IGNORE INTO reel_lga_targets (reel_id, lga_id) VALUES (?, ?)');
        foreach ($lgaIds as $lgaId) {
            $stmt->execute([$reelId, (int) $lgaId]);
        }
    }

    private function format(array $r): array {
        $lgaTargets = array_map(fn($l) => [
            'id'   => (int) $l['id'],
            'name' => $l['name'],
        ], $r['lga_targets'] ?? []);

        $daysSince = null;
        if ($r['published_at'] ?? null) {
            $diff = (new DateTime())->diff(new DateTime($r['published_at']));
            $daysSince = $diff->days;
        }

        $hashtags = $r['hashtags'] ?? '[]';
        if (is_string($hashtags)) $hashtags = json_decode($hashtags, true) ?? [];

        return [
            'reelId'          => $r['reel_id'],
            'id'              => $r['reel_id'],
            'userId'          => $r['author_id'],
            'authorName'      => $r['author_name'] ?? 'Admin',
            'isAdmin'         => (bool) ($r['is_admin'] ?? false),
            'caption'         => $r['caption']       ?? '',
            'hashtags'        => $hashtags,
            'videoUrl'        => $r['video_url'],
            'thumbnailUrl'    => $r['thumbnail_url'],
            'cloudinaryId'    => $r['cloudinary_id'],
            'duration'        => (int) ($r['duration'] ?? 0),
            'lgaId'           => $r['lga_id'] ? (int) $r['lga_id'] : null,
            'lgaName'         => $r['lga_name'],
            'targetAllLgas'   => (bool) ($r['target_all_lgas'] ?? false),
            'lgaTargets'      => $lgaTargets,
            'views'           => (int) ($r['views']         ?? 0),
            'likes'           => (int) ($r['likes']         ?? 0),
            'shares'          => (int) ($r['shares']        ?? 0),
            'commentCount'    => (int) ($r['comment_count'] ?? 0),
            'deliveryPush'    => (bool) ($r['delivery_push']  ?? true),
            'deliverySms'     => (bool) ($r['delivery_sms']   ?? false),
            'deliveryEmail'   => (bool) ($r['delivery_email'] ?? false),
            'allowComments'   => (bool) ($r['allow_comments'] ?? true),
            'status'          => $r['status'],
            'durationDays'    => $daysSince,
            'publishedAt'     => $r['published_at'],
            'createdAt'       => $r['created_at'],
        ];
    }
}