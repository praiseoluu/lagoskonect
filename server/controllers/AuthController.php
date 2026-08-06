<?php

class AuthController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── POST /auth/login ────────────────────────────────────────────────

    public function login(): void {
        if (Settings::is('maintenance_mode')) {
            Response::error('MAINTENANCE', 'The platform is currently under maintenance. Please try again later.', 503);
        }

        $body = Validator::jsonBody();
        if ($body === null) {
            Response::error('VALIDATION_ERROR', 'Invalid JSON body.', 422);
        }

        $identifier = trim($body['identifier'] ?? $body['phone'] ?? '');
        $password   = $body['password'] ?? '';

        if (!$identifier || !$password) {
            Response::error('VALIDATION_ERROR', 'Identifier and password are required.', 422);
        }

        $this->checkRateLimit($identifier, 'login');

        // Detect login type: email, phone, or username
        if (str_contains($identifier, '@')) {
            $stmt = $this->db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$identifier]);
        } elseif (str_starts_with($identifier, '+') || ctype_digit(ltrim($identifier, '0'))) {
            $normalised = Validator::normalisePhone($identifier) ?? $identifier;
            $stmt = $this->db->prepare('SELECT * FROM users WHERE phone = ? LIMIT 1');
            $stmt->execute([$normalised]);
        } else {
            // username (case-insensitive via utf8mb4_unicode_ci collation)
            $stmt = $this->db->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
            $stmt->execute([$identifier]);
        }

        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            $this->recordAttempt($identifier, 'login');
            Response::error('INVALID_CREDENTIALS', 'Incorrect credentials.', 401);
        }

        if ($user['status'] === 'suspended') {
            Response::error('ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact support.', 403);
        }

        if (!$user['is_verified'] || $user['status'] === 'pending') {
            Response::error('UNVERIFIED_PHONE', 'Please verify your phone number before logging in.', 403);
        }

        // Check if user has TOTP 2FA enabled
        $twoFaMethod = $user['totp_method'] ?? 'none';
        $twoFaEnabled = (bool) $user['two_fa_enabled'];

        if ($twoFaEnabled && $twoFaMethod === 'totp') {
            // Issue a short-lived partial token — not usable for API calls
            // Frontend must complete 2FA before getting the real token
            $partialToken = JWT::encode([
                'userId'  => $user['id'],
                'partial' => true,   // flag so middleware rejects it for normal requests
            ], JWT_SECRET, 300); // expires in 5 minutes

            Response::json([
                'requires2FA'  => true,
                'method'       => 'totp',
                'partialToken' => $partialToken,
            ]);
            return;
        }

        $this->clearAttempts($identifier, 'login');

        $token = JWT::encode([
            'userId' => $user['id'],
            'role'   => $user['role'],
            'lgaId'  => $user['lga_id'],
            'region' => $user['region'],
        ], JWT_SECRET, JWT_EXPIRES_IN);

        // Update last_seen_at
        $this->db->prepare('UPDATE users SET last_seen_at = NOW() WHERE id = ?')
                 ->execute([$user['id']]);

        $this->noteSignIn((int) $user['id']);

        // Check if admin-created account requiring password change
        $mustChange = (bool) ($user['must_change_password'] ?? false);

        Response::json([
            'token'               => $token,
            'role'                => $user['role'],
            'user'                => $this->sanitiseUser($user),
            'mustChangePassword'  => $mustChange,
        ]);
    }

    // ── POST /auth/register ────────────────────────────────────────────

    public function register(): void {
        if (!Settings::is('allow_registrations')) {
            Response::error('REGISTRATIONS_CLOSED', 'New registrations are currently closed.', 403);
        }

        $body = Validator::jsonBody();
        if ($body === null) {
            Response::error('VALIDATION_ERROR', 'Invalid JSON body.', 422);
        }

        $name     = trim($body['name']     ?? '');
        $email    = strtolower(trim($body['email']    ?? ''));
        $username = trim($body['username'] ?? '');
        $password = $body['password']      ?? '';
        $lgaId    = (int) ($body['lgaId']  ?? 0);
        $gender   = $body['gender']        ?? null;
        $region   = $body['region']        ?? null;
        $referralCode = strtoupper(trim($body['referralCode'] ?? ''));

        if (!$name || !$email || !$username || !$password || !$lgaId) {
            Response::error('VALIDATION_ERROR', 'name, email, username, password, and lgaId are required.', 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('VALIDATION_ERROR', 'Invalid email address.', 422);
        }

        // Username: alphanumeric, underscore, hyphen; 3–30 chars
        if (!preg_match('/^[a-zA-Z0-9_\-]{3,30}$/', $username)) {
            Response::error('VALIDATION_ERROR', 'Username must be 3–30 characters and may only contain letters, numbers, underscores, and hyphens.', 422);
        }

        $err = Validator::minLength($password, 8, 'Password');
        if ($err) {
            Response::error('WEAK_PASSWORD', $err, 422);
        }

        // Check LGA
        $lgaStmt = $this->db->prepare('SELECT id, name, region FROM lgas WHERE id = ?');
        $lgaStmt->execute([$lgaId]);
        $lga = $lgaStmt->fetch();
        if (!$lga) {
            Response::error('INVALID_LGA', 'Invalid LGA selected.', 422);
        }

        // Derive region from the LGA if the client didn't send one
        // (e.g. user came via a referral link without going through
        // the region-selector page).
        if (!$region && !empty($lga['region'])) {
            $region = $lga['region'];
        }

        // Validate region
        $allowedRegions = ['west', 'east', 'central'];
        if (!in_array($region, $allowedRegions)) {
            Response::error('VALIDATION_ERROR', 'Invalid region. Must be west, east, or central.', 422);
        }

        $referrerId = null;
        if ($referralCode !== '') {
            $referrerStmt = $this->db->prepare(
                'SELECT id FROM users WHERE referral_code = ? AND is_verified = 1 AND status = "active" LIMIT 1'
            );
            $referrerStmt->execute([$referralCode]);
            $referrer = $referrerStmt->fetch();
            if (!$referrer) {
                Response::error('INVALID_REFERRAL', 'That referral link is no longer valid.', 422);
            }
            $referrerId = (int) $referrer['id'];
        }

        // Email duplicate check
        $emailStmt = $this->db->prepare('SELECT id, status, is_verified FROM users WHERE email = ?');
        $emailStmt->execute([$email]);
        $existingEmail = $emailStmt->fetch();
        if ($existingEmail) {
            if (!$existingEmail['is_verified'] && $existingEmail['status'] === 'pending') {
                $otp    = $this->generateOtp(6);
                $expiry = date('Y-m-d H:i:s', time() + 600);
                $this->db->prepare('UPDATE users SET otp_hash = ?, otp_expires_at = ?, updated_at = NOW() WHERE id = ?')
                         ->execute([hash('sha256', (string)$otp), $expiry, $existingEmail['id']]);
                EmailService::sendOtp($email, $name, $otp, 'phone');
                Response::error('PENDING_VERIFICATION', 'This email has a pending verification. Please complete it.', 409, [
                    'userId' => (int) $existingEmail['id'],
                    'email'  => $email,
                ]);
            }
            Response::error('EMAIL_TAKEN', 'An account with this email already exists.', 409);
        }

        // Username duplicate check (case-insensitive via collation)
        $usernameStmt = $this->db->prepare('SELECT id FROM users WHERE username = ?');
        $usernameStmt->execute([$username]);
        if ($usernameStmt->fetch()) {
            Response::error('USERNAME_TAKEN', 'This username is already taken.', 409);
        }

        $hashed = password_hash($password, PASSWORD_BCRYPT);
        $otp    = $this->generateOtp(6);
        $expiry = date('Y-m-d H:i:s', time() + 600); // 10 minutes

        $allowedGenders = ['male', 'female', 'prefer_not_to_say'];
        $safeGender = in_array($gender, $allowedGenders) ? $gender : null;

        // ── Sequential ID generation ───────────────────────────────────────
        // Instead of relying on AUTO_INCREMENT (which skips numbers when
        // inserts fail or transactions roll back), we compute the next ID
        // inside a transaction with a row-level lock so IDs are always
        // gap-free and start from 100001.
        $this->db->beginTransaction();
        try {
            $idStmt = $this->db->query(
                'SELECT COALESCE(MAX(id), 100000) + 1 FROM users WHERE id >= 100000 FOR UPDATE'
            );
            $nextId = (int) $idStmt->fetchColumn();

            $insert = $this->db->prepare('
                INSERT INTO users
                    (id, name, username, email, referral_code, referred_by_user_id, gender, password, lga_id, lga_name, region, role,
                     is_verified, status, otp_hash, otp_expires_at, created_at, updated_at)
                VALUES
                    (?, ?, ?, ?, CONCAT("LK", UPPER(SUBSTRING(MD5(CONCAT(?, "-", UUID())), 1, 8))), ?, ?, ?, ?, ?, ?, "citizen",
                     0, "pending", ?, ?, NOW(), NOW())
            ');
            $insert->execute([$nextId, $name, $username, $email, $email, $referrerId, $safeGender, $hashed, $lgaId, $lga['name'], $region, hash('sha256', (string)$otp), $expiry]);

            $userId = $nextId;
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error('SERVER_ERROR', 'Could not complete registration. Please try again.', 500);
        }

        EmailService::sendOtp($email, $name, $otp, 'phone');

        Response::json(['userId' => $userId, 'email' => $email], 201);
    }

    // ── POST /auth/verify-phone ────────────────────────────────────────

    public function verifyPhone(): void {
        $body = Validator::jsonBody();
        if ($body === null) {
            Response::error('VALIDATION_ERROR', 'Invalid JSON body.', 422);
        }

        $userId = (int) ($body['userId'] ?? 0);
        $otp    = trim($body['otp'] ?? '');

        if (!$userId || !$otp) {
            Response::error('VALIDATION_ERROR', 'userId and otp are required.', 422);
        }

        $this->checkRateLimit((string)$userId, 'otp');

        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('USER_NOT_FOUND', 'User not found.', 404);
        }

        // Check OTP expiry
        if ($user['otp_expires_at'] && strtotime($user['otp_expires_at']) < time()) {
            $this->recordAttempt((string)$userId, 'otp');
            Response::error('OTP_EXPIRED', 'OTP has expired. Please request a new one.', 401);
        }

        if (!hash_equals($user['otp_hash'] ?? '', hash('sha256', (string)$otp))) {
            $this->recordAttempt((string)$userId, 'otp');
            Response::error('INVALID_OTP', 'Incorrect code. Please try again.', 401);
        }

        $this->clearAttempts((string)$userId, 'otp');

        // Activate account
        $this->db->prepare('
            UPDATE users
            SET is_verified = 1, status = "active", otp_hash = NULL, otp_expires_at = NULL, updated_at = NOW()
            WHERE id = ?
        ')->execute([$user['id']]);

        // Referral credit is awarded only once, after the referred account
        // completes verification. Pending or abandoned signups do not count.
        if (!empty($user['referred_by_user_id'])) {
            $this->db->prepare('UPDATE users SET referral_count = referral_count + 1 WHERE id = ?')
                     ->execute([(int) $user['referred_by_user_id']]);
        }

        // Issue token so user is logged in immediately
        $token = JWT::encode([
            'userId' => $user['id'],
            'role'   => $user['role'],
            'lgaId'  => $user['lga_id'],
            'region' => $user['region'],
        ], JWT_SECRET, JWT_EXPIRES_IN);

        // Fetch updated user
        $freshStmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $freshStmt->execute([$user['id']]);
        $freshUser = $freshStmt->fetch();

        Response::json([
            'verified' => true,
            'token'    => $token,
            'user'     => $this->sanitiseUser($freshUser),
        ]);
    }

    // ── POST /auth/resend-otp ────────────────────────────────────────────

    public function resendOtp(): void {
        $body       = Validator::jsonBody();
        $identifier = trim($body['identifier'] ?? $body['phone'] ?? '');
        $type       = trim($body['type'] ?? 'phone'); // 'phone' | 'identity'

        if (!$identifier) {
            Response::error('VALIDATION_ERROR', 'identifier is required.', 422);
        }

        $isEmail = str_contains($identifier, '@');
        $isUserId = ctype_digit($identifier);
        if ($isEmail) {
            $stmt = $this->db->prepare('SELECT id FROM users WHERE email = ?');
            $stmt->execute([$identifier]);
        } elseif ($isUserId) {
            $stmt = $this->db->prepare('SELECT id FROM users WHERE id = ?');
            $stmt->execute([(int) $identifier]);
        } else {
            $normalised = Validator::normalisePhone($identifier) ?? $identifier;
            $stmt = $this->db->prepare('SELECT id FROM users WHERE phone = ?');
            $stmt->execute([$normalised]);
        }
        $user = $stmt->fetch();

        if (!$user) {
            Response::json(['message' => 'If an account exists, an OTP has been sent.']);
            return;
        }

        $otp    = $this->generateOtp(6);
        $expiry = date('Y-m-d H:i:s', time() + 600);

        $this->db->prepare('UPDATE users SET otp_hash = ?, otp_expires_at = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([hash('sha256', (string)$otp), $expiry, $user['id']]);

        // Send via email (all OTPs now use email)
        $userRow = $this->db->prepare('SELECT name, email FROM users WHERE id = ?');
        $userRow->execute([$user['id']]);
        $userData = $userRow->fetch();
        $sendTo = $isEmail ? $identifier : ($userData['email'] ?? '');
        if ($sendTo) {
            EmailService::sendOtp($sendTo, $userData['name'] ?? '', $otp, $type);
        }

        Response::json(['sent' => true]);
    }

    // ── POST /auth/forgot-password ────────────────────────────────────────

    public function forgotPassword(): void {
        $body       = Validator::jsonBody();
        $identifier = trim($body['identifier'] ?? $body['phone'] ?? '');

        // Always return success to avoid leaking account existence
        if ($identifier) {
            $isEmail = str_contains($identifier, '@');

            if ($isEmail) {
                $stmt = $this->db->prepare('SELECT id FROM users WHERE email = ? AND is_verified = 1 LIMIT 1');
                $stmt->execute([$identifier]);
            } else {
                $normalised = Validator::normalisePhone($identifier) ?? $identifier;
                $stmt = $this->db->prepare('SELECT id FROM users WHERE phone = ? AND is_verified = 1 LIMIT 1');
                $stmt->execute([$normalised]);
            }

            $user = $stmt->fetch();

            if ($user) {
                $otp    = $this->generateOtp(6);
                $expiry = date('Y-m-d H:i:s', time() + 600);
                $this->db->prepare('UPDATE users SET otp_hash = ?, otp_expires_at = ?, updated_at = NOW() WHERE id = ?')
                         ->execute([hash('sha256', (string)$otp), $expiry, $user['id']]);

                // Fetch name for personalized email
                $nameStmt = $this->db->prepare('SELECT name FROM users WHERE id = ?');
                $nameStmt->execute([$user['id']]);
                $nameRow = $nameStmt->fetch();

                if ($isEmail) {
                    EmailService::sendOtp($identifier, $nameRow['name'] ?? '', $otp, 'identity');
                } else {
                    WhatsAppService::sendOtp($normalised ?? $identifier, $otp);
                }
            }
        }

        Response::json(['sent' => true]);
    }

    // ── POST /auth/verify-identity ────────────────────────────────────────

    public function verifyIdentity(): void {
        $body       = Validator::jsonBody();
        $identifier = trim($body['identifier'] ?? $body['phone'] ?? '');
        $otp        = trim($body['otp'] ?? '');

        if (!$identifier || !$otp) {
            Response::error('VALIDATION_ERROR', 'identifier and otp are required.', 422);
        }

        $this->checkRateLimit($identifier, 'otp');

        $isEmail = str_contains($identifier, '@');
        if ($isEmail) {
            $stmt = $this->db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$identifier]);
        } else {
            $normalised = Validator::normalisePhone($identifier) ?? $identifier;
            $stmt = $this->db->prepare('SELECT * FROM users WHERE phone = ? LIMIT 1');
            $stmt->execute([$normalised]);
        }
        $user = $stmt->fetch();

        if (!$user) {
            $this->recordAttempt($identifier, 'otp');
            Response::error('INVALID_OTP', 'Invalid or expired code.', 400);
        }

        if ($user['otp_expires_at'] && strtotime($user['otp_expires_at']) < time()) {
            $this->recordAttempt($identifier, 'otp');
            Response::error('OTP_EXPIRED', 'OTP has expired. Please request a new one.', 401);
        }

        if (!hash_equals($user['otp_hash'] ?? '', hash('sha256', (string)$otp))) {
            $this->recordAttempt($identifier, 'otp');
            Response::error('INVALID_OTP', 'Incorrect code. Please try again.', 401);
        }

        $this->clearAttempts($identifier, 'otp');

        // Generate a short-lived reset token
        $resetToken   = bin2hex(random_bytes(32));
        $resetExpiry  = date('Y-m-d H:i:s', time() + 900); // 15 minutes

        $this->db->prepare('
            UPDATE users
            SET reset_token = ?, reset_token_expires_at = ?, otp_hash = NULL, otp_expires_at = NULL, updated_at = NOW()
            WHERE id = ?
        ')->execute([$resetToken, $resetExpiry, $user['id']]);

        Response::json(['resetToken' => $resetToken]);
    }

    // ── POST /auth/reset-password ────────────────────────────────────────

    public function resetPassword(): void {
        $body        = Validator::jsonBody();
        $resetToken  = trim($body['resetToken']  ?? '');
        $newPassword = $body['newPassword'] ?? '';

        if (!$resetToken || !$newPassword) {
            Response::error('VALIDATION_ERROR', 'resetToken and newPassword are required.', 422);
        }

        $err = Validator::minLength($newPassword, 8, 'Password');
        if ($err) {
            Response::error('WEAK_PASSWORD', $err, 422);
        }

        $stmt = $this->db->prepare('SELECT * FROM users WHERE reset_token = ?');
        $stmt->execute([$resetToken]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('INVALID_TOKEN', 'Invalid or expired reset token.', 401);
        }

        if ($user['reset_token_expires_at'] && strtotime($user['reset_token_expires_at']) < time()) {
            Response::error('TOKEN_EXPIRED', 'Reset token has expired. Please start again.', 401);
        }

        $hashed = password_hash($newPassword, PASSWORD_BCRYPT);
        $this->db->prepare('
            UPDATE users
            SET password = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
            WHERE id = ?
        ')->execute([$hashed, $user['id']]);

        Response::json(['reset' => true]);
    }

    // ── POST /auth/change-password ───────────────────────────────────────
    // Called when mustChangePassword = true after first login.
    // Clears the must_change_password flag on success.

    public function changePassword(): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];

        $newPassword = $body['newPassword'] ?? '';

        if (!$newPassword || strlen($newPassword) < 8) {
            Response::error('VALIDATION_ERROR', 'Password must be at least 8 characters.', 422);
        }

        $hashed = password_hash($newPassword, PASSWORD_BCRYPT);

        $this->db->prepare('
            UPDATE users
            SET password = ?, must_change_password = 0, updated_at = NOW()
            WHERE id = ?
        ')->execute([$hashed, $auth['userId']]);

        Response::json(['changed' => true]);
    }

    // ── POST /auth/logout ────────────────────────────────────────────────

    public function logout(): void {
        $auth = requireAuth();

        $tokenHash = JWT::hash($auth['token']);
        $expiry    = date('Y-m-d H:i:s', time() + JWT_EXPIRES_IN);

        // Blacklist the token
        try {
            $this->db->prepare('
                INSERT IGNORE INTO jwt_blacklist (token_hash, expires_at, created_at)
                VALUES (?, ?, NOW())
            ')->execute([$tokenHash, $expiry]);
        } catch (Exception) {}

        Response::json(['loggedOut' => true]);
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private function getIp(): string {
        return $_SERVER['HTTP_X_FORWARDED_FOR']
            ?? $_SERVER['REMOTE_ADDR']
            ?? '0.0.0.0';
    }

    private function checkRateLimit(string $identifier, string $type = 'login'): void {
        $ip = $this->getIp();
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM auth_attempts
             WHERE (identifier = ? OR ip_address = ?)
               AND attempt_type = ?
               AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)"
        );
        $stmt->execute([$identifier, $ip, $type]);
        if ((int) $stmt->fetchColumn() >= 10) {
            Response::error('RATE_LIMITED', 'Too many failed attempts. Please try again in 15 minutes.', 429);
        }
    }

    private function recordAttempt(string $identifier, string $type = 'login'): void {
        $ip = $this->getIp();
        $stmt = $this->db->prepare(
            "INSERT INTO auth_attempts (identifier, ip_address, attempt_type) VALUES (?, ?, ?)"
        );
        $stmt->execute([$identifier, $ip, $type]);
    }

    private function clearAttempts(string $identifier, string $type = 'login'): void {
        $stmt = $this->db->prepare(
            "DELETE FROM auth_attempts WHERE identifier = ? AND attempt_type = ?"
        );
        $stmt->execute([$identifier, $type]);
    }

    /**
     * Records a sign-in, and alerts the citizen only when it came from a
     * device this account has not been seen on before.
     *
     * This used to fire on every login, so the notification list filled with
     * identical "New sign-in to your account" security warnings for the
     * ordinary act of logging in. An alert that fires when nothing is wrong
     * trains people to ignore it, which costs you the one time it matters.
     *
     * The device is matched on the user agent alone, hashed and salted per
     * user. The IP address is recorded for display but deliberately not
     * matched on: mobile networks reassign addresses constantly, so including
     * it would mark almost every login as new and recreate the problem.
     *
     * The first device ever seen is recorded silently. That is the one they
     * are holding while they sign up, and warning someone about themselves at
     * the moment they join is noise, not security.
     */
    private function noteSignIn(int $userId): void {
        $agent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400);
        $ip    = $_SERVER['REMOTE_ADDR'] ?? null;
        $hash  = hash('sha256', $userId . '|' . $agent);

        try {
            // Both reads happen before the insert below: afterwards the new
            // row would itself count as prior history and no first-time device
            // would ever be silent.
            $seen = $this->db->prepare('
                SELECT
                    COUNT(*)                                        AS devices,
                    SUM(CASE WHEN device_hash = ? THEN 1 ELSE 0 END) AS this_one
                  FROM user_devices
                 WHERE user_id = ?
            ');
            $seen->execute([$hash, $userId]);
            $row = $seen->fetch() ?: ['devices' => 0, 'this_one' => 0];

            $isKnownDevice = ((int) $row['this_one']) > 0;
            $hasHistory    = ((int) $row['devices'])  > 0;

            $this->db->prepare('
                INSERT INTO user_devices (user_id, device_hash, user_agent, label, last_ip)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE last_seen_at = NOW(), last_ip = VALUES(last_ip)
            ')->execute([$userId, $hash, $agent, $this->describeDevice($agent), $ip]);

            if ($isKnownDevice || !$hasHistory) return;

        } catch (Throwable) {
            // The table may not exist yet on an un-migrated deployment. Losing
            // the alert is far better than blocking a login over it.
            return;
        }

        NotificationService::send($this->db, $userId, [
            'category'    => 'Security Alert',
            'priority'    => 'high',
            'title'       => 'New sign-in from a new device',
            'body'        => 'Your Lagos Konect account was just signed in on '
                           . $this->describeDevice($agent)
                           . '. If this wasn\'t you, change your password immediately.',
            'linkTo'      => '/settings',
            'templateKey' => 'notifTemplates.newSignIn',
        ], 'notif_new_login');
    }

    /**
     * A short human label for a user agent, e.g. "Chrome on Android".
     *
     * Only for showing someone where a sign-in came from — never for matching,
     * since two different devices can easily produce the same label.
     */
    private function describeDevice(string $agent): string {
        if ($agent === '') return 'an unrecognised device';

        $browser = 'a browser';
        // Order matters: Edge and Opera both carry "Chrome" in their agent
        // string, and Chrome carries "Safari", so the specific names first.
        foreach ([
            'Edg'     => 'Edge',
            'OPR'     => 'Opera',
            'SamsungBrowser' => 'Samsung Internet',
            'Firefox' => 'Firefox',
            'Chrome'  => 'Chrome',
            'Safari'  => 'Safari',
        ] as $needle => $name) {
            if (str_contains($agent, $needle)) { $browser = $name; break; }
        }

        $os = '';
        foreach ([
            'Android'   => 'Android',
            'iPhone'    => 'iPhone',
            'iPad'      => 'iPad',
            'Windows'   => 'Windows',
            'Mac OS X'  => 'Mac',
            'Linux'     => 'Linux',
        ] as $needle => $name) {
            if (str_contains($agent, $needle)) { $os = $name; break; }
        }

        return $os === '' ? $browser : "{$browser} on {$os}";
    }

    private function resolveAvatarUrl(?string $storedUrl): ?string {
        if (!$storedUrl) return null;
        $filename   = basename($storedUrl);
        $base       = rtrim(getenv('BASE_URL') ?: '', '/');
        $serverBase = preg_replace('#/api/v1$#', '', $base);
        return $serverBase . '/uploads/avatars/' . $filename;
    }

    private function sanitiseUser(array $user): array {
        $hasPassword = !empty($user['password']);
        unset($user['password'], $user['otp_hash'], $user['otp_expires_at'],
              $user['reset_token'], $user['reset_token_expires_at']);

        return [
            'id'                 => (int) $user['id'],
            'name'               => $user['name'],
            'username'           => $user['username'],
            'referralCode'       => $user['referral_code'] ?? null,
            'referralCount'      => (int) ($user['referral_count'] ?? 0),
            'email'              => $user['email'],
            'phone'              => $user['phone'],
            'gender'             => $user['gender'] ?? null,
            'lgaId'              => (int) $user['lga_id'],
            'lgaName'            => $user['lga_name'],
            'region'             => $user['region'] ?? null,
            'avatarUrl'          => $this->resolveAvatarUrl($user['avatar_url']),
            'role'               => $user['role'],
            'isVerified'         => (bool) $user['is_verified'],
            'status'             => $user['status'],
            'has_seen_welcome'   => (bool) $user['has_seen_welcome'],
            'profileVisibility'  => $user['profile_visibility'] ?? 'public',
            'twoFaEnabled'       => (bool) ($user['two_fa_enabled'] ?? false),
            'totpMethod'         => $user['totp_method'] ?? 'none',
            'mustChangePassword' => (bool) ($user['must_change_password'] ?? false),
            'hasPassword'        => $hasPassword,
            'dob'                => $user['dob'] ?? null,
            'city'               => $user['city'] ?? null,
            'state'              => $user['state'] ?? 'Lagos State',
            'region'             => $user['region'] ?? null,
            'address'            => $user['address'] ?? null,
            'notifPrefs'         => [
                'official'     => (bool) ($user['notif_official']      ?? true),
                'community'    => (bool) ($user['notif_community']     ?? true),
                'lgaAlerts'    => (bool) ($user['notif_lga_alerts']    ?? false),
                'newLogin'     => (bool) ($user['notif_new_login']      ?? true),
                'reelLikes'    => (bool) ($user['notif_reel_likes']    ?? true),
                'reelComments' => (bool) ($user['notif_reel_comments'] ?? true),
                'breakingNews' => (bool) ($user['notif_breaking_news'] ?? true),
            ],
            'createdAt'          => $user['created_at'],
        ];
    }

    private function generateOtp(int $digits = 6): string {
        // Development escape hatch. When DEV_OTP is set in server/.env, every
        // generated code becomes that fixed value — needed locally because
        // there is no mail transport, so real codes can never be delivered.
        // The code is still hashed, stored and checked normally, and it still
        // expires; only the randomness is removed. MUST be blank in production.
        $devOtp = getenv('DEV_OTP') ?: '';
        if ($devOtp !== '' && preg_match('/^\d+$/', $devOtp)) {
            return str_pad(substr($devOtp, 0, $digits), $digits, '0', STR_PAD_LEFT);
        }

        $max = (int) str_repeat('9', $digits);
        $min = (int) ('1' . str_repeat('0', $digits - 1));
        return (string) random_int($min, $max);
    }
}