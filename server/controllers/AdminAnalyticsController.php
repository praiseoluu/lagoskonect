<?php

/**
 * Lagos Konnect - Admin Analytics Controller
 * ============================================================
 * Combined controller - dashboard + analytics page.
 *
 * Dashboard endpoints:
 *   GET  /admin/analytics/metrics          — stat cards (total users, flagged, weekly active, content)
 *   GET  /admin/analytics/insights         — cluster chart (?range=week|month|3months|6months|ytd|year|all)
 *   GET  /admin/analytics/top-lgas         — top 5 LGAs by active users (last 7 days)
 *   GET  /admin/analytics/flagged          — pending reel reports (last 10)
 *   PATCH /admin/analytics/flagged/:id     — dismiss a report
 *
 * Analytics page endpoints:
 *   GET  /admin/analytics/overview         — extended KPI metrics (active users 30d, engagement rate, etc.)
 *   GET  /admin/analytics/weekly           — 8-week content activity (news + reels per week)
 *   GET  /admin/analytics/topics           — top news categories + reel hashtags
 *   GET  /admin/analytics/lga-heatmap      — per-LGA engagement scores
 *   GET  /admin/analytics/export           — CSV or PDF report (?format=csv|pdf)
 *
 * Citizen endpoint:
 *   POST /data/visit               — record a citizen page view
 */
class AdminAnalyticsController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  DASHBOARD ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════

    // ── GET /admin/analytics/metrics ──────────────────────────────────────

    public function getMetrics(): void {
        $this->requireAdmin();

        $region = $_GET['region'] ?? null;

        if ($region) {
            // Scoped to a specific region — join users through lgas
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM users u JOIN lgas l ON l.id = u.lga_id WHERE u.role = "citizen" AND l.region = ?');
            $stmt->execute([$region]); $totalUsers = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(*) FROM users u JOIN lgas l ON l.id = u.lga_id WHERE u.role = "citizen" AND l.region = ? AND u.last_seen_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)');
            $stmt->execute([$region]); $activeToday = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(*) FROM users u JOIN lgas l ON l.id = u.lga_id WHERE u.role = "citizen" AND l.region = ? AND u.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)');
            $stmt->execute([$region]); $newThisWeek = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(*) FROM news n JOIN lgas l ON l.id = n.lga_id WHERE n.status = "published" AND l.region = ?');
            $stmt->execute([$region]); $totalNews = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(*) FROM reels r JOIN lgas l ON l.id = r.lga_id WHERE r.status = "published" AND l.region = ?');
            $stmt->execute([$region]); $totalReels = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(*) FROM reel_reports rr JOIN reels r ON r.reel_id = rr.reel_id JOIN lgas l ON l.id = r.lga_id WHERE rr.status = "pending" AND l.region = ?');
            $stmt->execute([$region]); $flagged = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(DISTINCT u.id) FROM users u JOIN lgas l ON l.id = u.lga_id WHERE u.role = "citizen" AND l.region = ? AND u.last_seen_at > DATE_SUB(NOW(), INTERVAL 7 DAY)');
            $stmt->execute([$region]); $wau = (int) $stmt->fetchColumn();
        } else {
            $totalUsers  = (int) $this->db->query('SELECT COUNT(*) FROM users WHERE role = "citizen"')->fetchColumn();
            $activeToday = (int) $this->db->query('SELECT COUNT(*) FROM users WHERE role = "citizen" AND last_seen_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)')->fetchColumn();
            $newThisWeek = (int) $this->db->query('SELECT COUNT(*) FROM users WHERE role = "citizen" AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)')->fetchColumn();
            $totalNews   = (int) $this->db->query('SELECT COUNT(*) FROM news  WHERE status = "published"')->fetchColumn();
            $totalReels  = (int) $this->db->query('SELECT COUNT(*) FROM reels WHERE status = "published"')->fetchColumn();
            $flagged     = (int) $this->db->query('SELECT COUNT(*) FROM reel_reports WHERE status = "pending"')->fetchColumn();
            $wau         = (int) $this->db->query('SELECT COUNT(DISTINCT id) FROM users WHERE role = "citizen" AND last_seen_at > DATE_SUB(NOW(), INTERVAL 7 DAY)')->fetchColumn();
        }

        Response::json([
            'totalUsers'        => $totalUsers,
            'activeToday'       => $activeToday,
            'newUsersThisWeek'  => $newThisWeek,
            'weeklyActiveUsers' => $wau,
            'totalNews'         => $totalNews,
            'totalReels'        => $totalReels,
            'totalContent'      => $totalNews + $totalReels,
            'flaggedCount'      => $flagged,
        ]);
    }

    // ── GET /admin/analytics/insights ─────────────────────────────────────

    public function getInsights(): void {
        $this->requireAdmin();
        $range  = $_GET['range']  ?? 'month';
        $region = $_GET['region'] ?? null;
        [$periods] = $this->getRangeConfig($range);

        $data = [];
        foreach ($periods as [$start, $end, $label]) {
            if ($region) {
                $stmt = $this->db->prepare('SELECT COUNT(*) FROM users u JOIN lgas l ON l.id = u.lga_id WHERE u.role="citizen" AND l.region=? AND u.created_at BETWEEN ? AND ?');
                $stmt->execute([$region, $start, $end]); $registrations = (int) $stmt->fetchColumn();

                $stmt = $this->db->prepare('SELECT COUNT(*) FROM lga_chat_messages m JOIN lgas l ON l.id = m.lga_id WHERE l.region=? AND m.created_at BETWEEN ? AND ?');
                $stmt->execute([$region, $start, $end]); $messages = (int) $stmt->fetchColumn();

                $stmt = $this->db->prepare('SELECT COUNT(*) FROM reels r JOIN lgas l ON l.id = r.lga_id WHERE l.region=? AND r.created_at BETWEEN ? AND ?');
                $stmt->execute([$region, $start, $end]); $reels = (int) $stmt->fetchColumn();

                $stmt = $this->db->prepare('SELECT COUNT(DISTINCT u.id) FROM users u JOIN lgas l ON l.id = u.lga_id WHERE u.role="citizen" AND l.region=? AND u.last_seen_at BETWEEN ? AND ?');
                $stmt->execute([$region, $start, $end]); $activeUsers = (int) $stmt->fetchColumn();

                $stmt = $this->db->prepare('SELECT COALESCE(SUM(n.views),0) FROM news n JOIN lgas l ON l.id = n.lga_id WHERE l.region=? AND n.published_at BETWEEN ? AND ?');
                $stmt->execute([$region, $start, $end]); $newsViews = (int) $stmt->fetchColumn();
            } else {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM users WHERE role="citizen" AND created_at BETWEEN ? AND ?');
            $stmt->execute([$start, $end]);
            $registrations = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(*) FROM lga_chat_messages WHERE created_at BETWEEN ? AND ?');
            $stmt->execute([$start, $end]);
            $messages = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(*) FROM reels WHERE created_at BETWEEN ? AND ?');
            $stmt->execute([$start, $end]);
            $reels = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COUNT(DISTINCT id) FROM users WHERE role="citizen" AND last_seen_at BETWEEN ? AND ?');
            $stmt->execute([$start, $end]);
            $activeUsers = (int) $stmt->fetchColumn();

            $stmt = $this->db->prepare('SELECT COALESCE(SUM(views),0) FROM news WHERE published_at BETWEEN ? AND ?');
            $stmt->execute([$start, $end]);
            $newsViews = (int) $stmt->fetchColumn();
            }

            $data[] = [
                'label'         => $label,
                'start'         => $start,
                'end'           => $end,
                'registrations' => $registrations,
                'messages'      => $messages,
                'reels'         => $reels,
                'activeUsers'   => $activeUsers,
                'newsViews'     => $newsViews,
            ];
        }

        Response::json([
            'range'  => $range,
            'series' => [
                ['key' => 'registrations', 'label' => 'Registrations', 'color' => 'primary'],
                ['key' => 'messages',      'label' => 'Chat Messages',  'color' => 'info'],
                ['key' => 'reels',         'label' => 'Reels Posted',   'color' => 'purple'],
                ['key' => 'activeUsers',   'label' => 'Active Users',   'color' => 'warning'],
                ['key' => 'newsViews',     'label' => 'News Views',     'color' => 'success'],
            ],
            'data'   => $data,
        ]);
    }

    // ── GET /admin/analytics/top-lgas ─────────────────────────────────────

    public function getTopLGAs(): void {
        $this->requireAdmin();
        $region = $_GET['region'] ?? null;
        if ($region) {
            $stmt = $this->db->prepare('
                SELECT u.lga_id, u.lga_name, COUNT(DISTINCT u.id) AS active_users
                FROM users u
                JOIN lgas l ON l.id = u.lga_id
                WHERE u.role = "citizen" AND u.last_seen_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
                  AND u.lga_id IS NOT NULL AND l.region = ?
                GROUP BY u.lga_id, u.lga_name ORDER BY active_users DESC LIMIT 5
            ');
            $stmt->execute([$region]);
        } else {
            $stmt = $this->db->query('
                SELECT u.lga_id, u.lga_name, COUNT(DISTINCT u.id) AS active_users
                FROM users u
                WHERE u.role = "citizen" AND u.last_seen_at > DATE_SUB(NOW(), INTERVAL 7 DAY) AND u.lga_id IS NOT NULL
                GROUP BY u.lga_id, u.lga_name ORDER BY active_users DESC LIMIT 5
            ');
        }
        Response::json(['lgas' => array_map(fn($r) => [
            'lgaId'       => (int) $r['lga_id'],
            'lgaName'     => $r['lga_name'],
            'activeUsers' => (int) $r['active_users'],
        ], $stmt->fetchAll())]);
    }

    // ── GET /admin/analytics/flagged ──────────────────────────────────────

    public function getFlagged(): void {
        $this->requireAdmin();
        $region = $_GET['region'] ?? null;
        if ($region) {
            $stmt = $this->db->prepare('
                SELECT rr.id AS report_id, rr.reel_id, rr.reason, rr.details, rr.status,
                       rr.created_at AS reported_at, r.caption, r.thumbnail_url,
                       r.author_name, r.lga_name, r.lga_id, l.region,
                       u.name AS reporter_name
                FROM reel_reports rr
                LEFT JOIN reels r ON r.reel_id = rr.reel_id
                LEFT JOIN lgas  l ON l.id = r.lga_id
                JOIN users u ON u.id = rr.user_id
                WHERE rr.status = "pending" AND l.region = ?
                ORDER BY rr.created_at DESC LIMIT 10
            ');
            $stmt->execute([$region]);
        } else {
            $stmt = $this->db->query('
                SELECT rr.id AS report_id, rr.reel_id, rr.reason, rr.details, rr.status,
                       rr.created_at AS reported_at, r.caption, r.thumbnail_url,
                       r.author_name, r.lga_name, r.lga_id, l.region,
                       u.name AS reporter_name
                FROM reel_reports rr
                LEFT JOIN reels r ON r.reel_id = rr.reel_id
                LEFT JOIN lgas  l ON l.id = r.lga_id
                JOIN users u ON u.id = rr.user_id
                WHERE rr.status = "pending"
                ORDER BY rr.created_at DESC LIMIT 10
            ');
        }
        Response::json(['flagged' => array_map(fn($r) => [
            'reportId'     => (int) $r['report_id'],
            'reelId'       => $r['reel_id'],
            'reason'       => $r['reason'],
            'details'      => $r['details'],
            'status'       => $r['status'],
            'reportedAt'   => $r['reported_at'],
            'caption'      => $r['caption'] ?? 'Reel deleted',
            'thumbnailUrl' => $r['thumbnail_url'] ?? null,
            'authorName'   => $r['author_name'] ?? 'Unknown',
            'lgaName'      => $r['lga_name'] ?? 'Unknown',
            'region'       => $r['region'] ?? null,
            'reporterName' => $r['reporter_name'],
        ], $stmt->fetchAll())]);
    }

    // ── PATCH /admin/analytics/flagged/:id ────────────────────────────────

    public function dismissReport(int $reportId): void {
        $this->requireAdmin();
        $stmt = $this->db->prepare('UPDATE reel_reports SET status = "dismissed", updated_at = NOW() WHERE id = ? AND status = "pending"');
        $stmt->execute([$reportId]);
        if ($stmt->rowCount() === 0) Response::error('NOT_FOUND', 'Report not found or already actioned.', 404);
        Response::json(['dismissed' => true]);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  ANALYTICS PAGE ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════

    // ── GET /admin/analytics/overview ─────────────────────────────────────

    public function overview(): void {
        $this->requireAdmin();

        $region = trim($_GET['region'] ?? '');
        if (!in_array($region, ['west', 'central', 'east'], true)) $region = '';
        $range = $_GET['range'] ?? '30d';
        $daysByRange = ['7d' => 7, '30d' => 30, '90d' => 90, '365d' => 365];
        $days = $daysByRange[$range] ?? 30;
        $previousDays = $days * 2;
        $quotedRegion = $region ? $this->db->quote($region) : '';

        // All overview metrics share the admin's region and date scope.
        $userScope = $region ? " AND u.lga_id IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';
        $newsScope = $region ? " AND n.lga_id IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';
        $reelScope = $region ? " AND r.lga_id IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';
        $chatScope = $region ? " AND m.lga_id IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';
        $pageViewScope = $region ? " AND pv.lga_id IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';

        $activeUsers = (int) $this->db->query("
            SELECT COUNT(*) FROM users u
            WHERE u.role = 'citizen' AND u.status = 'active'
              AND u.last_seen_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY) {$userScope}
        ")->fetchColumn();
        $previousActiveUsers = (int) $this->db->query("
            SELECT COUNT(*) FROM users u
            WHERE u.role = 'citizen' AND u.status = 'active'
              AND u.last_seen_at >= DATE_SUB(NOW(), INTERVAL {$previousDays} DAY)
              AND u.last_seen_at < DATE_SUB(NOW(), INTERVAL {$days} DAY) {$userScope}
        ")->fetchColumn();
        $activeUsersTrend = $previousActiveUsers > 0
            ? round((($activeUsers - $previousActiveUsers) / $previousActiveUsers) * 100, 1) : 0;

        $totalLgas = $region
            ? (int) $this->db->query("SELECT COUNT(*) FROM lgas WHERE region = {$quotedRegion}")->fetchColumn()
            : (int) $this->db->query('SELECT COUNT(*) FROM lgas')->fetchColumn();
        $contentInteractions = (int) $this->db->query("
            SELECT COALESCE(SUM(r.likes + r.comment_count + r.shares), 0)
            FROM reels r
            WHERE r.status = 'published'
              AND r.created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY) {$reelScope}
        ")->fetchColumn();
        $contentInteractions += (int) $this->db->query("
            SELECT COALESCE(SUM(n.views), 0) FROM news n
            WHERE n.status = 'published'
              AND n.published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY) {$newsScope}
        ")->fetchColumn();
        $engagementRate = $activeUsers > 0
            ? round(min(100, ($contentInteractions / $activeUsers) * 100), 1) : 0;

        $newUsers = (int) $this->db->query("
            SELECT COUNT(*) FROM users u
            WHERE u.role = 'citizen'
              AND u.created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY) {$userScope}
        ")->fetchColumn();
        $previousNewUsers = (int) $this->db->query("
            SELECT COUNT(*) FROM users u
            WHERE u.role = 'citizen'
              AND u.created_at >= DATE_SUB(NOW(), INTERVAL {$previousDays} DAY)
              AND u.created_at < DATE_SUB(NOW(), INTERVAL {$days} DAY) {$userScope}
        ")->fetchColumn();
        $newUsersTrend = $previousNewUsers > 0
            ? round((($newUsers - $previousNewUsers) / $previousNewUsers) * 100, 1) : 0;

        $chatMessages = (int) $this->db->query("
            SELECT COUNT(*) FROM lga_chat_messages m
            WHERE m.created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY) {$chatScope}
        ")->fetchColumn();
        $pageViews = (int) $this->db->query("
            SELECT COUNT(*) FROM page_views pv
            WHERE pv.created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY) {$pageViewScope}
        ")->fetchColumn();
        $flaggedContent = (int) $this->db->query("
            SELECT COUNT(DISTINCT rr.reel_id)
            FROM reel_reports rr
            JOIN reels r ON r.reel_id = rr.reel_id
            WHERE rr.status = 'pending' {$reelScope}
        ")->fetchColumn();
        $pendingChatReports = (int) $this->db->query("
            SELECT COUNT(*) FROM chat_reports cr
            JOIN lga_chat_messages m ON m.id = cr.message_id
            WHERE cr.status = 'pending' {$chatScope}
        ")->fetchColumn();

        $totalCitizens = (int) $this->db->query("SELECT COUNT(*) FROM users u WHERE u.role = 'citizen' {$userScope}")->fetchColumn();
        $totalNews = (int) $this->db->query("SELECT COUNT(*) FROM news n WHERE n.status = 'published' {$newsScope}")->fetchColumn();
        $totalReels = (int) $this->db->query("SELECT COUNT(*) FROM reels r WHERE r.status = 'published' {$reelScope}")->fetchColumn();

        Response::json([
            'activeUsers'          => $activeUsers,
            'activeUsersTrend'     => $activeUsersTrend,
            'newUsers'             => $newUsers,
            'newUsersTrend'        => $newUsersTrend,
            'chatMessages'         => $chatMessages,
            'pageViews'            => $pageViews,
            'contentInteractions'  => $contentInteractions,
            'moderationOpen'       => $flaggedContent + $pendingChatReports,
            'flaggedCount'         => $flaggedContent,
            'pendingChatReports'   => $pendingChatReports,
            'totalLgas'            => $totalLgas,
            'engagementRate'       => $engagementRate,
            'totalNews'            => $totalNews,
            'totalReels'           => $totalReels,
            'publishedContent'     => $totalNews + $totalReels,
            'totalCitizens'        => $totalCitizens,
            'range'                => $range,
            'region'               => $region ?: null,
        ]);
    }

    // ── GET /admin/analytics/weekly ───────────────────────────────────────

    public function weekly(): void {
        $this->requireAdmin();
        $region = trim($_GET['region'] ?? '');
        if (!in_array($region, ['west', 'central', 'east'], true)) $region = '';
        $range = $_GET['range'] ?? '30d';
        $days = ['7d' => 7, '30d' => 30, '90d' => 90, '365d' => 365][$range] ?? 30;
        $quotedRegion = $region ? $this->db->quote($region) : '';
        $scope = $region ? " IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';
        $periods = [];

        if ($days === 7) {
            for ($i = 6; $i >= 0; $i--) {
                $day = date('Y-m-d', strtotime("-{$i} days"));
                $periods[] = [$day, $day, date('D', strtotime($day))];
            }
        } elseif ($days === 365) {
            for ($i = 11; $i >= 0; $i--) {
                $stamp = strtotime("-{$i} months");
                $periods[] = [
                    date('Y-m-01', $stamp),
                    $i === 0 ? date('Y-m-d') : date('Y-m-t', $stamp),
                    date('M', $stamp),
                ];
            }
        } else {
            $count = $days === 90 ? 12 : 5;
            for ($i = $count - 1; $i >= 0; $i--) {
                $start = date('Y-m-d', strtotime("-{$i} weeks monday"));
                $end = $i === 0 ? date('Y-m-d') : date('Y-m-d', strtotime("{$start} +6 days"));
                $periods[] = [$start, $end, date('M j', strtotime($start))];
            }
        }

        $rows = [];
        foreach ($periods as [$start, $end, $label]) {
            $news = (int) $this->db->query("SELECT COUNT(*) FROM news n WHERE n.status='published' AND DATE(n.published_at) BETWEEN '{$start}' AND '{$end}'" . ($scope ? " AND n.lga_id{$scope}" : ''))->fetchColumn();
            $reels = (int) $this->db->query("SELECT COUNT(*) FROM reels r WHERE r.status='published' AND DATE(r.published_at) BETWEEN '{$start}' AND '{$end}'" . ($scope ? " AND r.lga_id{$scope}" : ''))->fetchColumn();
            $messages = (int) $this->db->query("SELECT COUNT(*) FROM lga_chat_messages m WHERE DATE(m.created_at) BETWEEN '{$start}' AND '{$end}'" . ($scope ? " AND m.lga_id{$scope}" : ''))->fetchColumn();
            $pageViews = (int) $this->db->query("SELECT COUNT(*) FROM page_views pv WHERE DATE(pv.created_at) BETWEEN '{$start}' AND '{$end}'" . ($scope ? " AND pv.lga_id{$scope}" : ''))->fetchColumn();
            $registrations = (int) $this->db->query("SELECT COUNT(*) FROM users u WHERE u.role='citizen' AND DATE(u.created_at) BETWEEN '{$start}' AND '{$end}'" . ($scope ? " AND u.lga_id{$scope}" : ''))->fetchColumn();
            $activeUsers = (int) $this->db->query("SELECT COUNT(*) FROM users u WHERE u.role='citizen' AND DATE(u.last_seen_at) BETWEEN '{$start}' AND '{$end}'" . ($scope ? " AND u.lga_id{$scope}" : ''))->fetchColumn();
            $rows[] = [
                'label' => $label, 'week' => $start, 'news' => $news, 'reels' => $reels,
                'messages' => $messages, 'pageViews' => $pageViews, 'registrations' => $registrations,
                'activeUsers' => $activeUsers, 'total' => $news + $reels,
            ];
        }
        Response::json($rows);
    }

    // ── GET /admin/analytics/topics ───────────────────────────────────────

    public function topics(): void {
        $this->requireAdmin();
        $region = trim($_GET['region'] ?? '');
        if (!in_array($region, ['west', 'central', 'east'], true)) $region = '';
        $range = $_GET['range'] ?? '30d';
        $days = ['7d' => 7, '30d' => 30, '90d' => 90, '365d' => 365][$range] ?? 30;
        $quotedRegion = $region ? $this->db->quote($region) : '';
        $newsScope = $region ? " AND n.lga_id IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';
        $reelScope = $region ? " AND r.lga_id IN (SELECT id FROM lgas WHERE region = {$quotedRegion})" : '';
        $dateScopeNews = " AND n.published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)";
        $dateScopeReels = " AND r.published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)";

        $cats = $this->db->query("
            SELECT n.category, COUNT(*) AS cnt FROM news n
            WHERE status='published' AND category IS NOT NULL AND category != ''
              {$dateScopeNews} {$newsScope}
            GROUP BY category ORDER BY cnt DESC LIMIT 8
        ")->fetchAll();

        $hashtagCounts = [];
        foreach ($this->db->query("SELECT r.hashtags FROM reels r WHERE r.status='published' AND r.hashtags IS NOT NULL AND r.hashtags != '[]' {$dateScopeReels} {$reelScope}")->fetchAll() as $row) {
            foreach (json_decode($row['hashtags'], true) ?: [] as $tag) {
                $tag = strtolower(trim($tag, '#'));
                if ($tag) $hashtagCounts[$tag] = ($hashtagCounts[$tag] ?? 0) + 1;
            }
        }
        arsort($hashtagCounts);

        $combined = [];
        foreach ($cats as $c) {
            $combined[] = ['label' => ucfirst($c['category']), 'count' => (int)$c['cnt'], 'type' => 'category'];
        }
        foreach (array_slice($hashtagCounts, 0, 5, true) as $tag => $count) {
            $combined[] = ['label' => '#' . $tag, 'count' => (int)$count, 'type' => 'hashtag'];
        }

        usort($combined, fn($a, $b) => $b['count'] - $a['count']);
        $combined  = array_slice($combined, 0, 6);
        $totalAll  = max(array_sum(array_column($combined, 'count')), 1);
        foreach ($combined as &$item) { $item['pct'] = round(($item['count'] / $totalAll) * 100); }

        Response::json($combined);
    }

    // ── GET /admin/analytics/lga-heatmap ─────────────────────────────────

    public function lgaHeatmap(): void {
        $this->requireAdmin();
        $region = trim($_GET['region'] ?? '');
        if (!in_array($region, ['west', 'central', 'east'], true)) $region = '';
        $range = $_GET['range'] ?? '30d';
        $days = ['7d' => 7, '30d' => 30, '90d' => 90, '365d' => 365][$range] ?? 30;
        $regionWhere = $region ? " WHERE l.region = " . $this->db->quote($region) : '';

        try {
            $rows = $this->db->query("
                SELECT * FROM (
                    SELECT l.id, l.name,
                        COUNT(DISTINCT u.id) AS active_users,
                        COALESCE(SUM(r.likes + r.comment_count + r.shares), 0) AS interactions,
                        0 AS views_30d
                    FROM lgas l
                    LEFT JOIN users u ON u.lga_id = l.id
                        AND u.last_seen_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)
                    LEFT JOIN reels r ON r.lga_id = l.id
                        AND r.status = 'published'
                        AND r.published_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)
                    {$regionWhere}
                    GROUP BY l.id, l.name
                ) AS lga_scores
                ORDER BY (active_users + interactions) DESC
            ")->fetchAll();
        } catch (\Exception $e) {
            Response::error('DB_ERROR', $e->getMessage(), 500);
        }

        // Enrich with page_views if the table exists
        try {
            $pvStmt = $this->db->prepare("
                SELECT COUNT(*) FROM page_views
                WHERE lga_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)
            ");
            foreach ($rows as &$row) {
                $pvStmt->execute([$row['id']]);
                $row['views_30d'] = (int) $pvStmt->fetchColumn();
            }
            unset($row);
        } catch (\Exception) {
            // page_views table not yet created — skip
        }

        if (empty($rows)) { Response::json([]); return; }

        $maxScore = 0;
        $scored   = [];
        foreach ($rows as $row) {
            $score    = (int)$row['active_users'] * 3 + (int)$row['interactions'] + (int)$row['views_30d'];
            $scored[] = array_merge($row, ['score' => $score]);
            $maxScore = max($maxScore, $score);
        }

        $maxScore = $maxScore ?: 1;
        $result   = [];
        foreach ($scored as $row) {
            $n      = round(($row['score'] / $maxScore) * 100);
            $level  = $n >= 66 ? 'High' : ($n >= 33 ? 'Med' : 'Low');
            $result[] = [
                'lgaId'        => (int) $row['id'],
                'lgaName'      => $row['name'],
                'score'        => $n,
                'level'        => $level,
                'activeUsers'  => (int) $row['active_users'],
                'interactions' => (int) $row['interactions'],
                'pageViews'    => (int) $row['views_30d'],
            ];
        }
        Response::json($result);
    }

    // ── GET /admin/analytics/export ───────────────────────────────────────

    public function export(): void {
        // Accept token via query param when opened in new tab (PDF path)
        $authHeader = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? (function_exists('apache_request_headers')
                ? (apache_request_headers()['Authorization'] ?? '')
                : '');

        if ((!$authHeader || !str_starts_with($authHeader, 'Bearer ')) && !empty($_GET['token'])) {
            $authHeader = 'Bearer ' . $_GET['token'];
        }

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

        $format = strtolower(trim($_GET['format'] ?? 'csv'));

        $metrics = $this->db->query("
            SELECT
                (SELECT COUNT(*) FROM users WHERE role='citizen' AND status='active'
                 AND last_seen_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS active_users,
                (SELECT COUNT(*) FROM lgas) AS total_lgas,
                (SELECT COUNT(*) FROM news  WHERE status='published') AS total_news,
                (SELECT COUNT(*) FROM reels WHERE status='published') AS total_reels,
                (SELECT COUNT(*) FROM users WHERE role='citizen') AS total_citizens
        ")->fetch();

        $lgaRows = $this->db->query("
            SELECT l.name, COUNT(DISTINCT u.id) AS citizens,
                   COALESCE(SUM(r.likes + r.comment_count), 0) AS interactions
            FROM lgas l
            LEFT JOIN users u ON u.lga_id = l.id
            LEFT JOIN reels r ON r.lga_id = l.id AND r.status='published'
            GROUP BY l.id ORDER BY l.name
        ")->fetchAll();

        if ($format === 'csv') {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="analytics_' . date('Y-m-d') . '.csv"');
            header('Pragma: no-cache');
            $out = fopen('php://output', 'w');
            fputcsv($out, ['LagKonnect — Analytics Export', date('Y-m-d H:i')]);
            fputcsv($out, []);
            fputcsv($out, ['PLATFORM OVERVIEW']);
            fputcsv($out, ['Active Users (30d)', $metrics['active_users']]);
            fputcsv($out, ['Total LGAs',         $metrics['total_lgas']]);
            fputcsv($out, ['Published News',      $metrics['total_news']]);
            fputcsv($out, ['Published Reels',     $metrics['total_reels']]);
            fputcsv($out, ['Total Citizens',      $metrics['total_citizens']]);
            fputcsv($out, []);
            fputcsv($out, ['LGA BREAKDOWN']);
            fputcsv($out, ['LGA Name', 'Registered Citizens', 'Total Interactions']);
            foreach ($lgaRows as $r) fputcsv($out, [$r['name'], $r['citizens'], $r['interactions']]);
            fclose($out);
            exit;
        } else {
            // PDF — open in new tab and trigger browser print dialog immediately.
            // User selects "Save as PDF" from the print dialog.
            header('Content-Type: text/html; charset=utf-8');
            // No Content-Disposition — browser renders it, not downloads it
            $html  = '<!DOCTYPE html><html><head><meta charset="utf-8">';
            $html .= '<title>LagKonnect_Analytics_' . date('Y-m-d') . '</title>';
            $html .= '<style>';
            $html .= 'body{font-family:Arial,sans-serif;margin:40px;color:#111;font-size:13px}';
            $html .= 'h1{color:#068727;margin:0 0 4px}';
            $html .= '.meta{color:#666;font-size:12px;margin-bottom:32px}';
            $html .= 'h2{color:#068727;font-size:13px;font-weight:bold;text-transform:uppercase;';
            $html .= '  letter-spacing:1px;margin:28px 0 12px;border-bottom:2px solid #068727;padding-bottom:4px}';
            $html .= '.kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:8px}';
            $html .= '.kpi{border:1px solid #ddd;border-radius:8px;padding:14px 16px}';
            $html .= '.kpi b{display:block;font-size:22px;color:#068727;margin-bottom:2px}';
            $html .= '.kpi span{font-size:11px;color:#666}';
            $html .= 'table{width:100%;border-collapse:collapse;margin-top:4px}';
            $html .= 'th{background:#068727;color:#fff;padding:8px 10px;text-align:left;font-size:12px}';
            $html .= 'td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px}';
            $html .= 'tr:last-child td{border-bottom:none}';
            $html .= '@media print{body{margin:20px}.kpi-grid{grid-template-columns:repeat(5,1fr)}}';
            $html .= '</style></head><body>';
            $html .= '<h1>LagKonnect — Analytics Report</h1>';
            $html .= '<p class="meta">Generated: ' . date('F j, Y \a\t H:i') . ' WAT</p>';
            $html .= '<h2>Platform Overview</h2>';
            $html .= '<div class="kpi-grid">';
            $html .= '<div class="kpi"><b>' . number_format($metrics['active_users'])   . '</b><span>Active Users (30d)</span></div>';
            $html .= '<div class="kpi"><b>' . number_format($metrics['total_lgas'])     . '</b><span>Total LGAs</span></div>';
            $html .= '<div class="kpi"><b>' . number_format($metrics['total_news'])     . '</b><span>Published News</span></div>';
            $html .= '<div class="kpi"><b>' . number_format($metrics['total_reels'])    . '</b><span>Published Reels</span></div>';
            $html .= '<div class="kpi"><b>' . number_format($metrics['total_citizens']) . '</b><span>Total Citizens</span></div>';
            $html .= '</div>';
            $html .= '<h2>LGA Breakdown</h2>';
            $html .= '<table><tr><th>LGA</th><th>Registered Citizens</th><th>Total Interactions</th></tr>';
            foreach ($lgaRows as $r) {
                $html .= '<tr>';
                $html .= '<td>' . htmlspecialchars($r['name'])          . '</td>';
                $html .= '<td>' . number_format((int) $r['citizens'])     . '</td>';
                $html .= '<td>' . number_format((int) $r['interactions']) . '</td>';
                $html .= '</tr>';
            }
            $html .= '</table>';
            $html .= '</body></html>';
            echo $html;
            exit;
        }
    }

    // ── POST /data/visit ──────────────────────────────────────────

    public function recordPageview(): void {
        $body  = Validator::jsonBody() ?? [];
        $page  = trim($body['page']   ?? '');
        $lgaId = (int) ($body['lgaId']  ?? 0);
        $uid   = (int) ($body['userId'] ?? 0);
        if (!$page) Response::error('VALIDATION_ERROR', 'page is required.', 422);
        $this->db->prepare('INSERT INTO page_views (user_id, page, lga_id, created_at) VALUES (?, ?, ?, NOW())')
                 ->execute([$uid ?: null, $page, $lgaId ?: null]);
        Response::json(['recorded' => true]);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════════════

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

    private function getRangeConfig(string $range): array {
        $now     = new DateTime();
        $fmt     = 'Y-m-d H:i:s';
        $periods = [];

        switch ($range) {
            case 'week':
                for ($i = 6; $i >= 0; $i--) {
                    $day   = (clone $now)->modify("-{$i} days");
                    $periods[] = [$day->format('Y-m-d 00:00:00'), $day->format('Y-m-d 23:59:59'), $day->format('D')];
                }
                break;
            case '3months':
                for ($i = 11; $i >= 0; $i--) {
                    $ws = (clone $now)->modify("-{$i} weeks")->modify('monday this week');
                    $we = (clone $ws)->modify('sunday this week');
                    $periods[] = [$ws->format('Y-m-d 00:00:00'), min($we->format('Y-m-d 23:59:59'), $now->format($fmt)), 'W'.$ws->format('W')];
                }
                break;
            case '6months':
                for ($i = 5; $i >= 0; $i--) {
                    $m = (clone $now)->modify("-{$i} months");
                    $periods[] = [$m->format('Y-m-01 00:00:00'), $m->format('Y-m-t 23:59:59'), $m->format('M')];
                }
                break;
            case 'ytd':
                $y = $now->format('Y'); $cm = (int)$now->format('n');
                for ($m = 1; $m <= $cm; $m++) {
                    $mo = new DateTime("{$y}-{$m}-01");
                    $periods[] = [$mo->format('Y-m-01 00:00:00'), ($m===$cm ? $now->format($fmt) : $mo->format('Y-m-t 23:59:59')), $mo->format('M')];
                }
                break;
            case 'year':
                for ($i = 11; $i >= 0; $i--) {
                    $m = (clone $now)->modify("-{$i} months");
                    $periods[] = [$m->format('Y-m-01 00:00:00'), ($i===0 ? $now->format($fmt) : $m->format('Y-m-t 23:59:59')), $m->format('M y')];
                }
                break;
            case 'all':
                $first = $this->db->query('SELECT MIN(created_at) FROM users WHERE role="citizen"')->fetchColumn() ?: date('Y-01-01');
                $cur   = (new DateTime($first))->modify('first day of january this year');
                while ($cur <= $now) {
                    $qs  = clone $cur; $cur->modify('+3 months');
                    $qe  = (clone $cur)->modify('-1 second');
                    if ($qe > $now) $qe = clone $now;
                    $qn  = ceil((int)$qs->format('n') / 3);
                    $periods[] = [$qs->format($fmt), $qe->format($fmt), 'Q'.$qn.' '.$qs->format('y')];
                }
                break;
            default: // month
                for ($i = 3; $i >= 0; $i--) {
                    $ws = (clone $now)->modify("-{$i} weeks")->modify('monday this week');
                    $we = (clone $ws)->modify('sunday this week');
                    $periods[] = [$ws->format('Y-m-d 00:00:00'), ($i===0 ? $now->format($fmt) : $we->format('Y-m-d 23:59:59')), 'Week '.(4-$i)];
                }
                break;
        }
        return [$periods, null, null, null];
    }

    // ══════════════════════════════════════════════════════════════════════
    //  TRAFFIC PAGE ENDPOINTS (add these to AdminAnalyticsController)
    // ══════════════════════════════════════════════════════════════════════

    // ── GET /admin/traffic/metrics ────────────────────────────────────────
    // ?from=YYYY-MM-DD &to=YYYY-MM-DD &lgaId=N

    public function trafficMetrics(): void {
        $this->requireAdmin();
        [$from, $to, $lgaId] = $this->trafficParams();

        $lgaWhere = $lgaId ? 'AND pv.lga_id = ' . (int)$lgaId : '';

        // Total sessions (page views in range)
        $total = (int) $this->db->query("
            SELECT COUNT(*) FROM page_views pv
            WHERE DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}' {$lgaWhere}
        ")->fetchColumn();

        // Previous period for trend
        $days  = max((new DateTime($from))->diff(new DateTime($to))->days, 1);
        $prevTo   = (new DateTime($from))->modify('-1 day')->format('Y-m-d');
        $prevFrom = (new DateTime($prevTo))->modify("-{$days} days")->format('Y-m-d');

        $prevTotal = (int) $this->db->query("
            SELECT COUNT(*) FROM page_views pv
            WHERE DATE(pv.created_at) BETWEEN '{$prevFrom}' AND '{$prevTo}' {$lgaWhere}
        ")->fetchColumn();

        $trend = $prevTotal > 0
            ? round((($total - $prevTotal) / $prevTotal) * 100, 1) : 0;

        // Unique visitors (distinct users)
        $unique = (int) $this->db->query("
            SELECT COUNT(DISTINCT pv.user_id) FROM page_views pv
            WHERE pv.user_id IS NOT NULL
              AND DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}' {$lgaWhere}
        ")->fetchColumn();

        // Active now — last_seen_at within 5 minutes
        $activeNow = (int) $this->db->query("
            SELECT COUNT(*) FROM users
            WHERE role = 'citizen' AND last_seen_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        ")->fetchColumn();

        // Avg pages per session (total views / distinct user-days)
        $sessions = (int) $this->db->query("
            SELECT COUNT(DISTINCT CONCAT(COALESCE(pv.user_id,'anon'), '_', DATE(pv.created_at)))
            FROM page_views pv
            WHERE DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}' {$lgaWhere}
        ")->fetchColumn();
        $avgPages = $sessions > 0 ? round($total / $sessions, 1) : 0;

        // Return rate — users who visited on more than one day
        $returning = (int) $this->db->query("
            SELECT COUNT(*) FROM (
                SELECT pv.user_id
                FROM page_views pv
                WHERE pv.user_id IS NOT NULL
                  AND DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}' {$lgaWhere}
                GROUP BY pv.user_id
                HAVING COUNT(DISTINCT DATE(pv.created_at)) > 1
            ) r
        ")->fetchColumn();
        $returnRate = $unique > 0 ? round(($returning / $unique) * 100, 1) : 0;

        // Per day / week / month
        $perDay   = $days > 0 ? round($total / max($days, 1)) : 0;
        $perWeek  = round($perDay * 7);
        $perMonth = round($perDay * 30);

        Response::json([
            'totalSessions'  => $total,
            'sessionsTrend'  => $trend,
            'uniqueVisitors' => $unique,
            'activeNow'      => $activeNow,
            'avgPagesPerSession' => $avgPages,
            'returnRate'     => $returnRate,
            'perDay'         => $perDay,
            'perWeek'        => $perWeek,
            'perMonth'       => $perMonth,
            'from'           => $from,
            'to'             => $to,
        ]);
    }

    // ── GET /admin/traffic/daily ──────────────────────────────────────────

    public function trafficDaily(): void {
        $this->requireAdmin();
        [$from, $to, $lgaId] = $this->trafficParams();
        $lgaWhere = $lgaId ? 'AND pv.lga_id = ' . (int)$lgaId : '';

        $stmt = $this->db->query("
            SELECT
                DATE(pv.created_at)              AS day,
                COUNT(*)                          AS page_views,
                COUNT(DISTINCT pv.user_id)        AS unique_visitors
            FROM page_views pv
            WHERE DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}' {$lgaWhere}
            GROUP BY DATE(pv.created_at)
            ORDER BY day ASC
        ");
        $rows = array_map(fn($r) => [
            'date'           => $r['day'],
            'pageViews'      => (int) $r['page_views'],
            'uniqueVisitors' => (int) $r['unique_visitors'],
        ], $stmt->fetchAll());

        Response::json($rows);
    }

    // ── GET /admin/traffic/logs ───────────────────────────────────────────

    public function trafficLogs(): void {
        $this->requireAdmin();
        [$from, $to, $lgaId] = $this->trafficParams();
        $p = Paginator::params($_GET, 10);
        $lgaWhere = $lgaId ? 'AND pv.lga_id = ' . (int)$lgaId : '';

        $total = (int) $this->db->query("
            SELECT COUNT(*) FROM page_views pv
            WHERE DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}' {$lgaWhere}
        ")->fetchColumn();

        $stmt = $this->db->query("
            SELECT
                pv.id,
                pv.created_at,
                pv.page,
                pv.lga_id,
                l.name  AS lga_name,
                l.state AS lga_state,
                u.name  AS user_name,
                u.avatar_url
            FROM page_views pv
            LEFT JOIN users u ON u.id = pv.user_id
            LEFT JOIN lgas  l ON l.id = pv.lga_id
            WHERE DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}' {$lgaWhere}
            ORDER BY pv.created_at DESC
            LIMIT {$p['limit']} OFFSET {$p['offset']}
        ");

        $rows = array_map(fn($r) => [
            'id'        => (int) $r['id'],
            'createdAt' => $r['created_at'],
            'page'      => $r['page'],
            'lgaName'   => $r['lga_name']  ?? '—',
            'lgaState'  => $r['lga_state'] ?? '—',
            'userName'  => $r['user_name'] ?? 'Guest',
            'avatarUrl' => $r['avatar_url'] ?? null,
        ], $stmt->fetchAll());

        Response::paginated($rows, $p['page'], $p['perPage'], $total);
    }

    // ── GET /admin/traffic/top-lgas ───────────────────────────────────────

    public function trafficTopLgas(): void {
        $this->requireAdmin();
        [$from, $to, $lgaId] = $this->trafficParams();

        $stmt = $this->db->query("
            SELECT l.name, COUNT(*) AS sessions
            FROM page_views pv
            JOIN lgas l ON l.id = pv.lga_id
            WHERE DATE(pv.created_at) BETWEEN '{$from}' AND '{$to}'
            GROUP BY pv.lga_id ORDER BY sessions DESC LIMIT 10
        ");
        $rows = array_map(fn($r) => [
            'lgaName'  => $r['name'],
            'sessions' => (int) $r['sessions'],
        ], $stmt->fetchAll());

        Response::json($rows);
    }

    // ── Private: parse traffic query params ───────────────────────────────

    private function trafficParams(): array {
        $to    = trim($_GET['to']    ?? date('Y-m-d'));
        $from  = trim($_GET['from']  ?? date('Y-m-d', strtotime('-6 days')));
        $lgaId = (int) ($_GET['lgaId'] ?? 0);

        // Sanitise dates
        $from  = preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) ? $from : date('Y-m-d', strtotime('-6 days'));
        $to    = preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)   ? $to   : date('Y-m-d');

        return [$from, $to, $lgaId ?: null];
    }

}