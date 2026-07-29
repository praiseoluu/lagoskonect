<?php

class AdvertController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /adverts ──────────────────────────────────────────────────────

    public function getForLGA(): void {
        if (!Settings::is('adverts_enabled')) {
            Response::json([]); return;
        }
        $auth   = requireRole('citizen');
        $lgaId  = $auth['lgaId'];
        $type   = trim($_GET['type'] ?? '');

        $sql = "
            SELECT a.*
            FROM adverts a
            WHERE a.status = 'active'
              AND (a.start_date IS NULL OR a.start_date <= CURDATE())
              AND (a.end_date   IS NULL OR a.end_date   >= CURDATE())
        ";
        $params = [];

        if ($type) {
            $sql .= ' AND a.type = ?';
            $params[] = $type;
        }

        $sql .= "
              AND (
                a.target_all_lgas = 1
                OR EXISTS (
                    SELECT 1 FROM advert_lga_targets alt
                    WHERE alt.advert_id = a.id AND alt.lga_id = ?
                )
              )
            ORDER BY a.created_at DESC
        ";
        $params[] = $lgaId;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $rows = $stmt->fetchAll();

        // Track impressions for each served advert
        if (!empty($rows)) {
            $ids = implode(',', array_map(fn($a) => (int) $a['id'], $rows));
            $this->db->exec("UPDATE adverts SET impressions = impressions + 1 WHERE id IN ({$ids})");
        }

        $items = array_map(fn($a) => [
            'id'          => (int) $a['id'],
            'title'       => $a['title'],
            'advertiser'  => $a['advertiser'],
            'description' => $a['description'],
            'ctaLabel'    => $a['cta_label'],
            'ctaUrl'      => $a['cta_url'],
            'imageUrl'    => $a['image_url'],
            'type'        => $a['type'],
            'status'      => $a['status'],
        ], $rows);

        Response::json($items);
    }

    // ── GET /adverts/public ───────────────────────────────────────────────
    // No auth required — returns active banner ads targeting all LGAs.
    // Used by the public landing page.

    public function getPublic(): void {
        if (!Settings::is('adverts_enabled')) {
            Response::json([]); return;
        }

        $stmt = $this->db->query("
            SELECT id, title, advertiser, description, cta_label, cta_url, image_url, type
            FROM adverts
            WHERE status = 'active'
              AND type = 'banner'
              AND target_all_lgas = 1
              AND (start_date IS NULL OR start_date <= CURDATE())
              AND (end_date   IS NULL OR end_date   >= CURDATE())
            ORDER BY RAND()
            LIMIT 4
        ");

        $rows = $stmt->fetchAll();

        if (!empty($rows)) {
            $ids = implode(',', array_map(fn($a) => (int) $a['id'], $rows));
            $this->db->exec("UPDATE adverts SET impressions = impressions + 1 WHERE id IN ({$ids})");
        }

        $items = array_map(fn($a) => [
            'id'          => (int) $a['id'],
            'title'       => $a['title'],
            'advertiser'  => $a['advertiser'],
            'description' => $a['description'],
            'ctaLabel'    => $a['cta_label'],
            'ctaUrl'      => $a['cta_url'],
            'imageUrl'    => $a['image_url'],
            'type'        => $a['type'],
        ], $rows);

        Response::json($items);
    }
}