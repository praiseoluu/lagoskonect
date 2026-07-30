/**
 * Lagos Konect — Reels Feed (generic / no-region route)
 * ============================================================
 * TikTok / Instagram-style continuous vertical feed.
 * Videos auto-play when scrolled into view; tap to pause/resume.
 *
 * Route:   /reels
 * Guards:  requireAuth + requireCitizen
 */

import { WebLayout }                          from '../../../components/layout/BaseLayout.js';
import { store, showToast, setPageLoading }   from '../../../core/store.js';
import { router }                             from '../../../core/router.js';
import { api }                                from '../../../api/client.js';
import { timeAgo }                            from '../../../utils/date.js';
import { t }                                  from '../../../core/i18n.js';

const REGION_PREFIX = '';

function fmtCount(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export default class ReelsPage extends WebLayout {
  static styles = '/pages/web/app/Reels.css';

  constructor(props) {
    super({ title: t('reels.title'), ...props });
    this._reels         = [];
    this._page          = 1;
    this._perPage       = 8;
    this._totalPages    = 0;
    this._loading       = false;
    this._videoObserver = null;
    this._sentinelObs   = null;
    this._likedSet      = new Set();
  }

  /* ── Shell ────────────────────────────────────────────────────────────── */

  getContent() {
    return `
      <div class="rf-wrap" id="rf-wrap">
        <div class="rf-feed" id="rf-feed" role="list"
             aria-label="${this.esc(t('reels.title'))}">
          ${[1, 2, 3].map(() =>
            '<div class="rf-item rf-item--skeleton" role="presentation" aria-hidden="true"></div>'
          ).join('')}
        </div>
        <div id="rf-sentinel" aria-hidden="true" style="height:1px;"></div>
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  async onContentReady() {
    setPageLoading(true);
    await this._fetchPage();
    setPageLoading(false);
    this._setupVideoObserver();
    this._setupSentinel();
    this._bindEvents();
  }

  beforeUnmount() {
    this._videoObserver?.disconnect();
    this._sentinelObs?.disconnect();
    this._videoObserver = null;
    this._sentinelObs   = null;
    this._feedEl()?.querySelectorAll('video').forEach(v => v.pause());
  }

  /* ── Data ─────────────────────────────────────────────────────────────── */

  async _fetchPage() {
    if (this._loading) return;
    this._loading = true;
    const res = await api.reels.getForLGA({ page: this._page, perPage: this._perPage });
    this._loading = false;
    if (res.error) return;
    this._totalPages = res.meta?.totalPages ?? 0;
    const items = res.data || [];
    if (this._page === 1) {
      this._reels = items;
      this._renderAll(items);
    } else {
      this._reels = [...this._reels, ...items];
      this._appendItems(items);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  _renderAll(reels) {
    const feed = this._feedEl();
    if (!feed) return;
    feed.innerHTML = '';
    if (!reels.length) {
      feed.innerHTML = `
        <div class="rf-empty">
          <p>${this.esc(t('reels.empty') || 'No reels yet for your LGA.')}</p>
        </div>`;
      return;
    }
    this._appendItems(reels);
  }

  _appendItems(reels) {
    const feed = this._feedEl();
    if (!feed) return;
    for (const reel of reels) {
      const el = this._buildItem(reel);
      feed.appendChild(el);
      this._videoObserver?.observe(el);
    }
  }

  _buildItem(reel) {
    const el        = document.createElement('div');
    el.className    = 'rf-item';
    el.dataset.reelId = reel.reelId;
    el.setAttribute('role', 'listitem');

    const isLiked  = !!reel.isLiked;
    if (isLiked) this._likedSet.add(reel.reelId);

    const caption  = this.esc(reel.caption || reel.title || '');
    const author   = this.esc(reel.authorName || '');
    const initial  = author ? author[0].toUpperCase() : '?';
    const timeStr  = reel.publishedAt ? this.esc(timeAgo(reel.publishedAt)) : '';
    const likes    = fmtCount(reel.likeCount    ?? 0);
    const comments = fmtCount(reel.commentCount ?? 0);
    const hasVideo = !!reel.videoUrl;
    const thumb    = reel.thumbnailUrl ? this.esc(reel.thumbnailUrl) : '';

    let mediaHtml;
    if (hasVideo) {
      mediaHtml = `
        <video class="rf-item__video"
               src="${this.esc(reel.videoUrl)}"
               loop muted playsinline preload="metadata"
               ${thumb ? `poster="${thumb}"` : ''}
               aria-label="${caption || 'Video reel'}"></video>
        <div class="rf-item__pause-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="white" width="36" height="36" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </div>`;
    } else if (thumb) {
      mediaHtml = `<img class="rf-item__thumb" src="${thumb}" alt="" loading="lazy">`;
    } else {
      mediaHtml = `<div class="rf-item__thumb-placeholder"></div>`;
    }

    el.innerHTML = `
      ${mediaHtml}
      <div class="rf-item__overlay" aria-hidden="true"></div>
      <div class="rf-item__controls">
        <div class="rf-item__info">
          <div class="rf-item__author">
            <span class="rf-item__avatar" aria-hidden="true">${initial}</span>
            <span class="rf-item__author-name">${author}</span>
            ${timeStr ? `<span class="rf-item__time">${timeStr}</span>` : ''}
          </div>
          ${caption ? `<p class="rf-item__caption">${caption}</p>` : ''}
        </div>
        <div class="rf-item__actions">
          <button class="rf-item__btn${isLiked ? ' rf-item__btn--liked' : ''}"
                  data-action="like"
                  aria-label="${isLiked ? 'Unlike' : 'Like'}"
                  aria-pressed="${isLiked}">
            <svg viewBox="0 0 24 24" width="28" height="28"
                 fill="${isLiked ? 'currentColor' : 'none'}"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span class="rf-item__btn-count" data-like-count>${likes}</span>
          </button>
          <button class="rf-item__btn" data-action="comment"
                  aria-label="View ${comments} comments">
            <svg viewBox="0 0 24 24" width="26" height="26"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="rf-item__btn-count">${comments}</span>
          </button>
        </div>
      </div>
      <button class="rf-item__tap"
              data-action="${hasVideo ? 'playpause' : 'open'}"
              aria-label="${hasVideo ? 'Play or pause video' : 'Open reel'}"
              tabindex="0"></button>
    `;

    return el;
  }

  /* ── Events ───────────────────────────────────────────────────────────── */

  _bindEvents() {
    const wrap = this._wrapEl();
    if (!wrap) return;

    wrap.addEventListener('click', (e) => {
      const btn    = e.target.closest('[data-action]');
      if (!btn) return;
      const item   = btn.closest('.rf-item[data-reel-id]');
      if (!item) return;
      const reelId = item.dataset.reelId;

      switch (btn.dataset.action) {
        case 'like':      e.stopPropagation(); this._toggleLike(item, reelId); break;
        case 'comment':   e.stopPropagation(); router.push(`${REGION_PREFIX}/reels/${reelId}`); break;
        case 'open':      router.push(`${REGION_PREFIX}/reels/${reelId}`); break;
        case 'playpause': this._togglePlay(item); break;
      }
    });
  }

  async _toggleLike(item, reelId) {
    const reel  = this._reels.find(r => r.reelId === reelId);
    if (!reel) return;
    const liked  = this._likedSet.has(reelId);
    const btn    = item.querySelector('[data-action="like"]');
    const cntEl  = item.querySelector('[data-like-count]');
    const svg    = btn?.querySelector('svg');
    const delta  = liked ? -1 : 1;

    reel.likeCount = (reel.likeCount ?? 0) + delta;
    if (!liked) {
      this._likedSet.add(reelId);
      btn?.classList.add('rf-item__btn--liked');
      btn?.setAttribute('aria-pressed', 'true');
      btn?.setAttribute('aria-label', 'Unlike');
      svg?.setAttribute('fill', 'currentColor');
    } else {
      this._likedSet.delete(reelId);
      btn?.classList.remove('rf-item__btn--liked');
      btn?.setAttribute('aria-pressed', 'false');
      btn?.setAttribute('aria-label', 'Like');
      svg?.setAttribute('fill', 'none');
    }
    if (cntEl) cntEl.textContent = fmtCount(reel.likeCount);

    const res = await api.reels.toggleLike(reelId);
    if (res.error) {
      reel.likeCount -= delta;
      if (!liked) {
        this._likedSet.delete(reelId); btn?.classList.remove('rf-item__btn--liked');
        btn?.setAttribute('aria-pressed', 'false'); svg?.setAttribute('fill', 'none');
      } else {
        this._likedSet.add(reelId); btn?.classList.add('rf-item__btn--liked');
        btn?.setAttribute('aria-pressed', 'true'); svg?.setAttribute('fill', 'currentColor');
      }
      if (cntEl) cntEl.textContent = fmtCount(reel.likeCount);
      showToast('error', 'Could not update like. Please try again.');
    }
  }

  _togglePlay(item) {
    const video    = item.querySelector('video');
    const pauseIco = item.querySelector('.rf-item__pause-icon');
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
      if (pauseIco) {
        pauseIco.classList.add('rf-item__pause-icon--show');
        setTimeout(() => pauseIco.classList.remove('rf-item__pause-icon--show'), 900);
      }
    }
  }

  /* ── Video auto-play observer ─────────────────────────────────────────── */

  _setupVideoObserver() {
    this._videoObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target.querySelector('video');
        if (!video) continue;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    }, { threshold: 0.6 });

    this._feedEl()?.querySelectorAll('.rf-item').forEach(el => {
      this._videoObserver.observe(el);
    });
  }

  /* ── Infinite scroll ──────────────────────────────────────────────────── */

  _setupSentinel() {
    const sentinel = this.getContentEl()?.querySelector('#rf-sentinel');
    if (!sentinel) return;

    this._sentinelObs = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return;
      if (this._page >= this._totalPages) { sentinel.style.display = 'none'; return; }
      this._page++;
      await this._fetchPage();
      if (this._page >= this._totalPages) sentinel.style.display = 'none';
    }, { rootMargin: '400px' });

    this._sentinelObs.observe(sentinel);
    if (this._totalPages <= 1) sentinel.style.display = 'none';
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  _feedEl() { return this.getContentEl()?.querySelector('#rf-feed'); }
  _wrapEl() { return this.getContentEl()?.querySelector('#rf-wrap'); }
}
