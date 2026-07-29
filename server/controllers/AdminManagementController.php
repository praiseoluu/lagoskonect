<?php

/**
 * KTG Connect — Admin Management Controller
 * ============================================================
 * Self-service (any admin):
 *   GET   /admin/me               — get own profile
 *   PATCH /admin/me               — update own name
 *   PATCH /admin/me/password      — change own password
 *
 * Team management (super_admin only):
 *   GET   /admin/team             — list all admins (paginated with ?page, ?perPage, ?search)
 *   POST  /admin/team             — invite / create admin
 *   GET   /admin/team/:id         — get single admin
 *   PATCH /admin/team/:id         — update admin full profile
 *   PATCH /admin/team/:id/role    — change role
 *   PATCH /admin/team/:id/status  — activate / deactivate
 *   DELETE /admin/team/:id        — remove admin (cannot remove self or last super_admin)
 */
class AdminManagementController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/me ─────────────────────────────────────────────────────

    public function getMe(): void {
        $auth  = $this->requireAdmin();
        $admin = $this->fetchAdmin($auth['adminId']);
        if (!$admin) Response::error('NOT_FOUND', 'Admin not found.', 404);
        Response::json($this->format($admin));
    }

    // ── PATCH /admin/me ───────────────────────────────────────────────────

    public function updateMe(): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $fields = [];
        $values = [];

        if (array_key_exists('name', $body)) {
            $name = trim($body['name']);
            if (!$name) Response::error('VALIDATION_ERROR', 'Name cannot be empty.', 422);
            $fields[] = 'name = ?';
            $values[] = $name;
        }
        foreach (['phone', 'state', 'city'] as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = ?";
                $values[] = trim($body[$col]) ?: null;
            }
        }

        if (empty($fields)) Response::error('VALIDATION_ERROR', 'Nothing to update.', 422);

        $fields[] = 'updated_at = NOW()';
        $values[] = $auth['adminId'];
        $this->db->prepare('UPDATE admins SET ' . implode(', ', $fields) . ' WHERE id = ?')
                 ->execute($values);

        Response::json($this->format($this->fetchAdmin($auth['adminId'])));
    }

    // ── PATCH /admin/me/password ──────────────────────────────────────────

    public function changeMyPassword(): void {
        $auth = $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $current  = trim($body['currentPassword'] ?? '');
        $newPass  = trim($body['newPassword']     ?? '');

        if (!$current) Response::error('VALIDATION_ERROR', 'Current password is required.', 422);
        if (strlen($newPass) < 8) Response::error('VALIDATION_ERROR', 'New password must be at least 8 characters.', 422);

        $stmt = $this->db->prepare('SELECT password FROM admins WHERE id = ?');
        $stmt->execute([$auth['adminId']]);
        $admin = $stmt->fetch();

        if (!$admin || !password_verify($current, $admin['password'])) {
            Response::error('INVALID_PASSWORD', 'Current password is incorrect.', 422);
        }

        $hashed = password_hash($newPass, PASSWORD_BCRYPT);
        $this->db->prepare('UPDATE admins SET password = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$hashed, $auth['adminId']]);

        Response::json(['changed' => true]);
    }

    // ── GET /admin/team ───────────────────────────────────────────────────

    public function listTeam(): void {
        $auth    = $this->requireAdmin();
        $search  = trim($_GET['search']  ?? '');
        $page    = max(1, (int)($_GET['page']    ?? 0));
        $perPage = max(1, min(100, (int)($_GET['perPage'] ?? 0)));
        $paginate = isset($_GET['page']);

        $where  = $search ? 'WHERE (name LIKE ? OR email LIKE ?)' : '';
        $params = $search ? ["%$search%", "%$search%"] : [];

        $orderBy = 'ORDER BY FIELD(role, "super_admin", "admin"), name ASC';

        if ($paginate) {
            $countStmt = $this->db->prepare("SELECT COUNT(*) FROM admins $where");
            $countStmt->execute($params);
            $total = (int) $countStmt->fetchColumn();

            $offset = ($page - 1) * $perPage;
            $dataParams = array_merge($params, [$perPage, $offset]);
            $stmt = $this->db->prepare("SELECT * FROM admins $where $orderBy LIMIT ? OFFSET ?");
            $stmt->execute($dataParams);
            $admins = array_map([$this, 'format'], $stmt->fetchAll());
            Response::json(['data' => $admins, 'total' => $total, 'page' => $page, 'perPage' => $perPage]);
        } else {
            $stmt = $this->db->prepare("SELECT * FROM admins $where $orderBy");
            $stmt->execute($params);
            $admins = array_map([$this, 'format'], $stmt->fetchAll());
            Response::json($admins);
        }
    }

    // ── GET /admin/team/:id ───────────────────────────────────────────────

    public function getTeamMember(int $id): void {
        $auth  = $this->requireAdmin();
        $this->requireSuperAdmin($auth);
        $admin = $this->fetchAdmin($id);
        if (!$admin) Response::error('NOT_FOUND', 'Admin not found.', 404);
        Response::json($this->format($admin));
    }

    // ── PATCH /admin/team/:id ─────────────────────────────────────────────

    public function updateTeamMember(int $id): void {
        $auth = $this->requireAdmin();
        $this->requireSuperAdmin($auth);

        $admin = $this->fetchAdmin($id);
        if (!$admin) Response::error('NOT_FOUND', 'Admin not found.', 404);

        $body   = Validator::jsonBody() ?? [];
        $fields = [];
        $values = [];

        // Full name from surname + firstName
        if (array_key_exists('surname', $body) || array_key_exists('firstName', $body)) {
            $surname   = trim($body['surname']   ?? explode(' ', $admin['name'], 2)[1] ?? '');
            $firstName = trim($body['firstName'] ?? explode(' ', $admin['name'], 2)[0] ?? '');
            $fullName  = trim($firstName . ' ' . $surname);
            if (!$fullName) Response::error('VALIDATION_ERROR', 'Name cannot be empty.', 422);
            $fields[] = 'name = ?';
            $values[] = $fullName;
        }

        foreach (['phone', 'state', 'city'] as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = ?";
                $values[] = trim($body[$col]) ?: null;
            }
        }

        if (array_key_exists('role', $body)) {
            $role = trim($body['role']);
            if (!in_array($role, ['super_admin', 'admin'], true)) {
                Response::error('VALIDATION_ERROR', 'Invalid role.', 422);
            }
            if ($id === $auth['adminId'] && $role !== 'super_admin') {
                Response::error('FORBIDDEN', 'You cannot demote yourself.', 403);
            }
            $fields[] = 'role = ?';
            $values[] = $role;
        }

        // Optional password reset
        if (!empty($body['password'])) {
            $pass = trim($body['password']);
            if (strlen($pass) < 8) Response::error('VALIDATION_ERROR', 'Password must be at least 8 characters.', 422);
            $fields[] = 'password = ?';
            $values[] = password_hash($pass, PASSWORD_BCRYPT);
        }

        if (empty($fields)) Response::error('VALIDATION_ERROR', 'Nothing to update.', 422);

        $fields[] = 'updated_at = NOW()';
        $values[] = $id;
        $this->db->prepare('UPDATE admins SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

        Response::json($this->format($this->fetchAdmin($id)));
    }

    // ── POST /admin/team ──────────────────────────────────────────────────

    public function createTeamMember(): void {
        $auth = $this->requireAdmin();
        $this->requireSuperAdmin($auth);

        $body  = Validator::jsonBody() ?? [];
        $name  = trim($body['name']  ?? '');
        $email = trim($body['email'] ?? '');
        $role  = trim($body['role']  ?? 'admin');
        $pass  = trim($body['temporaryPassword'] ?? '');

        if (!$name)  Response::error('VALIDATION_ERROR', 'Name is required.', 422);
        if (!$email) Response::error('VALIDATION_ERROR', 'Email is required.', 422);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('VALIDATION_ERROR', 'Invalid email.', 422);
        if (!in_array($role, ['super_admin', 'admin'], true)) {
            Response::error('VALIDATION_ERROR', 'Invalid role.', 422);
        }
        if (strlen($pass) < 8) Response::error('VALIDATION_ERROR', 'Temporary password must be at least 8 characters.', 422);

        $dupStmt = $this->db->prepare('SELECT id FROM admins WHERE email = ?');
        $dupStmt->execute([$email]);
        if ($dupStmt->fetch()) Response::error('DUPLICATE', 'An admin with this email already exists.', 409);

        $hashed = password_hash($pass, PASSWORD_BCRYPT);
        $this->db->prepare('
            INSERT INTO admins (name, email, password, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, "active", NOW(), NOW())
        ')->execute([$name, $email, $hashed, $role]);

        $newId = (int) $this->db->lastInsertId();
        Response::json($this->format($this->fetchAdmin($newId)), 201);
    }

    // ── PATCH /admin/team/:id/role ────────────────────────────────────────

    public function updateRole(int $id): void {
        $auth = $this->requireAdmin();
        $this->requireSuperAdmin($auth);

        $body = Validator::jsonBody() ?? [];
        $role = trim($body['role'] ?? '');

        if (!in_array($role, ['super_admin', 'admin'], true)) {
            Response::error('VALIDATION_ERROR', 'Invalid role.', 422);
        }

        $admin = $this->fetchAdmin($id);
        if (!$admin) Response::error('NOT_FOUND', 'Admin not found.', 404);

        // Cannot demote self
        if ($id === $auth['adminId'] && $role !== 'super_admin') {
            Response::error('FORBIDDEN', 'You cannot change your own role.', 403);
        }

        $this->db->prepare('UPDATE admins SET role = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$role, $id]);

        Response::json($this->format($this->fetchAdmin($id)));
    }

    // ── PATCH /admin/team/:id/status ──────────────────────────────────────

    public function updateStatus(int $id): void {
        $auth = $this->requireAdmin();
        $this->requireSuperAdmin($auth);

        $body   = Validator::jsonBody() ?? [];
        $status = trim($body['status'] ?? '');

        if (!in_array($status, ['active', 'suspended'], true)) {
            Response::error('VALIDATION_ERROR', 'Status must be active or suspended.', 422);
        }

        if ($id === $auth['adminId']) {
            Response::error('FORBIDDEN', 'You cannot change your own status.', 403);
        }

        $admin = $this->fetchAdmin($id);
        if (!$admin) Response::error('NOT_FOUND', 'Admin not found.', 404);

        $this->db->prepare('UPDATE admins SET status = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$status, $id]);

        Response::json($this->format($this->fetchAdmin($id)));
    }

    // ── DELETE /admin/team/:id ────────────────────────────────────────────

    public function removeTeamMember(int $id): void {
        $auth = $this->requireAdmin();
        $this->requireSuperAdmin($auth);

        if ($id === $auth['adminId']) {
            Response::error('FORBIDDEN', 'You cannot remove yourself.', 403);
        }

        $admin = $this->fetchAdmin($id);
        if (!$admin) Response::error('NOT_FOUND', 'Admin not found.', 404);

        // Ensure at least one super_admin remains
        if ($admin['role'] === 'super_admin') {
            $count = (int) $this->db->query('SELECT COUNT(*) FROM admins WHERE role = "super_admin" AND status = "active"')->fetchColumn();
            if ($count <= 1) {
                Response::error('FORBIDDEN', 'Cannot remove the last super admin.', 403);
            }
        }

        $this->db->prepare('DELETE FROM admins WHERE id = ?')->execute([$id]);
        Response::json(['removed' => true]);
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
        try { $payload = JWT::decode($token, JWT_SECRET); }
        catch (RuntimeException) { Response::error('UNAUTHENTICATED', 'Invalid or expired token.', 401); }
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

    private function requireSuperAdmin(array $auth): void {
        $stmt = $this->db->prepare('SELECT role FROM admins WHERE id = ?');
        $stmt->execute([$auth['adminId']]);
        $row = $stmt->fetch();
        if (!$row || $row['role'] !== 'super_admin') {
            Response::error('FORBIDDEN', 'Super admin access required.', 403);
        }
    }

    private function fetchAdmin(int $id): ?array {
        $stmt = $this->db->prepare('SELECT * FROM admins WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    private function format(array $a): array {
        $parts = explode(' ', $a['name'], 2);
        return [
            'id'          => (int) $a['id'],
            'displayId'   => 'AD' . str_pad($a['id'], 5, '0', STR_PAD_LEFT),
            'name'        => $a['name'],
            'firstName'   => $parts[0] ?? '',
            'lastName'    => $parts[1] ?? '',
            'email'       => $a['email'],
            'phone'       => $a['phone']      ?? null,
            'state'       => $a['state']      ?? null,
            'city'        => $a['city']       ?? null,
            'role'        => $a['role'],
            'avatarUrl'   => $a['avatar_url'] ?? null,
            'status'      => $a['status'],
            'lastLogin'   => $a['last_login']  ?? null,
            'createdAt'   => $a['created_at'],
        ];
    }
}
