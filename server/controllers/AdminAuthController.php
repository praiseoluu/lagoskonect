<?php

/**
 * ADM Connect — Admin Auth Controller
 * ============================================================
 * Handles admin authentication separately from citizen auth.
 *
 * Endpoints:
 *   POST /admin/auth/login   — email + password login
 *   POST /admin/auth/logout  — blacklist JWT
 *
 * Admin accounts are in the `admins` table, not `users`.
 * JWT payload includes role: 'admin' | 'super_admin'.
 */
class AdminAuthController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── POST /admin/auth/login ────────────────────────────────────────────

    public function login(): void {
        $body = Validator::jsonBody();
        if ($body === null) {
            Response::error('VALIDATION_ERROR', 'Invalid JSON body.', 422);
        }

        $email    = trim($body['email']    ?? '');
        $password = $body['password']      ?? '';
        $remember = (bool) ($body['remember'] ?? false);

        if (!$email || !$password) {
            Response::error('VALIDATION_ERROR', 'Email and password are required.', 422);
        }

        if (!Validator::isEmail($email)) {
            Response::error('VALIDATION_ERROR', 'Invalid email address.', 422);
        }

        $stmt = $this->db->prepare('SELECT * FROM admins WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $admin = $stmt->fetch();

        if (!$admin || !password_verify($password, $admin['password'])) {
            Response::error('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);
        }

        if ($admin['status'] === 'suspended') {
            Response::error('ACCOUNT_SUSPENDED', 'This account has been suspended.', 403);
        }

        // Remember me: 30 days vs 1 day
        $expiresIn = $remember ? (60 * 60 * 24 * 30) : (60 * 60 * 24);

        $token = JWT::encode([
            'adminId' => $admin['id'],
            'role'    => $admin['role'],
            'region'  => $admin['region'] ?? null,
            'type'    => 'admin', // distinguishes from citizen tokens
        ], JWT_SECRET, $expiresIn);

        // Update last login
        $this->db->prepare('UPDATE admins SET last_login = NOW() WHERE id = ?')
                 ->execute([$admin['id']]);

        Response::json([
            'token' => $token,
            'role'  => $admin['role'],
            'admin' => $this->sanitise($admin),
        ]);
    }

    // ── POST /admin/auth/logout ───────────────────────────────────────────

    public function logout(): void {
        $auth = $this->requireAdmin();

        $tokenHash = JWT::hash($auth['token']);
        $expiry    = date('Y-m-d H:i:s', time() + (60 * 60 * 24 * 30));

        try {
            $this->db->prepare('
                INSERT IGNORE INTO jwt_blacklist (token_hash, expires_at, created_at)
                VALUES (?, ?, NOW())
            ')->execute([$tokenHash, $expiry]);
        } catch (Exception) {}

        Response::json(['loggedOut' => true]);
    }

    // ── Private: require admin auth ───────────────────────────────────────

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
            Response::error('FORBIDDEN', 'Admin token required.', 403);
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

        return ['token' => $token, 'adminId' => $payload['adminId'], 'role' => $payload['role']];
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private function sanitise(array $admin): array {
        return [
            'id'        => (int) $admin['id'],
            'name'      => $admin['name'],
            'email'     => $admin['email'],
            'role'      => $admin['role'],
            'region'    => $admin['region'] ?? null,
            'avatarUrl' => $admin['avatar_url'] ?? null,
            'lastLogin' => $admin['last_login']  ?? null,
            'status'    => $admin['status'],
        ];
    }
}