<?php

/**
 * KTG Connect — Moderation Controller
 * ============================================================
 * Handles admin review of flagged citizen reels.
 *
 * Endpoints:
 *   GET   /admin/moderation          — paginated list of flagged reels
 *   GET   /admin/moderation/metrics  — counts for stat cards
 *   PATCH /admin/moderation/:reelId/dismiss  — dismiss all reports on a reel
 *   PATCH /admin/moderation/:reelId/takedown — pause reel + resolve reports
 */
class ModerationController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/moderation ─────────────────────────────────────────────
    // Returns reels that have at least one pending report.
    // Sorted by report count DESC.

    public function list(): void {
        $admin = $this->requireAdmin();
        $p     = Paginator::params($_GET, 12);
        $tab   = trim($_GET['tab'] ?? 'pending');

        // Map tab to status values with allowlist
        $statusMap = [
            'pending'   => ['pending'],
            'resolved'  => ['resolved'],
            'dismissed' => ['dismissed'],
            'all'       => ['pending', 'resolved', 'dismissed'],
        ];
        $statuses     = $statusMap[$tab] ?? $statusMap['pending'];
        $placeholders = implode(',', array_fill(0, count($statuses), '?'));

        $countStmt = $this->db->prepare(
            "SELECT COUNT(DISTINCT reel_id) FROM reel_reports WHERE status IN ({$placeholders})"
        );
        $countStmt->execute($statuses);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT
                r.reel_id,
                r.caption,
                r.video_url,
                r.thumbnail_url,
                r.duration,
                r.author_name,
                r.author_avatar_url,
                r.lga_name,
                r.status       AS reel_status,
                r.published_at,
                r.created_at,
                COUNT(rp.id)   AS report_count,
                GROUP_CONCAT(DISTINCT rp.reason ORDER BY rp.created_at SEPARATOR ', ')
                               AS report_reasons,
                MAX(rp.created_at) AS latest_report_at,
                MAX(CASE WHEN rp.status = 'pending' THEN 'pending'
                         WHEN rp.status = 'resolved' THEN 'resolved'
                         ELSE 'dismissed' END) AS report_status
            FROM reel_reports rp
            JOIN reels r ON r.reel_id = rp.reel_id
            WHERE rp.status IN ({$placeholders})
            GROUP BY r.reel_id
            ORDER BY report_count DESC, latest_report_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([...$statuses, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /admin/moderation/metrics ─────────────────────────────────────

    public function metrics(): void {
        $this->requireAdmin();

        $pending = (int) $this->db->query(
            'SELECT COUNT(DISTINCT reel_id) FROM reel_reports WHERE status = "pending"'
        )->fetchColumn();

        $resolvedToday = (int) $this->db->query(
            'SELECT COUNT(*) FROM reel_reports WHERE status IN ("resolved","dismissed") AND DATE(resolved_at) = CURDATE()'
        )->fetchColumn();

        $takenDown = (int) $this->db->query(
            'SELECT COUNT(*) FROM reels WHERE status = "paused"'
        )->fetchColumn();

        $totalReports = (int) $this->db->query(
            'SELECT COUNT(*) FROM reel_reports'
        )->fetchColumn();

        Response::json([
            'pendingCount'   => $pending,
            'resolvedToday'  => $resolvedToday,
            'takenDownCount' => $takenDown,
            'totalReports'   => $totalReports,
        ]);
    }

    // ── PATCH /admin/moderation/:reelId/dismiss ───────────────────────────
    // Reports dismissed — reel stays live.

    public function dismiss(string $reelId): void {
        $admin = $this->requireAdmin();
        $body  = Validator::jsonBody() ?? [];
        $note  = trim($body['note'] ?? '');

        // Verify reel exists
        $stmt = $this->db->prepare('SELECT reel_id, author_id, lga_id FROM reels WHERE reel_id = ?');
        $stmt->execute([$reelId]);
        $reel = $stmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        // Mark all pending reports as dismissed
        $this->db->prepare('
            UPDATE reel_reports
            SET status = "dismissed",
                admin_note = ?,
                resolved_at = NOW(),
                resolved_by = ?
            WHERE reel_id = ? AND status = "pending"
        ')->execute([$note ?: null, $admin['adminId'] ?? null, $reelId]);

        // Stub: notify citizen (ready for Termii/Resend)
        $this->stubNotify($reel, 'dismissed', $note);

        Response::json(['reelId' => $reelId, 'action' => 'dismissed']);
    }

    // ── PATCH /admin/moderation/:reelId/takedown ──────────────────────────
    // Reel is paused (hidden from citizens) + reports resolved.

    public function takedown(string $reelId): void {
        $admin = $this->requireAdmin();
        $body  = Validator::jsonBody() ?? [];
        $note  = trim($body['note'] ?? '');

        $stmt = $this->db->prepare('SELECT reel_id, author_id, lga_id, status FROM reels WHERE reel_id = ?');
        $stmt->execute([$reelId]);
        $reel = $stmt->fetch();
        if (!$reel) Response::error('NOT_FOUND', 'Reel not found.', 404);

        // Pause the reel
        $this->db->prepare('UPDATE reels SET status = "paused", updated_at = NOW() WHERE reel_id = ?')
                 ->execute([$reelId]);

        // Mark all pending reports as resolved
        $this->db->prepare('
            UPDATE reel_reports
            SET status = "resolved",
                admin_note = ?,
                resolved_at = NOW(),
                resolved_by = ?
            WHERE reel_id = ? AND status = "pending"
        ')->execute([$note ?: null, $admin['adminId'] ?? null, $reelId]);

        // Stub: notify citizen
        $this->stubNotify($reel, 'takedown', $note);

        Response::json(['reelId' => $reelId, 'action' => 'takedown']);
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
        try {
            $payload = JWT::decode($token, JWT_SECRET);
        } catch (RuntimeException) {
            Response::error('UNAUTHENTICATED', 'Invalid or expired token.', 401);
        }
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

    /**
     * Stub notification — logs intent, ready for Termii/Resend wiring.
     */
    private function stubNotify(array $reel, string $action, string $note): void {
        // TODO: wire to Termii SMS / Resend email
        // $authorId = $reel['author_id'];
        // $message  = $action === 'takedown'
        //     ? "Your reel has been taken down: {$note}"
        //     : "A report against your reel has been reviewed and dismissed.";
        // NotificationService::send($authorId, $message);
    }

    private function format(array $r): array {
        return [
            'reelId'         => $r['reel_id'],
            'caption'        => $r['caption']          ?? '',
            'videoUrl'       => $r['video_url'],
            'thumbnailUrl'   => $r['thumbnail_url'],
            'duration'       => (int) ($r['duration']  ?? 0),
            'authorName'     => $r['author_name']       ?? 'Unknown',
            'authorAvatar'   => $r['author_avatar_url'] ?? null,
            'lgaName'        => $r['lga_name']          ?? '—',
            'reelStatus'     => $r['reel_status'],
            'reportStatus'   => $r['report_status'] ?? 'pending',
            'reportCount'    => (int) ($r['report_count'] ?? 0),
            'reportReasons'  => $r['report_reasons']   ?? '',
            'latestReportAt' => $r['latest_report_at'],
            'publishedAt'    => $r['published_at'],
        ];
    }
}