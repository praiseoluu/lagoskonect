<?php

/**
 * NewsImportController — review queue for externally sourced articles.
 *
 * Two sources feed the same queue:
 *
 *   worldnews  World News API. Metered — a free-tier key with a small daily
 *              allowance, so results are cached hard and a budget is enforced.
 *   punch      Scraped straight off a punchng.com topic archive. Free, so no
 *              budget, but still cached to avoid hammering their servers.
 *
 * Either way nothing is visible to citizens until an admin approves an
 * individual article, which creates an ordinary `news` row exactly as the
 * manual editor would. Dismissing hides the article from future fetches.
 *
 * Published articles keep source_name and source_url pointing at the original
 * publisher, so every imported story is attributed and links back.
 *
 * Every route here is admin-only, and the upstream API key never leaves the
 * server.
 */
class NewsImportController {

    private PDO $db;
    private WorldNewsService $service;
    private PunchScraper $punch;

    public function __construct() {
        $this->db      = Database::connect();
        $this->service = new WorldNewsService($this->db);
        $this->punch   = new PunchScraper($this->db);
    }

    // ── GET /admin/news/import/feed ───────────────────────────────────────

    public function feed(): void {
        $this->requireAdmin();

        $source = strtolower(trim($_GET['source'] ?? 'worldnews'));

        if ($source === 'punch') {
            $this->punchFeed();
            return;
        }
        if ($source !== 'worldnews') {
            Response::error('VALIDATION_ERROR', 'Unknown source.', 422);
        }

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
            'source'    => 'worldnews',
            'cached'    => $result['cached'],
            'fetchedAt' => $result['fetchedAt'],
            'quota'     => $result['quota'],
            'country'   => $country,
            'date'      => $date,
        ]);
    }

    /**
     * Punch topic archive.
     *
     * Only the listing is fetched here — one request, however many stories come
     * back. Full article text is pulled per-article by story() or at approval,
     * so opening the review screen never turns into twenty sequential fetches
     * inside a single PHP process.
     */
    private function punchFeed(): void {
        $topic   = trim($_GET['topic'] ?? PunchScraper::TOPICS[0]['url']);
        $refresh = ($_GET['refresh'] ?? '') === '1';
        $pages   = (int) ($_GET['pages'] ?? 1);

        if (!PunchScraper::isPunchUrl($topic)) {
            Response::error('VALIDATION_ERROR', 'topic must be a punchng.com address.', 422);
        }

        try {
            $result = $this->punch->listing($topic, $refresh, $pages);
        } catch (RuntimeException $e) {
            Response::error('IMPORT_FAILED', $e->getMessage(), 502);
        }

        Response::json([
            'articles'  => $this->annotate($result['articles']),
            'source'    => 'punch',
            'cached'    => $result['cached'],
            'fetchedAt' => $result['fetchedAt'],
            'quota'     => null,        // scraping costs nothing
            'topic'     => $topic,
            'pages'     => $result['pages'],
        ]);
    }

    // ── GET /admin/news/import/story?url=… ────────────────────────────────
    //
    // Full text of one Punch article, so an admin can read what would be
    // published before publishing it. Cached for a month: a published story
    // does not change.

    public function story(): void {
        $this->requireAdmin();

        $url = trim($_GET['url'] ?? '');
        if (!PunchScraper::isPunchUrl($url)) {
            Response::error('VALIDATION_ERROR', 'url must be a punchng.com address.', 422);
        }

        try {
            $story = $this->punch->story($url, ($_GET['refresh'] ?? '') === '1');
        } catch (RuntimeException $e) {
            Response::error('IMPORT_FAILED', $e->getMessage(), 502);
        }

        Response::json($story);
    }

    // ── GET /admin/news/import/quota ──────────────────────────────────────

    public function quota(): void {
        $this->requireAdmin();
        Response::json([
            'configured' => WorldNewsService::isConfigured(),
            'quota'      => $this->service->quota(),
            'topics'     => PunchScraper::TOPICS,
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
        $rawImage   = trim((string) ($body['imageUrl'] ?? ''));
        $sourceUrl  = trim((string) ($body['sourceUrl'] ?? '')) ?: null;
        $sourceName = trim((string) ($body['sourceName'] ?? '')) ?: null;
        $breaking   = !empty($body['breaking']);

        $source = strtolower(trim((string) ($body['source'] ?? 'worldnews')));
        $source = $source === 'punch' ? 'punch' : 'worldnews';

        // A scraped listing card carries only a one-line excerpt: the story
        // itself is on the article page. Fetch it now rather than at browse
        // time, so the cost is paid once, for the articles actually published.
        // The listing thumbnail is 299px wide and unusable as a news image, so
        // the article's own og:image is preferred when there is one.
        if ($source === 'punch' && $sourceUrl && PunchScraper::isPunchUrl($sourceUrl)) {
            try {
                $story = $this->punch->story($sourceUrl);

                if ($articleTxt === '' && $story['body'] !== '') {
                    $articleTxt = $story['body'];
                }
                if (!empty($story['image'])) {
                    $rawImage = $story['image'];
                }
            } catch (RuntimeException) {
                // Publishing the excerpt with a link back is still useful;
                // failing the whole approval because the body could not be
                // fetched would not be.
            }
        }

        // Copy the picture into our own storage rather than hotlinking the
        // publisher. Citizens would otherwise be blocked by the CSP, and the
        // remote file could vanish at any time.
        $imageUrl = $this->mirrorImage($rawImage);

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
            $source === 'punch' ? 'punchng' : 'worldnewsapi',
            $auth['adminId'],
        ]);

        $newsId = (int) $this->db->lastInsertId();

        if (!$targetAll && $lgaId) {
            $this->db->prepare('INSERT IGNORE INTO news_lga_targets (news_id, lga_id) VALUES (?, ?)')
                     ->execute([$newsId, $lgaId]);
        }

        Response::json(['newsId' => $newsId, 'status' => 'published'], 201);
    }

    // ── GET /admin/news/import/image?url=… ────────────────────────────────
    //
    // Streams a remote article image through this origin.
    //
    // Why this exists: the site's CSP allows img-src 'self' plus a short
    // allowlist, and articles arrive from arbitrary news domains that can
    // never be on it. Loading them directly is blocked by the browser, so the
    // review screen showed empty boxes.
    //
    // Deliberately not behind the Bearer check: an <img> tag cannot send an
    // Authorization header. The guard instead is that the URL must already
    // appear in a cached feed payload, so this can only ever fetch images the
    // provider handed us. That makes it useless as a general purpose proxy.

    public function image(): void {
        $url = trim($_GET['url'] ?? '');

        if ($url === '' || !$this->isCachedImageUrl($url)) {
            header_remove('Content-Type');
            http_response_code(404);
            exit;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS=> CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT      => 'LagosKonect/1.0 (+https://lagoskonect.com)',
        ]);

        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $mime   = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        $mime = trim(explode(';', $mime)[0]);

        if ($body === false || $status < 200 || $status >= 300 || !str_starts_with($mime, 'image/')) {
            header_remove('Content-Type');
            http_response_code(404);
            exit;
        }

        header_remove('Content-Type');
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . strlen($body));
        header('Cache-Control: public, max-age=86400');
        echo $body;
        exit;
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

    /**
     * True when the URL is the image of an article in a live cache entry.
     * This is what stops the proxy being an open redirect/SSRF tool: only
     * URLs the provider itself gave us can ever be fetched.
     */
    private function isCachedImageUrl(string $url): bool {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        $stmt = $this->db->query('SELECT payload FROM news_import_cache WHERE expires_at > NOW()');
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $payload) {
            $decoded = json_decode($payload, true);
            if (!is_array($decoded)) continue;

            // World News API keeps its own nesting; the scraper stores a flat
            // list, and a single story row for its own picture.
            foreach (($decoded['top_news'] ?? []) as $cluster) {
                foreach (($cluster['news'] ?? []) as $item) {
                    if (!empty($item['image']) && $item['image'] === $url) return true;
                }
            }

            foreach (($decoded['articles'] ?? []) as $item) {
                if (!empty($item['image']) && $item['image'] === $url) return true;
            }

            if (!empty($decoded['image']) && $decoded['image'] === $url) return true;
        }

        return false;
    }

    /**
     * Copies a remote image into our own object storage and returns the
     * resulting same-origin /media URL.
     *
     * Published articles keep their image forever this way, instead of
     * hotlinking a publisher's server that may move or delete the file. It
     * also keeps the URL on an origin the CSP already permits.
     *
     * Returns null when the image cannot be fetched; the article is still
     * published, just without a picture.
     */
    private function mirrorImage(string $url): ?string {
        if ($url === '') return null;

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) return null;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS=> CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT      => 'LagosKonect/1.0 (+https://lagoskonect.com)',
        ]);

        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $mime   = trim(explode(';', (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE))[0]);
        curl_close($ch);

        if ($body === false || $status < 200 || $status >= 300) return null;
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) return null;
        if (strlen($body) > 8 * 1024 * 1024) return null;

        $tmp = tempnam(sys_get_temp_dir(), 'nimg');
        if ($tmp === false) return null;

        try {
            file_put_contents($tmp, $body);
            $key = S3::makeKey('news', S3::mimeToExt($mime));
            return S3::upload($tmp, $key, $mime);
        } catch (Throwable) {
            return null;   // storage unavailable: publish without an image
        } finally {
            @unlink($tmp);
        }
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
