/**
 * LagKonnect — API Client
 * ============================================================
 * Single source of truth for ALL data operations.
 *
 * Citizen side  → real PHP backend (http://localhost/server/api/v1)
 * Admin side    → mock data (admin endpoints not yet built)
 *
 * Contract:
 *   Every method is async, always returns { data } or { error }.
 *   Never throws. Auth token read from sessionStorage on every call.
 */
import { _fetch } from './_fetch.js?v=20260806b';
import { store } from '../core/store.js?v=20260806b';
import { auth } from './auth.js?v=20260806b';
import { news } from './news.js?v=20260806b';
import { reels } from './reels.js?v=20260806b';
import { moderation } from './moderation.js?v=20260806b';
import { adverts } from './adverts.js?v=20260806b';
import { lgasAdmin } from './lgasAdmin.js?v=20260806b';
import { adminTeam } from './adminTeam.js?v=20260806b';
import { analytics } from './analytics.js?v=20260806b';
import { chat } from './chat.js?v=20260806b';
import { notifications } from './notifications.js?v=20260806b';
import { users } from './users.js?v=20260806b';
import { referrals } from './referrals.js?v=20260806b';
import { newsletter } from './newsletter.js?v=20260806b';
import { newsImport } from './newsImport.js?v=20260806b';
import { withdrawals } from './withdrawals.js?v=20260806b';
import {
  MOCK,
  MOCK_SLOW_MS,
  _delay,
  _ok,
  _err,
  _requireRole,
  _paginate,
} from './_mockData.js?v=20260806b';

// ─── LGAs ─────────────────────────────────────────────────────────────────

const lgas = {
  async getAll() {
    return await _fetch('GET', '/lgas', null, false);
  },

  async getById(id) {
    // No dedicated endpoint — filter from getAll
    const res = await _fetch('GET', '/lgas', null, false);
    if (res.error) return res;
    const lga = res.data.find((l) => l.id === id);
    if (!lga) return _err('NOT_FOUND', 'LGA not found.');
    return _ok(lga);
  },
};

// ─── Events (mock — no backend endpoint yet) ──────────────────────────────

const events = {
  async getForLGA(opts = {}) {
    await _delay();
    const guard = _requireRole('citizen');
    if (guard) return guard;
    const lgaId = store.currentLGA?.id;
    let list = MOCK.events.filter(
      (e) => (e.lgaId === lgaId || e.lgaId === null) && e.status === 'published'
    );
    if (opts.type) list = list.filter((e) => e.type === opts.type);
    list.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    const { items, meta } = _paginate(list, opts.page, opts.perPage || 10);
    return _ok(items, meta);
  },

  async getById(id) {
    await _delay();
    const event = MOCK.events.find((e) => e.id === id && e.status === 'published');
    if (!event) return _err('NOT_FOUND', 'Event not found.');
    return _ok(event);
  },
};


// ─── Platform Settings ────────────────────────────────────────────────────

const platformSettings = {
  async get() { return await _fetch('GET', '/admin/platform-settings'); },
  async update(data) { return await _fetch('PATCH', '/admin/platform-settings', data); },
};

// ─── Unified Export ───────────────────────────────────────────────────────

export const api = {
  auth,
  lgas,
  users,
  events,
  news,
  reels,
  chat,
  notifications,
  adverts,
  analytics,
  moderation,
  lgasAdmin,
  adminTeam,
  platformSettings,
  referrals,
  newsletter,
  newsImport,
  withdrawals,
};