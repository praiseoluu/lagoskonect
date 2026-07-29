<?php

/**
 * KTG Connect — Platform Settings Controller
 * ============================================================
 * GET  /admin/platform-settings       — read all settings
 * PATCH /admin/platform-settings      — update one or more settings
 */
class PlatformSettingsController {
    public function __construct() {}

    // ── GET /admin/platform-settings ─────────────────────────────────────

    public function get(): void {
        $this->requireAdmin();
        $all = Settings::all();

        // Normalise to booleans for the frontend
        Response::json([
            'maintenanceMode'    => $all['maintenance_mode']    ?? '0',
            'allowRegistrations' => $all['allow_registrations'] ?? '1',
            'chatEnabled'        => $all['chat_enabled']        ?? '1',
            'reelsEnabled'       => $all['reels_enabled']       ?? '1',
            'advertsEnabled'     => $all['adverts_enabled']     ?? '1',
        ]);
    }

    // ── PATCH /admin/platform-settings ───────────────────────────────────

    public function update(): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $map = [
            'maintenanceMode'    => 'maintenance_mode',
            'allowRegistrations' => 'allow_registrations',
            'chatEnabled'        => 'chat_enabled',
            'reelsEnabled'       => 'reels_enabled',
            'advertsEnabled'     => 'adverts_enabled',
        ];

        foreach ($map as $jsKey => $dbKey) {
            if (array_key_exists($jsKey, $body)) {
                Settings::set($dbKey, $body[$jsKey] ? '1' : '0');
            }
        }

        $this->get(); // return updated state
    }

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
        $db     = Database::connect();
        $blStmt = $db->prepare(
            "SELECT 1 FROM jwt_blacklist WHERE token_hash = ? AND expires_at > NOW() LIMIT 1"
        );
        $blStmt->execute([hash('sha256', $token)]);
        if ($blStmt->fetchColumn()) {
            http_response_code(401);
            echo json_encode(['error' => ['code' => 'TOKEN_REVOKED', 'message' => 'Token has been revoked.']]);
            exit;
        }
    }
}
