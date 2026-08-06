<?php

/**
 * PunchScraper — reads a punchng.com topic archive.
 *
 * A PHP port of tools/punch_scraper.py, split so the expensive half only runs
 * when it is actually needed:
 *
 *   - listing()  one request, returns the cards on a topic page (title, link,
 *                excerpt, thumbnail, date). This is what the review screen shows.
 *   - story()    one request per article, returns the full text and the
 *                full-size picture. Only called when an admin opens a preview
 *                or publishes, so browsing the queue never costs 20 requests.
 *
 * The Python version fetched every body up front. That is fine on a laptop but
 * not on this host: twenty sequential fetches inside one PHP request would sit
 * on an entry process for half a minute, and entry processes are the limit this
 * site has already been knocked over by.
 *
 * Scraping is free, so there is no call budget as there is for the World News
 * API. Responses are still cached, to be a well-behaved visitor rather than to
 * conserve a quota.
 */
class PunchScraper {

    /** Only this publisher. Guards the fetchers against being aimed elsewhere. */
    private const HOST = 'punchng.com';

    /** Listing pages change often; stories effectively never do once published. */
    private const LISTING_TTL_SECONDS = 1800;      // 30 minutes
    private const STORY_TTL_SECONDS   = 2592000;   // 30 days

    private const MAX_PAGES    = 5;
    private const MAX_ARTICLES = 60;

    private const USER_AGENT =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        . '(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

    /**
     * Furniture that lives inside the article container but is not the story:
     * ad slots, the "read also" box, video embeds, share buttons, captions.
     */
    private const JUNK_CLASSES = [
        'read-also', 'ad-container', 'primisVideoUnit', 'related-news',
        'newsletter', 'social-share', 'post-tags', 'wp-caption-text',
    ];

    /** Trailing paragraphs Punch appends to most stories. */
    private const BOILERPLATE = '/^\s*(all rights reserved|copyright punch|this material.*may not be'
        . '|contact:\s*\S+@|kindly share this story|join our whatsapp)/i';

    /** Ready-made topics, so an admin does not have to paste URLs. */
    public const TOPICS = [
        ['label' => 'BBNaija S11',   'url' => 'https://punchng.com/topics/entertainment/bbnaija-11/'],
        ['label' => 'Entertainment', 'url' => 'https://punchng.com/topics/entertainment/'],
        ['label' => 'Politics',      'url' => 'https://punchng.com/topics/news/politics/'],
        ['label' => 'Metro Plus',    'url' => 'https://punchng.com/topics/news/metro-plus/'],
        ['label' => 'Business',      'url' => 'https://punchng.com/topics/business/'],
        ['label' => 'Sports',        'url' => 'https://punchng.com/topics/sports/'],
        ['label' => 'Education',     'url' => 'https://punchng.com/topics/news/education/'],
        ['label' => 'Health',        'url' => 'https://punchng.com/topics/news/health/'],
    ];

    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * True when the URL is a page on punchng.com over http(s).
     *
     * Every fetch this class makes is checked against this, so neither the
     * topic parameter nor a link found inside a scraped page can point the
     * server at an arbitrary host.
     */
    public static function isPunchUrl(string $url): bool {
        $parts = parse_url($url);
        if (!is_array($parts)) return false;

        $scheme = strtolower($parts['scheme'] ?? '');
        $host   = strtolower($parts['host'] ?? '');
        $host   = preg_replace('/^www\./', '', $host);

        return in_array($scheme, ['http', 'https'], true) && $host === self::HOST;
    }

    /**
     * The cards on a topic archive, newest first.
     *
     * @param string $topicUrl  a punchng.com topic URL
     * @param bool   $refresh   bypass the cache
     * @param int    $pages     listing pages to follow (1 = just this one)
     * @return array{articles: array, cached: bool, fetchedAt: string, pages: int}
     */
    public function listing(string $topicUrl, bool $refresh = false, int $pages = 1): array {
        if (!self::isPunchUrl($topicUrl)) {
            throw new RuntimeException('That is not a punchng.com address.');
        }

        $pages = max(1, min(self::MAX_PAGES, $pages));
        $key   = 'punch:' . sha1($topicUrl) . ':' . $pages;

        if (!$refresh) {
            $hit = $this->readCache($key);
            if ($hit !== null) {
                return [
                    'articles'  => $hit['payload']['articles'] ?? [],
                    'cached'    => true,
                    'fetchedAt' => $hit['fetched_at'],
                    'pages'     => $hit['payload']['pages'] ?? $pages,
                ];
            }
        }

        $articles = [];
        $seen     = [];
        $url      = $topicUrl;
        $walked   = 0;

        while ($url !== null && $walked < $pages) {
            $walked++;

            $html = $this->fetch($url);
            if ($html === null) {
                if ($walked === 1) {
                    throw new RuntimeException('Could not reach Punch. Try again in a moment.');
                }
                break;   // a later page failed; keep what we already have
            }

            $xp = $this->xpath($html);

            foreach ($this->parseListing($xp) as $row) {
                if (isset($seen[$row['url']])) continue;
                $seen[$row['url']] = true;
                $articles[] = $row;
            }

            if (count($articles) >= self::MAX_ARTICLES) {
                $articles = array_slice($articles, 0, self::MAX_ARTICLES);
                break;
            }

            $url = $this->nextPageUrl($xp, $url);
            if ($url !== null) usleep(400000);
        }

        if (!$articles) {
            throw new RuntimeException(
                'No stories found on that page. The topic may be empty, or Punch may have changed its layout.'
            );
        }

        $this->writeCache($key, ['articles' => $articles, 'pages' => $walked], self::LISTING_TTL_SECONDS);

        return [
            'articles'  => $articles,
            'cached'    => false,
            'fetchedAt' => date('Y-m-d H:i:s'),
            'pages'     => $walked,
        ];
    }

    /**
     * One article: full text, full-size picture, author and published time.
     *
     * The listing thumbnail is only 299px wide, which is unusable as a news
     * card image, so the og:image from the article page is preferred.
     *
     * @return array{body: string, image: ?string, author: string, publishedAt: ?string, wordCount: int}
     */
    public function story(string $url, bool $refresh = false): array {
        if (!self::isPunchUrl($url)) {
            throw new RuntimeException('That is not a punchng.com address.');
        }

        $key = 'punch-story:' . sha1($url);

        if (!$refresh) {
            $hit = $this->readCache($key);
            if ($hit !== null) return $hit['payload'];
        }

        $html = $this->fetch($url);
        if ($html === null) {
            throw new RuntimeException('Could not fetch that story from Punch.');
        }

        $xp   = $this->xpath($html);
        $ld   = $this->jsonLdArticle($xp);
        $body = $this->extractBody($xp);

        $author = $ld['author'] ?? null;
        if (is_array($author)) {
            $author = $author['name'] ?? ($author[0]['name'] ?? ($author[0] ?? ''));
        }

        $story = [
            'body'        => $body,
            'image'       => $this->meta($xp, 'og:image') ?: null,
            'author'      => is_string($author) ? trim($author) : '',
            'publishedAt' => $this->toUtc(
                $ld['datePublished'] ?? $this->meta($xp, 'article:published_time')
            ),
            'wordCount'   => $body === '' ? 0 : str_word_count($body),
        ];

        // Only worth remembering when there is something in it; a failed parse
        // should not be cached for a month.
        if ($story['body'] !== '') {
            $this->writeCache($key, $story, self::STORY_TTL_SECONDS);
        }

        return $story;
    }

    // ── Listing parsing ───────────────────────────────────────────────────

    /**
     * The archive list lives in .latest-news-timeline-section, which renders a
     * desktop block plus a .mobile-only block holding different posts, so both
     * are read and the caller dedupes by URL.
     *
     * Note the sidebar uses article.entry-item-simple with .entry-title — a
     * different, unrelated widget. Scoping to the timeline section is what
     * keeps those out.
     */
    private function parseListing(DOMXPath $xp): array {
        $section = $xp->query(
            "//*[contains(concat(' ', normalize-space(@class), ' '), ' latest-news-timeline-section ')]"
        )->item(0);

        if (!$section) return [];

        $out = [];

        foreach ($xp->query('.//article', $section) as $art) {
            $link = $xp->query(".//*[contains(@class,'post-title')]//a[@href]", $art)->item(0);
            if (!$link) continue;

            $href = trim($link->getAttribute('href'));
            $href = explode('#', $href)[0];
            if ($href === '' || !self::isPunchUrl($href)) continue;

            $title = $this->text($link);
            if ($title === '') continue;

            $excerpt = $this->text($xp->query(".//*[contains(@class,'post-excerpt')]", $art)->item(0));
            $date    = $this->text($xp->query(".//*[contains(@class,'post-date')]", $art)->item(0));

            $out[] = [
                // Punch has no article id in the markup, so the URL is the
                // identity. Hashed to fit news.external_id (VARCHAR(64)) and to
                // stay stable however long the slug is.
                'externalId'  => 'punch:' . sha1($href),
                'title'       => $title,
                'summary'     => rtrim($excerpt, '. '),
                'text'        => '',              // filled in by story(), on demand
                'url'         => $href,
                'image'       => $this->bestImage($xp, $art),
                'publishDate' => $this->toUtc($date, 'Africa/Lagos'),
                'authors'     => [],
                'sourceName'  => 'Punch',
                'category'    => null,
                'alsoCovered' => 0,
                'needsBody'   => true,
            ];
        }

        return $out;
    }

    /** Punch serves a responsive webp set; take the widest candidate. */
    private function bestImage(DOMXPath $xp, DOMNode $article): ?string {
        $best = '';
        $bestW = -1;

        foreach ($xp->query('.//img | .//source', $article) as $el) {
            foreach (explode(',', $el->getAttribute('srcset')) as $part) {
                $bits = preg_split('/\s+/', trim($part));
                if (count($bits) !== 2 || !str_ends_with($bits[1], 'w')) continue;

                $w = (int) rtrim($bits[1], 'w');
                if ($w > $bestW) { $best = $bits[0]; $bestW = $w; }
            }
        }

        if ($best === '') {
            $img  = $xp->query('.//img', $article)->item(0);
            $best = $img ? ($img->getAttribute('src') ?: $img->getAttribute('data-src')) : '';
        }

        return $best !== '' ? $best : null;
    }

    /** Punch paginates at /page/N/; null when this is the last page. */
    private function nextPageUrl(DOMXPath $xp, string $currentUrl): ?string {
        $links = $xp->query(
            "//*[contains(@class,'archive-pagination')]//a[@href][contains(translate("
            . "text(), 'NEXT', 'next'), 'next')]"
        );

        foreach ($links as $a) {
            $href = trim($a->getAttribute('href'));
            if ($href === '') continue;

            $abs = $this->absolutise($href, $currentUrl);
            if (self::isPunchUrl($abs)) return $abs;
        }

        return null;
    }

    // ── Article parsing ───────────────────────────────────────────────────

    /**
     * Body is div.post-content. Several exist per page — sidebar cards reuse
     * the class — so take the one with the most paragraphs.
     *
     * Depth varies: ordinary stories put <p> as direct children, listicles wrap
     * them in another div. So paragraphs are collected recursively and the
     * known non-article furniture is stripped first instead.
     */
    private function extractBody(DOMXPath $xp): string {
        $best  = null;
        $bestN = 0;

        foreach ($xp->query("//div[contains(@class,'post-content')]") as $block) {
            $n = $xp->query('.//p', $block)->length;
            if ($n > $bestN) { $best = $block; $bestN = $n; }
        }

        if (!$best) return '';

        // Work on a copy: removing nodes from the live tree would corrupt any
        // later query against the same document.
        $body = $best->cloneNode(true);
        $doc  = new DOMDocument();
        $doc->appendChild($doc->importNode($body, true));
        $bxp  = new DOMXPath($doc);

        $conditions = array_map(
            fn($c) => "contains(concat(' ', normalize-space(@class), ' '), ' {$c} ')",
            self::JUNK_CLASSES
        );
        $junk = $bxp->query(
            '//figcaption | //aside | //script | //style | //noscript | //*[' . implode(' or ', $conditions) . ']'
        );

        // Snapshot before removing: a DOMNodeList is live and shrinks as you go.
        foreach (iterator_to_array($junk) as $node) {
            $node->parentNode?->removeChild($node);
        }

        $paras = [];
        $seen  = [];

        foreach ($bxp->query('//p') as $p) {
            $text = trim(preg_replace('/\s+/u', ' ', str_replace("\xc2\xa0", ' ', $p->textContent)));
            if ($text === '' || isset($seen[$text])) continue;
            if (preg_match(self::BOILERPLATE, $text)) continue;

            $seen[$text] = true;
            $paras[] = $text;
        }

        return implode("\n\n", $paras);
    }

    /** The Article node out of the Yoast JSON-LD graph, if present. */
    private function jsonLdArticle(DOMXPath $xp): array {
        foreach ($xp->query('//script[@type="application/ld+json"]') as $tag) {
            $data = json_decode($tag->textContent, true);
            if (!is_array($data)) continue;

            $nodes = $data['@graph'] ?? [$data];
            if (!is_array($nodes)) continue;

            foreach ($nodes as $node) {
                if (!is_array($node)) continue;

                $type = $node['@type'] ?? '';
                $type = is_array($type) ? implode(',', $type) : (string) $type;

                if (str_contains($type, 'Article')) return $node;
            }
        }

        return [];
    }

    private function meta(DOMXPath $xp, string $property): string {
        $el = $xp->query("//meta[@property='{$property}' or @name='{$property}']")->item(0);
        return $el ? trim($el->getAttribute('content')) : '';
    }

    // ── Fetching ──────────────────────────────────────────────────────────

    /** Returns the page HTML, or null on any failure. */
    private function fetch(string $url): ?string {
        if (!self::isPunchUrl($url)) return null;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER  => true,
            CURLOPT_FOLLOWLOCATION  => true,
            CURLOPT_MAXREDIRS       => 3,
            CURLOPT_TIMEOUT         => 20,
            CURLOPT_CONNECTTIMEOUT  => 8,
            CURLOPT_ENCODING        => '',            // accept gzip
            CURLOPT_PROTOCOLS       => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT       => self::USER_AGENT,
            CURLOPT_HTTPHEADER      => ['Accept-Language: en-US,en;q=0.9'],
        ]);

        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $final  = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        curl_close($ch);

        // A redirect off punchng.com would defeat the check above.
        if ($body === false || $status < 200 || $status >= 300 || !self::isPunchUrl($final)) {
            return null;
        }

        return $body;
    }

    private function xpath(string $html): DOMXPath {
        $doc = new DOMDocument();

        // Punch is UTF-8 but does not always declare it early enough for
        // libxml, which then falls back to ISO-8859-1 and mangles quotes and
        // naira signs. The explicit meta forces the right one.
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML(
            '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' . $html,
            LIBXML_NOERROR | LIBXML_NOWARNING
        );
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        return new DOMXPath($doc);
    }

    // ── Small helpers ─────────────────────────────────────────────────────

    private function text(?DOMNode $node): string {
        return $node ? trim(preg_replace('/\s+/u', ' ', $node->textContent)) : '';
    }

    private function absolutise(string $href, string $base): string {
        if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) {
            return $href;
        }

        $parts  = parse_url($base);
        $origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? self::HOST);

        return str_starts_with($href, '/')
            ? $origin . $href
            : rtrim($origin . ($parts['path'] ?? '/'), '/') . '/' . $href;
    }

    /**
     * Punch prints listing dates as local wall-clock time with no zone
     * ("August 3, 2026 8:38 pm"). Everything in this app is stored in UTC, so
     * an unqualified date would land an hour out. Article pages carry a proper
     * ISO timestamp with an offset, which is used in preference.
     */
    private function toUtc(?string $raw, string $assumeZone = 'UTC'): ?string {
        $raw = trim((string) $raw);
        if ($raw === '') return null;

        try {
            $dt = new DateTime($raw, new DateTimeZone($assumeZone));
            return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        } catch (Throwable) {
            return null;
        }
    }

    private function readCache(string $key): ?array {
        $stmt = $this->db->prepare(
            'SELECT payload, fetched_at FROM news_import_cache WHERE cache_key = ? AND expires_at > NOW()'
        );
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $payload = json_decode($row['payload'], true);
        if (!is_array($payload)) return null;

        return ['payload' => $payload, 'fetched_at' => $row['fetched_at']];
    }

    private function writeCache(string $key, array $payload, int $ttl): void {
        $this->db->prepare('
            INSERT INTO news_import_cache (cache_key, payload, fetched_at, expires_at)
            VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))
            ON DUPLICATE KEY UPDATE
                payload    = VALUES(payload),
                fetched_at = VALUES(fetched_at),
                expires_at = VALUES(expires_at)
        ')->execute([$key, json_encode($payload), $ttl]);
    }
}
