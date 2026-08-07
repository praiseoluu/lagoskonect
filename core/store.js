/**
 * Lagos Konect — Reactive Global Store
 * ============================================================
 * A single Proxy-powered state container for the entire app.
 *
 * Design goals:
 *   - Zero boilerplate. Read and write like a plain object.
 *   - Surgical updates. Only subscribers to changed keys are notified.
 *   - No memory leaks. Components use Component.subscribe() which
 *     auto-calls store.unsubscribe() on component unmount.
 *   - Predictable. Deep objects must be replaced (not mutated) to
 *     trigger reactivity. See note on deep reactivity below.
 *
 * Usage:
 *   import { store } from './store.js?v=20260806f';
 *
 *   // Read
 *   const user = store.user;
 *
 *   // Write (triggers all subscribers for 'user')
 *   store.user = { id: 1, name: 'Ada', role: 'citizen' };
 *
 *   // Subscribe
 *   const unsub = store.subscribe('user', (newVal, oldVal) => { ... });
 *
 *   // Unsubscribe
 *   store.unsubscribe('user', handler);
 *   // or use the returned function:
 *   unsub();
 *
 * Deep reactivity note:
 *   The Proxy only intercepts top-level property assignments.
 *   To trigger reactivity on nested changes, reassign the top-level key:
 *
 *   // ✗ Won't trigger subscribers
 *   store.user.name = 'Ada';
 *
 *   // ✓ Will trigger subscribers
 *   store.user = { ...store.user, name: 'Ada' };
 */

import { loadPrefs } from '../utils/storage.js?v=20260806f';
import { onLanguageChange } from './i18n.js?v=20260806f';

// ─── Initial State Schema ─────────────────────────────────────────────────
//
// Every key that components might subscribe to must be initialised here.
// This documents the full shape of application state in one place.

const INITIAL_STATE = {
  // ── Localization ──────────────────────────────────────────────────────
  /**
   * The active UI language code — one of the i18n LANGUAGES[].code values
   * ('en' | 'ha' | 'pcm' | 'ff').
   *
   * NOTE: i18n.js is the SOURCE OF TRUTH for the active language (its internal
   * `_lang`, mirrored to localStorage via savePrefs/loadPrefs). This store key
   * is a REACTIVE MIRROR so components can `subscribe('language', ...)` and
   * re-render in place. It is kept in sync by the onLanguageChange() listener
   * registered at the bottom of this file, and is deliberately PRESERVED by
   * reset() so that logout never wipes the user's chosen language.
   * @type {string}
   */
  language: loadPrefs().language || 'en',

  // ── Auth ──────────────────────────────────────────────────────────────
  /**
   * Whether a session exists (token present and valid).
   * Used by route guards. Set to true after successful login.
   * @type {boolean}
   */
  isAuthenticated: false,

  /**
   * The role of the current session.
   * 'citizen' | 'admin' | null
   * Determines which route tree is accessible.
   * @type {string|null}
   */
  role: null,

  /**
   * The auth token returned by the backend on login.
   * Sent as Authorization: Bearer <token> on every API call.
   * @type {string|null}
   */
  authToken: null,

  // ── Current User ──────────────────────────────────────────────────────
  /**
   * Full user object for the logged-in citizen.
   * null when not authenticated.
   * @type {{
   *   id: number,
   *   name: string,
   *   phone: string,
   *   lgaId: number,
   *   lgaName: string,
   *   avatarUrl: string|null,
   *   isVerified: boolean,
   *   createdAt: string
   * }|null}
   */
  currentUser: null,

  /**
   * Full admin user object for the logged-in administrator.
   * null when not authenticated as admin.
   * @type {{
   *   id: number,
   *   name: string,
   *   email: string,
   *   role: 'super_admin'|'admin'|'moderator',
   *   avatarUrl: string|null,
   *   lastLogin: string
   * }|null}
   */
  currentAdmin: null,

  // ── LGA ───────────────────────────────────────────────────────────────
  /**
   * The currently selected Local Government Area.
   * Set during onboarding and changeable in Settings.
   * @type {{id: number, name: string, state: string}|null}
   */
  currentLGA: null,

  /**
   * Full list of LGAs available for selection.
   * Populated once on app init from the API.
   * @type {Array<{id: number, name: string, state: string}>}
   */
  lgaList: [],

  // ── Notifications ─────────────────────────────────────────────────────
  /**
   * Unread notification count — drives the bell badge.
   * @type {number}
   */
  unreadNotificationCount: 0,

  /**
   * The notifications list for the current user.
   * @type {Array<{
   *   id: number,
   *   category: 'Official'|'Community'|'Security Alert'|'Event',
   *   title: string,
   *   body: string,
   *   isRead: boolean,
   *   createdAt: string
   * }>}
   */
  notifications: [],

  /**
   * Unread community chat message count for the current LGA — drives the chat badge.
   * @type {number}
   */
  unreadChatCount: 0,

  // ── UI State ──────────────────────────────────────────────────────────
  /**
   * Whether the sidebar is collapsed (admin + web app).
   * @type {boolean}
   */
  sidebarCollapsed: false,

  /**
   * The current route path (kept in sync by the router).
   * @type {string}
   */
  currentRoute: '/',

  /**
   * Global loading overlay — true while a page-level async op runs.
   * @type {boolean}
   */
  isPageLoading: false,

  /**
   * Queue of toast notifications to display.
   * The Toast component subscribes and renders these.
   * @type {Array<{id: string, type: 'success'|'error'|'warning'|'info', message: string, duration: number}>}
   */
  toasts: [],

  // ── Page-level Data ───────────────────────────────────────────────────
  // These are populated by individual page components on mount
  // and cleared on unmount to free memory.

  /** @type {Array} Trending news items for the current LGA */
  trendingNews: [],

  /** @type {Array} Reels for the current LGA */
  reels: [],

  /** @type {Array} Community chat messages for the current LGA */
  chatMessages: [],

  /** @type {Object|null} Currently viewed article/reel */
  activeContent: null,

  // ── Admin-specific ────────────────────────────────────────────────────
  /** @type {Object} Admin dashboard aggregate metrics */
  adminMetrics: null,

  /** @type {Array} User list for admin management page */
  adminUserList: [],

  /** @type {number} Total user count (for pagination) */
  adminUserTotal: 0,

  /**
   * Currently selected admin region for content management.
   * Admins manage content per region (North, Central, South).
   * @type {'west'|'central'|'east'}
   */
  adminRegion: 'west',
};

// ─── Store Factory ────────────────────────────────────────────────────────

function createStore(initialState) {
  /**
   * Map of key → Set of handler functions.
   * Using a Set prevents duplicate subscriptions.
   * @type {Map<string, Set<Function>>}
   */
  const _subscribers = new Map();

  /**
   * The raw state object. Never accessed directly —
   * always through the Proxy below.
   */
  const _state = { ...initialState };

  // ── Core Proxy ────────────────────────────────────────────────────────

  const proxy = new Proxy(_state, {
    get(target, key) {
      // Expose subscribe / unsubscribe / reset as non-reactive methods
      if (key === 'subscribe') return subscribe;
      if (key === 'unsubscribe') return unsubscribe;
      if (key === 'reset') return reset;
      if (key === 'snapshot') return snapshot;
      if (key === 'hydrate') return hydrate;

      return target[key];
    },

    set(target, key, value) {
      const oldValue = target[key];

      // Skip if value hasn't changed (strict equality check)
      // For objects/arrays, always reassign — we trust the caller
      // to have created a new reference when mutation occurred.
      if (oldValue === value && typeof value !== 'object') {
        return true;
      }

      target[key] = value;
      _notify(key, value, oldValue);
      return true;
    },

    // Prevent accidental deletion of state keys
    deleteProperty(target, key) {
      console.warn(
          `[Store] Attempted to delete key "${key}". Use store.${key} = null instead.`
      );
      return false;
    },
  });

  // ── Notification ──────────────────────────────────────────────────────

  /**
   * Notifies all subscribers for a given key.
   * Runs handlers synchronously in registration order.
   */
  function _notify(key, newValue, oldValue) {
    const handlers = _subscribers.get(key);
    if (!handlers || handlers.size === 0) return;

    [...handlers].forEach((handler) => {
      try {
        handler(newValue, oldValue);
      } catch (err) {
        console.error(
            `[Store] Error in subscriber for key "${key}":`,
            err
        );
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Subscribes to changes on a specific state key.
   *
   * @param {string} key - The top-level state key to watch
   * @param {Function} handler - Called with (newValue, oldValue)
   * @returns {Function} Unsubscribe function
   */
  function subscribe(key, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`[Store] subscribe() handler must be a function.`);
    }

    if (!_subscribers.has(key)) {
      _subscribers.set(key, new Set());
    }
    _subscribers.get(key).add(handler);

    // Return an unsubscribe function for convenience
    return () => unsubscribe(key, handler);
  }

  /**
   * Removes a previously registered subscriber.
   *
   * @param {string} key
   * @param {Function} handler
   */
  function unsubscribe(key, handler) {
    _subscribers.get(key)?.delete(handler);
  }

  /**
   * Resets all state back to the initial values.
   * Used on logout to wipe all session data.
   */
  function reset() {
    Object.keys(initialState).forEach((key) => {
      // Preserve the chosen UI language across logout. i18n.js holds the real
      // source of truth (and localStorage persists it), so resetting this
      // mirror back to the default here would desync the two.
      if (key === 'language') return;

      const freshValue = Array.isArray(initialState[key])
          ? []
          : typeof initialState[key] === 'object' && initialState[key] !== null
              ? { ...initialState[key] }
              : initialState[key];

      const oldValue = _state[key];
      _state[key] = freshValue;
      _notify(key, freshValue, oldValue);
    });
  }

  /**
   * Returns a shallow snapshot of the current state.
   * Useful for debugging and persisting to sessionStorage.
   * @returns {Object}
   */
  function snapshot() {
    return { ..._state };
  }

  /**
   * Hydrates the store from a plain object (e.g. from sessionStorage).
   * Only sets keys that exist in the initial state schema.
   *
   * @param {Object} data
   */
  function hydrate(data) {
    Object.keys(data).forEach((key) => {
      if (key in initialState) {
        proxy[key] = data[key];
      } else {
        console.warn(`[Store] hydrate() skipping unknown key: "${key}"`);
      }
    });
  }

  return proxy;
}

// ─── Singleton Export ─────────────────────────────────────────────────────

/**
 * The single global store instance.
 * Import this everywhere — never call createStore() again.
 */
export const store = createStore(INITIAL_STATE);

// ─── Keep the reactive `language` mirror in sync with the i18n engine ──────
// i18n.js owns the active language; whenever it changes (via setLanguage) it
// notifies its listeners. We push that new code into the store so every
// component subscribed to 'language' re-renders. On boot, initI18n() reads the
// same persisted pref this store initialised from, so the two already agree on
// the first paint — this listener only handles subsequent switches.
onLanguageChange((code) => {
  store.language = code;
});

// ─── Store Helpers ────────────────────────────────────────────────────────

/**
 * Pushes a toast notification into the queue.
 * The Toast component subscribes to store.toasts and renders them.
 *
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} message
 * @param {number} [duration=4000] - ms before auto-dismiss
 */
export function showToast(type, message, duration = 4000) {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  store.toasts = [...store.toasts, { id, type, message, duration }];
}

/**
 * Removes a toast from the queue by id.
 * @param {string} id
 */
export function dismissToast(id) {
  store.toasts = store.toasts.filter((t) => t.id !== id);
}

/**
 * Sets the page-level loading state.
 * @param {boolean} loading
 */
export function setPageLoading(loading) {
  store.isPageLoading = loading;
}
