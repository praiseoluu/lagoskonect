<?php

/**
 * WorldNewsService — thin client for api.worldnewsapi.com.
 *
 * The account is on the free tier (50 points/day, 1 request/sec, 1 concurrent
 * request), so this class is deliberately stingy:
 *
 *   - Every response is cached per country + date. Repeat visits to the review
 *     screen cost nothing.
 *   - A daily call budget is enforced locally before a request is sent, so a
 *     stuck loop in the UI cannot drain the quota.
 *   - Calls are spaced to respect the one-per-second limit.
 *
 * The API key lives in server/.env as WORLDNEWS_API_KEY and must never reach
 * the browser — the admin UI talks to our own endpoints, never to the upstream.
 */
class WorldNewsService {

    private const BASE = 'https://api.worldnewsapi.com';

    /** How long a cached country+date response stays fresh. */
    private const CACHE_TTL_SECONDS = 43200;   // 12 hours

    /** Upper bound on upstream calls per calendar day (free tier is 50 points). */
    private const DAILY_CALL_BUDGET = 20;

    /** Minimum spacing between upstream calls, to honour 1 request/second. */
    private const MIN_CALL_GAP_SECONDS = 2;

    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public static function isConfigured(): bool {
        return (getenv('WORLDNEWS_API_KEY') ?: '') !== '';
    }

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Top news for a country and date.
     *
     * @param string $country  ISO-3166 country code, e.g. "ng"
     * @param string $date     YYYY-MM-DD
     * @param bool   $refresh  Bypass the cache (still subject to the budget)
     * @return array{articles: array, cached: bool, fetchedAt: string, quota: array}
     */
    public function topNews(string $country, string $date, bool $refresh = false): array {
        $key = "top-news:{$country}:{$date}";

        if (!$refresh) {
            $hit = $this->readCache($key);
            if ($hit !== null) {
                return [
                    'articles'  => $this->flatten($hit['payload']),
                    'cached'    => true,
                    'fetchedAt' => $hit['fetched_at'],
                    'quota'     => $this->quota(),
                ];
            }
        }

        $payload = $this->call('/top-news', [
            'source-country' => $country,
            'language'       => 'en',
            'date'           => $date,
        ]);

        $this->writeCache($key, $payload);

        return [
            'articles'  => $this->flatten($payload),
            'cached'    => false,
            'fetchedAt' => date('Y-m-d H:i:s'),
            'quota'     => $this->quota(),
        ];
    }

    /** Current local budget picture, for display in the admin UI. */
    public function quota(): array {
        $stmt = $this->db->prepare('SELECT calls, last_call_at FROM news_import_usage WHERE usage_date = ?');
        $stmt->execute([date('Y-m-d')]);
        $row = $stmt->fetch() ?: ['calls' => 0, 'last_call_at' => null];

        return [
            'callsToday' => (int) $row['calls'],
            'dailyLimit' => self::DAILY_CALL_BUDGET,
            'remaining'  => max(0, self::DAILY_CALL_BUDGET - (int) $row['calls']),
            'lastCallAt' => $row['last_call_at'],
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────

    /**
     * The upstream nests articles as top_news[] -> news[], where each group is
     * one cluster of coverage of the same story. The review list wants a flat
     * list, so keep the first item of each cluster and note how many others it
     * stood in for.
     */
    private function flatten(array $payload): array {
        $out = [];

        foreach (($payload['top_news'] ?? []) as $cluster) {
            $items = $cluster['news'] ?? [];
            if (!$items) continue;

            $lead = $items[0];
            $out[] = [
                'externalId'  => (string) ($lead['id'] ?? ''),
                'title'       => $lead['title']   ?? '',
                'summary'     => $lead['summary'] ?? '',
                'text'        => $lead['text']    ?? '',
                'url'         => $lead['url']     ?? '',
                'image'       => $lead['image']   ?? null,
                'publishDate' => $lead['publish_date'] ?? null,
                'authors'     => $lead['authors'] ?? [],
                'sourceName'  => $this->hostOf($lead['url'] ?? ''),
                'category'    => $lead['category'] ?? null,
                'alsoCovered' => max(0, count($items) - 1),
            ];
        }

        return $out;
    }

    private function hostOf(string $url): string {
        $host = parse_url($url, PHP_URL_HOST) ?: '';
        return preg_replace('/^www\./', '', $host);
    }

    /**
     * Performs the upstream request after checking the budget and spacing.
     * Throws RuntimeException with a message fit for showing to the admin.
     */
    private function call(string $path, array $query): array {
        $key = getenv('WORLDNEWS_API_KEY') ?: '';
        if ($key === '') {
            throw new RuntimeException('News import is not configured: WORLDNEWS_API_KEY is missing.');
        }

        $quota = $this->quota();
        if ($quota['remaining'] <= 0) {
            throw new RuntimeException(
                "Daily import budget reached ({$quota['dailyLimit']} calls). Cached results are still available, "
                . 'or try again tomorrow.'
            );
        }

        // Honour the one-request-per-second ceiling.
        if ($quota['lastCallAt']) {
            $since = time() - strtotime($quota['lastCallAt']);
            if ($since < self::MIN_CALL_GAP_SECONDS) {
                sleep(self::MIN_CALL_GAP_SECONDS - $since);
            }
        }

        $url = self::BASE . $path . '?' . http_build_query($query);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['x-api-key: ' . $key],
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
        ]);

        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err    = curl_error($ch);
        curl_close($ch);

        // Count the call whatever the outcome — the quota upstream was spent.
        $this->recordCall();

        if ($body === false) {
            throw new RuntimeException('Could not reach the news provider: ' . $err);
        }

        if ($status === 401 || $status === 403) {
            throw new RuntimeException('The news provider rejected the API key.');
        }
        if ($status === 402 || $status === 429) {
            throw new RuntimeException('The news provider quota is exhausted for now. Try again later.');
        }
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException("News provider returned HTTP {$status}.");
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('News provider returned an unreadable response.');
        }

        return $decoded;
    }

    private function recordCall(): void {
        $this->db->prepare('
            INSERT INTO news_import_usage (usage_date, calls, last_call_at)
            VALUES (?, 1, NOW())
            ON DUPLICATE KEY UPDATE calls = calls + 1, last_call_at = NOW()
        ')->execute([date('Y-m-d')]);
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

    private function writeCache(string $key, array $payload): void {
        $this->db->prepare('
            INSERT INTO news_import_cache (cache_key, payload, fetched_at, expires_at)
            VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))
            ON DUPLICATE KEY UPDATE
                payload    = VALUES(payload),
                fetched_at = VALUES(fetched_at),
                expires_at = VALUES(expires_at)
        ')->execute([$key, json_encode($payload), self::CACHE_TTL_SECONDS]);
    }
}
