<?php

/**
 * Lagos Konnect - Notification Service
 * ============================================================
 * Central helper for creating in-app notifications.
 * Every insertion goes through here so preference checks are
 * enforced consistently before anything hits the DB.
 *
 * Usage:
 *   NotificationService::send($db, $userId, [
 *       'category' => 'Community',
 *       'priority' => 'normal',
 *       'title'    => 'Someone liked your reel',
 *       'body'     => '"My caption..."',
 *       'actorName'      => $actorName,
 *       'actorAvatarUrl' => $actorAvatarUrl,
 *       'linkTo'         => '/reels/reel_abc123',
 *   ], 'notif_reel_likes');
 *
 *   NotificationService::broadcastToLgas($db, $lgaIds, $targetAll, $data, 'notif_official');
 */
class NotificationService
{
    /**
     * Send a notification to a single user.
     * If $prefKey is given, the user's preference is checked first —
     * if they have opted out the notification is silently dropped.
     *
     * @param PDO         $db
     * @param int         $userId
     * @param array       $data    { category, priority?, title, body, actorName?, actorAvatarUrl?, linkTo? }
     * @param string|null $prefKey Column name in users table (e.g. 'notif_reel_likes')
     */
    public static function send(PDO $db, int $userId, array $data, ?string $prefKey = null): void
    {
        static $allowedPrefKeys = [
            'notif_official', 'notif_community', 'notif_lga_alerts',
            'notif_new_login', 'notif_reel_likes', 'notif_reel_comments',
            'notif_breaking_news',
        ];

        if ($prefKey !== null) {
            if (!in_array($prefKey, $allowedPrefKeys, true)) {
                return; // silently skip notifications with invalid preference key
            }
            $stmt = $db->prepare("SELECT `{$prefKey}` FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$userId]);
            $allowed = $stmt->fetchColumn();
            if (!$allowed) return;
        }

        $db->prepare('
            INSERT INTO notifications
                (user_id, category, priority, title, body,
                 actor_name, actor_avatar_url, link_to,
                 template_key, template_vars, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ')->execute([
            $userId,
            $data['category'],
            $data['priority'] ?? 'normal',
            $data['title'],
            $data['body'],
            $data['actorName']      ?? null,
            $data['actorAvatarUrl'] ?? null,
            $data['linkTo']         ?? null,
            $data['templateKey']    ?? null,
            isset($data['templateVars']) ? json_encode($data['templateVars']) : null,
        ]);
    }

    /**
     * Broadcast a notification to all active citizens in the given LGAs,
     * filtered by their individual preference setting.
     *
     * Uses a single bulk INSERT for efficiency.
     *
     * @param PDO    $db
     * @param array  $lgaIds     Array of LGA IDs to target (ignored when $targetAll is true)
     * @param bool   $targetAll  If true, targets every active citizen regardless of LGA
     * @param array  $data       Same shape as send()
     * @param string $prefKey    Preference column to filter by (required for broadcasts)
     */
    public static function broadcastToLgas(PDO $db, array $lgaIds, bool $targetAll, array $data, string $prefKey): void
    {
        static $allowedPrefKeys = [
            'notif_official', 'notif_community', 'notif_lga_alerts',
            'notif_new_login', 'notif_reel_likes', 'notif_reel_comments',
            'notif_breaking_news',
        ];

        if (!in_array($prefKey, $allowedPrefKeys, true)) {
            return; // silently skip notifications with invalid preference key
        }

        if ($targetAll) {
            $stmt = $db->prepare(
                "SELECT id FROM users WHERE role = 'citizen' AND status = 'active' AND `{$prefKey}` = 1"
            );
            $stmt->execute();
        } elseif (!empty($lgaIds)) {
            $ph   = implode(',', array_fill(0, count($lgaIds), '?'));
            $stmt = $db->prepare(
                "SELECT id FROM users WHERE role = 'citizen' AND status = 'active' AND lga_id IN ({$ph}) AND `{$prefKey}` = 1"
            );
            $stmt->execute($lgaIds);
        } else {
            return;
        }

        $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if (empty($userIds)) return;

        $rowPh  = implode(',', array_fill(0, count($userIds), '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'));
        $templateVarsJson = isset($data['templateVars']) ? json_encode($data['templateVars']) : null;
        $params = [];
        foreach ($userIds as $uid) {
            array_push(
                $params,
                (int) $uid,
                $data['category'],
                $data['priority'] ?? 'normal',
                $data['title'],
                $data['body'],
                $data['actorName']      ?? null,
                $data['actorAvatarUrl'] ?? null,
                $data['linkTo']         ?? null,
                $data['templateKey']    ?? null,
                $templateVarsJson
            );
        }

        $db->prepare(
            "INSERT INTO notifications
                 (user_id, category, priority, title, body,
                  actor_name, actor_avatar_url, link_to,
                  template_key, template_vars, created_at)
             VALUES {$rowPh}"
        )->execute($params);
    }
}
