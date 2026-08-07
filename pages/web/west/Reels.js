/**
 * Lagos Konect — Reels Feed (West)
 * ============================================================
 * Light-theme vertical feed. Like / comment / share live below
 * the video. Comments open as an inline slide-up drawer — no
 * page navigation needed.
 *
 * Route:   /west/reels
 * Guards:  requireAuth + requireCitizen
 */

import { WebLayout }                          from '../../../components/layout/BaseLayout.js?v=20260806g';
import { store, showToast, setPageLoading }   from '../../../core/store.js?v=20260806g';
import { router }                             from '../../../core/router.js?v=20260806g';
import { api }                                from '../../../api/client.js?v=20260806g';
import { timeAgo }                            from '../../../utils/date.js?v=20260806g';
import { t }                                  from '../../../core/i18n.js?v=20260806g';

const REGION_PREFIX = '/west';

function fmtCount(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export default class ReelsPage extends WebLayout {
  static styles = '/pages/web/app/Reels.css?v=20260806g';

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
    this._setupNavArrows();
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
    const el = document.createElement('div');
    el.className      = 'rf-item';
    el.dataset.reelId = reel.reelId;
    el.setAttribute('role', 'listitem');

    const isLiked  = !!reel.isLiked;
    if (isLiked) this._likedSet.add(reel.reelId);

    const caption  = this.esc(reel.caption || reel.title || '');
    const author   = this.esc(reel.authorName || '');
    const initial  = author ? author[0].toUpperCase() : '?';
    const timeStr  = reel.publishedAt ? this.esc(timeAgo(reel.publishedAt)) : '';
    const likes    = fmtCount(reel.likes ?? 0);
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
        </div>
        <button class="rf-item__mute-btn" data-action="toggle-mute" aria-label="Unmute video">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
        </button>`;
    } else if (thumb) {
      mediaHtml = `<img class="rf-item__thumb" src="${thumb}" alt="" loading="lazy">`;
    } else {
      mediaHtml = `<div class="rf-item__thumb-placeholder"></div>`;
    }

    el.innerHTML = `
      <div class="rf-item__media">
        ${mediaHtml}

        <div class="rf-item__video-info" aria-hidden="true">
          <span class="rf-item__avatar">${initial}</span>
          <span class="rf-item__author-name">${author}</span>
          ${timeStr ? `<span class="rf-item__time">${timeStr}</span>` : ''}
        </div>

        ${caption ? `<p class="rf-item__caption">${caption}</p>` : ''}
        <button class="rf-item__tap"
                data-action="${hasVideo ? 'playpause' : 'open'}"
                aria-label="${hasVideo ? 'Play or pause video' : 'Open reel'}"
                tabindex="0"></button>

        <!-- Inline comment drawer -->
        <div class="rf-item__comment-drawer" id="cd-${reel.reelId}"
             role="dialog" aria-label="Comments" aria-hidden="true">
          <div class="rf-item__comment-drawer-handle">
            <p class="rf-item__comment-drawer-title">
              Comments <span data-comment-count>(${comments})</span>
            </p>
            <button class="rf-item__comment-close" data-action="close-comments"
                    aria-label="Close comments">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="rf-item__comments-list" id="cl-${reel.reelId}" role="list">
            <div class="rf-item__comment-loading">Loading comments…</div>
          </div>
          <div class="rf-item__comment-input-row">
            <input class="rf-item__comment-input" id="ci-${reel.reelId}"
                   type="text" placeholder="Add a comment…"
                   maxlength="500" autocomplete="off" />
            <button class="rf-item__comment-send" data-action="send-comment"
                    aria-label="Post comment">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="rf-item__below">
        <div class="rf-item__action-bar">
          <button class="rf-item__btn${isLiked ? ' rf-item__btn--liked' : ''}"
                  data-action="like"
                  aria-label="${isLiked ? 'Unlike' : 'Like'}"
                  aria-pressed="${isLiked}">
            <svg viewBox="0 0 24 24" width="20" height="20"
                 fill="${isLiked ? 'currentColor' : 'none'}"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span class="rf-item__btn-count" data-like-count>${likes}</span>
          </button>

          <button class="rf-item__btn" data-action="comment" aria-label="Comments">
            <svg viewBox="0 0 24 24" width="20" height="20"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="rf-item__btn-count">${comments}</span>
          </button>

          <button class="rf-item__btn rf-item__btn--share" data-action="share"
                  aria-label="Share reel">
            <svg viewBox="0 0 24 24" width="20" height="20"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="18" cy="5"  r="3"/>
              <circle cx="6"  cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49"/>
            </svg>
            Share
          </button>
        </div>
      </div>
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
        case 'like':           e.stopPropagation(); this._toggleLike(item, reelId); break;
        case 'comment':        e.stopPropagation(); this._toggleCommentDrawer(item, reelId); break;
        case 'close-comments': e.stopPropagation(); this._closeCommentDrawer(item); break;
        case 'send-comment':   e.stopPropagation(); this._sendComment(item, reelId); break;
        case 'share':          e.stopPropagation(); this._shareReel(reelId); break;
        case 'open':           router.push(`${REGION_PREFIX}/reels/${reelId}`); break;
        case 'playpause':      this._togglePlay(item); break;
        case 'toggle-mute':    e.stopPropagation(); this._toggleMute(item); break;
      }
    });

    // Enter key submits comment
    wrap.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const input = e.target.closest('.rf-item__comment-input');
      if (!input) return;
      const item = input.closest('.rf-item[data-reel-id]');
      if (!item) return;
      e.preventDefault();
      this._sendComment(item, item.dataset.reelId);
    });
  }

  /* ── Like ─────────────────────────────────────────────────────────────── */

  /* ── Up / down navigation (desktop) ───────────────────────────────────── */

  /**
   * Explicit previous/next controls for mouse users, who have no swipe. The
   * feed already snaps, so each press just scrolls one reel and lets the snap
   * settle it. Hidden on touch by CSS, where the feed is swiped directly.
   */
  _setupNavArrows() {
    const wrap = this._wrapEl();
    const feed = this._feedEl();
    if (!wrap || !feed || wrap.querySelector('.rf-nav')) return;

    const nav = document.createElement('div');
    nav.className = 'rf-nav';
    nav.innerHTML = `
      <button class="rf-nav__btn" data-nav="prev" type="button" aria-label="Previous reel">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button class="rf-nav__btn" data-nav="next" type="button" aria-label="Next reel">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>`;
    wrap.appendChild(nav);

    const step = (dir) => {
      const items = [...feed.querySelectorAll('.rf-item')];
      if (!items.length) return;
      // The reel filling the middle of the viewport is the current one.
      const mid = feed.scrollTop + feed.clientHeight / 2;
      let idx = items.findIndex(it => it.offsetTop <= mid && it.offsetTop + it.offsetHeight > mid);
      if (idx < 0) idx = 0;
      const next = items[Math.min(items.length - 1, Math.max(0, idx + dir))];
      next?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nav]');
      if (btn) step(btn.dataset.nav === 'next' ? 1 : -1);
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

    reel.likes = (reel.likes ?? 0) + delta;
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
    if (cntEl) cntEl.textContent = fmtCount(reel.likes);

    api.reels.toggleLike(reelId);
  }

  /* ── Inline comment drawer ────────────────────────────────────────────── */

  async _toggleCommentDrawer(item, reelId) {
    const drawer = item.querySelector(`#cd-${reelId}`);
    if (!drawer) return;
    if (drawer.classList.contains('rf-item__comment-drawer--open')) {
      this._closeCommentDrawer(item);
    } else {
      drawer.classList.add('rf-item__comment-drawer--open');
      drawer.setAttribute('aria-hidden', 'false');
      if (!drawer.dataset.loaded) {
        await this._loadComments(item, reelId);
        drawer.dataset.loaded = '1';
      }
      item.querySelector(`#ci-${reelId}`)?.focus();
    }
  }

  _closeCommentDrawer(item) {
    const drawer = item.querySelector('.rf-item__comment-drawer');
    if (!drawer) return;
    drawer.classList.remove('rf-item__comment-drawer--open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  async _loadComments(item, reelId) {
    const list = item.querySelector(`#cl-${reelId}`);
    if (!list) return;
    const res = await api.reels.getComments(reelId, { perPage: 20 });
    if (res.error || !res.data?.length) {
      list.innerHTML = '<div class="rf-item__comment-empty">No comments yet. Be the first!</div>';
      return;
    }
    list.innerHTML = res.data.map(c => `
      <div class="rf-item__comment-item" role="listitem">
        <div class="rf-item__comment-avatar">${c.avatarUrl ? `<img class="rf-item__comment-avatar-img" src="${this.esc(c.avatarUrl)}" alt="">` : this.esc((c.userName || c.authorName || c.author || '?').charAt(0).toUpperCase())}</div>
        <div class="rf-item__comment-body">
          <div class="rf-item__comment-author">${this.esc(c.userName || c.authorName || c.author || 'Anonymous')}</div>
          <p class="rf-item__comment-text">${this.esc(c.text || c.content || '')}</p>
          <div class="rf-item__comment-time">${c.createdAt ? this.esc(timeAgo(c.createdAt)) : ''}</div>
        </div>
      </div>
    `).join('');
  }

  async _sendComment(item, reelId) {
    const input   = item.querySelector(`#ci-${reelId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Optimistic: insert comment immediately, then sync to server
    input.value = '';

    const list = item.querySelector(`#cl-${reelId}`);
    if (list) {
      list.querySelector('.rf-item__comment-empty')?.remove();
      const name = store.currentUser?.name || 'You';
      const node = document.createElement('div');
      node.className = 'rf-item__comment-item';
      node.setAttribute('role', 'listitem');
      node.innerHTML = `
        <div class="rf-item__comment-avatar">${store.currentUser?.avatarUrl ? `<img class="rf-item__comment-avatar-img" src="${this.esc(store.currentUser.avatarUrl)}" alt="">` : this.esc(name.charAt(0).toUpperCase())}</div>
        <div class="rf-item__comment-body">
          <div class="rf-item__comment-author">${this.esc(name)}</div>
          <p class="rf-item__comment-text">${this.esc(text)}</p>
          <div class="rf-item__comment-time">Just now</div>
        </div>
      `;
      list.insertBefore(node, list.firstChild);
      list.scrollTop = 0;
    }

    const reel = this._reels.find(r => r.reelId === reelId);
    if (reel) {
      reel.commentCount = (reel.commentCount ?? 0) + 1;
      const cntEl   = item.querySelector('[data-action="comment"] .rf-item__btn-count');
      const cntBadge = item.querySelector('[data-comment-count]');
      if (cntEl)   cntEl.textContent   = fmtCount(reel.commentCount);
      if (cntBadge) cntBadge.textContent = `(${fmtCount(reel.commentCount)})`;
    }
    api.reels.addComment(reelId, text);
  }

  /* ── Share ────────────────────────────────────────────────────────────── */

  _shareReel(reelId) {
    const reel  = this._reels.find(r => r.reelId === reelId);
    const url   = `${window.location.origin}${REGION_PREFIX}/reels/${reelId}`;
    const title = reel?.caption || reel?.title || 'Check out this reel on Lagos Konect';
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url)
        .then(() => showToast('success', 'Link copied to clipboard!'))
        .catch(() => showToast('info', `Share: ${url}`));
    }
  }

  /* ── Play / pause ─────────────────────────────────────────────────────── */

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

  _toggleMute(item) {
    const video = item.querySelector('video');
    const btn   = item.querySelector('[data-action="toggle-mute"]');
    if (!video || !btn) return;
    video.muted = !video.muted;
    btn.setAttribute('aria-label', video.muted ? 'Unmute video' : 'Mute video');
    btn.innerHTML = video.muted
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  }

  _setupVideoObserver() {
    this._videoObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target.querySelector('video');
        if (!video) continue;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
          this._closeCommentDrawer(entry.target);
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
