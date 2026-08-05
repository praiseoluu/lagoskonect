<?php

class UserController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /users/me ────────────────────────────────────────────────────

    public function getProfile(): void {
        $auth = requireRole('citizen');
        $user = $this->fetchUser($auth['userId']);
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);
        Response::json($this->sanitise($user));
    }

    // ── PATCH /users/me ──────────────────────────────────────────────────

    public function updateProfile(): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];

        $allowed = ['name', 'email', 'lga_id', 'lga_name'];
        $fields  = [];
        $values  = [];

        if (isset($body['name'])) {
            $fields[] = 'name = ?';
            $values[] = trim($body['name']);
        }
        if (isset($body['email'])) {
            $email = trim($body['email']);
            if ($email && !Validator::isEmail($email)) {
                Response::error('VALIDATION_ERROR', 'Invalid email address.', 422);
            }
            $fields[] = 'email = ?';
            $values[] = $email ?: null;
        }
        if (isset($body['lgaId'])) {
            $lgaId  = (int) $body['lgaId'];
            $lgaStmt = $this->db->prepare('SELECT name FROM lgas WHERE id = ?');
            $lgaStmt->execute([$lgaId]);
            $lga = $lgaStmt->fetch();
            if (!$lga) Response::error('INVALID_LGA', 'Invalid LGA.', 422);
            $fields[] = 'lga_id = ?';
            $values[] = $lgaId;
            $fields[] = 'lga_name = ?';
            $values[] = $lga['name'];
        }

        if (isset($body['dob'])) {
            $fields[] = 'dob = ?';
            $values[] = $body['dob'] ?: null;
        }

        if (isset($body['city'])) {
            // Title-case each word
            $city = implode(' ', array_map('ucfirst', array_map('strtolower', explode(' ', trim($body['city'])))));
            $fields[] = 'city = ?';
            $values[] = $city ?: null;
        }

        if (isset($body['address'])) {
            $fields[] = 'address = ?';
            $values[] = trim($body['address']) ?: null;
        }

        if (isset($body['bio'])) {
            $bio = mb_substr(trim($body['bio']), 0, 160);
            $fields[] = 'bio = ?';
            $values[] = $bio ?: null;
        }

        if (isset($body['bankName'])) {
            $fields[] = 'bank_name = ?';
            $values[] = mb_substr(trim($body['bankName']), 0, 100) ?: null;
        }

        if (isset($body['bankAccountNumber'])) {
            $acct = preg_replace('/\D/', '', trim($body['bankAccountNumber']));
            if ($acct && (strlen($acct) < 8 || strlen($acct) > 20)) {
                Response::error('VALIDATION_ERROR', 'Bank account number must be 8–20 digits.', 422);
            }
            $fields[] = 'bank_account_number = ?';
            $values[] = $acct ?: null;
        }

        if (isset($body['bankAccountName'])) {
            $fields[] = 'bank_account_name = ?';
            $values[] = mb_substr(trim($body['bankAccountName']), 0, 100) ?: null;
        }

        if (isset($body['idType'])) {
            $allowed = ['NIN', 'Voter\'s Card', 'Driver\'s Licence', 'International Passport', ''];
            $idType  = trim($body['idType']);
            if ($idType && !in_array($idType, $allowed, true)) {
                Response::error('VALIDATION_ERROR', 'Invalid ID type.', 422);
            }
            $fields[] = 'id_type = ?';
            $values[] = $idType ?: null;
        }

        if (empty($fields)) {
            Response::error('VALIDATION_ERROR', 'No valid fields to update.', 422);
        }

        $fields[]  = 'updated_at = NOW()';
        $values[]  = $auth['userId'];
        $sql       = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $this->db->prepare($sql)->execute($values);

        $user = $this->fetchUser($auth['userId']);
        Response::json($this->sanitise($user));
    }

    // ── POST /users/me/id-document ───────────────────────────────────────

    public function uploadIdDocument(): void {
        $auth = requireRole('citizen');

        if (empty($_FILES['document'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "document".', 422);
        }

        $file = $_FILES['document'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        // Max 10 MB
        if ($file['size'] > 10 * 1024 * 1024) {
            Response::error('VALIDATION_ERROR', 'File size must not exceed 10 MB.', 422);
        }

        $mime = Mime::detect($file['tmp_name']);
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'Only JPEG, PNG, WebP images and PDFs are allowed.', 422);
        }

        $ext = match($mime) {
            'image/jpeg'      => 'jpg',
            'image/png'       => 'png',
            'image/webp'      => 'webp',
            'application/pdf' => 'pdf',
            default           => 'jpg',
        };

        $userId    = $auth['userId'];
        $safeName  = 'id_' . $userId . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
        $uploadDir = __DIR__ . '/../uploads/id-documents/';
        $destPath  = $uploadDir . $safeName;

        // Say which step failed, and record it. Both of these previously
        // surfaced as a bare "Could not save file" with nothing in the log,
        // which is unusable when the real problem is a directory that cannot
        // be created or written on the host.
        if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
            error_log("[IdUpload] cannot create directory: {$uploadDir}");
            Response::error('UPLOAD_ERROR', 'Could not create the upload folder on the server.', 500);
        }

        if (!is_writable($uploadDir)) {
            error_log("[IdUpload] directory not writable: {$uploadDir}");
            Response::error('UPLOAD_ERROR', 'The upload folder is not writable on the server.', 500);
        }

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            error_log("[IdUpload] move_uploaded_file failed -> {$destPath}");
            Response::error('UPLOAD_ERROR', 'Could not save the uploaded file.', 500);
        }

        $base       = rtrim(getenv('BASE_URL') ?: '', '/');
        $serverBase = preg_replace('#/api/v1$#', '', $base);
        $docUrl     = $serverBase . '/uploads/id-documents/' . $safeName;

        $this->db->prepare('UPDATE users SET id_document_url = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$docUrl, $userId]);

        $user = $this->fetchUser($userId);
        Response::json($this->sanitise($user));
    }

    // ── POST /users/me/avatar ────────────────────────────────────────────

    public function uploadAvatar(): void {
        $auth = requireRole('citizen');

        if (empty($_FILES['avatar'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "avatar".', 422);
        }

        $file = $_FILES['avatar'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        // Validate MIME type
        $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $mime = Mime::detect($file['tmp_name']);
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'Only image files are allowed.', 422);
        }

        // Max 5MB
        if ($file['size'] > 5 * 1024 * 1024) {
            Response::error('VALIDATION_ERROR', 'File size must not exceed 5MB.', 422);
        }

        $ext     = match($mime) {
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/gif'  => 'gif',
            'image/webp' => 'webp',
            default      => 'jpg',
        };

        $userId   = $auth['userId'];
        $filename = "{$userId}.{$ext}";
        $uploadDir = __DIR__ . '/../uploads/avatars/';
        $destPath  = $uploadDir . $filename;

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Response::error('UPLOAD_ERROR', 'Could not save file.', 500);
        }

        // Build the public URL to the uploads folder using BASE_URL env var
        $base       = rtrim(getenv('BASE_URL') ?: '', '/');
        $serverBase = preg_replace('#/api/v1$#', '', $base);
        $avatarUrl  = $serverBase . '/uploads/avatars/' . $filename;


        $this->db->prepare('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$avatarUrl, $userId]);

        $user = $this->fetchUser($userId);
        Response::json($this->sanitise($user));
    }

    // ── PATCH /users/me/password ─────────────────────────────────────────

    public function updatePassword(): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];

        $currentPassword = $body['currentPassword'] ?? '';
        $newPassword     = $body['newPassword']      ?? '';

        if (!$newPassword) {
            Response::error('VALIDATION_ERROR', 'newPassword is required.', 422);
        }

        $stmt = $this->db->prepare('SELECT password FROM users WHERE id = ?');
        $stmt->execute([$auth['userId']]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('NOT_FOUND', 'User not found.', 404);
        }

        $hasPassword = !empty($row['password']);

        if ($hasPassword) {
            // Standard user — must verify current password
            if (!$currentPassword) {
                Response::error('VALIDATION_ERROR', 'currentPassword is required.', 422);
            }
            if (!password_verify($currentPassword, $row['password'])) {
                Response::error('INVALID_PASSWORD', 'Current password is incorrect.', 401);
            }
        }
        // OAuth-only users (password IS NULL) may set a password without a current one

        $err = Validator::minLength($newPassword, 8, 'New password');
        if ($err) Response::error('WEAK_PASSWORD', $err, 422);

        $hashed = password_hash($newPassword, PASSWORD_BCRYPT);
        $this->db->prepare('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$hashed, $auth['userId']]);

        Response::json(['updated' => true, 'hasPassword' => true]);
    }

    // ── POST /users/me/welcome-seen ──────────────────────────────────────

    public function welcomeSeen(): void {
        $auth = requireRole('citizen');
        $this->db->prepare('UPDATE users SET has_seen_welcome = 1, updated_at = NOW() WHERE id = ?')
                 ->execute([$auth['userId']]);
        Response::json(['marked' => true]);
    }

    // ── PATCH /users/me/privacy ──────────────────────────────────────────

    public function updatePrivacy(): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];

        $fields = [];
        $values = [];

        if (isset($body['profileVisibility'])) {
            $vis = $body['profileVisibility'];
            if (!in_array($vis, ['public', 'members', 'private'], true)) {
                Response::error('VALIDATION_ERROR', 'Invalid profileVisibility value.', 422);
            }
            $fields[] = 'profile_visibility = ?';
            $values[] = $vis;
        }

        if (isset($body['twoFaEnabled'])) {
            $fields[] = 'two_fa_enabled = ?';
            $values[] = $body['twoFaEnabled'] ? 1 : 0;
        }

        if (empty($fields)) {
            Response::error('VALIDATION_ERROR', 'No valid fields to update.', 422);
        }

        $fields[]  = 'updated_at = NOW()';
        $values[]  = $auth['userId'];
        $this->db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')
                 ->execute($values);

        $user = $this->fetchUser($auth['userId']);
        Response::json($this->sanitise($user));
    }

    // ── PATCH /users/me/notif-prefs ──────────────────────────────────────

    public function updateNotifPrefs(): void {
        $auth = requireRole('citizen');
        $body = Validator::jsonBody() ?? [];

        $fields = [];
        $values = [];

        $prefMap = [
            'official'     => 'notif_official',
            'community'    => 'notif_community',
            'lgaAlerts'    => 'notif_lga_alerts',
            'newLogin'     => 'notif_new_login',
            'reelLikes'    => 'notif_reel_likes',
            'reelComments' => 'notif_reel_comments',
            'breakingNews' => 'notif_breaking_news',
        ];

        foreach ($prefMap as $bodyKey => $col) {
            if (isset($body[$bodyKey])) {
                $fields[] = "{$col} = ?";
                $values[] = $body[$bodyKey] ? 1 : 0;
            }
        }

        if (empty($fields)) {
            Response::error('VALIDATION_ERROR', 'No valid preference fields.', 422);
        }

        $fields[]  = 'updated_at = NOW()';
        $values[]  = $auth['userId'];
        $this->db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')
                 ->execute($values);

        $user = $this->fetchUser($auth['userId']);
        Response::json([
            'updated'    => true,
            'notifPrefs' => [
                'official'     => (bool) $user['notif_official'],
                'community'    => (bool) $user['notif_community'],
                'lgaAlerts'    => (bool) ($user['notif_lga_alerts']    ?? false),
                'newLogin'     => (bool) ($user['notif_new_login']      ?? true),
                'reelLikes'    => (bool) ($user['notif_reel_likes']    ?? true),
                'reelComments' => (bool) ($user['notif_reel_comments'] ?? true),
                'breakingNews' => (bool) ($user['notif_breaking_news'] ?? true),
            ],
        ]);
    }

    // ── GET /users/profile/:username ─────────────────────────────────────
    // Public — no auth required. Returns a limited view of a citizen's profile.

    public function getPublicProfile(string $username): void {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || $user['status'] !== 'active') {
            Response::error('NOT_FOUND', 'User not found.', 404);
        }

        if (($user['profile_visibility'] ?? 'public') === 'private') {
            Response::json([
                'username'    => $user['username'],
                'avatarUrl'   => $user['avatar_url'],
                'isPrivate'   => true,
            ]);
            return;
        }

        // Fetch reel count and total likes
        $reelStmt = $this->db->prepare(
            'SELECT COUNT(*) AS cnt, COALESCE(SUM(likes),0) AS total_likes FROM reels WHERE author_id = ? AND status = "published"'
        );
        $reelStmt->execute([$user['id']]);
        $stats = $reelStmt->fetch();

        Response::json([
            'id'          => (int) $user['id'],
            'name'        => $user['name'],
            'username'    => $user['username'],
            'avatarUrl'   => $user['avatar_url'],
            'lgaName'     => $user['lga_name'],
            'isVerified'  => (bool) $user['is_verified'],
            'createdAt'   => $user['created_at'],
            'reelCount'   => (int) $stats['cnt'],
            'totalLikes'  => (int) $stats['total_likes'],
            'isPrivate'   => false,
        ]);
    }

    // ── PATCH /users/me/username ─────────────────────────────────────────

    public function updateUsername(): void {
        $auth     = requireRole('citizen');
        $body     = Validator::jsonBody() ?? [];
        $username = trim($body['username'] ?? '');

        if (!$username) {
            Response::error('VALIDATION_ERROR', 'username is required.', 422);
        }
        if (!preg_match('/^[a-zA-Z0-9_\-]{3,30}$/', $username)) {
            Response::error('VALIDATION_ERROR', 'Username must be 3–30 characters and may only contain letters, numbers, underscores, and hyphens.', 422);
        }

        // Check uniqueness (case-insensitive via collation)
        $check = $this->db->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
        $check->execute([$username, $auth['userId']]);
        if ($check->fetch()) {
            Response::error('USERNAME_TAKEN', 'This username is already taken.', 409);
        }

        $this->db->prepare('UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?')
                 ->execute([$username, $auth['userId']]);

        $updated = $this->fetchUser($auth['userId']);
        Response::json($this->sanitise($updated));
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private function fetchUser(int $id): ?array {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    private function resolveAvatarUrl(?string $storedUrl): ?string {
        if (!$storedUrl) return null;
        $filename   = basename($storedUrl);
        $base       = rtrim(getenv('BASE_URL') ?: '', '/');
        $serverBase = preg_replace('#/api/v1$#', '', $base);
        return $serverBase . '/uploads/avatars/' . $filename;
    }

    private function sanitise(array $user): array {
        return [
            'id'                 => (int) $user['id'],
            'name'               => $user['name'],
            'username'           => $user['username'] ?? null,
            'email'              => $user['email'],
            'phone'              => $user['phone'],
            'lgaId'              => (int) $user['lga_id'],
            'lgaName'            => $user['lga_name'],
            'avatarUrl'          => $this->resolveAvatarUrl($user['avatar_url']),
            'role'               => $user['role'],
            'isVerified'         => (bool) $user['is_verified'],
            'status'             => $user['status'],
            'has_seen_welcome'   => (bool) $user['has_seen_welcome'],
            'profileVisibility'  => $user['profile_visibility'] ?? 'public',
            'twoFaEnabled'       => (bool) ($user['two_fa_enabled'] ?? false),
            'hasPassword'        => !empty($user['password']),
            'notifPrefs'         => [
                'official'     => (bool) ($user['notif_official']      ?? true),
                'community'    => (bool) ($user['notif_community']     ?? true),
                'lgaAlerts'    => (bool) ($user['notif_lga_alerts']    ?? false),
                'newLogin'     => (bool) ($user['notif_new_login']      ?? true),
                'reelLikes'    => (bool) ($user['notif_reel_likes']    ?? true),
                'reelComments' => (bool) ($user['notif_reel_comments'] ?? true),
                'breakingNews' => (bool) ($user['notif_breaking_news'] ?? true),
            ],
            'bio'               => $user['bio']     ?? null,
            'dob'               => $user['dob']     ?? null,
            'city'              => $user['city']    ?? null,
            'state'             => $user['state']   ?? 'Lagos State',
            'address'           => $user['address'] ?? null,
            'mustChangePassword'=> (bool) ($user['must_change_password'] ?? false),
            'createdAt'         => $user['created_at'],
            'bankName'          => $user['bank_name']           ?? null,
            'bankAccountNumber' => $user['bank_account_number'] ?? null,
            'bankAccountName'   => $user['bank_account_name']   ?? null,
            'idType'            => $user['id_type']             ?? null,
            'idDocumentUrl'     => $user['id_document_url']     ?? null,
        ];
    }
}