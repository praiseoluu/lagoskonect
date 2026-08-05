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
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    public function stream(): void {
        // ── Process-lifetime guardrails ───────────────────────────────────
        // Each SSE connection holds one PHP process on the server. Without
        // these two settings, processes can accumulate until the host's
        // concurrent-process limit is exhausted, causing 508 errors for ALL
        // endpoints (including login).
        //
        // ignore_user_abort(false): kill this process the moment the browser
        //   closes the tab / EventSource reconnects. The PHP default is 'off',
        //   but many shared-hosting php.ini files override it to 'on', which
        //   would keep orphaned processes running long after clients leave.
        //
        // set_time_limit(300): hard-cap each connection at 5 minutes.
        //   The browser's EventSource will auto-reconnect immediately after
        //   the server closes the stream, so users won't notice the restart.
        //   This prevents any single connection from holding a process forever
        //   even if ignore_user_abort is somehow overridden at the host level.
        ignore_user_abort(false);
        set_time_limit(300); // 5-minute hard cap; EventSource auto-reconnects

        // ── SSE headers ───────────────────────────────────────────────────
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');   // disable Nginx buffering
        header('Connection: keep-alive');

        // Disable output buffering at every level
        if (ob_get_level()) ob_end_clean();
        ini_set('output_buffering', 'off');
        ini_set('zlib.output_compression', 'off');

        // ── Validate short-lived SSE token ────────────────────────────────
        $token = trim($_GET['token'] ?? '');
        if (!$token) {
            $this->emit('error', ['code' => 'UNAUTHENTICATED', 'message' => 'Missing token.']);
            return;
        }

        $tokenHash = hash('sha256', $token);

        $sseStmt = $this->db->prepare(
            "SELECT user_id, expires_at, used FROM sse_tokens WHERE token_hash = ? LIMIT 1"
        );
        $sseStmt->execute([$tokenHash]);
        $sseRow = $sseStmt->fetch();

        if (!$sseRow || $sseRow['used'] || strtotime($sseRow['expires_at']) < time()) {
            $this->emit('error', ['code' => 'UNAUTHENTICATED', 'message' => 'Invalid or expired SSE token.']);
            return;
        }

        // Mark token as used (one-time use)
        $this->db->prepare("UPDATE sse_tokens SET used = 1 WHERE token_hash = ?")
                 ->execute([$tokenHash]);

        // Load user for lga_id
        $userStmt = $this->db->prepare('SELECT id, lga_id FROM users WHERE id = ? LIMIT 1');
        $userStmt->execute([$sseRow['user_id']]);
        $sseUser = $userStmt->fetch();

        if (!$sseUser) {
            $this->emit('error', ['code' => 'UNAUTHENTICATED', 'message' => 'User not found.']);
            return;
        }

        $userId = (int) $sseUser['id'];
        $lgaId  = (int) $sseUser['lga_id'];

        // ── Starting cursors ─────────────────────────────────────────────
        // We track the newest ID we've seen for each data source so we only
        // send truly new rows on each poll, never duplicates.

        // Last chat message ID in this LGA
        $stmt = $this->db->prepare('
            SELECT COALESCE(MAX(id), 0) FROM lga_chat_messages WHERE lga_id = ?
        ');
        $stmt->execute([$lgaId]);
        $lastMsgId = (int) $stmt->fetchColumn();

        // Last notification ID for this user
        $stmt = $this->db->prepare('
            SELECT COALESCE(MAX(id), 0) FROM notifications WHERE user_id = ?
        ');
        $stmt->execute([$userId]);
        $lastNotifId = (int) $stmt->fetchColumn();

        // ── Send initial connection event ─────────────────────────────────
        $this->emit('connected', [
            'userId'      => $userId,
            'lgaId'       => $lgaId,
            'lastMsgId'   => $lastMsgId,
            'lastNotifId' => $lastNotifId,
        ]);

        // ── Poll loop ─────────────────────────────────────────────────────
        // Wall-clock deadline: hrtime(true) returns nanoseconds and is never
        // affected by sleep() or system-call exclusions, unlike set_time_limit().
        // We break out of the loop after MAX_LIFETIME seconds so the PHP process
        // is always recycled; EventSource on the browser auto-reconnects within
        // a few seconds and the user sees no interruption.
        //
        // Client-disconnect detection relies on the periodic flush inside
        // $this->emit(). PHP only observes an aborted connection when it
        // attempts to write to the socket — the keepalive ping (every ~26s)
        // guarantees that detection window. connection_aborted() after each
        // sleep() is an additional fast-path check but is only reliable on
        // configurations where ignore_user_abort(false) causes an immediate
        // SIGPIPE, which is host-dependent.
        $maxLifetime = 300; // seconds — 5 minutes hard cap
        $deadline = hrtime(true) + $maxLifetime * 1_000_000_000;
        $pingCounter = 0;

        while (hrtime(true) < $deadline) {
            if (connection_aborted()) break;

            sleep(2); // poll every 2 seconds

            // Re-check wall clock and disconnect after sleep so we don't start
            // a fresh DB round-trip when we're already past the deadline.
            if (hrtime(true) >= $deadline) break;
            if (connection_aborted()) break;

            // ── New chat messages ──────────────────────────────────────────
            $msgStmt = $this->db->prepare('
                SELECT * FROM lga_chat_messages
                WHERE lga_id = ? AND id > ?
                ORDER BY id ASC
                LIMIT 20
            ');
            $msgStmt->execute([$lgaId, $lastMsgId]);
            $newMessages = $msgStmt->fetchAll();

            foreach ($newMessages as $msg) {
                $reactions = json_decode($msg['reactions'] ?? '{}', true) ?: [];
                $replyTo   = $msg['reply_to'] ? json_decode($msg['reply_to'], true) : null;

                $this->emit('new_message', [
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
                    'reactions' => empty($reactions) ? (object)[] : $reactions,
                    'replyTo'   => $replyTo,
                    'createdAt' => $msg['created_at'],
                ]);

                $lastMsgId = (int) $msg['id'];
            }

            // ── New notifications ──────────────────────────────────────────
            $notifStmt = $this->db->prepare('
                SELECT * FROM notifications
                WHERE user_id = ? AND id > ?
                ORDER BY id ASC
                LIMIT 10
            ');
            $notifStmt->execute([$userId, $lastNotifId]);
            $newNotifs = $notifStmt->fetchAll();

            foreach ($newNotifs as $notif) {
                $this->emit('new_notification', [
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
                ]);

                $lastNotifId = (int) $notif['id'];
            }

            // ── Keepalive ping every ~26s (13 × 2s ticks) ─────────────────
            // This flush is also what allows PHP to detect a disconnected
            // client on the next loop iteration via connection_aborted().
            $pingCounter++;
            if ($pingCounter >= 13) {
                $this->emit('ping', ['ts' => time()]);
                $pingCounter = 0;
            }
        }
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
