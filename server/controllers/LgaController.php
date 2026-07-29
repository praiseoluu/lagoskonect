<?php

class LgaController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /lgas ─────────────────────────────────────────────────────────

    public function getAll(): void {
        $stmt = $this->db->query('
            SELECT id, name, state, region, is_capital, chairman_name
            FROM lgas
            ORDER BY name ASC
        ');
        $lgas = $stmt->fetchAll();

        $formatted = array_map(fn($l) => [
            'id'           => (int) $l['id'],
            'name'         => $l['name'],
            'state'        => $l['state'],
            'region'       => $l['region'],
            'isCapital'    => (bool) $l['is_capital'],
            'chairmanName' => $l['chairman_name'] ?? null,
        ], $lgas);

        Response::json($formatted);
    }
}
