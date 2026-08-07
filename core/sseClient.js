/**
 * Lagos Konect — Realtime Client
 * ============================================================
 * Keeps the sidebar badges, chat and notifications up to date.
 *
 * This used to hold a Server-Sent Events stream open for the whole session.
 * That cost one PHP entry process per open tab, continuously: the stream
 * lives for five minutes and sleeps through nearly all of it, but the process
 * is occupied the entire time. The hosting account allows 20 entry processes
 * in total, shared with every ordinary page load and API call, so a handful of
 * simultaneous visitors exhausted them and the whole site failed — login
 * included. cPanel recorded the limit being hit 4507 times in one day.
 *
 * It now asks "anything new?" on an interval and the connection closes
 * straight away, so a tab occupies a process for a few milliseconds per poll
 * rather than permanently. The trade is latency: updates arrive within the
 * poll interval instead of instantly.
 *
 * Polling also authenticates with the normal Bearer token, which removes the
 * short-lived SSE token exchange entirely — that endpoint wrote a row and
 * deleted expired ones on every single connect.
 *
 * The public API is unchanged, so callers need no edits:
 *   sseClient.connect();       // WebLayout.afterMount
 *   sseClient.onMessage(fn);   // Chat page
 *   sseClient.disconnect();    // logout
 */

import { store, showToast } from '../core/store.js?v=20260806d';
import { _fetch } from '../api/_fetch.js?v=20260806d';

/** How often to check for new activity while the tab is visible. */
const POLL_INTERVAL_MS = 12_000;

/**
 * While the tab is hidden we only poll every Nth tick. A backgrounded tab
 * still gets its notifications, just less promptly, and costs proportionally
 * less of the shared process pool.
 */
const HIDDEN_TICK_DIVISOR = 5;

/** Back off to this after repeated failures so a struggling server is not hammered. */
const BACKOFF_INTERVAL_MS = 60_000;

class RealtimeClient {
  constructor() {
    this._timer          = null;
    this._lastMsgId      = null;   // null until the first poll sets the cursors
    this._lastNotifId    = null;
    this._inFlight       = false;  // guards against overlapping polls
    this._tickCount      = 0;
    this._failures       = 0;
    this._onMessage      = null;   // optional DOM handler (Chat page only)
    this._audioContext   = null;
    this._notificationPermission = 'default';
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
   * Start watching for new activity. Safe to call repeatedly — only one
   * poll loop runs at a time.
   */
  async connect() {
    if (this._timer) return;

    const auth = (() => {
      try { return JSON.parse(sessionStorage.getItem('adm_auth')); } catch { return null; }
    })();

    if (!auth?.token) return; // not authenticated

    this._requestNotificationPermission();

    // First call returns the current head positions and no rows, so we report
    // what happens from now on rather than replaying the backlog as "new".
    await this._poll();

    this._timer = setInterval(() => this._tick(), POLL_INTERVAL_MS);
  }

  /** Stop polling. Call on logout. */
  disconnect() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._onMessage   = null;
    this._lastMsgId   = null;
    this._lastNotifId = null;
    this._failures    = 0;
    this._tickCount   = 0;
    console.debug('[realtime] disconnected');
  }

  /**
   * Register a handler to receive new messages directly.
   * Only one handler is supported at a time — the Chat page.
   * @param {function|null} handler  - receives the message object, or null to remove
   */
  onMessage(handler) {
    this._onMessage = handler;
  }

  /** Whether the poll loop is running. */
  get connected() {
    return this._timer !== null;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  _tick() {
    this._tickCount++;

    // A hidden tab polls at a fifth of the rate.
    if (document.hidden && this._tickCount % HIDDEN_TICK_DIVISOR !== 0) return;

    // After repeated failures, only try every Nth tick until one succeeds.
    if (this._failures > 3) {
      const slowEvery = Math.round(BACKOFF_INTERVAL_MS / POLL_INTERVAL_MS);
      if (this._tickCount % slowEvery !== 0) return;
    }

    this._poll();
  }

  async _poll() {
    if (this._inFlight) return;          // previous poll still running
    if (!sessionStorage.getItem('adm_auth')) return;

    this._inFlight = true;
    try {
      const qs = (this._lastMsgId !== null && this._lastNotifId !== null)
        ? `?lastMsgId=${this._lastMsgId}&lastNotifId=${this._lastNotifId}`
        : '';

      // _fetch attaches the Bearer token and already handles ACCOUNT_SUSPENDED
      // by clearing the session, which is why no separate heartbeat is needed.
      const { data, error } = await _fetch('GET', '/events/poll' + qs);

      if (error || !data) {
        this._failures++;
        return;
      }

      this._failures = 0;

      const first = this._lastMsgId === null;
      this._lastMsgId   = data.lastMsgId   ?? this._lastMsgId;
      this._lastNotifId = data.lastNotifId ?? this._lastNotifId;

      if (first) return;  // cursor-priming call carries no rows

      (data.messages      || []).forEach((m) => this._handleMessage(m));
      (data.notifications || []).forEach((n) => this._handleNotification(n));
    } finally {
      this._inFlight = false;
    }
  }

  _handleMessage(msg) {
    const currentUserId = store.currentUser?.id;

    if (msg.userId !== currentUserId) {
      // Only badge it when the user is not already looking at the chat page.
      const onChatPage = window.location.pathname.endsWith('/chat');
      if (!onChatPage) {
        store.unreadChatCount = (store.unreadChatCount || 0) + 1;
        showToast('info', msg.userName ? `${msg.userName}: ${msg.text}` : 'New message');
        this._playNotificationSound();
        this._showBrowserNotification(msg.userName || 'New message', msg.text || '');
      }
    }

    if (this._onMessage) this._onMessage(msg);
  }

  _handleNotification(notif) {
    store.unreadNotificationCount = (store.unreadNotificationCount || 0) + 1;
    showToast('info', notif.title);
    this._playNotificationSound();
    this._showBrowserNotification(notif.title || 'New notification', notif.body || '');
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const sseClient = new RealtimeClient();
