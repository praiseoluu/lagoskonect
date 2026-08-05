/**
 * Lagos Konect — SSE Client
 * ============================================================
 * Manages a single persistent Server-Sent Events connection
 * for the entire app session.
 *
 * Opens one EventSource to GET /events/stream (authenticated via
 * token in the URL since EventSource doesn't support custom headers).
 *
 * Events handled:
 *   connected        — stream opened, confirms userId/lgaId
 *   new_message      — new chat message in the user's LGA
 *   new_notification — a notification was created for this user
 *   ping             — keepalive (ignored, browser handles reconnect)
 *   session_revoked  — account suspended; immediately clears session & redirects
 *
 * Usage:
 *   import { sseClient } from './sseClient.js';
 *   sseClient.connect();   // call once in WebLayout.afterMount
 *   sseClient.disconnect(); // call on logout
 *
 * The module writes directly to the store so all components
 * (Sidebar badge, Chat page, Notifications page) react automatically.
 *
 * Chat page integration:
 *   Chat.js registers a message handler via sseClient.onMessage()
 *   so new messages appear instantly without polling.
 *   Chat.js removes the handler on unmount so only the chat page
 *   appends messages to the DOM — other pages just update the badge.
 */

import { store, showToast } from '../core/store.js';
import { BASE_URL } from '../api/_fetch.js';
import { api }    from '../api/client.js';

class SSEClient {
  constructor() {
    this._es             = null;   // EventSource instance
    this._retryDelay     = 3000;   // ms before reconnect attempt
    this._retryTimer     = null;
    this._heartbeatTimer = null;   // periodic session-validity check
    this._onMessage      = null;   // optional DOM handler (Chat page only)
    this._audioContext   = null;   // Web Audio API context for notification sound
    this._notificationPermission = 'default';
    this._consecutiveFailures = 0; // track repeated stream failures to avoid hammering a down server
  }

  _ensureAudio() {
    if (!this._audioContext) {
      try {
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return this._audioContext;
  }

  _playNotificationSound() {
    const ctx = this._ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this._playBeep(ctx));
    } else {
      this._playBeep(ctx);
    }
  }

  _playBeep(ctx) {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  async _requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') this._notificationPermission = 'granted';
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      this._notificationPermission = result;
    }
  }

  _showBrowserNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, {
      body: body,
      icon: '/favicon.png',
      tag: 'lk-notification',
      requireInteraction: false,
    });
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Open the SSE stream. Safe to call multiple times — only one
   * connection is kept open at a time.
   */
  async connect() {
    if (this._es) return; // already connected

    const auth = (() => {
      try { return JSON.parse(sessionStorage.getItem('adm_auth')); } catch { return null; }
    })();

    if (!auth?.token) return; // not authenticated

    // Exchange the long-lived JWT for a short-lived SSE token so the
    // main JWT is never exposed in URLs or server access logs.
    const { data, error } = await api.auth.getSseToken();
    if (error || !data?.token) {
      console.warn('[SSE] could not obtain exchange token — retrying in 5s', error?.message);
      this._retryTimer = setTimeout(() => this.connect(), 5000);
      return;
    }

    const url = `${BASE_URL}/events/stream?token=${encodeURIComponent(data.token)}`;

    this._es = new EventSource(url);

    // Request browser notification permission (for chat messages + push sounds)
    this._requestNotificationPermission();

    this._es.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      console.debug('[SSE] connected', data);
      this._retryDelay = 3000;       // reset backoff on success
      this._consecutiveFailures = 0; // clear failure count — server is healthy
    });

    this._es.addEventListener('new_message', (e) => {
      const msg = JSON.parse(e.data);
      const currentUserId = store.currentUser?.id;

      // Always update the sidebar unread badge (unless it's our own message)
      if (msg.userId !== currentUserId) {
        // Only increment if user is NOT on the chat page right now
        const onChatPage = window.location.pathname === '/chat';
        if (!onChatPage) {
          store.unreadChatCount = (store.unreadChatCount || 0) + 1;
          // Show a browser notification with sound so the user knows
          // someone sent them a message
          showToast('info', msg.senderName ? `${msg.senderName}: ${msg.text}` : 'New message');
          this._playNotificationSound();
          this._showBrowserNotification(
              msg.senderName || 'New message',
              msg.text || ''
          );
        }
      }

      // If a Chat page handler is registered, forward the message to it
      if (this._onMessage) {
        this._onMessage(msg);
      }
    });

    this._es.addEventListener('new_notification', (e) => {
      const notif = JSON.parse(e.data);

      // Increment sidebar badge
      store.unreadNotificationCount = (store.unreadNotificationCount || 0) + 1;

      // Show a toast so the user knows something happened
      // (even if they're not on the notifications page)
      showToast('info', notif.title);
      this._playNotificationSound();
      this._showBrowserNotification(
          notif.title || 'New notification',
          notif.body || ''
      );
    });

    this._es.addEventListener('ping', () => {
      // Keepalive — nothing to do
    });

    // Immediate suspension / session revocation pushed by the server.
    // The admin suspends a user → the backend broadcasts this event to that
    // user's SSE stream → the client immediately clears the session without
    // waiting for the next API call.
    this._es.addEventListener('session_revoked', (e) => {
      let reason = 'suspended';
      try { reason = JSON.parse(e.data)?.reason || reason; } catch { /* noop */ }
      console.warn('[SSE] session_revoked', reason);
      showToast('error', 'Your account has been suspended. Please contact support.');
      sessionStorage.removeItem('adm_auth');
      setTimeout(() => window.location.replace('/'), 2500);
    });

    this._es.onerror = () => {
      // EventSource auto-reconnects, but we also do our own backoff
      // in case the token expired or the server restarted.
      this._es?.close();
      this._es = null;

      this._consecutiveFailures++;

      // Give up retrying after 8 consecutive failures (~4 min of backoff).
      // The session heartbeat below will resume connection attempts every 60 s
      // once the server recovers, without hammering it during an outage.
      if (this._consecutiveFailures > 8) {
        console.warn('[SSE] too many consecutive failures — pausing retries; heartbeat will resume');
        return;
      }

      this._retryTimer = setTimeout(() => {
        this._retryDelay = Math.min(this._retryDelay * 2, 30000); // cap at 30s
        this.connect();
      }, this._retryDelay);
    };

    // ── Session heartbeat ─────────────────────────────────────────────────
    // Poll every 60 s to detect account suspension for users who are idle.
    // Any authenticated _fetch() call already checks for ACCOUNT_SUSPENDED;
    // this heartbeat ensures suspended users are force-logged-out within 60 s
    // even if they make no other requests.
    //
    // IMPORTANT — do NOT use getSseToken() here. That endpoint writes to the
    // database on every call (INSERT sse_token + DELETE expired rows), so
    // calling it every 60 s per user causes heavy unnecessary DB writes and
    // PHP process churn that can exhaust the server's resource limit.
    // getProfile() is a simple SELECT with no side-effects.
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(async () => {
      if (!sessionStorage.getItem('adm_auth')) return;

      // If the SSE stream is open, suspension will arrive via the
      // session_revoked event — no need to poll at all.
      if (this._es?.readyState === EventSource.OPEN) return;

      // SSE is down: use a cheap read-only call so _fetch.js can detect
      // ACCOUNT_SUSPENDED and redirect, without touching the DB.
      await api.users.getProfile().catch(() => {});

      // Also attempt to reconnect if we previously gave up after too many
      // failures — server may have recovered.
      if (this._consecutiveFailures > 8 && !this._es && !this._retryTimer) {
        console.debug('[SSE] heartbeat triggering reconnect attempt after pause');
        this._consecutiveFailures = 0;
        this._retryDelay = 3000;
        this.connect();
      }
    }, 60_000);
  }

  /**
   * Close the SSE connection. Call on logout.
   */
  disconnect() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._es) {
      this._es.close();
      this._es = null;
    }
    this._onMessage = null;
    this._consecutiveFailures = 0;
    this._retryDelay = 3000;
    console.debug('[SSE] disconnected');
  }

  /**
   * Register a handler to receive new_message events directly.
   * Only one handler is supported at a time — the Chat page.
   * @param {function|null} handler  - receives the message object, or null to remove
   */
  onMessage(handler) {
    this._onMessage = handler;
  }

  /**
   * Whether the SSE connection is currently open.
   * @returns {boolean}
   */
  get connected() {
    return this._es?.readyState === EventSource.OPEN;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const sseClient = new SSEClient();
