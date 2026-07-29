/**
 * LagKonnect — Notifications API
 * ============================================================
 * All citizen methods → real PHP backend
 */

import { _fetch } from './_fetch.js';

export const notifications = {

  async getForUser(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page)    params.set('page',    opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/notifications${qs}`);
  },

  async markRead(id) {
    return await _fetch('PATCH', `/notifications/${id}/read`);
  },

  async markAllRead() {
    return await _fetch('PATCH', '/notifications/read-all');
  },

  async getUnreadCount() {
    return await _fetch('GET', '/notifications/unread-count');
  },
};
