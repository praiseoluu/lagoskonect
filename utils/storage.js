/**
 * LagKonnect — Storage Utility
 * ============================================================
 * Thin wrapper around Web Storage APIs.
 *
 * - session: sessionStorage (cleared when tab closes)
 * - local:   localStorage   (persists across sessions)
 *
 * All values are JSON serialised/deserialised automatically.
 * Never throws — returns null on missing keys or parse errors.
 *
 * Auth tokens are stored in sessionStorage (not localStorage)
 * so they're cleared when the browser tab closes — a deliberate
 * security decision for a civic platform.
 */

const _safe = (fn, fallback = null) => {
  try { return fn(); } catch { return fallback; }
};

export const storage = {
  session: {
    get: (key) => _safe(() => JSON.parse(sessionStorage.getItem(key))),
    set: (key, value) => _safe(() => sessionStorage.setItem(key, JSON.stringify(value))),
    remove: (key) => _safe(() => sessionStorage.removeItem(key)),
    clear: () => _safe(() => sessionStorage.clear()),
  },
  local: {
    get: (key) => _safe(() => JSON.parse(localStorage.getItem(key))),
    set: (key, value) => _safe(() => localStorage.setItem(key, JSON.stringify(value))),
    remove: (key) => _safe(() => localStorage.removeItem(key)),
    clear: () => _safe(() => localStorage.clear()),
  },
};

// ─── Auth Session Keys ────────────────────────────────────────────────────

const AUTH_KEY = 'adm_auth';
const USER_KEY = 'afx_user';
const ADMIN_KEY = 'afx_admin';
const PREFS_KEY = 'afx_prefs';

/**
 * Persists an auth session to sessionStorage.
 * @param {{ token: string, role: 'citizen'|'admin', user?: Object, admin?: Object }} session
 */
export function saveSession(session) {
  storage.session.set(AUTH_KEY, {
    token: session.token,
    role: session.role,
  });
  if (session.user) storage.session.set(USER_KEY, session.user);
  if (session.admin) storage.session.set(ADMIN_KEY, session.admin);
}

/**
 * Reads the persisted auth session from sessionStorage.
 * Returns null if no session exists.
 * @returns {{ token: string, role: string, user?: Object, admin?: Object }|null}
 */
export function loadSession() {
  const auth = storage.session.get(AUTH_KEY);
  if (!auth?.token) return null;
  return {
    ...auth,
    user: storage.session.get(USER_KEY),
    admin: storage.session.get(ADMIN_KEY),
  };
}

/**
 * Clears all auth session data.
 * Call on logout.
 */
export function clearSession() {
  storage.session.remove(AUTH_KEY);
  storage.session.remove(USER_KEY);
  storage.session.remove(ADMIN_KEY);
}

/**
 * Saves user preferences to localStorage (persists across sessions).
 * @param {Object} prefs
 */
export function savePrefs(prefs) {
  const existing = storage.local.get(PREFS_KEY) || {};
  storage.local.set(PREFS_KEY, { ...existing, ...prefs });
}

/**
 * Loads user preferences from localStorage.
 * @returns {Object}
 */
export function loadPrefs() {
  return storage.local.get(PREFS_KEY) || {};
}