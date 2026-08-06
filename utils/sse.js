/**
 * LagKonnect — SSE Client
 * ============================================================
 * Wraps EventSource for the /events/stream endpoint.
 *
 * Security: exchanges the main JWT for a short-lived SSE token
 * via GET /auth/sse-token before opening the EventSource
 * connection. This avoids exposing the long-lived main JWT in
 * URLs and server access logs.
 *
 * Usage:
 *   import { startSse, stopSse } from '../utils/sse.js?v=20260806a';
 *   startSse({ onNotification: (count) => { ... } });
 *   stopSse();
 */

import { BASE_URL } from '../api/_fetch.js?v=20260806a';
import { api } from '../api/client.js?v=20260806a';

let _source = null;
let _retryTimeout = null;
const RETRY_DELAY_MS = 5000;

/**
 * Start the SSE connection.
 * @param {object} handlers
 * @param {function} [handlers.onNotification]   called with unread notification count (number)
 * @param {function} [handlers.onError]          called on connection error
 */
export async function startSse(handlers = {}) {
  stopSse(); // clean up any existing connection

  // Exchange main JWT for a short-lived SSE token
  const { data, error } = await api.auth.getSseToken();
  if (error || !data?.token) {
    console.warn('SSE: could not obtain exchange token', error?.message);
    // Schedule a retry
    _retryTimeout = setTimeout(() => startSse(handlers), RETRY_DELAY_MS);
    return;
  }

  const url = `${BASE_URL}/events/stream?token=${encodeURIComponent(data.token)}`;

  try {
    _source = new EventSource(url);
  } catch (e) {
    console.warn('SSE: EventSource creation failed', e);
    return;
  }

  _source.addEventListener('notification', (e) => {
    try {
      const payload = JSON.parse(e.data);
      handlers.onNotification?.(payload.unreadCount ?? 0);
    } catch {
      // ignore malformed events
    }
  });

  _source.onerror = (e) => {
    handlers.onError?.(e);
    // EventSource reconnects automatically; no manual retry needed here
  };
}

/**
 * Stop the SSE connection and cancel any pending retries.
 */
export function stopSse() {
  if (_retryTimeout) {
    clearTimeout(_retryTimeout);
    _retryTimeout = null;
  }
  if (_source) {
    _source.close();
    _source = null;
  }
}
