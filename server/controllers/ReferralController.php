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

    /**
     * GET /admin/referrals/user/:userId
     * Returns full profile, activity metrics, and the paginated list of
     * users this citizen has referred.
     */
    public function getUserReferrals(int $userId): void {
        $this->requireAdmin();

        $user = $this->fetchUser($userId);

        $activity = $this->fetchActivityMetrics((int)$user['userId']);

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
            ['user' => $user, 'activity' => $activity, 'entries' => $entries],
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
            'SELECT u.id, u.name, u.username, u.email, u.avatar_url, u.lga_id, u.lga_name, u.state, u.city,
                    u.region, u.referral_code, u.referral_count, u.referred_by_user_id,
                    u.status, u.is_verified, u.last_seen_at, u.created_at,
                    r.name AS referrer_name, r.username AS referrer_username
             FROM users u
             LEFT JOIN users r ON r.id = u.referred_by_user_id
             WHERE u.id = ?'
        );
        $stmt->execute([$userId]);
        $u = $stmt->fetch();
        if (!$u) Response::error('NOT_FOUND', 'User not found.', 404);

        $region = $u['region'] ?? null;
        $lgaName = $u['lga_name'] ?: '—';

        return [
            'userId'          => (int)$u['id'],
            'name'            => $u['name'],
            'username'        => $u['username'],
            'email'           => $u['email'],
            'avatarUrl'       => $u['avatar_url'] ?: null,
            'lgaId'           => $u['lga_id'] ? (int)$u['lga_id'] : null,
            'lgaName'         => $lgaName,
            'city'            => $u['city'],
            'state'           => $u['state'],
            'region'          => $region,
            'referralCode'    => $u['referral_code'],
            'referralCount'   => (int)$u['referral_count'],
            'referredBy'      => (int)$u['referred_by_user_id'],
            'referredByName'  => $u['referrer_name'] ? $u['referrer_name'] : null,
            'referredByUsername' => $u['referrer_username'] ? $u['referrer_username'] : null,
            'status'          => $u['status'],
            'isVerified'      => (bool)$u['is_verified'],
            'lastSeenAt'      => $u['last_seen_at'],
            'createdAt'       => $u['created_at'],
        ];
    }

    /**
     * Computes 30-day activity metrics for a user.
     *
     * Weights (effort-based):
     *   Page views       × 1  — passive browsing
     *   Chat messages    × 3  — takes engagement
     *   News posts       × 10 — written content creation
     *   Reels            × 15 — video production, highest effort
     *   Direct referrals × 20 — bringing real people to the platform
     *
     * Plus a referral network bonus: +20% of the sum of all referred
     * users' own scores (attributed back to the referrer).
     */
    private function fetchActivityMetrics(int $userId): array {
        $days = 30;

        $pvStmt = $this->db->prepare(
            "SELECT COUNT(*) FROM page_views
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)"
        );
        $pvStmt->execute([$userId]);
        $pageViews = (int)$pvStmt->fetchColumn();

        $newsStmt = $this->db->prepare(
            "SELECT COUNT(*) FROM news
             WHERE author_id = ? AND status = 'published'
               AND published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)"
        );
        $newsStmt->execute([$userId]);
        $newsPosts = (int)$newsStmt->fetchColumn();

        $reelStmt = $this->db->prepare(
            "SELECT COUNT(*) FROM reels
             WHERE author_id = ? AND status = 'published'
               AND published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)"
        );
        $reelStmt->execute([$userId]);
        $reels = (int)$reelStmt->fetchColumn();

        $chatStmt = $this->db->prepare(
            "SELECT COUNT(*) FROM lga_chat_messages
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)"
        );
        $chatStmt->execute([$userId]);
        $chatMessages = (int)$chatStmt->fetchColumn();

        $rcStmt = $this->db->prepare(
            'SELECT referral_count FROM users WHERE id = ?'
        );
        $rcStmt->execute([$userId]);
        $referralCount = (int)$rcStmt->fetchColumn();

        // Own score (direct activity only)
        $ownScore = $pageViews * 1
                  + $chatMessages * 3
                  + $newsPosts * 10
                  + $reels * 15
                  + $referralCount * 20;

        // Referral network bonus: 20% of the sum of referred users' own scores
        $bonusStmt = $this->db->prepare("
            SELECT COALESCE(ROUND(SUM(
                (SELECT COUNT(*) FROM page_views pv
                 WHERE pv.user_id = ru.id
                   AND pv.created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)) * 1
                + (SELECT COUNT(*) FROM lga_chat_messages cm
                   WHERE cm.user_id = ru.id
                     AND cm.created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)) * 3
                + (SELECT COUNT(*) FROM news n
                   WHERE n.author_id = ru.id AND n.status = 'published'
                     AND n.published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)) * 10
                + (SELECT COUNT(*) FROM reels re
                   WHERE re.author_id = ru.id AND re.status = 'published'
                     AND re.published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)) * 15
                + COALESCE(ru.referral_count, 0) * 20
            ) * 0.20), 0)
            FROM users ru
            WHERE ru.referred_by_user_id = ?
        ");
        $bonusStmt->execute([$userId]);
        $referralNetworkBonus = (int)$bonusStmt->fetchColumn();

        $activityScore = $ownScore + $referralNetworkBonus;

        return [
            'pageViews'            => $pageViews,
            'newsPosts'            => $newsPosts,
            'reels'                => $reels,
            'chatMessages'         => $chatMessages,
            'referralCount'        => $referralCount,
            'ownScore'             => $ownScore,
            'referralNetworkBonus' => $referralNetworkBonus,
            'activityScore'        => $activityScore,
            'periodDays'           => $days,
        ];
    }

    private function minePayload(array $user): array {
        $base = rtrim(getenv('APP_URL') ?: getenv('BASE_URL') ?: '', '/');
        $base = preg_replace('#/server/api/v1$#', '', $base);
        $code = $user['referralCode'] ?? '';
        $count = (int) ($user['referralCount'] ?? 0);
        $link = $base . '/signup?ref=' . rawurlencode($code);

        return [
            // Canonical names
            'referralCode'  => $code,
            'referralCount' => $count,
            'referralLink'  => $link,
            // Aliases expected by the frontend Referral page
            'code'          => $code,
            'link'          => $link,
            // Referral earnings are paid per successful (verified) referral.
            'rewardAmount'  => $count * 250,
            'rewardRate'    => 250,
            // Keep the legacy field for older clients, but make it reflect naira.
            'rewardPoints'  => $count * 250,
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
