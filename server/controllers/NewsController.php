<?php

class NewsController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /news ────────────────────────────────────────────────────────

    public function getForLGA(): void {
        $auth  = requireRole('citizen');
        $lgaId = $auth['lgaId'];
        $p     = Paginator::params($_GET, 10);

        // A news item is visible to this user if:
        //   (a) target_all_lgas = 1  — broadcast to everyone
        //   (b) target_all_lgas = 0  — AND this lgaId is in news_lga_targets
        $countStmt = $this->db->prepare('
            SELECT COUNT(DISTINCT n.id)
            FROM news n
            WHERE n.status = "published"
              AND (
                n.target_all_lgas = 1
                OR EXISTS (
                    SELECT 1 FROM news_lga_targets nlt
                    WHERE nlt.news_id = n.id AND nlt.lga_id = ?
                )
              )
        ');
        $countStmt->execute([$lgaId]);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare('
            SELECT DISTINCT n.*
            FROM news n
            WHERE n.status = "published"
              AND (
                n.target_all_lgas = 1
                OR EXISTS (
                    SELECT 1 FROM news_lga_targets nlt
                    WHERE nlt.news_id = n.id AND nlt.lga_id = ?
                )
              )
            ORDER BY n.published_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$lgaId, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /news/:slug ──────────────────────────────────────────────────

    public function getBySlug(string $slug): void {
        $auth  = requireRole('citizen');
        $lgaId = $auth['lgaId'];

        // Fetch the item — also verify this user's LGA can see it
        $stmt = $this->db->prepare('
            SELECT n.*
            FROM news n
            WHERE n.slug = ?
              AND n.status = "published"
              AND (
                n.target_all_lgas = 1
                OR EXISTS (
                    SELECT 1 FROM news_lga_targets nlt
                    WHERE nlt.news_id = n.id AND nlt.lga_id = ?
                )
              )
            LIMIT 1
        ');
        $stmt->execute([$slug, $lgaId]);
        $item = $stmt->fetch();

        if (!$item) Response::error('NOT_FOUND', 'News item not found.', 404);

        // Increment views
        $this->db->prepare('UPDATE news SET views = views + 1 WHERE id = ?')
                 ->execute([$item['id']]);
        $item['views']++;

        // Attach target LGA list for context
        $item['targetLgaIds'] = $this->getTargetLgaIds((int)$item['id']);

        Response::json($this->format($item));
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private function getTargetLgaIds(int $newsId): array {
        $stmt = $this->db->prepare('SELECT lga_id FROM news_lga_targets WHERE news_id = ?');
        $stmt->execute([$newsId]);
        return array_column($stmt->fetchAll(), 'lga_id');
    }

    private function format(array $item): array {
        $classification = json_decode($item['classification'] ?? '[]', true) ?: [];
        return [
            'id'             => (int) $item['id'],
            'lgaId'          => $item['lga_id'] ? (int) $item['lga_id'] : null,
            'lgaName'        => $item['lga_name'],
            'targetAllLGAs'  => (bool) $item['target_all_lgas'],
            'targetLgaIds'   => $item['targetLgaIds'] ?? [],
            'slug'           => $item['slug'],
            'title'          => $item['title'],
            'summary'        => $item['summary'],
            'body'           => $item['body'],
            'imageUrl'       => $item['image_url'],
            'classification' => $classification,
            'category'       => $item['category'] ?? ($classification[0] ?? 'General'),
            'breaking'       => (bool) $item['breaking'],
            'sourceUrl'      => $item['source_url'],
            'sourceName'     => $item['source_name'],
            'status'         => $item['status'],
            'views'          => (int) $item['views'],
            'publishedAt'    => $item['published_at'],
            'isHeadline'     => (bool) ($item['is_headline'] ?? false),
            'createdAt'      => $item['created_at'],
        ];
    }
}