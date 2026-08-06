/**
 * Lagos Konnect - News Detail Page
 * Route: /news/:slug
 * Guards: requireAuth + requireCitizen
 *
 * Layout: newspaper style.
 *   1. Back link
 *   2. Hero image (standalone — no overlay text)
 *   3. Badges, title, meta bar
 *   4. Body (markdown rendered via marked.js)
 *   5. Source link
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260806b';
import { Badge } from '../../../components/base/Badge.js?v=20260806b';
import { setPageLoading } from '../../../core/store.js?v=20260806b';
import { router } from '../../../core/router.js?v=20260806b';
import { api } from '../../../api/client.js?v=20260806b';
import { formatDate } from '../../../utils/date.js?v=20260806b';
import { t, getLanguage } from '../../../core/i18n.js?v=20260806b';
import { translateArticleFull, needsTranslation, LANG_LABEL, FULL_SUPPORT } from '../../../utils/translator.js?v=20260806b';

export default class NewsDetailPage extends WebLayout {
  static styles = '/pages/web/app/NewsDetail.css?v=20260806b';
  static dependencies = ['/components/base/Badge.css']

  constructor(props) {
    super({ title: t('newsDetail.title'), ...props });
    this._article = null;
  }

  getContent() {
    return `<div id="news-detail-inner" class="news-detail-page">${this._renderSkeleton()}</div>`;
  }

  async onContentReady() {
    const slug = this.props.params?.slug;
    if (!slug) { router.replace('/news'); return; }

    setPageLoading(true);
    const res = await api.news.getBySlug(slug);
    setPageLoading(false);

    const inner = this.getContentEl()?.querySelector('#news-detail-inner');
    if (!inner) return;

    if (res.error || !res.data) {
      inner.innerHTML = `
        <div class="news-detail-not-found">
          <p>${this.esc(t('newsDetail.notFound'))}</p>
          <a href="/news" class="ktg-btn ktg-btn--ghost ktg-btn--md">← ${this.esc(t('newsDetail.backToNews'))}</a>
        </div>
      `;
      return;
    }

    // Translate full article if user has switched to a non-English language
    let article = res.data;
    const lang = getLanguage();
    if (needsTranslation(lang)) {
      article = await translateArticleFull(article, lang);
    }
    this._article = article;
    this.setTitle(article.title);
    await this._loadMarked();
    this._renderArticle(article, lang);
  }

  async _loadMarked() {
    if (window.marked) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }).catch(() => { });
  }

  _renderArticle(item, lang = 'en') {
    const inner = this.getContentEl()?.querySelector('#news-detail-inner');
    if (!inner) return;

    const bodyHtml = item.body
        ? (window.marked
            ? window.marked.parse(item.body)
            : this.esc(item.body).replace(/\n/g, '<br>'))
        : '';

    inner.innerHTML = `
      <div class="news-detail-container">

        <!-- Back link -->
        <a href="/news" class="news-detail-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          ${this.esc(t('newsDetail.backToNews'))}
        </a>

        <!-- Hero image — standalone, no text overlay -->
        <div class="news-detail-hero-wrap">
          ${item.imageUrl
        ? `<img class="news-detail-hero" src="${this.esc(item.imageUrl)}" alt="${this.esc(item.title)}" loading="eager" />`
        : `<div class="news-detail-hero-placeholder">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                   <rect x="2" y="2" width="20" height="20" rx="2"/>
                   <path d="m21 15-5-5L5 21"/><circle cx="8.5" cy="8.5" r="1.5"/>
                 </svg>
               </div>`
    }
        </div>

        <!-- Reading column: badges, title, meta, body -->
        <div class="news-detail-reading-col">

          <!-- Badges -->
          <div class="news-detail-badges">
            ${item.category ? Badge.html(item.category, Badge.variantFor(item.category)) : ''}
            ${item.isHeadline ? Badge.html(t('newsDetail.headline'), 'official', 'sm') : ''}
            ${item.breaking ? Badge.html(t('newsDetail.breaking'), 'security', 'sm') : ''}
            ${item.lgaName && !item.targetAllLgas ? Badge.html(item.lgaName, 'community', 'sm') : ''}
          </div>

          <!-- Title -->
          <h1 class="news-detail-title">${this.esc(item.title)}</h1>

          <!-- Meta bar -->
          <div class="news-detail-meta-bar">
            <div class="news-detail-meta">
              ${item.authorName
        ? `<span class="news-detail-meta__author">${this.esc(t('newsDetail.byAuthor', { name: item.authorName }))}</span>
                   <span class="news-detail-meta__divider"></span>`
        : ''}
              ${item.publishedAt || item.createdAt
        ? `<span class="news-detail-meta__item">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                     </svg>
                     ${formatDate(item.publishedAt || item.createdAt)}
                   </span>`
        : ''}
              ${item.views != null
        ? `<span class="news-detail-meta__divider"></span>
                   <span class="news-detail-meta__item">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                     </svg>
                     ${this.esc(t('newsDetail.views', { count: Number(item.views).toLocaleString() }))}
                   </span>`
        : ''}
            </div>
          </div>

          <!-- Translation notice -->
          ${lang && lang !== 'en' ? `
            <div class="news-detail-translation-notice">
              <span class="news-detail-translation-notice__icon">🌐</span>
              <span>Translated to <strong>${LANG_LABEL[lang] || lang}</strong>${!FULL_SUPPORT[lang] ? ' &middot; Partial support &mdash; some sections may remain in English' : ' &middot; Accuracy may vary'}</span>
            </div>` : ''}

          <!-- Body -->
          ${bodyHtml ? `<div class="news-detail-body">${bodyHtml}</div>` : ''}

          <!-- Source -->
          ${item.sourceUrl
        ? `<div class="news-detail-source">
                 <span>${this.esc(t('newsDetail.source'))}</span>
                 <a href="${this.esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
                   ${this.esc(item.sourceName || item.sourceUrl)}
                 </a>
               </div>`
        : ''}

        </div>
      </div>
    `;
  }

  _renderSkeleton() {
    return `
      <div class="news-detail-skeleton" aria-hidden="true">
        <div class="news-detail-skeleton__hero"></div>
        <div class="news-detail-skeleton__badge"></div>
        <div class="news-detail-skeleton__title"></div>
        <div class="news-detail-skeleton__title news-detail-skeleton__title--short"></div>
        <div class="news-detail-skeleton__meta"></div>
        <div class="news-detail-skeleton__body"></div>
        <div class="news-detail-skeleton__body"></div>
        <div class="news-detail-skeleton__body news-detail-skeleton__body--short"></div>
      </div>
    `;
  }
}
