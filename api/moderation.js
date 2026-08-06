/**
 * LagKonnect — Moderation API
 */

import { _fetch } from './_fetch.js?v=20260806c';

export const moderation = {

  async list(opts) {
    opts = opts || {};
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    if (opts.tab) params.set('tab', opts.tab);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', '/admin/moderation' + qs);
  },

  async metrics() {
    return await _fetch('GET', '/admin/moderation/metrics');
  },

  async dismiss(reelId, note) {
    return await _fetch('PATCH', '/admin/moderation/' + reelId + '/dismiss', { note: note || '' });
  },

  async takedown(reelId, note) {
    return await _fetch('PATCH', '/admin/moderation/' + reelId + '/takedown', { note: note || '' });
  },
};