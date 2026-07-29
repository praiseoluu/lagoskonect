/**
 * KTG Connect — Reels Page
 * Route: /reels
 * Guards: requireAuth + requireCitizen
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js';
import { Button } from '../../../components/base/Button.js';
import { Avatar } from '../../../components/base/UI.js';
import { store, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { timeAgo } from '../../../utils/date.js';
import { t } from '../../../core/i18n.js';

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export default class ReelsPage extends WebLayout {
  static styles = '/pages/web/app/Reels.css';

  constructor(props) {
    super({ title: t('reels.title'), ...props });
    this._reels = [];
    this._adverts = [];
    this._page = 1;
    this._perPage = 6;
    this._totalPages = 0;
    this._loadMoreBtn = null;
  }

  getContent() {
    return `
      <div class="reels-page" id="reels-root">
        <h1 class="reels-page__title">${this.esc(t('reels.title'))}</h1>
        <div class="reels-grid" id="reels-grid">
          ${[1, 2, 3, 4, 5, 6].map(() => `
            <div class="reel-card reel-card--skeleton">
              <div class="reel-card__thumb skeleton-block"></div>
            </div>
          `).join('')}
        </div>
        <div class="reels-page__load-more" id="load-more-mount"></div>
      </div>
    `;
  }

  async onContentReady() {
    setPageLoading(true);
    const [, advertsRes] = await Promise.all([
      this._loadPage(),
      api.adverts.getForLGA('feed'),
    ]);
    this._adverts = advertsRes.data || [];
    setPageLoading(false);

    this._loadMoreBtn = this.addChild(new Button({
      label: t('reels.loadMore'),
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
      iconPosition: 'left',
      variant: 'secondary',
      size: 'md',
      onClick: () => this._handleLoadMore(),
    }));
    const mount = this.getContentEl()?.querySelector('#load-more-mount');
    if (mount) await this._loadMoreBtn.mount(mount);
    this._updateLoadMore();

    // Single delegated listener — covers all cards including future ones
    this.delegate('.reel-card[data-reel-id]:not(.reel-ad-card)', 'click', (e, card) => {
      if (e.target.closest('a')) return; // let author link navigate normally
      router.push(`/reels/${card.dataset.reelId}`);
    });
  }

  // ── Data ─────────────────────────────────────────────────────────────

  async _loadPage() {
    const res = await api.reels.getForLGA({ page: this._page, perPage: this._perPage });
    if (res.error) return;

    this._totalPages = res.meta?.totalPages ?? 0;

    if (this._page === 1) {
      this._reels = res.data || [];
      this._renderGrid(this._reels);
    } else {
      this._reels = [...this._reels, ...(res.data || [])];
      this._appendCards(res.data || []);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  _renderGrid(reels) {
    const grid = this.getContentEl()?.querySelector('#reels-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!reels.length) {
      const isDisabled = this._totalPages === 0;
      grid.innerHTML = `
        <div class="reels-page__empty">
          <p>${this.esc(isDisabled ? t('reels.unavailable') : t('reels.empty'))}</p>
        </div>
      `;
      return;
    }
    this._appendCards(reels);
  }

  _appendCards(reels) {
    const grid = this.getContentEl()?.querySelector('#reels-grid');
    if (!grid) return;

    const existingCount = grid.querySelectorAll('.reel-card:not(.reel-ad-card)').length;
    let adIndex = 0;

    for (let i = 0; i < reels.length; i++) {
      const reel = reels[i];
      const slotNum = existingCount + i + 1;

      // Inject ad every 6th slot
      if (slotNum > 1 && (slotNum - 1) % 4 === 0 && this._adverts.length > 0) {
        const ad = this._adverts[adIndex % this._adverts.length];
        grid.appendChild(this._buildAdCard(ad));
        adIndex++;
      }

      const card = document.createElement('div');
      card.className = 'reel-card';
      card.dataset.reelId = reel.reelId;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', t('reels.playAria', { caption: reel.caption || '' }));

      const avatarHtml = Avatar.html({
        name: reel.authorName,
        imageUrl: reel.authorAvatarUrl,
        size: 'xs',
      });

      card.innerHTML = `
        <div class="reel-card__thumb-wrap">
          ${reel.thumbnailUrl
          ? `<img src="${reel.thumbnailUrl}" alt="" class="reel-card__thumb" loading="lazy" />`
          : `<div class="reel-card__thumb-placeholder" data-lga="${reel.lgaName}" aria-hidden="true"></div>`
      }
          <div class="reel-card__author">
            ${avatarHtml}
            <a class="reel-card__author-name" href="/u/${reel.authorHandle ? this.esc(reel.authorHandle.replace('@','')) : this.esc(reel.authorName)}">${this.esc(reel.authorName)}</a>
          </div>
        </div>
        <div class="reel-card__body">
          <p class="reel-card__title">${reel.caption}</p>
          <div class="reel-card__meta">
            <span class="reel-card__views">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              ${formatCount(reel.views)}
            </span>
            <span class="reel-card__time">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              ${timeAgo(reel.publishedAt || reel.createdAt)}
            </span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    }
  }

  _buildAdCard(ad) {
    const card = document.createElement('div');
    card.className = 'reel-card reel-ad-card';
    card.dataset.advertId = ad.id;

    const imgHtml = ad.imageUrl
        ? `<img src="${ad.imageUrl}" alt="${ad.title}" class="reel-card__thumb" loading="lazy" />`
        : `<div class="reel-card__thumb-placeholder reel-ad-card__placeholder" aria-hidden="true"></div>`;

    card.innerHTML = `
      <div class="reel-card__thumb-wrap">
        ${imgHtml}
        <span class="reel-ad-card__sponsored-badge">${this.esc(t('reels.sponsored'))}</span>
      </div>
      <div class="reel-card__body reel-ad-card__body">
        <p class="reel-ad-card__advertiser">${ad.advertiser || ''}</p>
        <p class="reel-card__title">${ad.title}</p>
        ${ad.ctaUrl ? `
          <a href="${ad.ctaUrl}" class="reel-ad-card__cta"
             target="_blank" rel="noopener noreferrer"
             data-ad-cta="${ad.id}">
            ${this.esc(ad.ctaLabel || t('reels.learnMore'))} →
          </a>` : ''}
      </div>
    `;

    const ctaEl = card.querySelector('[data-ad-cta]');
    if (ctaEl) {
      ctaEl.addEventListener('click', (e) => {
        e.stopPropagation();
        api.adverts.recordClick(ad.id);
      });
    }

    return card;
  }

  // ── Load More ─────────────────────────────────────────────────────────

  async _handleLoadMore() {
    if (this._page >= this._totalPages) return;
    this._page += 1;
    this._loadMoreBtn?.setLoading(true);
    await this._loadPage();
    this._loadMoreBtn?.setLoading(false);
    this._updateLoadMore();
  }

  _updateLoadMore() {
    const mount = this.getContentEl()?.querySelector('#load-more-mount');
    if (!mount) return;
    mount.hidden = this._totalPages === 0 || this._page >= this._totalPages;
  }
}
