/**
 * LagKonnect — Admin LGA API
 */

import { _fetch, BASE_URL } from './_fetch.js?v=20260805c';

export const lgasAdmin = {

  async list(opts) {
    opts = opts || {};
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    if (opts.search) params.set('search', opts.search);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', '/admin/lgas' + qs);
  },

  async metrics() {
    return await _fetch('GET', '/admin/lgas/metrics');
  },

  async create(data) {
    return await _fetch('POST', '/admin/lgas', data);
  },

  async update(id, data) {
    return await _fetch('PATCH', '/admin/lgas/' + id, data);
  },

  async merge(id, targetId) {
    return await _fetch('POST', '/admin/lgas/' + id + '/merge', { targetId: targetId });
  },
};