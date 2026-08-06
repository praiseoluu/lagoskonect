/**
 * LagKonnect — Adverts API
 */

import { _fetch, BASE_URL } from './_fetch.js?v=20260806a';

export const adverts = {

  // ── Public (no auth) ─────────────────────────────────────────────────

  async getPublic() {
    return await _fetch('GET', '/adverts/public');
  },

  // ── Citizen ───────────────────────────────────────────────────────────

  async getForLGA(type) {
    const qs = type ? '?type=' + encodeURIComponent(type) : '';
    return await _fetch('GET', '/adverts' + qs);
  },

  async recordClick(id) {
    return await _fetch('POST', '/adverts/' + id + '/click');
  },

  // ── Admin ─────────────────────────────────────────────────────────────

  async adminList(opts) {
    opts = opts || {};
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    if (opts.tab) params.set('tab', opts.tab);
    if (opts.search) params.set('search', opts.search);
    if (opts.placement) params.set('placement', opts.placement);
    if (opts.region) params.set('region', opts.region);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', '/admin/adverts' + qs);
  },

  async adminMetrics(opts) {
    opts = opts || {};
    const params = new URLSearchParams();
    if (opts.region) params.set('region', opts.region);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', '/admin/adverts/metrics' + qs);
  },

  async adminGetById(id) {
    return await _fetch('GET', '/admin/adverts/' + id);
  },

  async adminUploadBanner(file) {
    try {
      const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
      const token = auth ? (auth.token || '') : '';
      const formData = new FormData();
      formData.append('image', file);

      return await new Promise(function (resolve) {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', function () {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { resolve({ error: { code: 'PARSE_ERROR', message: 'Invalid response.' } }); }
        });
        xhr.addEventListener('error', function () {
          resolve({ error: { code: 'NETWORK_ERROR', message: 'Upload failed.' } });
        });
        xhr.open('POST', BASE_URL + '/admin/adverts/upload');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(formData);
      });
    } catch (e) {
      return { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload banner.' } };
    }
  },

  async adminCreate(data) {
    return await _fetch('POST', '/admin/adverts', data);
  },

  async adminUpdate(id, data) {
    return await _fetch('PATCH', '/admin/adverts/' + id, data);
  },

  async adminDelete(id) {
    return await _fetch('DELETE', '/admin/adverts/' + id);
  },

  async adminTogglePause(id) {
    return await _fetch('PATCH', '/admin/adverts/' + id + '/pause');
  },
};