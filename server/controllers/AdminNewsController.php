<?php

/**
 * KTG Connect — Admin News Controller
 * ============================================================
 * Endpoints:
 *   GET    /admin/news                    — paginated list with filters
 *   GET    /admin/news/metrics            — stat cards data
 *   GET    /admin/news/:id                — single article
 *   POST   /admin/news                    — create article
 *   PATCH  /admin/news/:id                — update article
 *   DELETE /admin/news/:id                — delete article
 *   PATCH  /admin/news/:id/publish        — publish immediately
 *   PATCH  /admin/news/:id/headline       — set as headline (unsets previous)
 *   POST   /admin/news/reach              — estimate reach for LGA selection
 *   GET    /cron/publish-scheduled        — publish due scheduled articles (cron)
 */
class AdminNewsController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/news ───────────────────────────────────────────────────

    public function list(): void {
        $this->requireAdmin();
        $p      = Paginator::params($_GET, 10);
        $status = trim($_GET['status'] ?? '');
        $search = trim($_GET['search'] ?? '');
        $tab    = trim($_GET['tab']    ?? 'all'); // all | featured | archived

        $where  = ['1=1'];
        $params = [];

        if ($status) {
            $where[]  = 'n.status = ?';
            $params[] = $status;
        }

        if ($search) {
            $where[]  = '(n.title LIKE ? OR n.source_name LIKE ?)';
            $like     = "%{$search}%";
            $params[] = $like;
            $params[] = $like;
        }

        if ($tab === 'published') {
            $where[]  = 'n.status = "published"';
        } elseif ($tab === 'paused') {
            $where[]  = 'n.status = "paused"';
        }

        $whereStr = implode(' AND ', $where);

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM news n WHERE {$whereStr}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT n.*, a.name AS author_name
            FROM news n
            LEFT JOIN admins a ON a.id = n.author_id
            WHERE {$whereStr}
            ORDER BY n.created_at DESC            LIMIT ? OFFSET ?
        ");
        $stmt->execute([...$params, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /admin/news/metrics ───────────────────────────────────────────

    public function metrics(): void {
        $this->requireAdmin();

        $total = (int) $this->db->query(
            'SELECT COUNT(*) FROM news WHERE status = "published"'
        )->fetchColumn();

        $pending = (int) $this->db->query(
            'SELECT COUNT(*) FROM news WHERE status IN ("draft","scheduled")'
        )->fetchColumn();

        $paused = (int) $this->db->query(
            'SELECT COUNT(*) FROM news WHERE status = "paused"'
        )->fetchColumn();

        $avgViews = (float) $this->db->query(
            'SELECT AVG(views) FROM news WHERE status = "published"'
        )->fetchColumn();

        // Health index: ratio of published to total articles (mock-style)
        $allCount = (int) $this->db->query('SELECT COUNT(*) FROM news')->fetchColumn();
        $healthIndex = $allCount > 0 ? round(($total / $allCount) * 100, 1) : 0;

        Response::json([
            'totalPublished' => $total,
            'pendingCount'   => $pending,
            'pausedCount'    => $paused,
            'avgViews'       => round($avgViews),
            'healthIndex'    => $healthIndex,
        ]);
    }

    // ── GET /admin/news/:id ───────────────────────────────────────────────

    public function getById(int $id): void {
        $this->requireAdmin();
        $stmt = $this->db->prepare('
            SELECT n.*, a.name AS author_name
            FROM news n LEFT JOIN admins a ON a.id = n.author_id
            WHERE n.id = ?
        ');
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        if (!$item) Response::error('NOT_FOUND', 'Article not found.', 404);

        // Fetch LGA targets
        $lgaStmt = $this->db->prepare('
            SELECT l.id, l.name FROM news_lga_targets nlt
            JOIN lgas l ON l.id = nlt.lga_id
            WHERE nlt.news_id = ?
        ');
        $lgaStmt->execute([$id]);
        $item['lga_targets'] = $lgaStmt->fetchAll();

        Response::json($this->format($item));
    }

    // ── POST /admin/news ──────────────────────────────────────────────────

    public function create(): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $this->validateBody($body);

        $slug = $this->generateSlug($body['title']);

        // Handle LGA targeting
        $targetAll = (bool) ($body['targetAllLgas'] ?? false);
        $lgaIds    = $body['lgaIds'] ?? [];

        $scheduledAt = $body['scheduledAt'] ?? null;
        $status      = $scheduledAt ? 'scheduled' : ($body['status'] ?? 'draft');
        $publishedAt = ($status === 'published') ? date('Y-m-d H:i:s') : null;

        $stmt = $this->db->prepare('
            INSERT INTO news (
                slug, title, summary, body, image_url,
                category, breaking, is_headline,
                target_all_lgas, lga_id, lga_name,
                source_name, source_url,
                delivery_push, delivery_sms, delivery_email,
                status, scheduled_at, published_at,
                author_id, views, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, 0, NOW(), NOW()
            )
        ');

        $stmt->execute([
            $slug,
            trim($body['title']),
            trim($body['summary']  ?? ''),
            trim($body['body']     ?? ''),
            $body['imageUrl']      ?? null,
            $body['category']      ?? 'General',
            (bool) ($body['breaking']   ?? false) ? 1 : 0,
            (bool) ($body['isHeadline'] ?? false) ? 1 : 0,
            $targetAll ? 1 : 0,
            !$targetAll && count($lgaIds) === 1 ? (int) $lgaIds[0] : null,
            !$targetAll && count($lgaIds) === 1 ? $this->lgaName((int) $lgaIds[0]) : null,
            $body['sourceName'] ?? null,
            $body['sourceUrl']  ?? null,
            (bool) ($body['deliveryPush']  ?? true)  ? 1 : 0,
            (bool) ($body['deliverySms']   ?? false) ? 1 : 0,
            (bool) ($body['deliveryEmail'] ?? false) ? 1 : 0,
            $status,
            $scheduledAt,
            $publishedAt,
            $auth['adminId'],
        ]);

        $newId = (int) $this->db->lastInsertId();

        // Insert LGA junction rows
        if (!$targetAll && count($lgaIds) > 0) {
            $this->syncLgaTargets($newId, $lgaIds);
        }

        // Unset previous headline if this is marked headline
        if (!empty($body['isHeadline'])) {
            $this->db->prepare(
                'UPDATE news SET is_headline = 0 WHERE id != ? AND is_headline = 1'
            )->execute([$newId]);
        }

        $item = $this->fetchFull($newId);
        Response::json($this->format($item), 201);
    }

    // ── PATCH /admin/news/:id ─────────────────────────────────────────────

    public function update(int $id): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $stmt = $this->db->prepare('SELECT * FROM news WHERE id = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) Response::error('NOT_FOUND', 'Article not found.', 404);

        $fields = [];
        $values = [];

        $stringFields = [
            'title' => 'title', 'summary' => 'summary', 'body' => 'body',
            'imageUrl' => 'image_url', 'category' => 'category',
            'sourceName' => 'source_name', 'sourceUrl' => 'source_url',
        ];

        foreach ($stringFields as $key => $col) {
            if (array_key_exists($key, $body)) {
                $fields[] = "{$col} = ?";
                $values[] = $body[$key];
            }
        }

        if (array_key_exists('breaking', $body)) {
            $fields[] = 'breaking = ?';
            $values[] = $body['breaking'] ? 1 : 0;
        }

        if (array_key_exists('isHeadline', $body)) {
            $fields[] = 'is_headline = ?';
            $values[] = $body['isHeadline'] ? 1 : 0;
            if ($body['isHeadline']) {
                $this->db->prepare('UPDATE news SET is_headline = 0 WHERE id != ?')->execute([$id]);
            }
        }

        if (array_key_exists('deliveryPush', $body)) {
            $fields[] = 'delivery_push = ?'; $values[] = $body['deliveryPush'] ? 1 : 0;
        }
        if (array_key_exists('deliverySms', $body)) {
            $fields[] = 'delivery_sms = ?'; $values[] = $body['deliverySms'] ? 1 : 0;
        }
        if (array_key_exists('deliveryEmail', $body)) {
            $fields[] = 'delivery_email = ?'; $values[] = $body['deliveryEmail'] ? 1 : 0;
        }

        if (array_key_exists('scheduledAt', $body)) {
            $fields[] = 'scheduled_at = ?';
            $values[] = $body['scheduledAt'];
            if ($body['scheduledAt'] && $existing['status'] !== 'published') {
                $fields[] = 'status = ?';
                $values[] = 'scheduled';
            }
        }

        if (array_key_exists('status', $body)) {
            $fields[] = 'status = ?';
            $values[] = $body['status'];
            if ($body['status'] === 'published' && !$existing['published_at']) {
                $fields[] = 'published_at = NOW()';
            }
        }

        if (array_key_exists('targetAllLgas', $body)) {
            $fields[] = 'target_all_lgas = ?';
            $values[] = $body['targetAllLgas'] ? 1 : 0;
        }

        if (array_key_exists('title', $body)) {
            $fields[] = 'slug = ?';
            $values[] = $this->generateSlug($body['title'], $id);
        }

        if (!empty($fields)) {
            $fields[]  = 'updated_at = NOW()';
            $values[]  = $id;
            $this->db->prepare('UPDATE news SET ' . implode(', ', $fields) . ' WHERE id = ?')
                     ->execute($values);
        }

        // Sync LGA targets
        if (array_key_exists('lgaIds', $body)) {
            $this->db->prepare('DELETE FROM news_lga_targets WHERE news_id = ?')->execute([$id]);
            if (!empty($body['lgaIds'])) {
                $this->syncLgaTargets($id, $body['lgaIds']);
            }
        }

        $item = $this->fetchFull($id);
        Response::json($this->format($item));
    }

    // ── DELETE /admin/news/:id ────────────────────────────────────────────

    public function delete(int $id): void {
        $this->requireAdmin();
        $stmt = $this->db->prepare('SELECT id FROM news WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) Response::error('NOT_FOUND', 'Article not found.', 404);

        $this->db->prepare('DELETE FROM news_lga_targets WHERE news_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM news WHERE id = ?')->execute([$id]);
        Response::json(['deleted' => true]);
    }

    // ── PATCH /admin/news/:id/pause ───────────────────────────────────────
    // Toggles between published and paused. Paused articles are hidden
    // from the citizen feed without being deleted.

    public function togglePause(int $id): void {
        $this->requireAdmin();

        $stmt = $this->db->prepare('SELECT id, status FROM news WHERE id = ?');
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        if (!$item) Response::error('NOT_FOUND', 'Article not found.', 404);

        $newStatus = $item['status'] === 'paused' ? 'published' : 'paused';

        $this->db->prepare('UPDATE news SET status = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$newStatus, $id]);

        Response::json(['id' => $id, 'status' => $newStatus]);
    }

    // ── PATCH /admin/news/:id/publish ─────────────────────────────────────

    public function publish(int $id): void {
        $this->requireAdmin();
        $stmt = $this->db->prepare('SELECT * FROM news WHERE id = ?');
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        if (!$item) Response::error('NOT_FOUND', 'Article not found.', 404);

        $this->db->prepare('
            UPDATE news SET status = "published",
            published_at = COALESCE(published_at, NOW()),
            scheduled_at = NULL, updated_at = NOW()
            WHERE id = ?
        ')->execute([$id]);

        // Dispatch delivery channels (stubbed until services are live)
        $this->dispatchDelivery($item);

        Response::json($this->format($this->fetchFull($id)));
    }

    // ── PATCH /admin/news/:id/headline ────────────────────────────────────

    public function setHeadline(int $id): void {
        $this->requireAdmin();
        // Unset all others, set this one
        $this->db->prepare('UPDATE news SET is_headline = 0')->execute();
        $this->db->prepare('UPDATE news SET is_headline = 1, updated_at = NOW() WHERE id = ?')
                 ->execute([$id]);
        Response::json(['headline' => true, 'id' => $id]);
    }

    // ── POST /admin/news/reach ────────────────────────────────────────────
    // Estimate reach for selected LGAs

    public function estimateReach(): void {
        $this->requireAdmin();
        $body  = Validator::jsonBody() ?? [];
        $lgaIds = $body['lgaIds'] ?? [];
        $targetAll = (bool) ($body['targetAllLgas'] ?? false);

        if ($targetAll) {
            $count = (int) $this->db->query(
                'SELECT COUNT(*) FROM users WHERE role = "citizen" AND status = "active"'
            )->fetchColumn();
        } elseif (empty($lgaIds)) {
            $count = 0;
        } else {
            $placeholders = implode(',', array_fill(0, count($lgaIds), '?'));
            $stmt = $this->db->prepare(
                "SELECT COUNT(*) FROM users WHERE role = 'citizen' AND status = 'active' AND lga_id IN ({$placeholders})"
            );
            $stmt->execute($lgaIds);
            $count = (int) $stmt->fetchColumn();
        }

        Response::json(['reach' => $count]);
    }

    // ── GET /cron/publish-scheduled ───────────────────────────────────────
    // Called by cPanel cron every 5 minutes.
    // Protected by CRON_SECRET in config.

    public function publishScheduled(): void {
        $secret = $_GET['secret'] ?? '';
        if (!defined('CRON_SECRET') || $secret !== CRON_SECRET) {
            Response::error('FORBIDDEN', 'Invalid cron secret.', 403);
        }

        $stmt = $this->db->query('
            SELECT * FROM news
            WHERE status = "scheduled"
              AND scheduled_at IS NOT NULL
              AND scheduled_at <= NOW()
        ');
        $due = $stmt->fetchAll();

        $published = 0;
        foreach ($due as $item) {
            $this->db->prepare('
                UPDATE news
                SET status = "published",
                    published_at = COALESCE(published_at, NOW()),
                    scheduled_at = NULL,
                    updated_at = NOW()
                WHERE id = ?
            ')->execute([$item['id']]);

            $this->dispatchDelivery($item);
            $published++;
        }

        Response::json(['published' => $published, 'checkedAt' => date('Y-m-d H:i:s')]);
    }

    // ── Private: delivery stub ────────────────────────────────────────────
    // Logs delivery intent. Wire to Termii/Resend when credentials arrive.

    // ── POST /admin/news/upload-image ─────────────────────────────────────
    // Accepts multipart image, uploads to Cloudinary, returns secure_url.
    // Called by the frontend before create/update to get the image URL.

    public function uploadImage(): void {
        $this->requireAdmin();

        if (empty($_FILES['image'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "image".', 422);
        }

        $file = $_FILES['image'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        $mime = mime_content_type($file['tmp_name']);
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'Only JPEG, PNG or WebP images are allowed.', 422);
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            Response::error('VALIDATION_ERROR', 'Image must not exceed 5MB.', 422);
        }

        try {
            $mime = mime_content_type($file['tmp_name']);
            $ext  = S3::mimeToExt($mime);
            $key  = S3::makeKey('news', $ext);
            $url  = S3::upload($file['tmp_name'], $key, $mime);
            Response::json(['url' => $url, 'publicId' => $key]);
        } catch (RuntimeException $e) {
            Response::error('UPLOAD_ERROR', $e->getMessage(), 500);
        }
    }

    private function dispatchDelivery(array $item): void {
        // In-app notifications — always dispatched
        $isBreaking = (bool) ($item['breaking'] ?? false) || (bool) ($item['is_headline'] ?? false);
        $prefKey    = $isBreaking ? 'notif_breaking_news' : 'notif_official';
        $priority   = $isBreaking ? 'high' : 'normal';
        $prefix     = $isBreaking ? 'BREAKING: ' : '';

        $body = trim($item['summary'] ?? '')
            ?: mb_substr(strip_tags($item['body'] ?? ''), 0, 120);

        $lgaStmt = $this->db->prepare('SELECT lga_id FROM news_lga_targets WHERE news_id = ?');
        $lgaStmt->execute([$item['id']]);
        $lgaIds = array_map('intval', $lgaStmt->fetchAll(PDO::FETCH_COLUMN));

        NotificationService::broadcastToLgas($this->db, $lgaIds, (bool) $item['target_all_lgas'], [
            'category' => 'Official',
            'priority' => $priority,
            'title'    => $prefix . $item['title'],
            'body'     => $body ?: 'Tap to read the full article.',
            'linkTo'   => '/news/' . $item['slug'],
        ], $prefKey);

        // Email delivery — send via Resend to users who have an email on file
        if (!empty($item['delivery_email'])) {
            $rawBase  = getenv('BASE_URL') ?: 'https://lagkonnect.com';
            $baseUrl  = str_ends_with($rawBase, '/api/v1') ? substr($rawBase, 0, -7) : rtrim($rawBase, '/');
            $articleUrl = $baseUrl . '/news/' . $item['slug'];

            // Allowlist to prevent SQL injection via column name interpolation
            $allowedPrefKeys = ['notif_official', 'notif_breaking_news', 'notif_community', 'notif_lga_alerts', 'notif_new_login', 'notif_reel_likes', 'notif_reel_comments'];
            if (!in_array($prefKey, $allowedPrefKeys, true)) {
                $prefKey = 'notif_official'; // safe default
            }

            $emailUsersStmt = $this->db->prepare("
                SELECT u.email, u.name FROM users u
                WHERE u.email IS NOT NULL
                  AND u.is_verified = 1
                  AND u.`{$prefKey}` = 1
                  AND (
                    ? = 1
                    OR EXISTS (SELECT 1 FROM news_lga_targets nlt WHERE nlt.news_id = ? AND nlt.lga_id = u.lga_id)
                  )
                LIMIT 500
            ");
            $emailUsersStmt->execute([(int)$item['target_all_lgas'], $item['id']]);
            foreach ($emailUsersStmt->fetchAll() as $eu) {
                EmailService::sendNewsAlert($eu['email'], $eu['name'], $item['title'], $body ?: '', $articleUrl);
            }
        }
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

    private function validateBody(array $body): void {
        if (empty(trim($body['title'] ?? ''))) {
            Response::error('VALIDATION_ERROR', 'Title is required.', 422);
        }
        if (empty(trim($body['summary'] ?? ''))) {
            Response::error('VALIDATION_ERROR', 'Summary is required.', 422);
        }
        $targetAll = $body['targetAllLgas'] ?? false;
        $lgaIds    = $body['lgaIds'] ?? [];
        if (!$targetAll && empty($lgaIds)) {
            Response::error('VALIDATION_ERROR', 'Please select at least one LGA or target all LGAs.', 422);
        }
    }

    private function generateSlug(string $title, ?int $excludeId = null): string {
        $slug = strtolower(trim(preg_replace('/[^a-z0-9\s-]/i', '', $title)));
        $slug = preg_replace('/\s+/', '-', $slug);
        $slug = trim($slug, '-');

        // Ensure uniqueness
        $base  = $slug;
        $count = 0;
        do {
            $check = $count > 0 ? "{$base}-{$count}" : $base;
            $stmt  = $this->db->prepare('SELECT id FROM news WHERE slug = ?' . ($excludeId ? ' AND id != ?' : ''));
            $params = $excludeId ? [$check, $excludeId] : [$check];
            $stmt->execute($params);
            $exists = $stmt->fetch();
            $count++;
        } while ($exists);

        return $check;
    }

    private function lgaName(int $lgaId): ?string {
        $stmt = $this->db->prepare('SELECT name FROM lgas WHERE id = ?');
        $stmt->execute([$lgaId]);
        return $stmt->fetchColumn() ?: null;
    }

    private function syncLgaTargets(int $newsId, array $lgaIds): void {
        $stmt = $this->db->prepare('INSERT IGNORE INTO news_lga_targets (news_id, lga_id) VALUES (?, ?)');
        foreach ($lgaIds as $lgaId) {
            $stmt->execute([$newsId, (int) $lgaId]);
        }
        // Update lga_id/lga_name for single LGA
        if (count($lgaIds) === 1) {
            $name = $this->lgaName((int) $lgaIds[0]);
            $this->db->prepare('UPDATE news SET lga_id = ?, lga_name = ? WHERE id = ?')
                     ->execute([(int) $lgaIds[0], $name, $newsId]);
        }
    }

    private function fetchFull(int $id): array {
        $stmt = $this->db->prepare('
            SELECT n.*, a.name AS author_name FROM news n
            LEFT JOIN admins a ON a.id = n.author_id WHERE n.id = ?
        ');
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        $lgaStmt = $this->db->prepare('
            SELECT l.id, l.name FROM news_lga_targets nlt
            JOIN lgas l ON l.id = nlt.lga_id WHERE nlt.news_id = ?
        ');
        $lgaStmt->execute([$id]);
        $item['lga_targets'] = $lgaStmt->fetchAll();
        return $item;
    }

    private function format(array $n): array {
        $lgaTargets = array_map(fn($l) => [
            'id'   => (int) $l['id'],
            'name' => $l['name'],
        ], $n['lga_targets'] ?? []);

        $daysSincePublished = null;
        if ($n['published_at']) {
            $diff = (new DateTime())->diff(new DateTime($n['published_at']));
            $daysSincePublished = $diff->days;
        }

        return [
            'id'              => (int) $n['id'],
            'newsId'          => (string) $n['id'],
            'slug'            => $n['slug'],
            'title'           => $n['title'],
            'summary'         => $n['summary'],
            'body'            => $n['body'],
            'imageUrl'        => $n['image_url'],
            'category'        => $n['category'],
            'breaking'        => (bool) $n['breaking'],
            'isHeadline'      => (bool) ($n['is_headline'] ?? false),
            'targetAllLgas'   => (bool) $n['target_all_lgas'],
            'lgaId'           => $n['lga_id'] ? (int) $n['lga_id'] : null,
            'lgaName'         => $n['lga_name'],
            'lgaTargets'      => $lgaTargets,
            'sourceName'      => $n['source_name'],
            'sourceUrl'       => $n['source_url'],
            'deliveryPush'    => (bool) ($n['delivery_push']  ?? true),
            'deliverySms'     => (bool) ($n['delivery_sms']   ?? false),
            'deliveryEmail'   => (bool) ($n['delivery_email'] ?? false),
            'status'          => $n['status'],
            'scheduledAt'     => $n['scheduled_at'],
            'publishedAt'     => $n['published_at'],
            'durationDays'    => $daysSincePublished,
            'views'           => (int) ($n['views'] ?? 0),
            'authorId'        => $n['author_id'] ? (int) $n['author_id'] : null,
            'authorName'      => $n['author_name'] ?? null,
            'createdAt'       => $n['created_at'],
            'updatedAt'       => $n['updated_at'],
        ];
    }
}