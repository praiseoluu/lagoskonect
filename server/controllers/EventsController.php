<?php

/**
 * KTG Connect — Server-Sent Events Controller
 * ============================================================
 * Endpoint: GET /events/stream
 *
 * Pushes real-time events to the citizen's browser over a
 * persistent HTTP connection. No WebSocket server needed —
 * SSE uses a plain HTTP response that never closes.
 *
 * Events emitted:
 *   new_message      — a new chat message was posted in the user's LGA
 *   new_notification — a new notification was created for this user
 *   reaction         — a reaction was toggled on one of the user's messages
 *   ping             — keepalive every 25 seconds (prevents proxy timeout)
 *
 * How it works:
 *   1. Client opens EventSource('/events/stream') with Bearer token
 *   2. PHP loops every 2 seconds, querying for new data since last check
 *   3. Any new rows are serialised as SSE events and flushed to client
 *   4. Browser EventSource auto-reconnects if the connection drops
 *
 * Apache / XAMPP note:
 *   mod_deflate must be disabled for this endpoint (handled below).
 *   output_buffering must be Off — we set it at runtime.
 *
 * Concurrency note:
 *   Each open tab = one persistent PHP process. This is fine for
 *   development and small deployments. For production scale,
 *   replace the polling loop with a message queue (Redis pub/sub).
 */
class EventsController {
    /** Null while the poll loop is idle — see the sleep in stream(). */
    private ?PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    /**
     * Retired. Superseded by poll().
     *
     * This used to hold the connection open for five minutes, polling every
     * two seconds. Each one occupied a PHP entry process for its whole life,
     * and this account is allowed 20 in total, shared with every ordinary page
     * load and API call. cPanel recorded the ceiling being hit 4507 times in a
     * single day, which took the whole site down, login included.
     *
     * It cannot simply be deleted: browsers that cached the old client before
     * the polling rollout still open this endpoint, and a tab left open never
     * re-fetches the module at all. So it stays, but answers instantly.
     *
     * etry: tells EventSource how long to wait before reconnecting. Five
     * minutes means a stale tab now costs one millisecond-long request every
     * five minutes instead of a permanently held process. Those users stop
     * receiving live updates until they reload, which is a fair trade for
     * keeping the site up for everyone else.
     *
     * Declared static so the route never constructs the controller, and so
     * this path touches neither the database nor the session.
     */
    public static function retiredStream(): void {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');

        if (ob_get_level()) ob_end_clean();

        echo "retry: 300000\n\n";
        echo "event: deprecated\ndata: {\"use\":\"/events/poll\"}\n\n";
        flush();
    }
    // ── GET /events/poll ──────────────────────────────────────────────────
    //
    // Short-lived replacement for the SSE stream.
    //
    // stream() keeps one PHP entry process occupied for its whole five-minute
    // life, so each open browser tab permanently consumes one. This account's
    // entry-process limit is 20, which the site was hitting thousands of times
    // a day and taking everything down with it, login included.
    //
    // This returns whatever is new and exits immediately, so a tab occupies a
    // process for a few milliseconds per interval instead of continuously.
    //
    // Cursors come from the client. On the very first call it has none, so we
    // hand back the current head positions without any rows: the caller wants
    // to know what happens from now on, not to replay history.

    public function poll(): void {
        $auth   = requireAuth();
        $userId = (int) $auth['userId'];
        $lgaId  = (int) ($auth['lgaId'] ?? 0);

        $hasCursor   = isset($_GET['lastMsgId']) && isset($_GET['lastNotifId']);
        $lastMsgId   = (int) ($_GET['lastMsgId']   ?? 0);
        $lastNotifId = (int) ($_GET['lastNotifId'] ?? 0);

        if (!$hasCursor) {
            $m = $this->db->prepare('SELECT COALESCE(MAX(id), 0) FROM lga_chat_messages WHERE lga_id = ?');
            $m->execute([$lgaId]);
            $n = $this->db->prepare('SELECT COALESCE(MAX(id), 0) FROM notifications WHERE user_id = ?');
            $n->execute([$userId]);

            Response::json([
                'messages'      => [],
                'notifications' => [],
                'lastMsgId'     => (int) $m->fetchColumn(),
                'lastNotifId'   => (int) $n->fetchColumn(),
            ]);
            return;
        }

        // ── New chat messages ────────────────────────────────────────────
        $msgStmt = $this->db->prepare('
            SELECT * FROM lga_chat_messages
            WHERE lga_id = ? AND id > ?
            ORDER BY id ASC
            LIMIT 20
        ');
        $msgStmt->execute([$lgaId, $lastMsgId]);

        $messages = [];
        foreach ($msgStmt->fetchAll() as $msg) {
            $reactions = json_decode($msg['reactions'] ?? '{}', true) ?: [];
            $replyTo   = $msg['reply_to'] ? json_decode($msg['reply_to'], true) : null;

            $messages[] = [
                'id'        => (int) $msg['id'],
                'lgaId'     => (int) $msg['lga_id'],
                'userId'    => (int) $msg['user_id'],
                'userName'  => $msg['user_name'],
                'avatarUrl' => $msg['avatar_url'],
                'text'      => $msg['text'],
                'mediaUrl'  => $msg['media_url'],
                'fileUrl'   => $msg['file_url'],
                'fileName'  => $msg['file_name'],
                'fileSize'  => $msg['file_size'],
                'reactions' => empty($reactions) ? (object) [] : $reactions,
                'replyTo'   => $replyTo,
                'createdAt' => $msg['created_at'],
            ];
            $lastMsgId = (int) $msg['id'];
        }

        // ── New notifications ────────────────────────────────────────────
        $notifStmt = $this->db->prepare('
            SELECT * FROM notifications
            WHERE user_id = ? AND id > ?
            ORDER BY id ASC
            LIMIT 10
        ');
        $notifStmt->execute([$userId, $lastNotifId]);

        $notifications = [];
        foreach ($notifStmt->fetchAll() as $notif) {
            $notifications[] = [
                'id'             => (int) $notif['id'],
                'userId'         => (int) $notif['user_id'],
                'category'       => $notif['category'],
                'priority'       => $notif['priority'],
                'title'          => $notif['title'],
                'body'           => $notif['body'],
                'actorName'      => $notif['actor_name'],
                'actorAvatarUrl' => $notif['actor_avatar_url'],
                'linkTo'         => $notif['link_to'],
                'isRead'         => (bool) $notif['is_read'],
                'createdAt'      => $notif['created_at'],
            ];
            $lastNotifId = (int) $notif['id'];
        }

        Response::json([
            'messages'      => $messages,
            'notifications' => $notifications,
            'lastMsgId'     => $lastMsgId,
            'lastNotifId'   => $lastNotifId,
        ]);
    }

    // ── SSE wire format ───────────────────────────────────────────────────

    /**
     * Write a single SSE event to the output buffer and flush immediately.
     * Format:
     *   event: <type>\n
     *   data: <json>\n
     *   \n
     */
    private function emit(string $event, array $data): void {
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n";
        flush();
    }
}
