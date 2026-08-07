/**
 * Lagos konnect — News Page
 * Route: /news
 * ============================================================
 * Featured hero = latest article with is_headline = true.
 * Falls back to newest article if no headline is set.
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260806e';
import { Button } from '../../../components/base/Button.js?v=20260806e';
import { router } from '../../../core/router.js?v=20260806e';
import { setPageLoading } from '../../../core/store.js?v=20260806e';
import { api } from '../../../api/client.js?v=20260806e';
import { t, getLanguage } from '../../../core/i18n.js?v=20260806e';
import { translateArticle, needsTranslation, LANG_LABEL } from '../../../utils/translator.js?v=20260806e';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

// Strips markdown syntax for plain-text display (grid excerpts, etc.)
function stripMarkdown(str) {
  if (!str) return '';
  return str
      .replace(/#{1,6}\s+/g, '')          // headings
      .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
      .replace(/\*(.+?)\*/g, '$1')        // italic
      .replace(/__(.+?)__/g, '$1')        // bold underscore
      .replace(/_(.+?)_/g, '$1')          // italic underscore
      .replace(/~~(.+?)~~/g, '$1')        // strikethrough
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code / code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label only
      .replace(/^>\s+/gm, '')             // blockquotes
      .replace(/^[-*+]\s+/gm, '')         // unordered list markers
      .replace(/^\d+\.\s+/gm, '')         // ordered list markers
      .replace(/\n+/g, ' ')               // collapse newlines
      .trim();
}

export default class NewsPage extends WebLayout {
  static styles = '/pages/web/app/News.css?v=20260806e';

  constructor(props) {
    super({ title: t('news.title'), ...props });
    this._featured = null;
    this._items = [];
    this._adverts = [];
    this._page = 1;
    this._perPage = 6;
    this._totalPages = 0;
    this._loadMoreBtn = null;
  }

  getContent() {
    return `
      <div class="news-page" id="news-root">
        <div class="news-hero news-hero--skeleton" id="news-hero">
          <div class="news-hero__img-wrap skeleton-block"></div>
          <div class="news-hero__content">
            <div class="skeleton-line skeleton-line--sm"></div>
            <div class="skeleton-line skeleton-line--lg"></div>
            <div class="skeleton-line skeleton-line--md"></div>
          </div>
        </div>
        <section class="news-news" aria-labelledby="news-news-heading">
          <div class="news-news__header">
            <div>
              <h2 class="news-news__title" id="news-news-heading">${this.esc(t('news.latestNews'))}</h2>
              <p class="news-news__subtitle">${this.esc(t('news.subtitle'))}</p>
            </div>
          </div>
          <div class="news-grid" id="news-grid">
            ${[1, 2, 3].map(() => `
              <div class="news-card news-card--skeleton">
                <div class="news-card__img skeleton-block"></div>
                <div class="news-card__body">
                  <div class="skeleton-line skeleton-line--md"></div>
                  <div class="skeleton-line skeleton-line--sm"></div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="news-news__load-more" id="load-more-mount"></div>
        </section>
      </div>
    `;
  }

  async onContentReady() {
    setPageLoading(true);
    const [, advertsRes] = await Promise.all([
      this._loadPage(),
      api.adverts.getForLGA('news'),
    ]);
    this._adverts = advertsRes.data || [];
    this._renderGrid(); // Re-render grid now that ads are populated (fixes race condition)
    setPageLoading(false);

    this._loadMoreBtn = this.addChild(new Button({
      label: t('news.loadMore'),
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
      iconPosition: 'left',
      variant: 'secondary',
      size: 'md',
      onClick: () => this._handleLoadMore(),
    }));
    const loadMoreMount = this.getContentEl()?.querySelector('#load-more-mount');
    if (loadMoreMount) await this._loadMoreBtn.mount(loadMoreMount);
    this._updateLoadMoreVisibility();

    this.delegate('.news-card:not(.news-ad-card)', 'click', (e, card) => {
      const slug = card.dataset.slug;
      if (slug) router.push(`/news/${slug}`);
    });

    this.delegate('.news-hero', 'click', () => {
      if (this._featured) router.push(`/news/${this._featured.slug}`);
    });
  }

  async _loadPage() {
    const res = await api.news.getAll({ page: this._page, perPage: this._perPage });
    if (res.error) return;

    const rawAll = res.data || [];
    this._totalPages = res.meta?.totalPages ?? 0;

    // Translate article previews when the user has switched language
    const lang = getLanguage();
    const all = needsTranslation(lang)
      ? await Promise.all(rawAll.map((a) => translateArticle(a, lang)))
      : rawAll;

    if (this._page === 1) {
      // Featured = latest headline article; fallback to first item if no headline set
      const featuredId = (rawAll.find((i) => i.isHeadline) || rawAll[0])?.id;
      this._featured = all.find((i) => i.id === featuredId) || all[0] || null;
      this._items   = all.filter((i) => i.id !== this._featured?.id);

      // Show/refresh a 'Translated to …' notice if applicable
      this._updateTranslationBanner(lang);
      this._renderHero();
      this._renderGrid();
    } else {
      this._items = [...this._items, ...all];
      this._appendCards(all);
    }
  }

  /** Insert or remove the translation notice above the news grid. */
  _updateTranslationBanner(lang) {
    const root = this.getContentEl();
    if (!root) return;
    const existing = root.querySelector('#news-translation-banner');
    if (existing) existing.remove();

    if (!needsTranslation(lang)) return;

    const label = LANG_LABEL[lang] || lang;
    const banner = document.createElement('div');
    banner.id = 'news-translation-banner';
    banner.className = 'news-translation-banner';
    banner.innerHTML = `
      <span class="news-translation-banner__icon">🌐</span>
      <span class="news-translation-banner__text">
        Headlines &amp; summaries translated to <strong>${label}</strong> &middot; Accuracy may vary
      </span>
    `;
    const section = root.querySelector('.news-news') || root.querySelector('.news-grid');
    if (section) section.insertAdjacentElement('beforebegin', banner);
  }

  _renderHero() {
    const heroEl = this.getContentEl()?.querySelector('#news-hero');
    if (!heroEl || !this._featured) return;
    const f = this._featured;
    heroEl.className = 'news-hero';
    heroEl.innerHTML = `
      <div class="news-hero__img-wrap">
        ${f.imageUrl
        ? `<img src="${this.esc(f.imageUrl)}" alt="${this.esc(f.title)}" class="news-hero__img" />`
        : `<div class="news-hero__img-placeholder" data-category="${this.esc(f.category)}" aria-hidden="true"></div>`
    }
      </div>
      <div class="news-hero__content">
        <div class="news-hero__meta">
          <span class="news-hero__badge">${this.esc(f.category)}</span>
          ${f.isHeadline ? `<span class="news-hero__badge news-hero__badge--headline">${this.esc(t('news.headline'))}</span>` : ''}
          ${f.breaking ? `<span class="news-hero__badge news-hero__badge--breaking">${this.esc(t('news.breaking'))}</span>` : ''}
          <span class="news-hero__date">${formatDate(f.publishedAt)}</span>
        </div>
        <h1 class="news-hero__title">${this.esc(f.title)}</h1>
        <p class="news-hero__summary">${this.esc(truncate(stripMarkdown(f.summary || f.body || ''), 160))}</p>
        <div class="news-hero__cta" id="hero-cta-mount"></div>
      </div>
    `;
    const ctaMount = heroEl.querySelector('#hero-cta-mount');
    if (ctaMount) {
      const ctaBtn = this.addChild(new Button({
        label: t('news.readFull'),
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
        iconPosition: 'right',
        variant: 'primary',
        size: 'md',
        onClick: () => router.push(`/news/${f.slug}`),
      }));
      ctaBtn.mount(ctaMount);
    }
  }

  _renderGrid() {
    const gridEl = this.getContentEl()?.querySelector('#news-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';
    this._appendCards(this._items);
  }

  _appendCards(items) {
    const gridEl = this.getContentEl()?.querySelector('#news-grid');
    if (!gridEl) return;

    // Count existing content cards (not ad cards) to determine slot position
    const existingCount = gridEl.querySelectorAll('.news-card:not(.news-ad-card)').length;
    let adIndex = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const slotNum = existingCount + i + 1; // 1-based position in grid

      // Inject ad before every 6th content card (slots 6, 12, 18...)
      if (slotNum > 1 && (slotNum - 1) % 4 === 0 && this._adverts.length > 0) {
        const ad = this._adverts[adIndex % this._adverts.length];
        gridEl.appendChild(this._buildAdCard(ad));
        adIndex++;
      }

      const card = document.createElement('div');
      card.className = 'news-card';
      card.dataset.slug = item.slug;
      card.innerHTML = `
        <div class="news-card__img-wrap">
          ${item.imageUrl
          ? `<img src="${this.esc(item.imageUrl)}" alt="" class="news-card__img" />`
          : `<div class="news-card__img-placeholder" data-category="${this.esc(item.category)}" aria-hidden="true"></div>`
      }
          <span class="news-card__badge">${this.esc(item.category)}</span>
          ${item.breaking ? `<span class="news-card__badge news-card__badge--breaking">${this.esc(t('news.breaking'))}</span>` : ''}
        </div>
        <div class="news-card__body">
          <h3 class="news-card__title">${this.esc(item.title)}</h3>
          <p class="news-card__excerpt">${this.esc(truncate(stripMarkdown(item.summary || item.body || ''), 90))}</p>
          <div class="news-card__footer">
            <span class="news-card__date">${formatDate(item.publishedAt)}</span>
            <span class="news-card__read-more">${this.esc(t('news.readMore'))}</span>
          </div>
        </div>
      `;
      gridEl.appendChild(card);
    }
  }

  _buildAdCard(ad) {
    const card = document.createElement('div');
    card.className = 'news-card news-ad-card';
    card.dataset.advertId = ad.id;

    const imgHtml = ad.imageUrl
        ? `<img src="${this.esc(ad.imageUrl)}" alt="${this.esc(ad.title)}" class="news-card__img" loading="lazy" />`
        : `<div class="news-card__img-placeholder news-ad-card__img-placeholder" aria-hidden="true"></div>`;

    card.innerHTML = `
      <div class="news-card__img-wrap">
        ${imgHtml}
        <span class="news-ad-card__sponsored-badge">${this.esc(t('news.sponsored'))}</span>
      </div>
      <div class="news-card__body news-ad-card__body">
        <p class="news-ad-card__advertiser">${this.esc(ad.advertiser || '')}</p>
        <h3 class="news-card__title">${this.esc(ad.title)}</h3>
        ${ad.description ? `<p class="news-card__excerpt">${this.esc(truncate(ad.description, 80))}</p>` : ''}
        ${ad.ctaUrl ? `
          <div class="news-card__footer">
            <a href="${this.esc(ad.ctaUrl)}" class="news-ad-card__cta"
               target="_blank" rel="noopener noreferrer"
               data-ad-cta="${ad.id}">
              ${this.esc(ad.ctaLabel || t('news.learnMore'))} →
            </a>
          </div>` : ''}
      </div>
    `;

    // Track click
    const ctaEl = card.querySelector('[data-ad-cta]');
    if (ctaEl) {
      ctaEl.addEventListener('click', () => {
        api.adverts.recordClick(ad.id);
      });
    }

    return card;
  }

  async _handleLoadMore() {
    if (this._page >= this._totalPages) return;
    this._page += 1;
    this._loadMoreBtn?.setLoading(true);
    await this._loadPage();
    this._loadMoreBtn?.setLoading(false);
    this._updateLoadMoreVisibility();
  }

  _updateLoadMoreVisibility() {
    const mount = this.getContentEl()?.querySelector('#load-more-mount');
    if (mount) mount.hidden = this._totalPages === 0 || this._page >= this._totalPages;
  }
}
