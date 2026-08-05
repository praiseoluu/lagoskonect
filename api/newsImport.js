/**
 * LagKonnect — News Import API (admin)
 * ============================================================
 * Wraps the review queue for externally sourced articles.
 *
 * The upstream provider is never called from the browser: the API key stays
 * in server/.env and every request here goes through our own backend.
 */

import { _fetch } from './_fetch.js?v=20260805c';

export const newsImport = {
  /**
   * Top stories for a country and date, annotated with what has already been
   * approved or dismissed.
   *
   * @param {{country?: string, date?: string, refresh?: boolean}} opts
   */
  async feed({ country = 'ng', date, refresh = false } = {}) {
    const qs = new URLSearchParams({ country });
    if (date) qs.set('date', date);
    if (refresh) qs.set('refresh', '1');
    return await _fetch('GET', '/admin/news/import/feed?' + qs.toString());
  },

  /** Remaining daily call budget, without spending one. */
  async quota() {
    return await _fetch('GET', '/admin/news/import/quota');
  },

  /** Publishes an article. This is the only call that makes it public. */
  async approve(article) {
    return await _fetch('POST', '/admin/news/import/approve', article);
  },

  /** Hides an article from future fetches. */
  async dismiss(externalId) {
    return await _fetch('POST', '/admin/news/import/dismiss', { externalId });
  },

  /** Undoes a dismissal. */
  async restore(externalId) {
    return await _fetch('POST', '/admin/news/import/restore', { externalId });
  },
};
