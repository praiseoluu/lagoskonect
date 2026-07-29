<?php

/**
 * Lagos Konect — Admin User Controller
 * ============================================================
 * Endpoints:
 *   GET    /admin/users              — list with search, LGA filter, pagination
 *   GET    /admin/users/:id          — get single user
 *   POST   /admin/users              — create user (admin-initiated)
 *   PATCH  /admin/users/:id          — update profile fields
 *   PATCH  /admin/users/:id/status   — suspend or reactivate
 */
class AdminUserController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/users ──────────────────────────────────────────────────

    public function list(): void {
        $this->requireAdmin();
        $p = Paginator::params($_GET, 20);

        $search    = trim($_GET['search']  ?? '');
        $lgaId     = (int) ($_GET['lgaId'] ?? 0);
        $status    = trim($_GET['status']  ?? '');
        $region    = trim($_GET['region']  ?? '');

        $where  = ['role = "citizen"'];
        $params = [];

        if ($search) {
            $where[]  = '(name LIKE ? OR phone LIKE ? OR email LIKE ?)';
            $like     = "%{$search}%";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        if ($lgaId) {
            $where[]  = 'lga_id = ?';
            $params[] = $lgaId;
        }

        if ($status) {
            $where[]  = 'status = ?';
            $params[] = $status;
        }

        if ($region && in_array($region, ['west', 'central', 'east'], true)) {
            $where[]  = 'lga_id IN (SELECT id FROM lgas WHERE region = ?)';
            $params[] = $region;
        }

        $whereStr = 'WHERE ' . implode(' AND ', $where);

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM users {$whereStr}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT * FROM users {$whereStr}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([...$params, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'sanitise'], $stmt->fetchAll());

        // Summary stats (region-scoped when a region is selected)
        $regionWhere  = 'role = "citizen"';
        $regionParams = [];
        if ($region && in_array($region, ['west', 'central', 'east'], true)) {
            $regionWhere   .= ' AND lga_id IN (SELECT id FROM lgas WHERE region = ?)';
            $regionParams[] = $region;
        }

        $totalStmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE {$regionWhere}");
        $totalStmt->execute($regionParams);
        $totalAll = (int) $totalStmt->fetchColumn();

        $activeStmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE {$regionWhere} AND status = \"active\"");
        $activeStmt->execute($regionParams);
        $totalActive = (int) $activeStmt->fetchColumn();

        Response::paginated($items, $p['page'], $p['perPage'], $total, [
            'totalCitizens' => $totalAll,
            'totalActive'   => $totalActive,
        ]);
    }

    // ── GET /admin/users/:id ──────────────────────────────────────────────

    public function getById(int $id): void {
        $this->requireAdmin();
        $user = $this->fetchUser($id);
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);
        Response::json($this->sanitise($user));
    }

    // ── POST /admin/users ─────────────────────────────────────────────────

    public function create(): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $firstName = trim($body['firstName'] ?? '');
        $lastName  = trim($body['lastName']  ?? '');
        $phone     = trim($body['phone']     ?? '');
        $tempPass  = trim($body['tempPassword'] ?? '');
        $lgaId     = (int) ($body['lgaId']   ?? 0);
        $email     = trim($body['email']     ?? '');
        $dob       = trim($body['dob']       ?? '');
        $city      = trim($body['city']      ?? '');
        $address   = trim($body['address']   ?? '');
        $state     = 'Lagos State';

        // Required fields
        if (!$firstName || !$lastName) {
            Response::error('VALIDATION_ERROR', 'First name and last name are required.', 422);
        }
        if (!$phone) {
            Response::error('VALIDATION_ERROR', 'Phone number is required.', 422);
        }
        if (!$tempPass || strlen($tempPass) < 6) {
            Response::error('VALIDATION_ERROR', 'Temporary password must be at least 6 characters.', 422);
        }
        if (!$lgaId) {
            Response::error('VALIDATION_ERROR', 'LGA is required.', 422);
        }

        // Normalise phone
        $normalised = Validator::normalisePhone($phone) ?? $phone;

        // Check phone uniqueness
        $dupStmt = $this->db->prepare('SELECT id FROM users WHERE phone = ?');
        $dupStmt->execute([$normalised]);
        if ($dupStmt->fetch()) {
            Response::error('DUPLICATE', 'A user with this phone number already exists.', 409);
        }

        // Get LGA name
        $lgaStmt = $this->db->prepare('SELECT name FROM lgas WHERE id = ?');
        $lgaStmt->execute([$lgaId]);
        $lga = $lgaStmt->fetch();
        if (!$lga) Response::error('INVALID_LGA', 'Invalid LGA.', 422);

        // Title-case city helper
        $city = $this->titleCase($city);

        $fullName = $this->titleCase("{$firstName} {$lastName}");
        $hashed   = password_hash($tempPass, PASSWORD_BCRYPT);

        $stmt = $this->db->prepare('
            INSERT INTO users
                (name, phone, email, password, lga_id, lga_name, state, city, address, dob,
                 role, status, is_verified, must_change_password, has_seen_welcome, created_at, updated_at)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 "citizen", "active", 1, 1, 0, NOW(), NOW())
        ');
        $stmt->execute([
            $fullName, $normalised,
            $email ?: null, $hashed,
            $lgaId, $lga['name'], $state, $city ?: null,
            $address ?: null, $dob ?: null,
        ]);

        $newId = (int) $this->db->lastInsertId();
        $user  = $this->fetchUser($newId);
        Response::json($this->sanitise($user), 201);
    }

    // ── PATCH /admin/users/:id ────────────────────────────────────────────

    public function update(int $id): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $user = $this->fetchUser($id);
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);

        $fields = [];
        $values = [];

        if (isset($body['firstName']) || isset($body['lastName'])) {
            $fn = $this->titleCase(trim($body['firstName'] ?? explode(' ', $user['name'])[0]));
            $ln = $this->titleCase(trim($body['lastName']  ?? implode(' ', array_slice(explode(' ', $user['name']), 1))));
            $fields[] = 'name = ?';
            $values[] = trim("{$fn} {$ln}");
        }

        if (isset($body['phone'])) {
            $normalised = Validator::normalisePhone(trim($body['phone'])) ?? trim($body['phone']);
            $dupStmt = $this->db->prepare('SELECT id FROM users WHERE phone = ? AND id != ?');
            $dupStmt->execute([$normalised, $id]);
            if ($dupStmt->fetch()) {
                Response::error('DUPLICATE', 'Phone number already in use.', 409);
            }
            $fields[] = 'phone = ?';
            $values[] = $normalised;
        }

        if (isset($body['email'])) {
            $email = trim($body['email']);
            if ($email && !Validator::isEmail($email)) {
                Response::error('VALIDATION_ERROR', 'Invalid email.', 422);
            }
            $fields[] = 'email = ?';
            $values[] = $email ?: null;
        }

        if (isset($body['dob'])) {
            $fields[] = 'dob = ?';
            $values[] = $body['dob'] ?: null;
        }

        if (isset($body['city'])) {
            $fields[] = 'city = ?';
            $values[] = $this->titleCase(trim($body['city'])) ?: null;
        }

        if (isset($body['address'])) {
            $fields[] = 'address = ?';
            $values[] = trim($body['address']) ?: null;
        }

        if (isset($body['lgaId'])) {
            $lgaId   = (int) $body['lgaId'];
            $lgaStmt = $this->db->prepare('SELECT name FROM lgas WHERE id = ?');
            $lgaStmt->execute([$lgaId]);
            $lga = $lgaStmt->fetch();
            if (!$lga) Response::error('INVALID_LGA', 'Invalid LGA.', 422);
            $fields[] = 'lga_id = ?';
            $values[] = $lgaId;
            $fields[] = 'lga_name = ?';
            $values[] = $lga['name'];
        }

        if (empty($fields)) {
            Response::error('VALIDATION_ERROR', 'No valid fields to update.', 422);
        }

        $fields[]  = 'updated_at = NOW()';
        $values[]  = $id;
        $this->db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')
                 ->execute($values);

        Response::json($this->sanitise($this->fetchUser($id)));
    }

    // ── PATCH /admin/users/:id/status ─────────────────────────────────────

    public function setStatus(int $id): void {
        $this->requireAdmin();
        $body   = Validator::jsonBody() ?? [];
        $status = trim($body['status'] ?? '');

        if (!in_array($status, ['active', 'suspended'], true)) {
            Response::error('VALIDATION_ERROR', 'status must be "active" or "suspended".', 422);
        }

        $user = $this->fetchUser($id);
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);

        $this->db->prepare('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$status, $id]);

        Response::json($this->sanitise($this->fetchUser($id)));
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private function requireAdmin(): void {
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
    }

    private function fetchUser(int $id): ?array {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    private function titleCase(string $str): string {
        return implode(' ', array_map('ucfirst', array_map('strtolower', explode(' ', $str))));
    }

    private function sanitise(array $u): array {
        // Split name into first/last for the modal
        $parts     = explode(' ', $u['name'], 2);
        $firstName = $parts[0] ?? '';
        $lastName  = $parts[1] ?? '';

        return [
            'id'                  => (int) $u['id'],
            'citizenId'           => (string) $u['id'], // 100001 format
            'username'            => $u['username'] ?? '',
            'firstName'           => $firstName,
            'lastName'            => $lastName,
            'name'                => $u['name'],
            'phone'               => $u['phone'],
            'email'               => $u['email'],
            'bio'                 => $u['bio'] ?? null,
            'dob'                 => $u['dob'],
            'city'                => $u['city'],
            'state'               => $u['state'] ?? 'Lagos State',
            'address'             => $u['address'],
            'lgaId'               => $u['lga_id'] ? (int) $u['lga_id'] : null,
            'lgaName'             => $u['lga_name'],
            'avatarUrl'           => $u['avatar_url'],
            'role'                => $u['role'],
            'status'              => $u['status'],
            'isVerified'          => (bool) $u['is_verified'],
            'mustChangePassword'  => (bool) ($u['must_change_password'] ?? false),
            'createdAt'           => $u['created_at'],
            'lastSeenAt'          => $u['last_seen_at'],
        ];
    }
}
