<?php

/**
 * KTG Connect — Google OAuth Controller
 * ============================================================
 * Handles the Google OAuth 2.0 login flow.
 *
 * Flow:
 *   1. Frontend calls GET /auth/oauth/google/redirect
 *      → Controller builds the Google auth URL and returns it
 *      → Frontend redirects the browser to that URL
 *
 *   2. User approves on Google
 *      → Google redirects to /auth/oauth/google/callback?code=...
 *      → Controller exchanges code for access token
 *      → Controller fetches user profile from Google
 *      → Controller finds or creates a local user account
 *      → Controller issues a JWT and redirects to frontend with token
 *
 * No external libraries needed — uses PHP's built-in curl.
 *
 * Config values are read from config/oauth.php
 */
class GoogleOAuthController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /auth/oauth/google/redirect ───────────────────────────────────
    // Returns the Google authorisation URL for the frontend to redirect to.

    public function redirect(): void {
        $state = bin2hex(random_bytes(16));

        // Store state in DB for CSRF verification
        $this->db->prepare('
            INSERT INTO oauth_states (state, provider, created_at)
            VALUES (?, "google", NOW())
        ')->execute([$state]);

        $params = http_build_query([
            'client_id'     => GOOGLE_CLIENT_ID,
            'redirect_uri'  => GOOGLE_REDIRECT_URI,
            'response_type' => 'code',
            'scope'         => 'openid email profile',
            'state'         => $state,
            'access_type'   => 'online',
            'prompt'        => 'select_account',
        ]);

        $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . $params;

        // Return the URL — frontend handles the redirect
        Response::json(['url' => $url]);
    }

    // ── GET /auth/oauth/google/callback ───────────────────────────────────
    // Google redirects here with ?code=... after user approves.
    // We exchange the code, get the user profile, and redirect to frontend.

    public function callback(): void {
        $code  = $_GET['code']  ?? '';
        $state = $_GET['state'] ?? '';
        $error = $_GET['error'] ?? '';

        // User denied access
        if ($error) {
            $this->redirectToFrontend(['error' => 'oauth_denied']);
            return;
        }

        if (!$code || !$state) {
            $this->redirectToFrontend(['error' => 'oauth_invalid']);
            return;
        }

        // Verify state to prevent CSRF
        $stateStmt = $this->db->prepare('
            SELECT id FROM oauth_states
            WHERE state = ? AND provider = "google"
            AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        ');
        $stateStmt->execute([$state]);
        if (!$stateStmt->fetch()) {
            $this->redirectToFrontend(['error' => 'oauth_state_invalid']);
            return;
        }

        // Clean up used state
        $this->db->prepare('DELETE FROM oauth_states WHERE state = ?')->execute([$state]);

        // Exchange code for access token
        $tokenData = $this->exchangeCode($code);
        if (!$tokenData || empty($tokenData['access_token'])) {
            $this->redirectToFrontend(['error' => 'oauth_token_failed']);
            return;
        }

        // Fetch user profile from Google
        $profile = $this->fetchProfile($tokenData['access_token']);
        if (!$profile || empty($profile['email'])) {
            $this->redirectToFrontend(['error' => 'oauth_profile_failed']);
            return;
        }

        // Find or create user
        $result = $this->findOrCreateUser($profile);
        if (!$result['success']) {
            $this->redirectToFrontend(['error' => $result['error']]);
            return;
        }

        $user = $result['user'];

        // Check account status
        if ($user['status'] === 'suspended') {
            $this->redirectToFrontend(['error' => 'account_suspended']);
            return;
        }

        // Issue JWT
        $token = JWT::encode([
            'userId' => $user['id'],
            'role'   => $user['role'],
            'lgaId'  => (int) $user['lga_id'],
        ], JWT_SECRET, JWT_EXPIRES_IN);

        $this->db->prepare('UPDATE users SET last_seen_at = NOW() WHERE id = ?')
                 ->execute([$user['id']]);

        // Redirect to frontend with token
        // Frontend reads the token from the URL hash and saves the session
        $this->redirectToFrontend([
            'token'    => $token,
            'role'     => $user['role'],
            'new_user' => $result['isNew'] ? '1' : '0',
        ]);
    }

    // ── Private: exchange code for token ─────────────────────────────────

    private function exchangeCode(string $code): ?array {
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'code'          => $code,
                'client_id'     => GOOGLE_CLIENT_ID,
                'client_secret' => GOOGLE_CLIENT_SECRET,
                'redirect_uri'  => GOOGLE_REDIRECT_URI,
                'grant_type'    => 'authorization_code',
            ]),
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        return $response ? json_decode($response, true) : null;
    }

    // ── Private: fetch Google profile ────────────────────────────────────

    private function fetchProfile(string $accessToken): ?array {
        $ch = curl_init('https://www.googleapis.com/oauth2/v3/userinfo');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$accessToken}"],
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        return $response ? json_decode($response, true) : null;
    }

    // ── Private: find or create local user ───────────────────────────────

    private function findOrCreateUser(array $profile): array {
        $email     = $profile['email']      ?? '';
        $name      = $profile['name']       ?? '';
        $googleId  = $profile['sub']        ?? '';  // Google's unique user ID
        $avatarUrl = $profile['picture']    ?? null;

        // 1. Check if user exists with this Google ID
        $stmt = $this->db->prepare('SELECT * FROM users WHERE google_id = ?');
        $stmt->execute([$googleId]);
        $user = $stmt->fetch();
        if ($user) {
            // Update avatar if changed
            if ($avatarUrl && $user['avatar_url'] !== $avatarUrl) {
                $this->db->prepare('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?')
                         ->execute([$avatarUrl, $user['id']]);
                $user['avatar_url'] = $avatarUrl;
            }
            return ['success' => true, 'user' => $user, 'isNew' => false];
        }

        // 2. Check if user exists with same email
        $emailStmt = $this->db->prepare('SELECT * FROM users WHERE email = ?');
        $emailStmt->execute([$email]);
        $existingByEmail = $emailStmt->fetch();
        if ($existingByEmail) {
            // Link Google ID to existing account
            $this->db->prepare('
                UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), updated_at = NOW()
                WHERE id = ?
            ')->execute([$googleId, $avatarUrl, $existingByEmail['id']]);
            $existingByEmail['google_id'] = $googleId;
            return ['success' => true, 'user' => $existingByEmail, 'isNew' => false];
        }

        // 3. New user — create account
        // New OAuth users need to select an LGA before they can use the app.
        // We create the account with status='active', is_verified=1 (email verified by Google),
        // lga_id=NULL. The frontend will detect lga_id=null and show the LGA selection screen.
        $this->db->prepare('
            INSERT INTO users
                (name, email, google_id, avatar_url, role, is_verified, status,
                 has_seen_welcome, created_at, updated_at)
            VALUES
                (?, ?, ?, ?, "citizen", 1, "active", 0, NOW(), NOW())
        ')->execute([$name, $email, $googleId, $avatarUrl]);

        $newId = (int) $this->db->lastInsertId();
        $newStmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $newStmt->execute([$newId]);
        $newUser = $newStmt->fetch();

        return ['success' => true, 'user' => $newUser, 'isNew' => true];
    }

    // ── Private: redirect to frontend with result ─────────────────────────

    private function redirectToFrontend(array $params): void {
        // Pass data as URL hash so it never hits the server
        // Frontend reads window.location.hash on the /oauth/callback route
        $hash     = http_build_query($params);
        $frontendUrl = FRONTEND_URL . '/oauth/callback#' . $hash;
        header('Location: ' . $frontendUrl);
        exit;
    }
}
