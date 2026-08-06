/**
 * LagKonnect — Users API
 * ============================================================
 * Citizen methods  → real PHP backend
 * Admin methods    → real PHP backend
 */

import { _fetch, BASE_URL } from './_fetch.js?v=20260806a';

export const users = {

  // ── Citizen: profile ──────────────────────────────────────────────────

  async getProfile() {
    return await _fetch('GET', '/users/me');
  },

  async updateProfile(data) {
    return await _fetch('PATCH', '/users/me', data);
  },

  async uploadAvatar(dataUrl) {
    try {
      const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
      const token = auth?.token || '';
      const [meta, base64] = dataUrl.split(',');
      const mime = meta.match(/:(.*?);/)[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.jpg');
      const response = await fetch(`${BASE_URL}/users/me/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      return await response.json();
    } catch {
      return { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload avatar.' } };
    }
  },

  async updatePassword(data) {
    return await _fetch('PATCH', '/users/me/password', data);
  },

  /**
   * Force-change password for admin-created accounts.
   * Clears mustChangePassword flag on success.
   */
  async changePassword(newPassword) {
    return await _fetch('POST', '/auth/change-password', { newPassword });
  },

  async markWelcomeSeen() {
    return await _fetch('POST', '/users/me/welcome-seen');
  },

  async updatePrivacySettings(data) {
    return await _fetch('PATCH', '/users/me/privacy', data);
  },

  async updateNotifPrefs(prefs) {
    return await _fetch('PATCH', '/users/me/notif-prefs', prefs);
  },

  async updateUsername(username) {
    return await _fetch('PATCH', '/users/me/username', { username });
  },

  async getPublicProfile(username) {
    return await _fetch('GET', `/users/profile/${encodeURIComponent(username)}`, null, false);
  },

  async uploadIdDocument(file) {
    const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
    const token = auth?.token || '';
    const formData = new FormData();
    formData.append('document', file, file.name);

    let response;
    try {
      response = await fetch(`${BASE_URL}/users/me/id-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    } catch {
      return { error: { code: 'NETWORK_ERROR', message: 'Could not reach the server. Check your connection and try again.' } };
    }

    // Read the body as text first. A failed upload often answers with an HTML
    // error page or a PHP notice rather than JSON, and parsing that blindly
    // turned every distinct failure into one unhelpful "Failed to upload"
    // with no status code to go on.
    const raw = await response.text();

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* not JSON */ }

    if (parsed?.error) return parsed;

    if (!response.ok) {
      return {
        error: {
          code: 'UPLOAD_ERROR',
          message: `Upload failed (HTTP ${response.status}). ${raw.slice(0, 140)}`.trim(),
        },
      };
    }

    if (!parsed) {
      return { error: { code: 'UPLOAD_ERROR', message: 'The server returned an unreadable response.' } };
    }

    return parsed;
  },

  // ── Admin: user management ────────────────────────────────────────────

  /**
   * List users with optional filters.
   * Returns paginated list + { totalCitizens, totalActive } in meta.extra
   */
  async adminList(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    if (opts.search) params.set('search', opts.search);
    if (opts.status) params.set('status', opts.status);
    if (opts.lgaId) params.set('lgaId', opts.lgaId);
    if (opts.region) params.set('region', opts.region);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/admin/users${qs}`);
  },

  async adminGetById(id) {
    return await _fetch('GET', `/admin/users/${id}`);
  },

  /**
   * Create a citizen account.
   * Admin sets a temporary password — user must change it on first login.
   */
  async adminCreate(data) {
    return await _fetch('POST', '/admin/users', data);
  },

  async adminUpdate(id, data) {
    return await _fetch('PATCH', `/admin/users/${id}`, data);
  },

  async adminSuspend(id) {
    return await _fetch('PATCH', `/admin/users/${id}/status`, { status: 'suspended' });
  },

  async adminReactivate(id) {
    return await _fetch('PATCH', `/admin/users/${id}/status`, { status: 'active' });
  },
};