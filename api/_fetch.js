/**
 * LagKonnect — HTTP fetch helper
 * ============================================================
 * Shared by all citizen API modules.
 * Wraps fetch() and always returns { data } or { error }
 * — same contract as the old mock layer.
 */

import { showToast } from '../core/store.js?v=20260807a';

// Derive the API base from the current origin instead of hardcoding a single
// domain. This means the frontend always talks to the backend it was actually
// served from — no more "seeded admins on server A but the UI is calling
// server B" mismatches when testing on a different domain/subdomain.
export const BASE_URL = `${window.location.origin}/server/api/v1`;

function _token() {
  try {
    const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
    return auth?.token || null;
  } catch {
    return null;
  }
}

// Debounce flags — prevent stacking identical toasts when multiple requests
// fire at once on a single page load.
let _maintenanceToastPending = false;
let _suspensionHandled = false;

export async function _fetch(method, path, body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = _token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const json = await res.json();

    if (json?.error?.code === 'MAINTENANCE') {
      const wasLoggedIn = !!_token();
      if (wasLoggedIn && !window.location.pathname.startsWith('/admin')) {
        // Wipe session and show the maintenance screen
        sessionStorage.removeItem('adm_auth');
        window.location.replace('/?maintenance=1');
        return json;
      }
      // Public/unauthenticated page — show a toast once per burst
      if (!_maintenanceToastPending) {
        _maintenanceToastPending = true;
        showToast('warning', 'LagKonnect is currently under maintenance. Please try again later.');
        setTimeout(() => { _maintenanceToastPending = false; }, 6000);
      }
    }

    // ── Account suspension: immediately invalidate the session ────────────
    // The server already enforces this on every protected request. When it
    // returns ACCOUNT_SUSPENDED, wipe the local session and redirect to the
    // login page so the suspended user cannot continue using the app.
    if (json?.error?.code === 'ACCOUNT_SUSPENDED' && !_suspensionHandled) {
      _suspensionHandled = true;
      sessionStorage.removeItem('adm_auth');
      showToast('error', 'Your account has been suspended. Please contact support.');
      // Short delay so the toast is visible before the redirect.
      setTimeout(() => {
        _suspensionHandled = false; // reset in case of edge reuse
        window.location.replace('/');
      }, 2500);
      return json;
    }

    return json;
  } catch (err) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server. Please check your connection.',
      },
    };
  }
}