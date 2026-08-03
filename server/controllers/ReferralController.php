<?php

class ReferralController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── Citizen ───────────────────────────────────────────────────────────────

    /** GET /referrals/me  (legacy) */
    public function getMine(): void {
        $auth = requireRole('citizen');
        $user = $this->fetchUser($auth['userId']);
        Response::json($this->minePayload($user));
    }

    /** GET /referrals/my-code — used by the Referral page (getMyCode) */
    public function getMyCode(): void {
        $auth = requireRole('citizen');
        $user = $this->fetchUser($auth['userId']);
        Response::json($this->minePayload($user));
    }

    /** GET /referrals/my-history — paginated list of users the citizen referred */
    public function getMyHistory(): void {
        $auth    = requireRole('citizen');
        $page    = max(1, (int)($_GET['page']    ?? 1));
        $perPage = min(50, max(1, (int)($_GET['perPage'] ?? 20)));
        $offset  = ($page - 1) * $perPage;

        $cntStmt = $this->db->prepare(
            'SELECT COUNT(*) FROM users WHERE referred_by_user_id = ?'
        );
        $cntStmt->execute([$auth['userId']]);
        $total = (int)$cntStmt->fetchColumn();

        $stmt = $this->db->prepare(
            'SELECT id, name, username, status, is_verified, created_at
             FROM users
             WHERE referred_by_user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$auth['userId'], $perPage, $offset]);
        $rows = $stmt->fetchAll();

        $entries = array_map(function ($r) {
            $confirmed = (bool)$r['is_verified'] && $r['status'] === 'active';
            return [
                'userId'   => (int)$r['id'],
                'name'     => $r['name'],
                'userName' => $r['username'],
                'joinedAt' => $r['created_at'],
                'status'   => $confirmed ? 'confirmed' : 'pending',
            ];
        }, $rows);

        Response::json($entries, 200, [
            'total'      => $total,
            'page'       => $page,
            'perPage'    => $perPage,
            'totalPages' => max(1, (int)ceil($total / $perPage)),
        ]);
    }

    /** GET /referrals/contest — citizen-facing contest + mini-leaderboard */
    public function getContest(): void {
        requireRole('citizen');
        $setting = $this->db->query(
            'SELECT * FROM referral_contest_settings WHERE id = 1 LIMIT 1'
        )->fetch();

        $rows = $this->db->query(
            'SELECT id, name, username, referral_count, referral_code
             FROM users
             WHERE role = "citizen" AND is_verified = 1 AND status = "active"
             ORDER BY referral_count DESC, created_at ASC
             LIMIT 10'
        )->fetchAll();

        $leaderboard = array_map(function ($r, $i) {
            return [
                'rank'          => $i + 1,
                'userId'        => (int)$r['id'],
                'name'          => $r['name'],
                'username'      => $r['username'],
                'referralCount' => (int)$r['referral_count'],
            ];
        }, $rows, array_keys($rows));

        Response::json([
            'contest' => $setting ? [
                'title'       => $setting['title'],
                'description' => $setting['description'],
                'prizes'      => [
                    'first'  => $setting['prize_first'],
                    'second' => $setting['prize_second'],
                    'third'  => $setting['prize_third'],
                ],
                'startsAt' => $setting['starts_at'],
                'endsAt'   => $setting['ends_at'],
                'isActive' => (bool)$setting['is_active'],
            ] : null,
            'leaderboard' => $leaderboard,
        ]);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * GET /admin/referrals/leaderboard
     * Returns a ranked, paginated, region-filtered list of top referrers.
     * Fields match what ReferralLeaderboard.js expects:
     *   name, handle, avatarUrl, lgaName, region, referrals, converted
     */
    public function getLeaderboard(): void {
        $this->requireAdmin();

        $region  = $_GET['region']  ?? null;
        $page    = max(1, (int)($_GET['page']    ?? 1));
        $perPage = min(100, max(1, (int)($_GET['perPage'] ?? 15)));
        $offset  = ($page - 1) * $perPage;

        // Build WHERE clause
        $where  = 'u.role = "citizen"';
        $params = [];
        if ($region && $region !== 'all') {
            $where   .= ' AND u.region = ?';
            $params[] = $region;
        }

        // Total count for pagination
        $cntStmt = $this->db->prepare(
            "SELECT COUNT(*) FROM users u WHERE {$where}"
        );
        $cntStmt->execute($params);
        $total = (int)$cntStmt->fetchColumn();

        // Main query — "converted" = verified + active referrals made by this user
        $stmtParams   = $params;
        $stmtParams[] = $perPage;
        $stmtParams[] = $offset;

        $stmt = $this->db->prepare(
            "SELECT u.id, u.name, u.username, u.email, u.region,
                    u.referral_code, u.referral_count, u.avatar_url,
                    l.name AS lga_name,
                    (SELECT COUNT(*) FROM users r
                     WHERE r.referred_by_user_id = u.id
                       AND r.is_verified = 1 AND r.status = 'active') AS converted_count
             FROM users u
             LEFT JOIN lgas l ON l.id = u.lga_id
             WHERE {$where}
             ORDER BY u.referral_count DESC, u.created_at ASC
             LIMIT ? OFFSET ?"
        );
        $stmt->execute($stmtParams);
        $rows = $stmt->fetchAll();

        $entries = array_map(function ($r, $i) use ($page, $perPage) {
            return [
                'rank'      => ($page - 1) * $perPage + $i + 1,
                'userId'    => (int)$r['id'],
                'name'      => $r['name'],
                'handle'    => '@' . $r['username'],
                'avatarUrl' => $r['avatar_url'] ?: null,
                'email'     => $r['email'],
                'region'    => $r['region'],
                'lgaName'   => $r['lga_name'] ?? '—',
                'referrals' => (int)$r['referral_count'],
                'converted' => (int)$r['converted_count'],
            ];
        }, $rows, array_keys($rows));

        Response::json(
            ['entries' => $entries],
            200,
            ['total' => $total, 'page' => $page, 'perPage' => $perPage,
             'totalPages' => max(1, (int)ceil($total / $perPage))]
        );
    }

    /**
     * GET /admin/referrals/stats
     * Platform-wide referral health stats, optionally scoped to a region.
     */
    public function getStats(): void {
        $this->requireAdmin();

        $region  = $_GET['region'] ?? null;
        $where   = 'role = "citizen"';
        $params  = [];
        if ($region && $region !== 'all') {
            $where   .= ' AND region = ?';
            $params[] = $region;
        }

        // Total referrals made
        $totalStmt = $this->db->prepare(
            "SELECT COALESCE(SUM(referral_count), 0) FROM users WHERE {$where}"
        );
        $totalStmt->execute($params);
        $totalReferrals = (int)$totalStmt->fetchColumn();

        // Citizens who have referred at least one person
        $activeStmt = $this->db->prepare(
            "SELECT COUNT(*) FROM users WHERE {$where} AND referral_count > 0"
        );
        $activeStmt->execute($params);
        $activeReferrers = (int)$activeStmt->fetchColumn();

        // Converted this month (joined via referral, verified, active, within 30 days)
        $monthParams   = $params;
        $monthParams[] = date('Y-m-d', strtotime('-30 days'));
        $convStmt = $this->db->prepare(
            "SELECT COUNT(*) FROM users
             WHERE {$where}
               AND referred_by_user_id IS NOT NULL
               AND is_verified = 1
               AND status = 'active'
               AND created_at >= ?"
        );
        $convStmt->execute($monthParams);
        $convertedThisMonth = (int)$convStmt->fetchColumn();

        // Growth rate: % change in referral_count sum vs. 30 days ago
        // Approximated as: (converted this month / max(totalReferrals - convertedThisMonth, 1)) * 100
        $base       = max(1, $totalReferrals - $convertedThisMonth);
        $growthRate = round(($convertedThisMonth / $base) * 100, 1);

        Response::json([
            'totalReferrals'     => $totalReferrals,
            'activeReferrers'    => $activeReferrers,
            'convertedThisMonth' => $convertedThisMonth,
            'growthRate'         => $growthRate,
        ]);
    }

    // ── Admin: per-user referral history ──────────────────────────
    // GET /admin/referrals/user/:userId

    public function getUserReferrals(int $userId): void {
        $this->requireAdmin();

        $user = $this->fetchUser($userId);

        $page    = max(1, (int)($_GET['page']    ?? 1));
        $perPage = min(50, max(1, (int)($_GET['perPage'] ?? 20)));
        $offset  = ($page - 1) * $perPage;

        $cntStmt = $this->db->prepare(
            'SELECT COUNT(*) FROM users WHERE referred_by_user_id = ?'
        );
        $cntStmt->execute([$userId]);
        $total = (int)$cntStmt->fetchColumn();

        $stmt = $this->db->prepare(
            'SELECT id, name, username, status, is_verified, created_at, avatar_url
             FROM users
             WHERE referred_by_user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$userId, $perPage, $offset]);
        $rows = $stmt->fetchAll();

        $entries = array_map(function ($r) {
            $confirmed = (bool)$r['is_verified'] && $r['status'] === 'active';
            return [
                'userId'    => (int)$r['id'],
                'name'      => $r['name'],
                'username'  => $r['username'],
                'avatarUrl' => $r['avatar_url'] ?: null,
                'joinedAt'  => $r['created_at'],
                'status'    => $confirmed ? 'confirmed' : 'pending',
            ];
        }, $rows);

        Response::json(
            ['user' => [
                'userId'       => (int)$user['id'],
                'name'         => $user['name'],
                'username'     => $user['username'],
                'referralCount'=> (int)$user['referral_count'],
            ], 'entries' => $entries],
            200,
            ['total'      => $total,
             'page'       => $page,
             'perPage'    => $perPage,
             'totalPages' => max(1, (int)ceil($total / $perPage))]
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function fetchUser(int $userId): array {
        $stmt = $this->db->prepare(
            'SELECT id, name, username, referral_code, referral_count FROM users WHERE id = ?'
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) Response::error('NOT_FOUND', 'User not found.', 404);
        return $user;
    }

    private function minePayload(array $user): array {
        $base = rtrim(getenv('APP_URL') ?: getenv('BASE_URL') ?: '', '/');
        $base = preg_replace('#/server/api/v1$#', '', $base);
        $link = $base . '/signup?ref=' . rawurlencode($user['referral_code'] ?? '');

        return [
            // Canonical names
            'referralCode'  => $user['referral_code'],
            'referralCount' => (int)$user['referral_count'],
            'referralLink'  => $link,
            // Aliases expected by the frontend Referral page
            'code'          => $user['referral_code'],
            'link'          => $link,
            // Referral earnings are paid per successful (verified) referral.
            'rewardAmount'  => (int)$user['referral_count'] * 250,
            'rewardRate'    => 250,
            // Keep the legacy field for older clients, but make it reflect naira.
            'rewardPoints'  => (int)$user['referral_count'] * 250,
        ];
    }

    private function requireAdmin(): array {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!$header || !str_starts_with($header, 'Bearer ')) {
            Response::error('UNAUTHENTICATED', 'Authorization token required.', 401);
        }
        try {
            $payload = JWT::decode(substr($header, 7), JWT_SECRET);
        } catch (RuntimeException) {
            Response::error('UNAUTHENTICATED', 'Invalid or expired token.', 401);
        }
        if (
            ($payload['type'] ?? '') !== 'admin' ||
            !in_array($payload['role'] ?? '', ['admin', 'super_admin'], true)
        ) {
            Response::error('FORBIDDEN', 'Admin access required.', 403);
        }
        return $payload;
    }
}
