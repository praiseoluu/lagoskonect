/**
 * Lagos Konect — Import News (admin)
 * Route: /admin/news/import
 * ============================================================
 * Review queue for articles pulled from World News API.
 *
 * Nothing here is public. Fetched articles are shown for review only, and an
 * article becomes visible to citizens exactly when an admin presses Publish on
 * it. Dismiss hides an article from later fetches.
 *
 * The provider is on a free tier with a small daily allowance, so results are
 * cached server-side per country and date. Changing the filters reads from
 * cache; only "Force refresh" spends a call.
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260805b';
import { showToast, setPageLoading } from '../../../core/store.js';
import { api } from '../../../api/client.js';
import { BASE_URL } from '../../../api/_fetch.js';
import { formatDateTime } from '../../../utils/date.js';

const COUNTRIES = [
  { code: 'ng', label: 'Nigeria' },
  { code: 'gh', label: 'Ghana' },
  { code: 'za', label: 'South Africa' },
  { code: 'ke', label: 'Kenya' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'us', label: 'United States' },
];

const CATEGORIES = ['General', 'Politics', 'Business', 'Sports', 'Technology', 'Health', 'Entertainment'];

const ICON_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICON_X = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_LINK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

export default class NewsImportPage extends AdminLayout {
  static styles = '/pages/admin/app/NewsImport.css';

  constructor(props) {
    super({ title: 'Import News', ...props });
    this._articles = [];
    this._quota    = null;
    this._meta     = null;
    this._country  = 'ng';
    this._date     = new Date().toISOString().slice(0, 10);
    this._showHandled = false;
  }

  getContent() {
    return `<div class="ni-page" id="ni-root"></div>`;
  }

  async onContentReady() {
    this._renderShell();
    await this._load(false);
  }

  /* ── Shell ──────────────────────────────────────────────────────────── */

  _renderShell() {
    const root = this.getContentEl()?.querySelector('#ni-root');
    if (!root) return;

    root.innerHTML = `
      <header class="ni-header">
        <div>
          <p class="ni-eyebrow">News Desk</p>
          <h1 class="ni-title">Import News</h1>
          <p class="ni-sub">
            Review stories from World News API. Nothing reaches citizens until you publish it.
          </p>
        </div>
        <div class="ni-quota" id="ni-quota"></div>
      </header>

      <div class="ni-controls">
        <label class="ni-field">
          <span class="ni-field__label">Country</span>
          <select class="ni-select" id="ni-country">
            ${COUNTRIES.map(c => `
              <option value="${c.code}" ${c.code === this._country ? 'selected' : ''}>${c.label}</option>
            `).join('')}
          </select>
        </label>

        <label class="ni-field">
          <span class="ni-field__label">Date</span>
          <input type="date" class="ni-input" id="ni-date"
                 value="${this._date}" max="${new Date().toISOString().slice(0, 10)}" />
        </label>

        <button class="ni-btn ni-btn--primary" id="ni-fetch" type="button">Load stories</button>
        <button class="ni-btn" id="ni-refresh" type="button"
                title="Ignores the cache and spends one API call">Force refresh</button>

        <label class="ni-toggle">
          <input type="checkbox" id="ni-show-handled" ${this._showHandled ? 'checked' : ''} />
          <span>Show published &amp; dismissed</span>
        </label>
      </div>

      <div class="ni-meta" id="ni-meta"></div>
      <div class="ni-list" id="ni-list"></div>
    `;

    root.querySelector('#ni-country')?.addEventListener('change', (e) => {
      this._country = e.target.value;
    });
    root.querySelector('#ni-date')?.addEventListener('change', (e) => {
      this._date = e.target.value;
    });
    root.querySelector('#ni-fetch')?.addEventListener('click', () => this._load(false));
    root.querySelector('#ni-refresh')?.addEventListener('click', () => this._load(true));
    root.querySelector('#ni-show-handled')?.addEventListener('change', (e) => {
      this._showHandled = e.target.checked;
      this._renderList();
    });

    this.delegate('[data-approve]', 'click', (e, btn) => this._approve(btn.dataset.approve, btn));
    this.delegate('[data-dismiss]', 'click', (e, btn) => this._dismiss(btn.dataset.dismiss));
    this.delegate('[data-restore]', 'click', (e, btn) => this._restore(btn.dataset.restore));
  }

  /* ── Data ───────────────────────────────────────────────────────────── */

  async _load(refresh) {
    setPageLoading(true);
    const listEl = this.getContentEl()?.querySelector('#ni-list');
    if (listEl) listEl.innerHTML = `<div class="ni-empty">Loading stories…</div>`;

    const res = await api.newsImport.feed({
      country: this._country,
      date:    this._date,
      refresh,
    });
    setPageLoading(false);

    if (res.error) {
      this._articles = [];
      if (listEl) {
        listEl.innerHTML = `<div class="ni-error">${this.esc(res.error.message || 'Could not load stories.')}</div>`;
      }
      showToast('error', res.error.message || 'Could not load stories.');
      return;
    }

    this._articles = res.data.articles || [];
    this._quota    = res.data.quota || null;
    this._meta     = { cached: res.data.cached, fetchedAt: res.data.fetchedAt };

    this._renderQuota();
    this._renderMeta();
    this._renderList();
  }

  _renderQuota() {
    const el = this.getContentEl()?.querySelector('#ni-quota');
    if (!el || !this._quota) return;

    const { remaining, dailyLimit } = this._quota;
    const low = remaining <= 3;

    el.innerHTML = `
      <span class="ni-quota__value ${low ? 'ni-quota__value--low' : ''}">${remaining}/${dailyLimit}</span>
      <span class="ni-quota__label">API calls left today</span>
    `;
  }

  _renderMeta() {
    const el = this.getContentEl()?.querySelector('#ni-meta');
    if (!el || !this._meta) return;

    el.innerHTML = this._meta.cached
      ? `<span class="ni-badge ni-badge--cached">From cache</span>
         <span>Fetched ${this.esc(formatDateTime(this._meta.fetchedAt))}. No API call was used.</span>`
      : `<span class="ni-badge ni-badge--live">Fresh</span>
         <span>Fetched just now. One API call was used.</span>`;
  }

  _visible() {
    return this._showHandled
      ? this._articles
      : this._articles.filter(a => !a.isImported && !a.isDismissed);
  }

  _renderList() {
    const el = this.getContentEl()?.querySelector('#ni-list');
    if (!el) return;

    const items = this._visible();

    if (!items.length) {
      el.innerHTML = `
        <div class="ni-empty">
          ${this._articles.length
            ? 'Every story for this day has been handled. Tick "Show published &amp; dismissed" to see them.'
            : 'No stories returned for that country and date.'}
        </div>`;
      return;
    }

    el.innerHTML = items.map(a => this._card(a)).join('');

    // Bound as a listener rather than an inline onerror attribute: the CSP
    // sets script-src without 'unsafe-inline', so inline handlers never run.
    el.querySelectorAll('.ni-card__media img').forEach((img) => {
      img.addEventListener('error', () => {
        img.closest('.ni-card')?.classList.add('ni-card--noimg');
      });
    });
  }

  _card(a) {
    const state = a.isImported ? 'published' : a.isDismissed ? 'dismissed' : 'pending';

    const actions = state === 'pending'
      ? `<button class="ni-btn ni-btn--approve" data-approve="${this.esc(a.externalId)}">
           ${ICON_CHECK} Publish
         </button>
         <button class="ni-btn ni-btn--dismiss" data-dismiss="${this.esc(a.externalId)}">
           ${ICON_X} Dismiss
         </button>`
      : state === 'dismissed'
        ? `<button class="ni-btn" data-restore="${this.esc(a.externalId)}">Restore</button>`
        : `<span class="ni-state ni-state--published">${ICON_CHECK} Published</span>`;

    // Article images come from arbitrary news domains, which the site's CSP
    // (img-src 'self' plus a short allowlist) blocks outright. Routing them
    // through our own origin makes them load. Items with no image, or whose
    // image 404s, drop the media track so the text uses the full width.
    const proxied = a.image
      ? `${BASE_URL}/admin/news/import/image?url=${encodeURIComponent(a.image)}`
      : '';

    return `
      <article class="ni-card ni-card--${state}${a.image ? '' : ' ni-card--noimg'}"
               data-id="${this.esc(a.externalId)}">
        ${a.image
          ? `<div class="ni-card__media">
               <img src="${this.esc(proxied)}" alt="" loading="lazy" />
             </div>`
          : ''}

        <div class="ni-card__body">
          <div class="ni-card__meta">
            <span class="ni-source">${this.esc(a.sourceName || 'Unknown source')}</span>
            ${a.publishDate ? `<span>${this.esc(formatDateTime(a.publishDate))}</span>` : ''}
            ${a.alsoCovered > 0 ? `<span class="ni-also">+${a.alsoCovered} more outlets</span>` : ''}
          </div>

          <h2 class="ni-card__title">${this.esc(a.title)}</h2>
          <p class="ni-card__summary">${this.esc((a.summary || a.text || '').slice(0, 320))}</p>

          <div class="ni-card__row">
            <label class="ni-field ni-field--inline">
              <span class="ni-field__label">Category</span>
              <select class="ni-select ni-select--sm" data-cat="${this.esc(a.externalId)}">
                ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </label>

            <label class="ni-toggle ni-toggle--sm">
              <input type="checkbox" data-breaking="${this.esc(a.externalId)}" />
              <span>Mark as breaking</span>
            </label>

            ${a.url
              ? `<a class="ni-link" href="${this.esc(a.url)}" target="_blank" rel="noopener noreferrer">
                   ${ICON_LINK} Read original
                 </a>`
              : ''}
          </div>

          <div class="ni-card__actions">${actions}</div>
        </div>
      </article>
    `;
  }

  /* ── Actions ────────────────────────────────────────────────────────── */

  async _approve(externalId, btn) {
    const a = this._articles.find(x => x.externalId === externalId);
    if (!a) return;

    const root     = this.getContentEl();
    const catEl    = root?.querySelector(`[data-cat="${CSS.escape(externalId)}"]`);
    const breakEl  = root?.querySelector(`[data-breaking="${CSS.escape(externalId)}"]`);

    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }

    const res = await api.newsImport.approve({
      externalId,
      title:      a.title,
      summary:    a.summary || '',
      body:       a.text || a.summary || '',
      imageUrl:   a.image || '',
      sourceUrl:  a.url || '',
      sourceName: a.sourceName || '',
      category:   catEl?.value || 'General',
      breaking:   !!breakEl?.checked,
    });

    if (res.error) {
      showToast('error', res.error.message || 'Could not publish that article.');
      if (btn) { btn.disabled = false; btn.innerHTML = `${ICON_CHECK} Publish`; }
      return;
    }

    a.isImported = true;
    a.newsId     = res.data.newsId;
    showToast('success', 'Published. Citizens can see it now.');
    this._renderList();
  }

  async _dismiss(externalId) {
    const a = this._articles.find(x => x.externalId === externalId);
    if (!a) return;

    const res = await api.newsImport.dismiss(externalId);
    if (res.error) {
      showToast('error', res.error.message || 'Could not dismiss that article.');
      return;
    }

    a.isDismissed = true;
    showToast('info', 'Dismissed. It will stay hidden from this list.');
    this._renderList();
  }

  async _restore(externalId) {
    const a = this._articles.find(x => x.externalId === externalId);
    if (!a) return;

    const res = await api.newsImport.restore(externalId);
    if (res.error) {
      showToast('error', res.error.message || 'Could not restore that article.');
      return;
    }

    a.isDismissed = false;
    this._renderList();
  }
}
