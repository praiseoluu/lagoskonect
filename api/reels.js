/**
 * LagKonnect — Reels API
 */

import { _fetch, BASE_URL } from './_fetch.js?v=20260806d';

export const reels = {

  // ── Citizen ───────────────────────────────────────────────────────────

  async getForLGA(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', '/reels' + qs);
  },

  async getByReelId(reelId) {
    return await _fetch('GET', '/reels/' + reelId);
  },

  async toggleLike(reelId) {
    return await _fetch('POST', '/reels/' + reelId + '/like');
  },

  async getComments(reelId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', '/reels/' + reelId + '/comments' + qs);
  },

  async addComment(reelId, text) {
    return await _fetch('POST', '/reels/' + reelId + '/comments', { text });
  },

  // Alias used by some Reels page components
  async postComment(reelId, body) {
    return this.addComment(reelId, body?.text ?? body);
  },

  async upload(file, caption, hashtags, onProgress, thumbnailBlob) {
    caption = caption || '';
    hashtags = hashtags || [];
    onProgress = onProgress || null;
    try {
      const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
      const token = auth ? (auth.token || '') : '';
      const formData = new FormData();
      formData.append('file', file);
      if (caption) formData.append('caption', caption);
      if (hashtags.length) formData.append('hashtags', JSON.stringify(hashtags));
      if (thumbnailBlob) formData.append('thumbnail', thumbnailBlob, 'thumb.jpg');

      return await new Promise(function (resolve) {
        const xhr = new XMLHttpRequest();
        if (onProgress) {
          xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          });
        }
        xhr.addEventListener('load', function () {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { resolve({ error: { code: 'PARSE_ERROR', message: 'Invalid server response.' } }); }
        });
        xhr.addEventListener('error', function () {
          resolve({ error: { code: 'NETWORK_ERROR', message: 'Upload failed.' } });
        });
        xhr.open('POST', BASE_URL + '/reels/upload');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(formData);
      });
    } catch (e) {
      return { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload reel.' } };
    }
  },

  async deleteOwnReel(reelId) {
    return await _fetch('DELETE', '/reels/' + reelId);
  },

  async reportReel(reelId, reason, details) {
    return await _fetch('POST', '/reels/' + reelId + '/report', { reason: reason, details: details || '' });
  },

  async adminDeleteReel(reelId) {
    return await _fetch('DELETE', '/reels/' + reelId);
  },

  async getByUser(userId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', `/reels/by/${userId}${qs}`, null, false);
  },

  async getSubscription(reelId) {
    return await _fetch('GET', `/reels/${reelId}/subscription`);
  },

  async subscribe(reelId) {
    return await _fetch('POST', `/reels/${reelId}/subscribe`);
  },

  async unsubscribe(reelId) {
    return await _fetch('DELETE', `/reels/${reelId}/subscribe`);
  },

  // ── Admin ─────────────────────────────────────────────────────────────

  async adminList(opts) {
    opts = opts || {};
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    if (opts.tab) params.set('tab', opts.tab);
    if (opts.search) params.set('search', opts.search);
    if (opts.lgaId) params.set('lgaId', opts.lgaId);
    if (opts.region) params.set('region', opts.region);
    const qs = params.toString() ? '?' + params : '';
    return await _fetch('GET', '/admin/reels' + qs);
  },

  async adminMetrics(region) {
    const qs = region ? '?region=' + encodeURIComponent(region) : '';
    return await _fetch('GET', '/admin/reels/metrics' + qs);
  },

  async adminGetById(reelId) {
    return await _fetch('GET', '/admin/reels/' + reelId);
  },

  async adminUploadVideo(file, onProgress, thumbnailBlob) {
    onProgress = onProgress || null;
    try {
      const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
      const token = auth ? (auth.token || '') : '';
      const formData = new FormData();
      formData.append('file', file);
      if (thumbnailBlob) formData.append('thumbnail', thumbnailBlob, 'thumb.jpg');

      return await new Promise(function (resolve) {
        const xhr = new XMLHttpRequest();
        if (onProgress) {
          xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          });
        }
        xhr.addEventListener('load', function () {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { resolve({ error: { code: 'PARSE_ERROR', message: 'Invalid server response.' } }); }
        });
        xhr.addEventListener('error', function () {
          resolve({ error: { code: 'NETWORK_ERROR', message: 'Upload failed.' } });
        });
        xhr.open('POST', BASE_URL + '/admin/reels/upload');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(formData);
      });
    } catch (e) {
      return { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload video.' } };
    }
  },

  async adminCreate(data) {
    return await _fetch('POST', '/admin/reels', data);
  },

  async adminUpdate(reelId, data) {
    return await _fetch('PATCH', '/admin/reels/' + reelId, data);
  },

  async adminDelete(reelId) {
    return await _fetch('DELETE', '/admin/reels/' + reelId);
  },

  async adminTogglePause(reelId) {
    return await _fetch('PATCH', '/admin/reels/' + reelId + '/pause');
  },

  async adminEstimateReach(lgaIds, targetAllLgas) {
    return await _fetch('POST', '/admin/reels/reach', { lgaIds: lgaIds, targetAllLgas: !!targetAllLgas });
  },
};