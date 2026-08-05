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
import { _fetch } from './_fetch.js';
import { store } from '../core/store.js';
import { auth } from './auth.js';
import { news } from './news.js';
import { reels } from './reels.js';
import { moderation } from './moderation.js';
import { adverts } from './adverts.js';
import { lgasAdmin } from './lgasAdmin.js';
import { adminTeam } from './adminTeam.js';
import { analytics } from './analytics.js';
import { chat } from './chat.js';
import { notifications } from './notifications.js';
import { users } from './users.js';
import { referrals } from './referrals.js';
import { newsletter } from './newsletter.js';
import { newsImport } from './newsImport.js';
import {
  MOCK,
  MOCK_SLOW_MS,
  _delay,
  _ok,
  _err,
  _requireRole,
  _paginate,
} from './_mockData.js';

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
};