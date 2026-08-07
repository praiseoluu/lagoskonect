/**
 * LagKonnect — Chat API
 */

import { _fetch, BASE_URL } from './_fetch.js?v=20260806d';

export const chat = {

  // ── Citizen: LGA group chat ───────────────────────────────────────────

  async getPreviews() {
    return await _fetch('GET', '/chat/previews');
  },

  async getMessages(opts = {}) {
    const params = new URLSearchParams();
    if (opts.lgaId) params.set('lgaId', opts.lgaId);
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage || 50);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/chat/messages${qs}`);
  },

  async sendMessage(data) {
    return await _fetch('POST', '/chat/messages', {
      lgaId: data.lgaId || null,
      text: data.text || null,
      mediaUrl: data.mediaUrl || null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      replyTo: data.replyTo || null,
    });
  },

  async getOnlineCount(opts = {}) {
    const qs = opts.lgaId ? `?lgaId=${opts.lgaId}` : '';
    return await _fetch('GET', `/chat/online-count${qs}`);
  },

  async getUnreadCount(opts = {}) {
    const qs = opts.lgaId ? `?lgaId=${opts.lgaId}` : '';
    return await _fetch('GET', `/chat/unread-count${qs}`);
  },

  async markRead(opts = {}) {
    const body = opts.lgaId ? { lgaId: opts.lgaId } : {};
    return await _fetch('POST', '/chat/mark-read', body);
  },

  async toggleReaction(messageId, emoji) {
    return await _fetch('POST', `/chat/messages/${messageId}/reactions`, { emoji });
  },

  async inviteMember(phone) {
    return await _fetch('POST', '/chat/invite', { phone });
  },

  async getMembers() {
    return await _fetch('GET', '/chat/members');
  },

  async deleteMessage(messageId) {
    return await _fetch('DELETE', `/chat/messages/${messageId}`);
  },

  async editMessage(messageId, text) {
    return await _fetch('PATCH', `/chat/messages/${messageId}`, { text });
  },

  async reportMessage(messageId, reason) {
    return await _fetch('POST', '/chat/report', { messageId, reason });
  },

  async uploadFile(file) {
    try {
      const form = new FormData();
      form.append('file', file);
      const token = JSON.parse(sessionStorage.getItem('adm_auth') || 'null')?.token;
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BASE_URL}/chat/upload`, { method: 'POST', headers, body: form });
      return await res.json();
    } catch {
      return { error: { code: 'NETWORK_ERROR', message: 'Could not reach the server.' } };
    }
  },

  // ── Admin ──────────────────────────────────────────────────────────────

  async adminGetLgas(opts = {}) {
    const qs = opts.region ? `?region=${encodeURIComponent(opts.region)}` : '';
    return await _fetch('GET', `/admin/chat/lgas${qs}`);
  },

  async adminGetStats(opts = {}) {
    const qs = opts.region ? `?region=${encodeURIComponent(opts.region)}` : '';
    return await _fetch('GET', `/admin/chat/stats${qs}`);
  },

  async adminGetReports(status = 'pending') {
    return await _fetch('GET', `/admin/chat/reports?status=${status}`);
  },

  async adminResolveReport(id, resolution, note = '') {
    return await _fetch('POST', `/admin/chat/reports/${id}/resolve`, { resolution, note });
  },

  async adminGetMessages(lgaId, opts = {}) {
    const params = new URLSearchParams({ lgaId: String(lgaId) });
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    return await _fetch('GET', `/admin/chat/messages?${params}`);
  },

  async adminSendMessage(lgaId, text, replyTo = null, fileData = null) {
    return await _fetch('POST', '/admin/chat/messages', {
      lgaId,
      text:     text     || null,
      replyTo:  replyTo  || null,
      fileUrl:  fileData?.fileUrl  || null,
      fileName: fileData?.fileName || null,
      fileSize: fileData?.fileSize || null,
    });
  },

  async adminUploadFile(file) {
    try {
      const form = new FormData();
      form.append('file', file);
      const token = JSON.parse(sessionStorage.getItem('adm_auth') || 'null')?.token;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BASE_URL}/admin/chat/upload`, { method: 'POST', headers, body: form });
      return await res.json();
    } catch {
      return { error: { code: 'NETWORK_ERROR', message: 'Could not reach the server.' } };
    }
  },

  async adminFlagMessage(messageId) {
    return await _fetch('POST', `/admin/chat/messages/${messageId}/flag`, {});
  },

  async adminDeleteMessage(id) {
    return await _fetch('DELETE', `/admin/chat/messages/${id}`);
  },

  async adminClearMessages(lgaId) {
    return await _fetch('DELETE', `/admin/chat/lgas/${lgaId}/messages`);
  },

  async adminToggleReaction(messageId, emoji) {
    return await _fetch('POST', `/admin/chat/messages/${messageId}/reactions`, { emoji });
  },

  async adminWarnUser(userId, reason = '') {
    return await _fetch('POST', `/admin/chat/warn/${userId}`, { reason });
  },

  async adminGetMembers(lgaId) {
    return await _fetch('GET', `/admin/chat/members?lgaId=${lgaId}`);
  },

  async adminGetBannedWords() {
    return await _fetch('GET', '/admin/chat/banned-words');
  },

  async adminAddBannedWord(word) {
    return await _fetch('POST', '/admin/chat/banned-words', { word });
  },

  async adminDeleteBannedWord(id) {
    return await _fetch('DELETE', `/admin/chat/banned-words/${id}`);
  },
};