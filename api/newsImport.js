/**
 * LagKonnect — News Import API (admin)
 * ============================================================
 * Wraps the review queue for externally sourced articles.
 *
 * The upstream provider is never called from the browser: the API key stays
 * in server/.env and every request here goes through our own backend.
 */

import { _fetch } from './_fetch.js?v=20260806a';

export const newsImport = {
  /**
   * Stories for review, annotated with what has already been approved or
   * dismissed.
   *
   * Two sources share this endpoint. `worldnews` is filtered by country and
   * date and costs a metered API call; `punch` scrapes a topic archive and
   * costs nothing.
   *
   * @param {{source?: 'worldnews'|'punch', country?: string, date?: string,
   *          topic?: string, pages?: number, refresh?: boolean}} opts
   */
  async feed({ source = 'worldnews', country = 'ng', date, topic, pages, refresh = false } = {}) {
    const qs = new URLSearchParams({ source });

    if (source === 'punch') {
      if (topic) qs.set('topic', topic);
      if (pages) qs.set('pages', String(pages));
    } else {
      qs.set('country', country);
      if (date) qs.set('date', date);
    }

    if (refresh) qs.set('refresh', '1');
    return await _fetch('GET', '/admin/news/import/feed?' + qs.toString());
  },

  /** Full text of one scraped article, for preview before publishing. */
  async story(url) {
    return await _fetch('GET', '/admin/news/import/story?url=' + encodeURIComponent(url));
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
