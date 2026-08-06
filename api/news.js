/**
 * LagKonnect — News API
 * ============================================================
 * Citizen methods  → real PHP backend
 * Admin methods    → real PHP backend
 */

import { _fetch, BASE_URL } from './_fetch.js?v=20260806c';

export const news = {

  // ── Citizen ───────────────────────────────────────────────────────────

  async getForLGA(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/news${qs}`);
  },

  async getAll(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage || 50);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/news${qs}`);
  },

  async getBySlug(slug) {
    return await _fetch('GET', `/news/${slug}`);
  },

  // ── Admin ─────────────────────────────────────────────────────────────

  async adminList(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    if (opts.status) params.set('status', opts.status);
    if (opts.search) params.set('search', opts.search);
    if (opts.tab) params.set('tab', opts.tab);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/admin/news${qs}`);
  },

  async adminMetrics() {
    return await _fetch('GET', '/admin/news/metrics');
  },

  async adminGetById(id) {
    return await _fetch('GET', `/admin/news/${id}`);
  },

  async adminCreate(data) {
    return await _fetch('POST', '/admin/news', data);
  },

  /**
   * Upload a news banner image to Cloudinary via the backend.
   * Returns { url, publicId } on success.
   * @param {File} file
   */
  async uploadNewsImage(file) {
    try {
      const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
      const token = auth?.token || '';
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${BASE_URL}/admin/news/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      return await res.json();
    } catch {
      return { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload image.' } };
    }
  },

  async adminUpdate(id, data) {
    return await _fetch('PATCH', `/admin/news/${id}`, data);
  },

  async adminDelete(id) {
    return await _fetch('DELETE', `/admin/news/${id}`);
  },

  async adminPublish(id) {
    return await _fetch('PATCH', `/admin/news/${id}/publish`);
  },

  async adminTogglePause(id) {
    return await _fetch('PATCH', `/admin/news/${id}/pause`);
  },

  async adminSetHeadline(id) {
    return await _fetch('PATCH', `/admin/news/${id}/headline`);
  },

  /**
   * Estimate reach for selected LGAs.
   * @param {number[]} lgaIds
   * @param {boolean}  targetAllLgas
   */
  async estimateReach(lgaIds, targetAllLgas = false) {
    return await _fetch('POST', '/admin/news/reach', { lgaIds, targetAllLgas });
  },
};
