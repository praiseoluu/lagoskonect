<?php

class ChatController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /chat/previews ────────────────────────────────────────────────
    // Returns all LGAs with their last message used by the chat list sidebar.

    public function getPreviews(): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];

        // Only LGAs within the user's own region are visible in community chat.
        $lgaStmt = $this->db->prepare('SELECT id, name FROM lgas WHERE region = ? ORDER BY name ASC');
        $lgaStmt->execute([$auth['region']]);
        $lgas = $lgaStmt->fetchAll();

        if (!$lgas) { Response::json([]); return; }

        $lgaIds = array_column($lgas, 'id');
        $placeholders = implode(',', array_fill(0, count($lgaIds), '?'));

        // Last message per LGA in one query
        $msgStmt = $this->db->prepare("
            SELECT m.lga_id, m.text, m.file_name, m.created_at,
                   COALESCE(u.username, m.user_name) AS sender_name,
                   m.user_id
            FROM lga_chat_messages m
            LEFT JOIN users u ON u.id = m.user_id
            INNER JOIN (
                SELECT lga_id, MAX(id) AS max_id
                FROM lga_chat_messages
                WHERE lga_id IN ($placeholders)
                GROUP BY lga_id
            ) latest ON m.lga_id = latest.lga_id AND m.id = latest.max_id
        ");
        $msgStmt->execute($lgaIds);
        $lastMsgs = [];
        foreach ($msgStmt->fetchAll() as $row) {
            $lastMsgs[$row['lga_id']] = $row;
        }

        // Last-read per LGA for this user
        $lrStmt = $this->db->prepare("
            SELECT lga_id, last_message_id FROM chat_last_read
            WHERE user_id = ? AND lga_id IN ($placeholders)
        ");
        $lrStmt->execute(array_merge([$userId], $lgaIds));
        $lastRead = [];
        foreach ($lrStmt->fetchAll() as $row) {
            $lastRead[$row['lga_id']] = (int) $row['last_message_id'];
        }

        // Unread counts per LGA
        $unreadStmt = $this->db->prepare("
            SELECT lga_id, COUNT(*) AS cnt
            FROM lga_chat_messages
            WHERE lga_id IN ($placeholders)
              AND (user_id IS NULL OR user_id != ?)
            GROUP BY lga_id
        ");
        // We count messages after last_read per LGA in PHP to avoid a complex dynamic query
        $unreadStmt = $this->db->prepare("
            SELECT m.lga_id, COUNT(*) AS cnt
            FROM lga_chat_messages m
            LEFT JOIN chat_last_read lr ON lr.user_id = ? AND lr.lga_id = m.lga_id
            WHERE m.lga_id IN ($placeholders)
              AND (m.user_id IS NULL OR m.user_id != ?)
              AND m.id > COALESCE(lr.last_message_id, 0)
            GROUP BY m.lga_id
        ");
        $unreadStmt->execute(array_merge([$userId], $lgaIds, [$userId]));
        $unreadCounts = [];
        foreach ($unreadStmt->fetchAll() as $row) {
            $unreadCounts[$row['lga_id']] = (int) $row['cnt'];
        }

        $result = array_map(function($lga) use ($lastMsgs, $lastRead, $unreadCounts, $userId) {
            $lgaId = (int) $lga['id'];
            $last  = $lastMsgs[$lgaId] ?? null;
            $preview = null;
            if ($last) {
                $isMe = (int)($last['user_id'] ?? -1) === $userId;
                $prefix = $isMe ? 'You' : ($last['sender_name'] ?? 'Someone');
                $text = $last['text'] ?? ($last['file_name'] ? '📎 ' . $last['file_name'] : '');
                $preview = [
                    'text'      => mb_strlen($text) > 60 ? mb_substr($text, 0, 57) . '…' : $text,
                    'sender'    => $prefix,
                    'isMe'      => $isMe,
                    'createdAt' => $last['created_at'],
                ];
            }
            return [
                'id'          => $lgaId,
                'name'        => $lga['name'],
                'lastMessage' => $preview,
                'unreadCount' => $unreadCounts[$lgaId] ?? 0,
            ];
        }, $lgas);

        Response::json($result);
    }

    // ── GET /chat/messages ────────────────────────────────────────────────

    public function getMessages(): void {
        $auth   = requireRole('citizen');
        $lgaId  = isset($_GET['lgaId']) ? (int) $_GET['lgaId'] : $auth['lgaId'];
        $this->assertLgaInRegion($lgaId, $auth);
        $p      = Paginator::params($_GET, 50);

        $countStmt = $this->db->prepare('SELECT COUNT(*) FROM lga_chat_messages WHERE lga_id = ?');
        $countStmt->execute([$lgaId]);
        $total = (int) $countStmt->fetchColumn();

        // Chat messages are oldest-first (ascending)
        $stmt = $this->db->prepare('
            SELECT m.*, COALESCE(u.username, m.user_name) AS resolved_user_name,
                   COALESCE(u.avatar_url, m.avatar_url) AS resolved_avatar_url
            FROM lga_chat_messages m
            LEFT JOIN users u ON u.id = m.user_id
            WHERE m.lga_id = ?
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$lgaId, $p['limit'], $p['offset']]);

        $items = array_map([$this, 'formatMessage'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── POST /chat/messages ───────────────────────────────────────────────

    public function sendMessage(): void {
        if (!Settings::is('chat_enabled')) {
            Response::error('FEATURE_DISABLED', 'Community chat is currently disabled.', 403);
        }
        $auth   = requireRole('citizen');
        $body   = Validator::jsonBody() ?? [];
        $userId = $auth['userId'];
        $lgaId  = isset($body['lgaId']) ? (int) $body['lgaId'] : $auth['lgaId'];
        $this->assertLgaInRegion($lgaId, $auth);

        $text      = trim($body['text']     ?? '');
        $mediaUrl  = $body['mediaUrl']      ?? null;
        $fileUrl   = $body['fileUrl']       ?? null;
        $fileName  = $body['fileName']      ?? null;
        $fileSize  = $body['fileSize']      ?? null;
        $replyTo   = $body['replyTo']       ?? null;

        if ($text && mb_strlen($text) > 2000) {
            Response::error('VALIDATION_ERROR', 'Message too long (max 2000 characters).', 422);
        }

        if (!$text && !$mediaUrl && !$fileUrl) {
            Response::error('VALIDATION_ERROR', 'Message cannot be empty.', 422);
        }

        if ($replyTo !== null) {
            if (!is_array($replyTo) || !isset($replyTo['id'])) {
                Response::error('VALIDATION_ERROR', 'Invalid replyTo format.', 422);
            }
            // Coerce id to integer to prevent type confusion
            $replyTo['id'] = (int) $replyTo['id'];
            if ($replyTo['id'] <= 0) {
                Response::error('VALIDATION_ERROR', 'Invalid replyTo id.', 422);
            }
            // Whitelist only the fields we actually use
            $replyTo = [
                'id'       => $replyTo['id'],
                'text'     => isset($replyTo['text']) ? mb_substr((string)$replyTo['text'], 0, 500) : '',
                'userName' => isset($replyTo['userName']) ? mb_substr((string)$replyTo['userName'], 0, 50) : '',
            ];
        }

        // Profanity filter — check against banned_words table
        if ($text) {
            $wordsStmt = $this->db->query('SELECT word FROM banned_words');
            $bannedWords = $wordsStmt->fetchAll(PDO::FETCH_COLUMN);
            $lowerText = mb_strtolower($text);
            foreach ($bannedWords as $bw) {
                if (mb_strpos($lowerText, mb_strtolower($bw)) !== false) {
                    Response::error('PROFANITY', 'Your message contains language that is not allowed in this community.', 422);
                }
            }
        }

        // Fetch sender info
        $userStmt = $this->db->prepare('SELECT name, username, avatar_url FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);

        $reactionsJson = '{}';
        $replyToJson   = $replyTo ? json_encode($replyTo) : null;

        $stmt = $this->db->prepare('
            INSERT INTO lga_chat_messages
                (lga_id, user_id, user_name, avatar_url, text, media_url,
                 file_url, file_name, file_size, reactions, reply_to, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $lgaId, $userId, $user['username'] ?? $user['name'], $user['avatar_url'],
            $text ?: null, $mediaUrl, $fileUrl, $fileName, $fileSize,
            $reactionsJson, $replyToJson,
        ]);

        $msgId = (int) $this->db->lastInsertId();

        // ── Notify the original message author if this is a reply ────────
        if ($replyTo && isset($replyTo['id'])) {
            $origStmt = $this->db->prepare('SELECT user_id, text FROM lga_chat_messages WHERE id = ?');
            $origStmt->execute([$replyTo['id']]);
            $orig = $origStmt->fetch();

            if ($orig && $orig['user_id'] !== null && (int)$orig['user_id'] !== $userId) {
                $preview = mb_strlen($orig['text'] ?? '') > 60
                    ? mb_substr($orig['text'], 0, 57) . '...'
                    : ($orig['text'] ?? 'your message');

                $senderName = $user['username'] ?? $user['name'];
                $this->db->prepare('
                    INSERT INTO notifications
                        (user_id, category, priority, title, body, actor_name, link_to, is_read, created_at)
                    VALUES (?, "Community", "normal", ?, ?, ?, "/chat", 0, NOW())
                ')->execute([
                    (int)$orig['user_id'],
                    "{$senderName} replied to your message",
                    "{$senderName}: \"{$text}\" — in reply to: \"{$preview}\"",
                    $senderName,
                ]);
            }
        }

        // ── Update sender's last_read to this new message ─────────────────
        $this->db->prepare('
            INSERT INTO chat_last_read (user_id, lga_id, last_message_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE last_message_id = VALUES(last_message_id)
        ')->execute([$userId, $lgaId, $msgId]);

        $msgStmt = $this->db->prepare('SELECT * FROM lga_chat_messages WHERE id = ?');
        $msgStmt->execute([$msgId]);
        $msg = $msgStmt->fetch();

        Response::json($this->formatMessage($msg), 201);
    }

    // ── GET /chat/online-count ────────────────────────────────────────────

    public function getOnlineCount(): void {
        $auth  = requireRole('citizen');
        $lgaId = isset($_GET['lgaId']) ? (int) $_GET['lgaId'] : $auth['lgaId'];
        $this->assertLgaInRegion($lgaId, $auth);

        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM users
            WHERE lga_id = ? AND status = "active"
              AND last_seen_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        ');
        $stmt->execute([$lgaId]);
        $count = (int) $stmt->fetchColumn();

        Response::json(['count' => $count]);
    }

    // ── GET /chat/unread-count ────────────────────────────────────────────

    public function getUnreadCount(): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $lgaId  = isset($_GET['lgaId']) ? (int) $_GET['lgaId'] : $auth['lgaId'];
        $this->assertLgaInRegion($lgaId, $auth);

        // Get the user's last-read message ID for this LGA
        $lrStmt = $this->db->prepare('
            SELECT last_message_id FROM chat_last_read WHERE user_id = ? AND lga_id = ?
        ');
        $lrStmt->execute([$userId, $lgaId]);
        $lr = $lrStmt->fetch();
        $lastReadId = $lr ? (int)$lr['last_message_id'] : 0;

        // Count messages after that ID (excluding own messages)
        $countStmt = $this->db->prepare('
            SELECT COUNT(*) FROM lga_chat_messages
            WHERE lga_id = ? AND id > ? AND (user_id IS NULL OR user_id != ?)
        ');
        $countStmt->execute([$lgaId, $lastReadId, $userId]);
        $count = (int) $countStmt->fetchColumn();

        Response::json(['count' => $count, 'lastReadId' => $lastReadId]);
    }

    // ── POST /chat/mark-read ──────────────────────────────────────────────

    public function markRead(): void {
        $auth   = requireRole('citizen');
        $body   = Validator::jsonBody() ?? [];
        $userId = $auth['userId'];
        $lgaId  = isset($body['lgaId']) ? (int) $body['lgaId'] : $auth['lgaId'];
        $this->assertLgaInRegion($lgaId, $auth);

        // Get the latest message ID in this LGA chat
        $latestStmt = $this->db->prepare('
            SELECT MAX(id) as max_id FROM lga_chat_messages WHERE lga_id = ?
        ');
        $latestStmt->execute([$lgaId]);
        $latest = $latestStmt->fetch();
        $latestId = (int)($latest['max_id'] ?? 0);

        if ($latestId > 0) {
            $this->db->prepare('
                INSERT INTO chat_last_read (user_id, lga_id, last_message_id)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE last_message_id = VALUES(last_message_id)
            ')->execute([$userId, $lgaId, $latestId]);
        }

        Response::json(['marked' => true, 'lastReadId' => $latestId]);
    }

    // ── POST /chat/messages/:id/reactions ────────────────────────────────

    public function toggleReaction(int $messageId): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $body   = Validator::jsonBody() ?? [];
        $emoji  = $body['emoji'] ?? '';

        if (!$emoji) {
            Response::error('VALIDATION_ERROR', 'emoji is required.', 422);
        }

        // Length limit and strip HTML tags from emoji value
        if (mb_strlen($emoji) > 10) {
            Response::error('VALIDATION_ERROR', 'Invalid emoji value.', 422);
        }
        $emoji = strip_tags($emoji);
        if (!$emoji) {
            Response::error('VALIDATION_ERROR', 'emoji is required.', 422);
        }

        $stmt = $this->db->prepare('SELECT reactions FROM lga_chat_messages WHERE id = ?');
        $stmt->execute([$messageId]);
        $msg = $stmt->fetch();

        if (!$msg) {
            Response::error('NOT_FOUND', 'Message not found.', 404);
        }

        $reactions = json_decode($msg['reactions'] ?? '{}', true) ?: [];

        // Remove user from all other emoji arrays (one reaction per user)
        foreach ($reactions as $existingEmoji => &$users) {
            if ($existingEmoji === $emoji) continue;
            $idx = array_search($userId, $users);
            if ($idx !== false) {
                array_splice($users, $idx, 1);
                if (empty($users)) unset($reactions[$existingEmoji]);
            }
        }
        unset($users);

        // Toggle the requested emoji
        if (!isset($reactions[$emoji])) {
            $reactions[$emoji] = [];
        }

        $idx = array_search($userId, $reactions[$emoji]);
        $isAdding = ($idx === false);

        if (!$isAdding) {
            array_splice($reactions[$emoji], $idx, 1);
            if (empty($reactions[$emoji])) {
                unset($reactions[$emoji]);
            }
        } else {
            $reactions[$emoji][] = $userId;
        }

        $reactionsJson = empty($reactions) ? '{}' : json_encode($reactions, JSON_UNESCAPED_UNICODE);

        $this->db->prepare('UPDATE lga_chat_messages SET reactions = ? WHERE id = ?')
                 ->execute([$reactionsJson, $messageId]);

        // ── Notify message author when someone reacts ────────────────────
        if ($isAdding) {
            $fullMsgStmt = $this->db->prepare('SELECT user_id, text FROM lga_chat_messages WHERE id = ?');
            $fullMsgStmt->execute([$messageId]);
            $fullMsg = $fullMsgStmt->fetch();

            if ($fullMsg && $fullMsg['user_id'] !== null && (int)$fullMsg['user_id'] !== $userId) {
                $reactorStmt = $this->db->prepare('SELECT name, username FROM users WHERE id = ?');
                $reactorStmt->execute([$userId]);
                $reactor = $reactorStmt->fetch();
                $reactorName = $reactor['username'] ?? $reactor['name'] ?? 'Someone';

                $preview = mb_strlen($fullMsg['text'] ?? '') > 60
                    ? mb_substr($fullMsg['text'], 0, 57) . '...'
                    : ($fullMsg['text'] ?? 'your message');

                $safeEmoji = htmlspecialchars($emoji, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

                $this->db->prepare('
                    INSERT INTO notifications
                        (user_id, category, priority, title, body, actor_name, link_to, is_read, created_at)
                    VALUES (?, "Community", "normal", ?, ?, ?, "/chat", 0, NOW())
                ')->execute([
                    (int)$fullMsg['user_id'],
                    "{$reactorName} reacted to your message",
                    "{$reactorName} reacted {$safeEmoji} to: \"{$preview}\"",
                    $reactorName,
                ]);
            }
        }

        Response::json(['reactions' => empty($reactions) ? (object)[] : $reactions]);
    }

    // ── GET /chat/members ─────────────────────────────────────────────────

    public function getMembers(): void {
        $auth  = requireRole('citizen');
        $lgaId = $auth['lgaId'];

        $stmt = $this->db->prepare('
            SELECT id, name, avatar_url, status, last_seen_at
            FROM users
            WHERE lga_id = ? AND role = "citizen" AND is_verified = 1
            ORDER BY name ASC
        ');
        $stmt->execute([$lgaId]);

        $members = array_map(fn($r) => [
            'id'         => (int) $r['id'],
            'name'       => $r['name'],
            'avatarUrl'  => $r['avatar_url'],
            'status'     => $r['status'],
            'lastSeenAt' => $r['last_seen_at'],
        ], $stmt->fetchAll());

        Response::json($members);
    }

    // ── POST /chat/upload ─────────────────────────────────────────────────

    public function uploadFile(): void {
        if (!Settings::is('chat_enabled')) {
            Response::error('FEATURE_DISABLED', 'Community chat is currently disabled.', 403);
        }
        $auth = requireRole('citizen');

        if (empty($_FILES['file'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "file".', 422);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        // Max 20MB
        if ($file['size'] > 20 * 1024 * 1024) {
            Response::error('VALIDATION_ERROR', 'File size must not exceed 20MB.', 422);
        }

        $mime = mime_content_type($file['tmp_name']);
        $allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'video/mp4', 'video/webm',
            'audio/mpeg', 'audio/ogg', 'audio/wav',
        ];
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'File type not allowed.', 422);
        }

        $isImage = str_starts_with($mime, 'image/');
        $subDir  = $isImage ? 'images' : 'files';

        // Derive extension from MIME type never trust the client supplied filename extension
        $mimeExt = [
            'image/jpeg'      => 'jpg',
            'image/png'       => 'png',
            'image/gif'       => 'gif',
            'image/webp'      => 'webp',
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'video/mp4'       => 'mp4',
            'video/webm'      => 'webm',
            'audio/mpeg'      => 'mp3',
            'audio/ogg'       => 'ogg',
            'audio/wav'       => 'wav',
        ];
        $extSafe  = $mimeExt[$mime] ?? 'bin';
        $safeName = bin2hex(random_bytes(12)) . '.' . $extSafe;
        $uploadDir = __DIR__ . "/../uploads/chat/{$subDir}/";
        $destPath  = $uploadDir . $safeName;

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Response::error('UPLOAD_ERROR', 'Could not save file.', 500);
        }

        $base       = rtrim(getenv('BASE_URL') ?: '', '/');
        $serverBase = preg_replace('#/api/v1$#', '', $base);
        $fileUrl    = $serverBase . '/uploads/chat/' . $subDir . '/' . $safeName;

        $response = [
            'url'      => $fileUrl,
            'fileName' => $file['name'],
            'fileSize' => $file['size'],
            'mimeType' => $mime,
            'isImage'  => $isImage,
        ];

        Response::json($response, 201);
    }

    // ── POST /chat/report ─────────────────────────────────────────────────

    public function reportMessage(): void {
        $auth   = requireRole('citizen');
        $body   = Validator::jsonBody() ?? [];
        $msgId  = (int) ($body['messageId'] ?? 0);
        $reason = trim($body['reason'] ?? '');

        if (!$msgId) {
            Response::error('VALIDATION_ERROR', 'messageId is required.', 422);
        }
        if (!$reason) {
            Response::error('VALIDATION_ERROR', 'reason is required.', 422);
        }
        if (mb_strlen($reason) > 100) {
            Response::error('VALIDATION_ERROR', 'Reason must be 100 characters or fewer.', 422);
        }

        $stmt = $this->db->prepare('SELECT id FROM lga_chat_messages WHERE id = ? AND lga_id = ?');
        $stmt->execute([$msgId, $auth['lgaId']]);
        if (!$stmt->fetch()) {
            Response::error('NOT_FOUND', 'Message not found.', 404);
        }

        // Prevent duplicate reports from the same user on the same message
        $dupStmt = $this->db->prepare('
            SELECT id FROM chat_reports
            WHERE message_id = ? AND reporter_id = ? AND status = "pending"
        ');
        $dupStmt->execute([$msgId, $auth['userId']]);
        if ($dupStmt->fetch()) {
            Response::json(['reported' => true]);
            return;
        }

        $this->db->prepare('
            INSERT INTO chat_reports (message_id, reporter_id, reason, status, created_at)
            VALUES (?, ?, ?, "pending", NOW())
        ')->execute([$msgId, $auth['userId'], $reason]);

        Response::json(['reported' => true], 201);
    }

    // ── PATCH /chat/messages/:id  (citizen own messages only) ──────────

    public function editMessage(int $messageId): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];
        $text = trim($body['text'] ?? '');

        if ($text === '') {
            Response::error('VALIDATION_ERROR', 'Message text cannot be empty.', 422);
        }
        if (mb_strlen($text) > 2000) {
            Response::error('VALIDATION_ERROR', 'Message is too long (max 2000 characters).', 422);
        }

        $stmt = $this->db->prepare('SELECT id, user_id FROM lga_chat_messages WHERE id = ?');
        $stmt->execute([$messageId]);
        $msg = $stmt->fetch();
        if (!$msg) Response::error('NOT_FOUND', 'Message not found.', 404);
        if ((int) $msg['user_id'] !== $auth['userId']) {
            Response::error('FORBIDDEN', 'You can only edit your own messages.', 403);
        }

        $this->db->prepare(
            'UPDATE lga_chat_messages SET text = ?, edited_at = NOW() WHERE id = ?'
        )->execute([$text, $messageId]);

        $updated = $this->db->prepare('SELECT id, text, edited_at FROM lga_chat_messages WHERE id = ?');
        $updated->execute([$messageId]);
        $row = $updated->fetch();

        Response::json([
            'id'       => (int) $row['id'],
            'text'     => $row['text'],
            'editedAt' => $row['edited_at'],
        ]);
    }

    // ── DELETE /chat/messages/:id  (citizen own messages only) ─────────


    public function deleteMessage(int $messageId): void {
        $auth = requireRole('citizen');

        $stmt = $this->db->prepare('SELECT user_id, lga_id FROM lga_chat_messages WHERE id = ?');
        $stmt->execute([$messageId]);
        $msg = $stmt->fetch();
        if (!$msg) Response::error('NOT_FOUND', 'Message not found.', 404);
        if ((int) $msg['user_id'] !== $auth['userId']) {
            Response::error('FORBIDDEN', 'You can only delete your own messages.', 403);
        }

        $this->db->prepare('DELETE FROM lga_chat_messages WHERE id = ?')->execute([$messageId]);
        Response::json(['deleted' => true]);
    }

    // ── POST /chat/invite ─────────────────────────────────────────────────

    public function inviteMember(): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];
        $phone = trim($body['phone'] ?? '');

        if (!$phone) {
            Response::error('VALIDATION_ERROR', 'Phone number is required.', 422);
        }

        $normalised = Validator::normalisePhone($phone) ?? $phone;

        try {
            $this->db->prepare('
                INSERT INTO chat_invites (invited_by, phone, lga_id, created_at)
                VALUES (?, ?, ?, NOW())
            ')->execute([$auth['userId'], $normalised, $auth['lgaId']]);
        } catch (Exception) {}

        // Send WhatsApp invite with signup link
        $host      = $_SERVER['HTTP_HOST'] ?? 'lagkonnect.com';
        $scheme    = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $signupUrl = "{$scheme}://{$host}/signup";
        WhatsAppService::sendInvite($normalised, $signupUrl);

        Response::json(['sent' => true, 'phone' => $normalised]);
    }

    // ── Private helpers ──────────────────────────────────────────────────

    // Community chat is region-scoped: a user may only read/post in an LGA
    // that belongs to their own region (north/south/central). Blocks
    // cross region access even if a valid lgaId is passed explicitly.
    private function assertLgaInRegion(int $lgaId, array $auth): void {
        $stmt = $this->db->prepare('SELECT region FROM lgas WHERE id = ?');
        $stmt->execute([$lgaId]);
        $lga = $stmt->fetch();

        if (!$lga) {
            Response::error('NOT_FOUND', 'LGA not found.', 404);
        }

        if (!$auth['region'] || $lga['region'] !== $auth['region']) {
            Response::error('FORBIDDEN', 'You can only access community chat for LGAs in your own region.', 403);
        }
    }

    private function formatMessage(array $msg): array {
        $reactions = json_decode($msg['reactions'] ?? '{}', true) ?: [];
        $replyTo   = $msg['reply_to'] ? json_decode($msg['reply_to'], true) : null;
        // Ensure timestamp is in ISO 8601 format with timezone
        $createdAt = $msg['created_at'] ? date('c', strtotime($msg['created_at'])) : null;

        return [
            'id'        => (int) $msg['id'],
            'lgaId'     => (int) $msg['lga_id'],
            'userId'    => (int) $msg['user_id'],
            'userName'  => $msg['resolved_user_name'] ?? $msg['user_name'],
            'avatarUrl' => $msg['resolved_avatar_url'] ?? $msg['avatar_url'],
            'text'      => $msg['text'],
            'mediaUrl'  => $msg['media_url'],
            'fileUrl'   => $msg['file_url'],
            'fileName'  => $msg['file_name'],
            'fileSize'  => $msg['file_size'],
            'reactions' => empty($reactions) ? (object)[] : $reactions,
            'replyTo'   => $replyTo,
            'createdAt' => $createdAt,
        ];
    }
}