<?php

class AdminChatController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/chat/lgas ─────────────────────────────────────────────

    public function getLgas(): void {
        $this->requireAdmin();

        $region = trim($_GET['region'] ?? '');
        $regionWhere = '';
        $regionParams = [];
        if ($region && in_array($region, ['west', 'central', 'east'], true)) {
            $regionWhere = 'WHERE l.region = ?';
            $regionParams[] = $region;
        }

        $stmt = $this->db->prepare("
            SELECT
                l.id,
                l.name,
                COUNT(DISTINCT m.id)                                           AS message_count,
                MAX(m.created_at)                                              AS last_message_at,
                (SELECT m2.user_name FROM lga_chat_messages m2
                 WHERE m2.lga_id = l.id ORDER BY m2.created_at DESC LIMIT 1)  AS last_sender,
                (SELECT m2.text FROM lga_chat_messages m2
                 WHERE m2.lga_id = l.id ORDER BY m2.created_at DESC LIMIT 1)  AS last_text,
                COUNT(DISTINCT u.id)                                           AS member_count,
                COUNT(DISTINCT CASE WHEN cr.status = \"pending\" THEN cr.id END) AS pending_reports
            FROM lgas l
            LEFT JOIN lga_chat_messages m ON m.lga_id = l.id
            LEFT JOIN users u ON u.lga_id = l.id AND u.role = \"citizen\" AND u.is_verified = 1
            LEFT JOIN chat_reports cr ON cr.message_id = m.id
            {$regionWhere}
            GROUP BY l.id, l.name
            ORDER BY last_message_at DESC, l.name ASC
        ");
        $stmt->execute($regionParams);

        $lgas = array_map(fn($r) => [
            'id'             => (int) $r['id'],
            'name'           => $r['name'],
            'messageCount'   => (int) $r['message_count'],
            'memberCount'    => (int) $r['member_count'],
            'lastMessageAt'  => $r['last_message_at'],
            'lastSender'     => $r['last_sender'],
            'lastText'       => $r['last_text'],
            'pendingReports' => (int) $r['pending_reports'],
        ], $stmt->fetchAll());

        Response::json($lgas);
    }

    // ── GET /admin/chat/stats ─────────────────────────────────────────────

    public function getStats(): void {
        $this->requireAdmin();

        $region = trim($_GET['region'] ?? '');
        $hasRegion = $region && in_array($region, ['west', 'central', 'east'], true);

        if ($hasRegion) {
            $lgaStmt = $this->db->prepare('SELECT COUNT(*) FROM lgas WHERE region = ?');
            $lgaStmt->execute([$region]);
            $lgaCount = (int) $lgaStmt->fetchColumn();

            $userStmt = $this->db->prepare(
                'SELECT COUNT(*) FROM users WHERE role = "citizen" AND is_verified = 1
                 AND lga_id IN (SELECT id FROM lgas WHERE region = ?)'
            );
            $userStmt->execute([$region]);
            $userCount = (int) $userStmt->fetchColumn();

            $pendingStmt = $this->db->prepare(
                'SELECT COUNT(*) FROM chat_reports cr
                 JOIN lga_chat_messages m ON m.id = cr.message_id
                 WHERE cr.status = "pending" AND m.lga_id IN (SELECT id FROM lgas WHERE region = ?)'
            );
            $pendingStmt->execute([$region]);
            $pendingReports = (int) $pendingStmt->fetchColumn();

            $totalStmt = $this->db->prepare(
                'SELECT COUNT(*) FROM chat_reports cr
                 JOIN lga_chat_messages m ON m.id = cr.message_id
                 WHERE m.lga_id IN (SELECT id FROM lgas WHERE region = ?)'
            );
            $totalStmt->execute([$region]);
            $totalReports = (int) $totalStmt->fetchColumn();
        } else {
            $lgaCount = (int) $this->db->query('SELECT COUNT(*) FROM lgas')->fetchColumn();

            $userCount = (int) $this->db->query(
                'SELECT COUNT(*) FROM users WHERE role = "citizen" AND is_verified = 1'
            )->fetchColumn();

            $pendingReports = (int) $this->db->query(
                'SELECT COUNT(*) FROM chat_reports WHERE status = "pending"'
            )->fetchColumn();

            $totalReports = (int) $this->db->query(
                'SELECT COUNT(*) FROM chat_reports'
            )->fetchColumn();
        }

        Response::json([
            'activeLgas'     => $lgaCount,
            'totalUsers'     => $userCount,
            'pendingReports' => $pendingReports,
            'totalReports'   => $totalReports,
        ]);
    }

    // ── GET /admin/chat/reports ───────────────────────────────────────────

    public function getReports(): void {
        $this->requireAdmin();

        $status = $_GET['status'] ?? 'pending';
        $p      = Paginator::params($_GET, 50);

        $countStmt = $this->db->prepare('SELECT COUNT(*) FROM chat_reports WHERE status = ?');
        $countStmt->execute([$status]);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare('
            SELECT
                cr.id,
                cr.message_id,
                cr.reason,
                cr.status,
                cr.resolution,
                cr.resolution_note,
                cr.resolved_at,
                cr.created_at,
                m.lga_id,
                m.text          AS message_text,
                m.file_url      AS message_file_url,
                m.user_id       AS sender_id,
                m.user_name     AS sender_name,
                m.avatar_url    AS sender_avatar,
                u.name          AS reporter_name,
                l.name          AS lga_name
            FROM chat_reports cr
            LEFT JOIN lga_chat_messages m ON m.id = cr.message_id
            LEFT JOIN users u             ON u.id = cr.reporter_id
            LEFT JOIN lgas l              ON l.id = m.lga_id
            WHERE cr.status = ?
            ORDER BY cr.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$status, $p['limit'], $p['offset']]);

        $items = array_map(fn($r) => [
            'id'              => (int) $r['id'],
            'messageId'       => (int) $r['message_id'],
            'lgaId'           => (int) $r['lga_id'],
            'lgaName'         => $r['lga_name'],
            'reason'          => $r['reason'],
            'status'          => $r['status'],
            'resolution'      => $r['resolution'],
            'resolutionNote'  => $r['resolution_note'],
            'resolvedAt'      => $r['resolved_at'],
            'createdAt'       => $r['created_at'],
            'messageText'     => $r['message_text'],
            'messageFileUrl'  => $r['message_file_url'],
            'senderId'        => (int) $r['sender_id'],
            'senderName'      => $r['sender_name'],
            'senderAvatar'    => $r['sender_avatar'],
            'reporterName'    => $r['reporter_name'],
        ], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── POST /admin/chat/reports/:id/resolve ──────────────────────────────

    public function resolveReport(int $id): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $resolution = $body['resolution'] ?? '';
        if (!in_array($resolution, ['warned', 'deleted', 'dismissed'], true)) {
            Response::error('VALIDATION_ERROR', 'resolution must be warned, deleted, or dismissed.', 422);
        }
        $note = trim($body['note'] ?? '');

        $stmt = $this->db->prepare('
            SELECT cr.*, m.user_id AS sender_id
            FROM chat_reports cr
            JOIN lga_chat_messages m ON m.id = cr.message_id
            WHERE cr.id = ?
        ');
        $stmt->execute([$id]);
        $report = $stmt->fetch();
        if (!$report) {
            Response::error('NOT_FOUND', 'Report not found.', 404);
        }
        if ($report['status'] === 'resolved') {
            Response::error('ALREADY_RESOLVED', 'This report is already resolved.', 409);
        }

        // Perform the resolution action
        if ($resolution === 'deleted') {
            // Soft-delete: null out content so the row persists for FK integrity
            // (chat_reports JOINs to this row; hard-delete orphans the report)
            $this->db->prepare('
                UPDATE lga_chat_messages
                SET text = NULL, media_url = NULL, file_url = NULL, file_name = NULL, file_size = NULL
                WHERE id = ?
            ')->execute([$report['message_id']]);
        } elseif ($resolution === 'warned') {
            $userStmt = $this->db->prepare('SELECT id, name FROM users WHERE id = ?');
            $userStmt->execute([$report['sender_id'] ?? 0]);
            $user = $userStmt->fetch();
            if ($user) {
                $warnBody = $note
                    ? "You have received a warning from a community moderator: \"{$note}\""
                    : 'You have received a warning for a reported message that violated community guidelines.';
                $this->db->prepare('
                    INSERT INTO notifications
                        (user_id, category, priority, title, body, link_to, is_read, created_at)
                    VALUES (?, "Security Alert", "high", "Community guidelines warning", ?, "/chat", 0, NOW())
                ')->execute([$user['id'], $warnBody]);
            }
        }

        $this->db->prepare('
            UPDATE chat_reports
            SET status = "resolved", resolution = ?, resolution_note = ?,
                resolved_by = ?, resolved_at = NOW()
            WHERE id = ?
        ')->execute([$resolution, $note ?: null, $auth['adminId'], $id]);

        Response::json(['resolved' => true, 'resolution' => $resolution]);
    }

    // ── GET /admin/chat/messages?lgaId=X ─────────────────────────────────

    public function getMessages(): void {
        $this->requireAdmin();

        $lgaId = (int) ($_GET['lgaId'] ?? 0);
        if (!$lgaId) {
            Response::error('VALIDATION_ERROR', 'lgaId is required.', 422);
        }

        $p = Paginator::params($_GET, 100);

        $countStmt = $this->db->prepare('SELECT COUNT(*) FROM lga_chat_messages WHERE lga_id = ?');
        $countStmt->execute([$lgaId]);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare('
            SELECT
                m.*,
                (SELECT COUNT(*) FROM chat_reports cr
                 WHERE cr.message_id = m.id AND cr.status = "pending") AS report_count,
                (SELECT cr2.id FROM chat_reports cr2
                 WHERE cr2.message_id = m.id AND cr2.status = "pending"
                 LIMIT 1) AS report_id
            FROM lga_chat_messages m
            WHERE m.lga_id = ?
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$lgaId, $p['limit'], $p['offset']]);

        $items = array_map([$this, 'formatMessage'], $stmt->fetchAll());
        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── DELETE /admin/chat/messages/:id ──────────────────────────────────

    public function deleteMessage(int $id): void {
        $this->requireAdmin();

        $stmt = $this->db->prepare('SELECT id FROM lga_chat_messages WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            Response::error('NOT_FOUND', 'Message not found.', 404);
        }

        $this->db->prepare('DELETE FROM lga_chat_messages WHERE id = ?')->execute([$id]);
        Response::json(['deleted' => true]);
    }

    // ── DELETE /admin/chat/lgas/:lgaId/messages ───────────────────────────
    // Purges one community's chat history while retaining the LGA itself.
    // Reports and read markers are removed first so the operation remains
    // consistent even when older installations have FK constraints enabled.
    public function clearMessages(int $lgaId): void {
        $this->requireAdmin();

        if ($lgaId <= 0) {
            Response::error('VALIDATION_ERROR', 'A valid LGA is required.', 422);
        }

        $lgaStmt = $this->db->prepare('SELECT id, name FROM lgas WHERE id = ?');
        $lgaStmt->execute([$lgaId]);
        $lga = $lgaStmt->fetch();
        if (!$lga) {
            Response::error('NOT_FOUND', 'LGA not found.', 404);
        }

        $countStmt = $this->db->prepare('SELECT COUNT(*) FROM lga_chat_messages WHERE lga_id = ?');
        $countStmt->execute([$lgaId]);
        $messageCount = (int) $countStmt->fetchColumn();

        $this->db->beginTransaction();
        try {
            $this->db->prepare('
                DELETE cr
                FROM chat_reports cr
                INNER JOIN lga_chat_messages m ON m.id = cr.message_id
                WHERE m.lga_id = ?
            ')->execute([$lgaId]);

            $this->db->prepare('DELETE FROM chat_last_read WHERE lga_id = ?')->execute([$lgaId]);
            $this->db->prepare('DELETE FROM lga_chat_messages WHERE lga_id = ?')->execute([$lgaId]);
            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $e;
        }

        Response::json([
            'cleared' => true,
            'lgaId' => $lgaId,
            'lgaName' => $lga['name'],
            'deletedMessages' => $messageCount,
        ]);
    }

    // ── POST /admin/chat/messages ─────────────────────────────────────────

    public function sendMessage(): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $lgaId    = (int) ($body['lgaId'] ?? 0);
        $text     = trim($body['text'] ?? '');
        $replyTo  = $body['replyTo'] ?? null;
        $fileUrl  = trim($body['fileUrl']  ?? '');
        $fileName = trim($body['fileName'] ?? '');
        $fileSize = isset($body['fileSize']) ? (int) $body['fileSize'] : null;

        // At least one of text or file is required
        if (!$lgaId || (!$text && !$fileUrl)) {
            Response::error('VALIDATION_ERROR', 'lgaId and either text or fileUrl are required.', 422);
        }

        $adminStmt = $this->db->prepare('SELECT name, avatar_url FROM admins WHERE id = ?');
        $adminStmt->execute([$auth['adminId']]);
        $admin = $adminStmt->fetch();
        if (!$admin) {
            Response::error('NOT_FOUND', 'Admin not found.', 404);
        }

        $adminName   = $admin['name'] . ' (Admin)';
        $replyToJson = $replyTo ? json_encode($replyTo, JSON_UNESCAPED_UNICODE) : null;

        $stmt = $this->db->prepare('
            INSERT INTO lga_chat_messages
                (lga_id, user_id, user_name, avatar_url, text, file_url, file_name, file_size,
                 reactions, reply_to, created_at)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, "{}", ?, NOW())
        ');
        $stmt->execute([
            $lgaId, $adminName, $admin['avatar_url'],
            $text ?: null,
            $fileUrl  ?: null,
            $fileName ?: null,
            $fileSize ?: null,
            $replyToJson,
        ]);

        $msgId = (int) $this->db->lastInsertId();
        $msgStmt = $this->db->prepare('SELECT * FROM lga_chat_messages WHERE id = ?');
        $msgStmt->execute([$msgId]);

        Response::json($this->formatMessage($msgStmt->fetch()), 201);
    }

    // ── POST /admin/chat/upload ───────────────────────────────────────────

    public function uploadFile(): void {
        $this->requireAdmin();

        if (empty($_FILES['file'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "file".', 422);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        // Max 25 MB for admins
        if ($file['size'] > 25 * 1024 * 1024) {
            Response::error('VALIDATION_ERROR', 'File size must not exceed 25 MB.', 422);
        }

        $mime = mime_content_type($file['tmp_name']);
        $allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'video/mp4', 'video/webm', 'video/quicktime',
            'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
        ];
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'File type not allowed.', 422);
        }

        $isImage = str_starts_with($mime, 'image/');
        $subDir  = $isImage ? 'images' : 'files';

        $mimeExt = [
            'image/jpeg'       => 'jpg',  'image/png'   => 'png',
            'image/gif'        => 'gif',  'image/webp'  => 'webp',
            'application/pdf'  => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'video/mp4'        => 'mp4',  'video/webm'     => 'webm', 'video/quicktime' => 'mov',
            'audio/mpeg'       => 'mp3',  'audio/ogg'      => 'ogg',
            'audio/wav'        => 'wav',  'audio/webm'     => 'webm',
        ];
        $extSafe  = $mimeExt[$mime] ?? 'bin';
        $safeName = bin2hex(random_bytes(12)) . '.' . $extSafe;
        $uploadDir = __DIR__ . "/../uploads/chat/{$subDir}/";
        $destPath  = $uploadDir . $safeName;

        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Response::error('UPLOAD_ERROR', 'Could not save file.', 500);
        }

        $base      = rtrim(getenv('BASE_URL') ?: '', '/');
        $serverBase = preg_replace('#/api/v1$#', '', $base);
        $fileUrl   = $serverBase . '/uploads/chat/' . $subDir . '/' . $safeName;

        Response::json([
            'url'      => $fileUrl,
            'fileName' => $file['name'],
            'fileSize' => $file['size'],
            'mimeType' => $mime,
            'isImage'  => $isImage,
        ], 201);
    }

    // ── POST /admin/chat/messages/:id/flag ────────────────────────────────

    public function flagMessage(int $msgId): void {
        $auth = $this->requireAdmin();

        $msgStmt = $this->db->prepare('SELECT id FROM lga_chat_messages WHERE id = ?');
        $msgStmt->execute([$msgId]);
        if (!$msgStmt->fetch()) {
            Response::error('NOT_FOUND', 'Message not found.', 404);
        }

        // Insert a system report with reason 'admin-flagged' if not already flagged
        $existing = $this->db->prepare(
            'SELECT id FROM chat_message_reports WHERE message_id = ? AND reason = "admin-flagged"'
        );
        $existing->execute([$msgId]);
        if (!$existing->fetch()) {
            $this->db->prepare(
                'INSERT INTO chat_message_reports (message_id, reported_by_admin_id, reason, status, created_at)
                 VALUES (?, ?, "admin-flagged", "pending", NOW())'
            )->execute([$msgId, $auth['adminId']]);
        }

        Response::json(['flagged' => true]);
    }

    // ── POST /admin/chat/warn/:userId ─────────────────────────────────────

    public function warnUser(int $userId): void {
        $this->requireAdmin();
        $body   = Validator::jsonBody() ?? [];
        $reason = trim($body['reason'] ?? '');

        $stmt = $this->db->prepare('SELECT id, name FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('NOT_FOUND', 'User not found.', 404);
        }

        $title = 'Community guidelines warning';
        $body_text = $reason
            ? "You have received a warning from a community moderator: \"{$reason}\""
            : 'You have received a warning for violating community guidelines. Further violations may result in account suspension.';

        $this->db->prepare('
            INSERT INTO notifications
                (user_id, category, priority, title, body, link_to, is_read, created_at)
            VALUES (?, "Security Alert", "high", ?, ?, "/chat", 0, NOW())
        ')->execute([$userId, $title, $body_text]);

        Response::json(['warned' => true]);
    }

    // ── GET /admin/chat/members?lgaId=X ──────────────────────────────────

    public function getMembers(): void {
        $this->requireAdmin();

        $lgaId = (int) ($_GET['lgaId'] ?? 0);
        if (!$lgaId) {
            Response::error('VALIDATION_ERROR', 'lgaId is required.', 422);
        }

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

    // ── GET /admin/chat/banned-words ──────────────────────────────────────

    public function getBannedWords(): void {
        $this->requireAdmin();

        $stmt = $this->db->query('SELECT id, word, created_at FROM banned_words ORDER BY word ASC');
        $words = array_map(fn($r) => [
            'id'        => (int) $r['id'],
            'word'      => $r['word'],
            'createdAt' => $r['created_at'],
        ], $stmt->fetchAll());

        Response::json($words);
    }

    // ── POST /admin/chat/banned-words ─────────────────────────────────────

    public function addBannedWord(): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];
        $word = strtolower(trim($body['word'] ?? ''));

        if (!$word) {
            Response::error('VALIDATION_ERROR', 'word is required.', 422);
        }
        if (mb_strlen($word) > 100) {
            Response::error('VALIDATION_ERROR', 'Word must be 100 characters or fewer.', 422);
        }

        try {
            $this->db->prepare('INSERT INTO banned_words (word) VALUES (?)')->execute([$word]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error('DUPLICATE', 'This word is already in the list.', 409);
            }
            throw $e;
        }

        $id = (int) $this->db->lastInsertId();
        Response::json(['id' => $id, 'word' => $word], 201);
    }

    // ── DELETE /admin/chat/banned-words/:id ───────────────────────────────

    public function deleteBannedWord(int $id): void {
        $this->requireAdmin();

        $stmt = $this->db->prepare('SELECT id FROM banned_words WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            Response::error('NOT_FOUND', 'Word not found.', 404);
        }

        $this->db->prepare('DELETE FROM banned_words WHERE id = ?')->execute([$id]);
        Response::json(['deleted' => true]);
    }

    // ── Private helpers ──────────────────────────────────────────────────

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

    // ── POST /admin/chat/messages/:id/reactions ───────────────────────────

    public function toggleReaction(int $messageId): void {
        $auth   = $this->requireAdmin();
        // Negative adminId avoids collision with citizen user IDs in the reactions JSON
        $userId = -(int)$auth['adminId'];
        $body   = Validator::jsonBody() ?? [];
        $emoji  = $body['emoji'] ?? '';

        if (!$emoji) {
            Response::error('VALIDATION_ERROR', 'emoji is required.', 422);
        }

        $stmt = $this->db->prepare('SELECT reactions, user_id, text FROM lga_chat_messages WHERE id = ?');
        $stmt->execute([$messageId]);
        $msg = $stmt->fetch();
        if (!$msg) {
            Response::error('NOT_FOUND', 'Message not found.', 404);
        }

        $reactions = json_decode($msg['reactions'] ?? '{}', true) ?: [];

        foreach ($reactions as $existingEmoji => &$users) {
            if ($existingEmoji === $emoji) continue;
            $idx = array_search($userId, $users);
            if ($idx !== false) {
                array_splice($users, $idx, 1);
                if (empty($users)) unset($reactions[$existingEmoji]);
            }
        }
        unset($users);

        if (!isset($reactions[$emoji])) $reactions[$emoji] = [];

        $existing = array_search($userId, $reactions[$emoji]);
        if ($existing !== false) {
            array_splice($reactions[$emoji], $existing, 1);
            if (empty($reactions[$emoji])) unset($reactions[$emoji]);
        } else {
            $reactions[$emoji][] = $userId;
        }

        $this->db->prepare('UPDATE lga_chat_messages SET reactions = ? WHERE id = ?')
            ->execute([json_encode($reactions ?: new stdClass(), JSON_UNESCAPED_UNICODE), $messageId]);

        // Notify the message author (citizen only) when admin adds a reaction
        if ($existing === false && $msg['user_id'] !== null) {
            $adminStmt = $this->db->prepare('SELECT name FROM admins WHERE id = ?');
            $adminStmt->execute([$auth['adminId']]);
            $adminRow    = $adminStmt->fetch();
            $reactorName = ($adminRow['name'] ?? 'Admin') . ' (Admin)';

            $preview = mb_strlen($msg['text'] ?? '') > 60
                ? mb_substr($msg['text'], 0, 57) . '...'
                : ($msg['text'] ?? 'your message');

            $this->db->prepare('
                INSERT INTO notifications
                    (user_id, category, priority, title, body, actor_name, link_to, is_read, created_at)
                VALUES (?, "Community", "normal", ?, ?, ?, "/chat", 0, NOW())
            ')->execute([
                (int)$msg['user_id'],
                "{$reactorName} reacted to your message",
                "{$reactorName} reacted {$emoji} to: \"{$preview}\"",
                $reactorName,
            ]);
        }

        Response::json(['reactions' => $reactions]);
    }

    private function formatMessage(array $msg): array {
        $reactions = json_decode($msg['reactions'] ?? '{}', true) ?: [];
        $replyTo   = isset($msg['reply_to']) && $msg['reply_to']
            ? json_decode($msg['reply_to'], true)
            : null;

        return [
            'id'           => (int) $msg['id'],
            'lgaId'        => (int) $msg['lga_id'],
            'userId'       => isset($msg['user_id']) ? (int) $msg['user_id'] : null,
            'userName'     => $msg['user_name'],
            'avatarUrl'    => $msg['avatar_url'],
            'text'         => $msg['text'],
            'mediaUrl'     => $msg['media_url'] ?? null,
            'fileUrl'      => $msg['file_url'] ?? null,
            'fileName'     => $msg['file_name'] ?? null,
            'fileSize'     => $msg['file_size'] ?? null,
            'reactions'    => empty($reactions) ? (object)[] : $reactions,
            'replyTo'      => $replyTo,
            'createdAt'    => $msg['created_at'],
            'reportCount'  => (int) ($msg['report_count'] ?? 0),
            'reportId'     => isset($msg['report_id']) ? (int) $msg['report_id'] : null,
        ];
    }
}
