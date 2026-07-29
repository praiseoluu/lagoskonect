<?php

/**
 * KTG Connect — Admin LGA Controller
 * ============================================================
 * Endpoints:
 *   GET    /admin/lgas            — paginated list with search
 *   GET    /admin/lgas/metrics    — total count
 *   GET    /admin/lgas/export     — CSV download
 *   POST   /admin/lgas            — create LGA (blocked if name duplicate)
 *   PATCH  /admin/lgas/:id        — update name / state / chairman
 *   POST   /admin/lgas/:id/merge  — merge duplicate into target LGA
 */
class AdminLgaController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/lgas ───────────────────────────────────────────────────

    public function list(): void {
        $this->requireAdmin();
        $p      = Paginator::params($_GET, 10);
        $search = trim($_GET['search'] ?? '');

        $where  = ['1=1'];
        $params = [];

        if ($search) {
            $where[]  = '(l.name LIKE ? OR l.state LIKE ? OR l.chairman_name LIKE ?)';
            $like     = "%{$search}%";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereStr  = implode(' AND ', $where);
        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM lgas l WHERE {$whereStr}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT
                l.*,
                COUNT(u.id) AS user_count
            FROM lgas l
            LEFT JOIN users u ON u.lga_id = l.id
            WHERE {$whereStr}
            GROUP BY l.id
            ORDER BY l.name ASC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([...$params, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /admin/lgas/metrics ───────────────────────────────────────────

    public function metrics(): void {
        $this->requireAdmin();

        $total = (int) $this->db->query('SELECT COUNT(*) FROM lgas')->fetchColumn();

        Response::json(['totalLgas' => $total]);
    }

    // ── GET /admin/lgas/export ────────────────────────────────────────────

    public function export(): void {
        $this->requireAdmin();

        $stmt = $this->db->query('
            SELECT
                l.id,
                l.name,
                l.state,
                l.is_capital,
                l.chairman_name,
                COUNT(u.id) AS user_count,
                l.updated_at
            FROM lgas l
            LEFT JOIN users u ON u.lga_id = l.id
            GROUP BY l.id
            ORDER BY l.name ASC
        ');
        $rows = $stmt->fetchAll();

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="lgas_export_' . date('Y-m-d') . '.csv"');
        header('Pragma: no-cache');

        $out = fopen('php://output', 'w');
        fputcsv($out, ['LGA ID', 'Name', 'State', 'Is Capital', 'Chairman', 'Registered Users', 'Last Updated']);

        foreach ($rows as $r) {
            fputcsv($out, [
                'LG' . str_pad($r['id'], 5, '0', STR_PAD_LEFT),
                $r['name'],
                $r['state'],
                $r['is_capital'] ? 'Yes' : 'No',
                $r['chairman_name'] ?? '',
                $r['user_count'],
                $r['updated_at'],
            ]);
        }

        fclose($out);
        exit;
    }

    // ── POST /admin/lgas ──────────────────────────────────────────────────

    public function create(): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $name = trim($body['name'] ?? '');
        if (!$name) Response::error('VALIDATION_ERROR', 'LGA name is required.', 422);

        // Block duplicates
        $checkStmt = $this->db->prepare('SELECT id FROM lgas WHERE LOWER(name) = LOWER(?)');
        $checkStmt->execute([$name]);
        if ($checkStmt->fetch()) {
            Response::error('DUPLICATE', 'An LGA with this name already exists.', 409);
        }

        $stmt = $this->db->prepare('
            INSERT INTO lgas (name, state, is_capital, chairman_name, updated_at)
            VALUES (?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $name,
            trim($body['state']        ?? ''),
            (bool) ($body['isCapital'] ?? false) ? 1 : 0,
            trim($body['chairmanName'] ?? '') ?: null,
        ]);

        $id  = (int) $this->db->lastInsertId();
        $lga = $this->fetchFull($id);
        Response::json($this->format($lga), 201);
    }

    // ── PATCH /admin/lgas/:id ─────────────────────────────────────────────

    public function update(int $id): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $stmt = $this->db->prepare('SELECT id FROM lgas WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) Response::error('NOT_FOUND', 'LGA not found.', 404);

        $fields = [];
        $values = [];

        if (array_key_exists('name', $body)) {
            $newName = trim($body['name']);
            if (!$newName) Response::error('VALIDATION_ERROR', 'LGA name cannot be empty.', 422);

            // Check duplicate name (excluding self)
            $dupStmt = $this->db->prepare('SELECT id FROM lgas WHERE LOWER(name) = LOWER(?) AND id != ?');
            $dupStmt->execute([$newName, $id]);
            if ($dupStmt->fetch()) {
                Response::error('DUPLICATE', 'An LGA with this name already exists.', 409);
            }
            $fields[] = 'name = ?';
            $values[] = $newName;
        }

        if (array_key_exists('state', $body)) {
            $fields[] = 'state = ?';
            $values[] = trim($body['state']);
        }

        if (array_key_exists('isCapital', $body)) {
            $fields[] = 'is_capital = ?';
            $values[] = $body['isCapital'] ? 1 : 0;
        }

        if (array_key_exists('chairmanName', $body)) {
            $fields[] = 'chairman_name = ?';
            $values[] = trim($body['chairmanName']) ?: null;
        }

        if (!empty($fields)) {
            $values[] = $id;
            $this->db->prepare('UPDATE lgas SET ' . implode(', ', $fields) . ' WHERE id = ?')
                     ->execute($values);
        }

        Response::json($this->format($this->fetchFull($id)));
    }

    // ── POST /admin/lgas/:id/merge ────────────────────────────────────────
    // Merges this LGA (duplicate) into targetId (correct one).
    // All users on the duplicate are moved to the target.
    // The duplicate is then deleted.

    public function merge(int $id): void {
        $this->requireAdmin();
        $body     = Validator::jsonBody() ?? [];
        $targetId = (int) ($body['targetId'] ?? 0);

        if (!$targetId)    Response::error('VALIDATION_ERROR', 'targetId is required.', 422);
        if ($id === $targetId) Response::error('VALIDATION_ERROR', 'Cannot merge an LGA with itself.', 422);

        // Verify both exist
        $srcStmt = $this->db->prepare('SELECT id, name FROM lgas WHERE id = ?');
        $srcStmt->execute([$id]);
        $src = $srcStmt->fetch();
        if (!$src) Response::error('NOT_FOUND', 'Source LGA not found.', 404);

        $tgtStmt = $this->db->prepare('SELECT id, name FROM lgas WHERE id = ?');
        $tgtStmt->execute([$targetId]);
        $tgt = $tgtStmt->fetch();
        if (!$tgt) Response::error('NOT_FOUND', 'Target LGA not found.', 404);

        $this->db->beginTransaction();
        try {
            // Move all users from duplicate → target
            $this->db->prepare('UPDATE users SET lga_id = ? WHERE lga_id = ?')
                     ->execute([$targetId, $id]);

            // Move citizen reels
            $this->db->prepare('UPDATE reels SET lga_id = ? WHERE lga_id = ?')
                     ->execute([$targetId, $id]);

            // Move news targets
            $this->db->prepare('UPDATE news_lga_targets SET lga_id = ? WHERE lga_id = ?')
                     ->execute([$targetId, $id]);

            // Move reel targets
            $this->db->prepare('UPDATE reel_lga_targets SET lga_id = ? WHERE lga_id = ?')
                     ->execute([$targetId, $id]);

            // Move advert targets
            $this->db->prepare('UPDATE advert_lga_targets SET lga_id = ? WHERE lga_id = ?')
                     ->execute([$targetId, $id]);

            // Delete the duplicate
            $this->db->prepare('DELETE FROM lgas WHERE id = ?')->execute([$id]);

            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            Response::error('DB_ERROR', 'Merge failed: ' . $e->getMessage(), 500);
        }

        Response::json([
            'merged'     => true,
            'fromId'     => $id,
            'fromName'   => $src['name'],
            'toId'       => $targetId,
            'toName'     => $tgt['name'],
        ]);
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

    private function fetchFull(int $id): ?array {
        $stmt = $this->db->prepare('
            SELECT l.*, COUNT(u.id) AS user_count
            FROM lgas l
            LEFT JOIN users u ON u.lga_id = l.id
            WHERE l.id = ?
            GROUP BY l.id
        ');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    private function format(array $l): array {
        return [
            'id'           => (int) $l['id'],
            'displayId'    => 'LG' . str_pad($l['id'], 5, '0', STR_PAD_LEFT),
            'name'         => $l['name'],
            'state'        => $l['state'],
            'isCapital'    => (bool) $l['is_capital'],
            'chairmanName' => $l['chairman_name'] ?? null,
            'userCount'    => (int) ($l['user_count'] ?? 0),
            'updatedAt'    => $l['updated_at'] ?? null,
        ];
    }
}