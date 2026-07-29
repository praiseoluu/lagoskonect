<?php

class NotificationController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /notifications ────────────────────────────────────────────────

    public function getForUser(): void {
        $auth   = requireRole('citizen');
        $userId = $auth['userId'];
        $p      = Paginator::params($_GET, 20);

        $countStmt = $this->db->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ?');
        $countStmt->execute([$userId]);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare('
            SELECT * FROM notifications WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$userId, $p['limit'], $p['offset']]);

        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── PATCH /notifications/:id/read ────────────────────────────────────

    public function markRead(int $id): void {
        $auth = requireRole('citizen');

        $stmt = $this->db->prepare('SELECT id, user_id FROM notifications WHERE id = ?');
        $stmt->execute([$id]);
        $note = $stmt->fetch();

        if (!$note) {
            Response::error('NOT_FOUND', 'Notification not found.', 404);
        }

        // Only allow marking own notifications
        if ((int) $note['user_id'] !== $auth['userId']) {
            Response::error('FORBIDDEN', 'Access denied.', 403);
        }

        $this->db->prepare('UPDATE notifications SET is_read = 1 WHERE id = ?')
                 ->execute([$id]);

        Response::json(['updated' => true]);
    }

    // ── PATCH /notifications/read-all ────────────────────────────────────

    public function markAllRead(): void {
        $auth = requireRole('citizen');

        $this->db->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
                 ->execute([$auth['userId']]);

        Response::json(['updated' => true]);
    }

    // ── GET /notifications/unread-count ──────────────────────────────────

    public function getUnreadCount(): void {
        $auth = requireRole('citizen');

        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0
        ');
        $stmt->execute([$auth['userId']]);
        $count = (int) $stmt->fetchColumn();

        Response::json(['count' => $count]);
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private function format(array $n): array {
        return [
            'id'             => (int) $n['id'],
            'userId'         => (int) $n['user_id'],
            'category'       => $n['category'],
            'priority'       => $n['priority'],
            'title'          => $n['title'],
            'body'           => $n['body'],
            'actorName'      => $n['actor_name'],
            'actorAvatarUrl' => $n['actor_avatar_url'],
            'linkTo'         => $n['link_to'],
            'templateKey'    => $n['template_key']  ?? null,
            'templateVars'   => isset($n['template_vars']) ? json_decode($n['template_vars'], true) : null,
            'isRead'         => (bool) $n['is_read'],
            'createdAt'      => $n['created_at'],
        ];
    }
}
