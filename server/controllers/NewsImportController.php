<?php

/**
 * NewsImportController — review queue for externally sourced articles.
 *
 * Flow: an admin picks a country and a date, the feed is fetched (or served
 * from cache), and nothing is visible to citizens until that admin approves an
 * individual article. Approving creates an ordinary `news` row exactly as the
 * manual editor would; dismissing hides the article from future fetches.
 *
 * Every route here is admin-only, and the upstream API key never leaves the
 * server.
 */
class NewsImportController {

    private PDO $db;
    private WorldNewsService $service;

    public function __construct() {
        $this->db      = Database::connect();
        $this->service = new WorldNewsService($this->db);
    }

    // ── GET /admin/news/import/feed ───────────────────────────────────────

    public function feed(): void {
        $this->requireAdmin();

        if (!WorldNewsService::isConfigured()) {
            Response::error(
                'IMPORT_NOT_CONFIGURED',
                'News import is not set up. Add WORLDNEWS_API_KEY to server/.env.',
                503
            );
        }

        $country = strtolower(trim($_GET['country'] ?? 'ng'));
        $date    = trim($_GET['date'] ?? date('Y-m-d'));
        $refresh = ($_GET['refresh'] ?? '') === '1';

        if (!preg_match('/^[a-z]{2}$/', $country)) {
            Response::error('VALIDATION_ERROR', 'country must be a two-letter code.', 422);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) {
            Response::error('VALIDATION_ERROR', 'date must be YYYY-MM-DD.', 422);
        }
        if (strtotime($date) > strtotime(date('Y-m-d'))) {
            Response::error('VALIDATION_ERROR', 'date cannot be in the future.', 422);
        }

        try {
            $result = $this->service->topNews($country, $date, $refresh);
        } catch (RuntimeException $e) {
            Response::error('IMPORT_FAILED', $e->getMessage(), 502);
        }

        $articles = $this->annotate($result['articles']);

        Response::json([
            'articles'  => $articles,
            'cached'    => $result['cached'],
            'fetchedAt' => $result['fetchedAt'],
            'quota'     => $result['quota'],
            'country'   => $country,
            'date'      => $date,
        ]);
    }

    // ── GET /admin/news/import/quota ──────────────────────────────────────

    public function quota(): void {
        $this->requireAdmin();
        Response::json([
            'configured' => WorldNewsService::isConfigured(),
            'quota'      => $this->service->quota(),
        ]);
    }

    // ── POST /admin/news/import/approve ───────────────────────────────────
    //
    // Creates the published article. This is the only step that makes an
    // imported item visible to citizens.

    public function approve(): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $externalId = trim((string) ($body['externalId'] ?? ''));
        $title      = trim((string) ($body['title'] ?? ''));

        if ($externalId === '' || $title === '') {
            Response::error('VALIDATION_ERROR', 'externalId and title are required.', 422);
        }

        if ($this->alreadyImported($externalId)) {
            Response::error('ALREADY_IMPORTED', 'That article has already been published.', 409);
        }

        // The admin may have edited the text in the review panel before
        // approving, so trust the submitted values rather than re-fetching.
        $summary    = trim((string) ($body['summary'] ?? ''));
        $articleTxt = trim((string) ($body['body'] ?? ''));
        $category   = trim((string) ($body['category'] ?? '')) ?: 'General';
        $imageUrl   = trim((string) ($body['imageUrl'] ?? '')) ?: null;
        $sourceUrl  = trim((string) ($body['sourceUrl'] ?? '')) ?: null;
        $sourceName = trim((string) ($body['sourceName'] ?? '')) ?: null;
        $breaking   = !empty($body['breaking']);

        // Default to every LGA; a single LGA can be targeted instead.
        $targetAll = !isset($body['lgaId']) || $body['lgaId'] === null || $body['lgaId'] === '';
        $lgaId     = $targetAll ? null : (int) $body['lgaId'];

        $stmt = $this->db->prepare('
            INSERT INTO news (
                slug, title, summary, body, image_url,
                category, breaking, is_headline,
                target_all_lgas, lga_id, lga_name,
                source_name, source_url, external_id, external_source,
                delivery_push, delivery_sms, delivery_email,
                status, published_at,
                author_id, views, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, 0,
                ?, ?, ?,
                ?, ?, ?, ?,
                1, 0, 0,
                "published", NOW(),
                ?, 0, NOW(), NOW()
            )
        ');

        $stmt->execute([
            $this->generateSlug($title),
            $title,
            $summary,
            $articleTxt,
            $imageUrl,
            $category,
            $breaking ? 1 : 0,
            $targetAll ? 1 : 0,
            $lgaId,
            $lgaId ? $this->lgaName($lgaId) : null,
            $sourceName,
            $sourceUrl,
            $externalId,
            'worldnewsapi',
            $auth['adminId'],
        ]);

        $newsId = (int) $this->db->lastInsertId();

        if (!$targetAll && $lgaId) {
            $this->db->prepare('INSERT IGNORE INTO news_lga_targets (news_id, lga_id) VALUES (?, ?)')
                     ->execute([$newsId, $lgaId]);
        }

        Response::json(['newsId' => $newsId, 'status' => 'published'], 201);
    }

    // ── POST /admin/news/import/dismiss ───────────────────────────────────

    public function dismiss(): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $externalId = trim((string) ($body['externalId'] ?? ''));
        if ($externalId === '') {
            Response::error('VALIDATION_ERROR', 'externalId is required.', 422);
        }

        $this->db->prepare('
            INSERT INTO news_import_dismissed (external_id, admin_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE admin_id = VALUES(admin_id)
        ')->execute([$externalId, $auth['adminId']]);

        Response::json(['dismissed' => true]);
    }

    // ── POST /admin/news/import/restore ───────────────────────────────────

    public function restore(): void {
        $this->requireAdmin();
        $body       = Validator::jsonBody() ?? [];
        $externalId = trim((string) ($body['externalId'] ?? ''));

        if ($externalId === '') {
            Response::error('VALIDATION_ERROR', 'externalId is required.', 422);
        }

        $this->db->prepare('DELETE FROM news_import_dismissed WHERE external_id = ?')
                 ->execute([$externalId]);

        Response::json(['restored' => true]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Marks each article with what the admin has already done with it, so the
     * UI can show approved and dismissed states instead of offering the same
     * article again.
     */
    private function annotate(array $articles): array {
        if (!$articles) return [];

        $ids = array_values(array_filter(array_column($articles, 'externalId')));
        if (!$ids) return $articles;

        $ph = implode(',', array_fill(0, count($ids), '?'));

        $imported = $this->db->prepare(
            "SELECT external_id, id FROM news WHERE external_id IN ({$ph})"
        );
        $imported->execute($ids);
        $importedMap = $imported->fetchAll(PDO::FETCH_KEY_PAIR);

        $dismissed = $this->db->prepare(
            "SELECT external_id FROM news_import_dismissed WHERE external_id IN ({$ph})"
        );
        $dismissed->execute($ids);
        $dismissedSet = array_flip($dismissed->fetchAll(PDO::FETCH_COLUMN));

        foreach ($articles as &$a) {
            $id = $a['externalId'];
            $a['isImported'] = isset($importedMap[$id]);
            $a['newsId']     = $importedMap[$id] ?? null;
            $a['isDismissed'] = isset($dismissedSet[$id]);
        }

        return $articles;
    }

    private function alreadyImported(string $externalId): bool {
        $stmt = $this->db->prepare('SELECT id FROM news WHERE external_id = ? LIMIT 1');
        $stmt->execute([$externalId]);
        return (bool) $stmt->fetch();
    }

    private function generateSlug(string $title): string {
        $slug = strtolower(trim(preg_replace('/[^a-z0-9\s-]/i', '', $title)));
        $slug = preg_replace('/\s+/', '-', $slug);
        $slug = trim($slug, '-') ?: 'article';

        $base  = $slug;
        $count = 0;
        do {
            $check = $count > 0 ? "{$base}-{$count}" : $base;
            $stmt  = $this->db->prepare('SELECT id FROM news WHERE slug = ?');
            $stmt->execute([$check]);
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

        // Admin tokens carry type=admin and adminId, not the citizen userId.
        if (($payload['type'] ?? '') !== 'admin') {
            Response::error('FORBIDDEN', 'Admin access required.', 403);
        }

        $role = $payload['role'] ?? '';
        if (!in_array($role, ['super_admin', 'admin'], true)) {
            Response::error('FORBIDDEN', 'Insufficient privileges.', 403);
        }

        $blStmt = $this->db->prepare(
            'SELECT 1 FROM jwt_blacklist WHERE token_hash = ? AND expires_at > NOW() LIMIT 1'
        );
        $blStmt->execute([hash('sha256', $token)]);
        if ($blStmt->fetchColumn()) {
            Response::error('TOKEN_REVOKED', 'Token has been revoked.', 401);
        }

        return ['adminId' => (int) ($payload['adminId'] ?? 0), 'role' => $role];
    }
}
