<?php

/**
 * KTG Connect — Two-Factor Authentication Controller
 * ============================================================
 * Handles TOTP (authenticator app) 2FA setup and validation.
 *
 * Endpoints:
 *   POST /auth/2fa/setup       — generate secret + QR code
 *   POST /auth/2fa/confirm     — verify first code + activate
 *   POST /auth/2fa/validate    — verify code during login
 *   POST /auth/2fa/disable     — disable TOTP 2FA
 *   POST /auth/2fa/backup      — verify a backup code
 *   GET  /auth/2fa/status      — check current 2FA status
 *
 * Flow:
 *   1. User clicks "Enable 2FA (Authenticator)" in Settings
 *   2. Frontend calls /auth/2fa/setup → gets QR code URL + secret
 *   3. User scans QR code with their authenticator app
 *   4. User enters the 6-digit code to confirm setup
 *   5. Frontend calls /auth/2fa/confirm with the code
 *   6. On success: totp_method = 'totp', backup codes returned
 *   7. On next login: backend returns requires2FA = true
 *   8. Frontend shows 2FA code input screen
 *   9. Frontend calls /auth/2fa/validate with the code
 *   10. On success: full JWT issued, login proceeds normally
 */
class TwoFactorController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /auth/2fa/status ──────────────────────────────────────────────

    public function getStatus(): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];

        $stmt = $this->db->prepare('SELECT totp_method, two_fa_enabled FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        $totpStmt = $this->db->prepare('SELECT verified FROM user_totp WHERE user_id = ?');
        $totpStmt->execute([$userId]);
        $totp = $totpStmt->fetch();

        Response::json([
            'twoFaEnabled' => (bool) $user['two_fa_enabled'],
            'totpMethod'   => $user['totp_method'] ?? 'none',
            'totpVerified' => $totp ? (bool) $totp['verified'] : false,
        ]);
    }

    // ── POST /auth/2fa/setup ──────────────────────────────────────────────

    public function setup(): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];

        // Fetch user for display name in QR code
        $stmt = $this->db->prepare('SELECT phone, email, name FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);

        // Check if TOTP already active
        $existing = $this->db->prepare('SELECT secret, verified FROM user_totp WHERE user_id = ?');
        $existing->execute([$userId]);
        $row = $existing->fetch();

        if ($row && $row['verified']) {
            Response::error('ALREADY_ENABLED', '2FA is already enabled on this account.', 409);
        }

        // Generate fresh secret (or reuse unverified one so user can retry)
        $secret = ($row && !$row['verified']) ? $row['secret'] : TOTP::generateSecret();

        if ($row) {
            $this->db->prepare('UPDATE user_totp SET secret = ?, updated_at = NOW() WHERE user_id = ?')
                     ->execute([$secret, $userId]);
        } else {
            $this->db->prepare('INSERT INTO user_totp (user_id, secret, verified) VALUES (?, ?, 0)')
                     ->execute([$userId, $secret]);
        }

        // Build otpauth URI — use phone as account identifier (or email if no phone)
        $account    = $user['phone'] ?? $user['email'] ?? $user['name'];
        $otpauthUri = TOTP::getOtpauthUri($secret, $account, 'KTG Connect');

        Response::json([
            'secret'     => $secret,      // show as manual entry fallback
            'otpauthUri' => $otpauthUri,  // frontend generates QR code client-side
        ]);
    }

    // ── POST /auth/2fa/confirm ────────────────────────────────────────────

    public function confirm(): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $body   = Validator::jsonBody() ?? [];
        $code   = trim($body['code'] ?? '');

        if (!$code) {
            Response::error('VALIDATION_ERROR', 'Verification code is required.', 422);
        }

        // Get the stored secret
        $stmt = $this->db->prepare('SELECT secret FROM user_totp WHERE user_id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('NOT_FOUND', 'No 2FA setup in progress. Call /auth/2fa/setup first.', 404);
        }

        if (!TOTP::verify($row['secret'], $code)) {
            Response::error('INVALID_CODE', 'Incorrect code. Please try again.', 401);
        }

        // Generate backup codes
        $plainBackupCodes = TOTP::generateBackupCodes();
        // Hash each code before storing
        $hashedCodes = array_map(fn($c) => password_hash($c, PASSWORD_BCRYPT), $plainBackupCodes);

        // Activate TOTP
        $this->db->prepare('
            UPDATE user_totp
            SET verified = 1, backup_codes = ?, updated_at = NOW()
            WHERE user_id = ?
        ')->execute([json_encode($hashedCodes), $userId]);

        // Mark user as having 2FA enabled
        $this->db->prepare('
            UPDATE users
            SET two_fa_enabled = 1, totp_method = "totp", updated_at = NOW()
            WHERE id = ?
        ')->execute([$userId]);

        Response::json([
            'enabled'     => true,
            'backupCodes' => $plainBackupCodes, // shown ONCE — user must save these
        ]);
    }

    // ── POST /auth/2fa/validate ───────────────────────────────────────────
    // Called during login when the user has 2FA enabled.
    // Takes a partial token (issued at login before 2FA) + the TOTP code.

    public function validate(): void {
        $body    = Validator::jsonBody() ?? [];
        $partial = trim($body['partialToken'] ?? '');
        $code    = trim($body['code']         ?? '');

        if (!$partial || !$code) {
            Response::error('VALIDATION_ERROR', 'partialToken and code are required.', 422);
        }

        // Verify the partial token
        try {
            $payload = JWT::decode($partial, JWT_SECRET);
        } catch (RuntimeException) {
            Response::error('UNAUTHENTICATED', 'Invalid or expired session. Please log in again.', 401);
        }

        // Partial tokens have a special claim to prevent them being used as full tokens
        if (!isset($payload['partial']) || !$payload['partial']) {
            Response::error('UNAUTHENTICATED', 'Invalid token type.', 401);
        }

        $userId = (int) $payload['userId'];

        // Get TOTP secret
        $stmt = $this->db->prepare('SELECT secret FROM user_totp WHERE user_id = ? AND verified = 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('NOT_FOUND', '2FA not configured for this account.', 404);
        }

        if (!TOTP::verify($row['secret'], $code)) {
            Response::error('INVALID_CODE', 'Incorrect authenticator code. Please try again.', 401);
        }

        // Issue full JWT
        $userStmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();

        $token = JWT::encode([
            'userId' => $userId,
            'role'   => $user['role'],
            'lgaId'  => (int) $user['lga_id'],
        ], JWT_SECRET, JWT_EXPIRES_IN);

        $this->db->prepare('UPDATE users SET last_seen_at = NOW() WHERE id = ?')
                 ->execute([$userId]);

        // Blacklist the partial token now that full auth is complete
        $blExpiry = date('Y-m-d H:i:s', time() + 300);
        $blStmt   = $this->db->prepare(
            "INSERT IGNORE INTO jwt_blacklist (token_hash, expires_at) VALUES (?, ?)"
        );
        $blStmt->execute([hash('sha256', $partial), $blExpiry]);

        Response::json([
            'token' => $token,
            'role'  => $user['role'],
            'user'  => $this->sanitiseUser($user),
        ]);
    }

    // ── POST /auth/2fa/disable ────────────────────────────────────────────

    public function disable(): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $body   = Validator::jsonBody() ?? [];
        $code   = trim($body['code'] ?? '');

        if (!$code) {
            Response::error('VALIDATION_ERROR', 'Current authenticator code is required to disable 2FA.', 422);
        }

        $stmt = $this->db->prepare('SELECT secret FROM user_totp WHERE user_id = ? AND verified = 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('NOT_FOUND', '2FA is not enabled on this account.', 404);
        }

        if (!TOTP::verify($row['secret'], $code)) {
            Response::error('INVALID_CODE', 'Incorrect code. Please try again.', 401);
        }

        // Remove TOTP record and update user
        $this->db->prepare('DELETE FROM user_totp WHERE user_id = ?')->execute([$userId]);
        $this->db->prepare('
            UPDATE users
            SET two_fa_enabled = 0, totp_method = "none", updated_at = NOW()
            WHERE id = ?
        ')->execute([$userId]);

        Response::json(['disabled' => true]);
    }

    // ── POST /auth/2fa/backup ─────────────────────────────────────────────
    // Use a backup code instead of TOTP (e.g. lost phone)

    public function useBackupCode(): void {
        $body    = Validator::jsonBody() ?? [];
        $partial = trim($body['partialToken'] ?? '');
        $backup  = strtoupper(trim($body['backupCode'] ?? ''));

        if (!$partial || !$backup) {
            Response::error('VALIDATION_ERROR', 'partialToken and backupCode are required.', 422);
        }

        try {
            $payload = JWT::decode($partial, JWT_SECRET);
        } catch (RuntimeException) {
            Response::error('UNAUTHENTICATED', 'Invalid or expired session.', 401);
        }

        if (!isset($payload['partial']) || !$payload['partial']) {
            Response::error('UNAUTHENTICATED', 'Invalid token type.', 401);
        }

        $userId = (int) $payload['userId'];

        $stmt = $this->db->prepare('SELECT backup_codes FROM user_totp WHERE user_id = ? AND verified = 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if (!$row || !$row['backup_codes']) {
            Response::error('NOT_FOUND', 'No backup codes found.', 404);
        }

        $codes = json_decode($row['backup_codes'], true) ?: [];
        $usedIdx = null;

        foreach ($codes as $idx => $hashed) {
            if (password_verify($backup, $hashed)) {
                $usedIdx = $idx;
                break;
            }
        }

        if ($usedIdx === null) {
            Response::error('INVALID_CODE', 'Invalid backup code.', 401);
        }

        // Remove used code (one-time use)
        array_splice($codes, $usedIdx, 1);
        $this->db->prepare('UPDATE user_totp SET backup_codes = ? WHERE user_id = ?')
                 ->execute([json_encode($codes), $userId]);

        // Issue full JWT
        $userStmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();

        $token = JWT::encode([
            'userId' => $userId,
            'role'   => $user['role'],
            'lgaId'  => (int) $user['lga_id'],
        ], JWT_SECRET, JWT_EXPIRES_IN);

        // Blacklist the partial token now that full auth is complete
        $blExpiry = date('Y-m-d H:i:s', time() + 300);
        $blStmt   = $this->db->prepare(
            "INSERT IGNORE INTO jwt_blacklist (token_hash, expires_at) VALUES (?, ?)"
        );
        $blStmt->execute([hash('sha256', $partial), $blExpiry]);

        Response::json([
            'token'            => $token,
            'role'             => $user['role'],
            'user'             => $this->sanitiseUser($user),
            'remainingBackups' => count($codes),
        ]);
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private function sanitiseUser(array $user): array {
        return [
            'id'                => (int) $user['id'],
            'name'              => $user['name'],
            'email'             => $user['email'],
            'phone'             => $user['phone'],
            'lgaId'             => (int) $user['lga_id'],
            'lgaName'           => $user['lga_name'],
            'avatarUrl'         => $user['avatar_url'],
            'role'              => $user['role'],
            'isVerified'        => (bool) $user['is_verified'],
            'status'            => $user['status'],
            'has_seen_welcome'  => (bool) $user['has_seen_welcome'],
            'profileVisibility' => $user['profile_visibility'] ?? 'public',
            'twoFaEnabled'      => (bool) $user['two_fa_enabled'],
            'totpMethod'        => $user['totp_method'] ?? 'none',
            'notifPrefs'        => [
                'official'  => (bool) ($user['notif_official']   ?? true),
                'community' => (bool) ($user['notif_community']  ?? true),
                'lgaAlerts' => (bool) ($user['notif_lga_alerts'] ?? false),
            ],
            'createdAt' => $user['created_at'],
        ];
    }
}
