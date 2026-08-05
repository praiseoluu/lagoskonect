/**
 * Lagos Konnect - Reel Detail Page
 * Route: /reels/:reelId
 * Guards: requireAuth + requireCitizen
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260805b';
import { Avatar } from '../../../components/base/UI.js';
import { store, showToast, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { timeAgo } from '../../../utils/date.js';
import { t } from '../../../core/i18n.js';

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

const ICON_PLAY = `<polygon points="5 3 19 12 5 21 5 3"/>`;
const ICON_PAUSE = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
const ICON_MUTED = `<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>`;
const ICON_SOUND = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>`;

const REPORT_REASONS = [
  { value: 'Inappropriate', key: 'reasonInappropriate' },
  { value: 'Spam', key: 'reasonSpam' },
  { value: 'Misinformation', key: 'reasonMisinformation' },
  { value: 'Harassment', key: 'reasonHarassment' },
  { value: 'Violence', key: 'reasonViolence' },
  { value: 'Other', key: 'reasonOther' },
];

export default class ReelDetailPage extends WebLayout {
  static styles = '/pages/web/app/ReelDetail.css';

  constructor(props) {
    super({ title: t('reelDetail.title'), ...props });
    this._reel = null;
    this._comments = [];
    this._isLiked = false;
    this._isSubscribed = false;
    this._commentsOpen = false;
    this._videoEl = null;
    this._rafId = null;
    this._reportOpen = false;
    this._reportReason = null;
    this._reportSubmitting = false;
    /* ── Continuous-play state ── */
    this._adjacentReels      = [];
    this._currentReelIndex   = -1;
    this._nextCountdownTimer = null;
  }

  getContent() {
    return `
      <div class="reel-detail" id="reel-detail-root">
        ${this._renderSkeleton()}
      </div>
    `;
  }

  async onContentReady() {
    const reelId = this.props.params?.reelId;
    if (!reelId) { router.replace('/reels'); return; }

    setPageLoading(true);
    const [reelRes, commentsRes] = await Promise.all([
      api.reels.getByReelId(reelId),
      api.reels.getComments(reelId, { perPage: 50 }),
    ]);
    setPageLoading(false);

    // Load subscription state after we know the reel (checked after render)

    const root = this.getContentEl()?.querySelector('#reel-detail-root');
    if (!root) return;

    if (reelRes.error) {
      root.innerHTML = `
        <div class="reel-detail__not-found">
          <p>${this.esc(t('reelDetail.notFound'))}</p>
          <a href="/reels" class="ktg-btn ktg-btn--ghost ktg-btn--md">← ${this.esc(t('reelDetail.backToReels'))}</a>
        </div>
      `;
      return;
    }

    this._reel = reelRes.data;
    this._comments = commentsRes.data || [];
    this._loadAdjacentReels();
    this.setTitle(this._reel.caption || t('reelDetail.title'));
    this._render(root);

    // Load subscription state for non-own reels
    const isOwnReel = this._reel.authorId === store.currentUser?.id;
    if (!isOwnReel) {
      const subRes = await api.reels.getSubscription(this._reel.reelId);
      if (!subRes.error) {
        this._isSubscribed = subRes.data?.subscribed === true;
        this._updateBellUI(root);
      }
    }
  }

  // ── Main render ──────────────────────────────────────────────────────

  _render(root) {
    const reel = this._reel;

    const authorAvatarHtml = Avatar.html({
      name: reel.authorName,
      imageUrl: reel.authorAvatarUrl,
      size: 'sm',
    });

    // Don't show report button on own reels
    const isOwnReel = reel.authorId === store.currentUser?.id;

    root.innerHTML = `
      <a href="/reels" class="reel-detail__back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        ${this.esc(t('reelDetail.backToReels'))}
      </a>

      <div class="reel-detail__layout" id="reel-layout">

        <!-- ── Video column ── -->
        <div class="reel-detail__video-col" id="video-col">
          <div class="reel-player" id="reel-player">

            <video
              id="reel-video"
              class="reel-player__video"
              ${reel.videoUrl ? `src="${reel.videoUrl}"` : ''}
              ${reel.thumbnailUrl ? `poster="${reel.thumbnailUrl}"` : ''}
              playsinline autoplay muted preload="auto"
              aria-label="${this.esc(reel.caption || t('reelDetail.title'))}"
            ></video>

            <div class="reel-player__tap-area" id="tap-area" role="button" tabindex="0" aria-label="${this.esc(t('reelDetail.tapToPlayPause'))}"></div>

            <div class="reel-player__tap-icon" id="tap-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" id="tap-svg">
                ${ICON_PAUSE}
              </svg>
            </div>

            <!-- Action icons -->
            <div class="reel-player__actions">

              <button class="reel-player__action-btn" id="like-btn" type="button" aria-label="${this.esc(t('reelDetail.like'))}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="like-icon">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
                <span class="reel-player__action-count" id="like-count">${formatCount(reel.likes)}</span>
              </button>

              <button class="reel-player__action-btn" id="comment-toggle-btn" type="button" aria-label="${this.esc(t('reelDetail.toggleComments'))}" aria-expanded="false">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <span class="reel-player__action-count" id="comment-count">${formatCount(reel.commentCount)}</span>
              </button>

              <button class="reel-player__action-btn" id="share-btn" type="button" aria-label="${this.esc(t('reelDetail.share'))}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                <span class="reel-player__action-count">${formatCount(reel.shares)}</span>
              </button>

              ${!isOwnReel ? `
              <button class="reel-player__action-btn" id="report-btn" type="button" aria-label="${this.esc(t('reelDetail.reportReel'))}">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
              </button>
              ` : `
              <button class="reel-player__action-btn reel-player__action-btn--delete" id="delete-btn" type="button" aria-label="${this.esc(t('reelDetail.deleteReel'))}">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
              `}

            </div>

            <!-- Bottom overlay -->
            <div class="reel-player__bottom">
              <div class="reel-player__author">
                ${authorAvatarHtml}
                <div class="reel-player__author-info">
                  <a class="reel-player__author-name" href="/u/${reel.authorHandle ? this.esc(reel.authorHandle.replace('@','')) : this.esc(reel.authorName)}">${this.esc(reel.authorName)}</a>
                  ${reel.authorHandle
        ? `<span class="reel-player__author-handle">${this.esc(reel.authorHandle)} · ${timeAgo(reel.publishedAt)}</span>`
        : ''}
                </div>
                ${!isOwnReel ? `
                <button class="reel-player__bell-btn" id="bell-btn" type="button" aria-label="${this.esc(t('reelDetail.subscribe'))}" aria-pressed="false">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="bell-icon">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 01-3.46 0"/>
                  </svg>
                </button>
                ` : ''}
              </div>

              ${reel.caption ? `
                <p class="reel-player__caption">
                  ${this.esc(reel.caption)}
                  ${(reel.hashtags || []).map(h => `<span class="reel-player__hashtag">${this.esc(h)}</span>`).join(' ')}
                </p>
              ` : ''}

              <div class="reel-player__controls-row">
                <div class="reel-player__progress-wrap">
                  <div class="reel-player__progress-bar" id="progress-bar">
                    <div class="reel-player__progress-fill" id="progress-fill"></div>
                  </div>
                  <div class="reel-player__timestamps">
                    <span id="current-time">00:00</span>
                    <span id="total-time">00:00</span>
                  </div>
                </div>
                <button class="reel-player__mute-btn" id="mute-btn" type="button" aria-label="${this.esc(t('reelDetail.unmute'))}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="mute-icon">
                    ${ICON_MUTED}
                  </svg>
                </button>
              </div>
            </div>

            <!-- Continuous play: reel navigation -->
            <div class="reel-nav-arrows" id="reel-nav-arrows" role="group" aria-label="Reel navigation">
              <button class="reel-nav-arrow reel-nav-arrow--prev" id="prev-reel-btn" type="button" aria-label="Previous reel">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button class="reel-nav-arrow reel-nav-arrow--next" id="next-reel-btn" type="button" aria-label="Next reel">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>

            <!-- Auto-advance countdown overlay -->
            <div class="reel-next-overlay" id="reel-next-overlay" aria-hidden="true">
              <div class="reel-next-overlay__content">
                <p class="reel-next-overlay__label">Up next in <span id="next-countdown">3</span>s</p>
                <div class="reel-next-overlay__bar"><div class="reel-next-overlay__fill"></div></div>
                <div class="reel-next-overlay__actions">
                  <button class="reel-next-overlay__skip" id="next-skip-btn" type="button">Play now</button>
                  <button class="reel-next-overlay__cancel" id="next-cancel-btn" type="button">Cancel</button>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- ── Comments panel ── -->
        <div class="reel-detail__comments-panel" id="comments-panel" aria-hidden="true">

          <div class="reel-detail__drawer-handle" id="drawer-handle" aria-hidden="true">
            <span class="reel-detail__drawer-pill"></span>
          </div>

          <div class="reel-detail__comments-header">
            <h2 class="reel-detail__comments-title">${this.esc(t('reelDetail.comments'))}</h2>
            <span class="reel-detail__comments-count" id="comments-badge">${this.esc(t('reelDetail.commentsCount', { count: formatCount(reel.commentCount) }))}</span>
          </div>

          <div class="reel-detail__comments-list" id="comments-list">
            ${this._renderCommentsList(this._comments)}
          </div>

          <div class="reel-detail__comment-input-wrap">
            <input
              type="text"
              class="reel-detail__comment-input"
              id="comment-input"
              placeholder="${this.esc(t('reelDetail.addCommentPlaceholder'))}"
              autocomplete="off"
              maxlength="500"
              aria-label="${this.esc(t('reelDetail.addComment'))}"
            />
            <button class="reel-detail__comment-submit" id="comment-submit" type="button" aria-label="${this.esc(t('reelDetail.postComment'))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

        </div>

      </div>

      <!-- ── Report modal (body-level) ── -->
      <div class="reel-report-backdrop" id="report-backdrop" aria-hidden="true">
        <div class="reel-report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <h2 class="reel-report-modal__title" id="report-modal-title">${this.esc(t('reelDetail.reportTitle'))}</h2>
          <p class="reel-report-modal__subtitle">${this.esc(t('reelDetail.reportSubtitle'))}</p>
          <div class="reel-report-modal__reasons" id="report-reasons">
            ${REPORT_REASONS.map(r => `
              <button class="reel-report-reason" data-reason="${r.value}" type="button">
                <span class="reel-report-reason__radio"></span>
                ${this.esc(t('reelDetail.' + r.key))}
              </button>
            `).join('')}
          </div>
          <textarea
            class="reel-report-modal__details"
            id="report-details"
            placeholder="${this.esc(t('reelDetail.reportDetailsPlaceholder'))}"
            rows="2"
            maxlength="300"
            aria-label="${this.esc(t('reelDetail.reportDetails'))}"
          ></textarea>
          <div class="reel-report-modal__actions">
            <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="report-cancel" type="button">${this.esc(t('common.cancel'))}</button>
            <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="report-submit" type="button" disabled>${this.esc(t('reelDetail.submitReport'))}</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(root);
    this._initVideo(root);

    if (window.innerWidth > 900) {
      this._openComments(root);
    }
  }

  // ── Video init ────────────────────────────────────────────────────────

  _initVideo(root) {
    const video = root.querySelector('#reel-video');
    if (!video) return;
    this._videoEl = video;

    const fill = root.querySelector('#progress-fill');
    const currentTime = root.querySelector('#current-time');
    const totalTime = root.querySelector('#total-time');

    this.on(video, 'loadedmetadata', () => {
      if (totalTime) {
        const m = String(Math.floor(video.duration / 60)).padStart(2, '0');
        const s = String(Math.floor(video.duration % 60)).padStart(2, '0');
        totalTime.textContent = `${m}:${s}`;
      }
    });

    this.on(video, 'timeupdate', () => {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      if (fill) fill.style.width = `${pct}%`;
      if (currentTime) {
        const m = String(Math.floor(video.currentTime / 60)).padStart(2, '0');
        const s = String(Math.floor(video.currentTime % 60)).padStart(2, '0');
        currentTime.textContent = `${m}:${s}`;
      }
    });

    this.on(video, 'play',  () => this._syncTapIcon(root, false));
    this.on(video, 'pause', () => this._syncTapIcon(root, true));
    this.on(video, 'ended', () => this._onReelEnded(root));

    if (this._reel.videoUrl) {
      video.play().catch(() => this._syncTapIcon(root, true));
    }
  }

  // ── Events ────────────────────────────────────────────────────────────

  _bindEvents(root) {
    const video = root.querySelector('#reel-video');

    // Tap area
    const tapArea = root.querySelector('#tap-area');
    const tapIcon = root.querySelector('#tap-icon');
    const tapSvg = root.querySelector('#tap-svg');
    if (tapArea && video) {
      this.on(tapArea, 'click', () => {
        if (!this._reel.videoUrl) {
          showToast('info', 'No video available yet for this reel.');
          return;
        }
        if (video.muted) this._setMuted(root, false);
        if (video.paused) {
          video.play();
          if (tapSvg) tapSvg.innerHTML = ICON_PAUSE;
        } else {
          video.pause();
          if (tapSvg) tapSvg.innerHTML = ICON_PLAY;
        }
        if (tapIcon) {
          tapIcon.classList.add('reel-player__tap-icon--flash');
          setTimeout(() => tapIcon.classList.remove('reel-player__tap-icon--flash'), 600);
        }
      });
      this.on(tapArea, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapArea.click(); }
      });
    }

    // Mute
    const muteBtn = root.querySelector('#mute-btn');
    if (muteBtn && video) {
      this.on(muteBtn, 'click', () => this._setMuted(root, !video.muted));
    }

    // Like
    const likeBtn = root.querySelector('#like-btn');
    if (likeBtn) this.on(likeBtn, 'click', () => this._handleLike(root));

    // Share
    const shareBtn = root.querySelector('#share-btn');
    if (shareBtn) this.on(shareBtn, 'click', () => this._handleShare());

    // Comment toggle
    const commentToggleBtn = root.querySelector('#comment-toggle-btn');
    if (commentToggleBtn) this.on(commentToggleBtn, 'click', () => this._toggleComments(root));

    // Drawer handle
    const drawerHandle = root.querySelector('#drawer-handle');
    if (drawerHandle) {
      this.on(drawerHandle, 'click', () => this._closeComments(root));
      let touchStartY = 0;
      this.on(drawerHandle, 'touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
      this.on(drawerHandle, 'touchend', (e) => {
        if (e.changedTouches[0].clientY - touchStartY > 40) this._closeComments(root);
      }, { passive: true });
    }

    // Progress scrubbing
    const progressBar = root.querySelector('#progress-bar');
    if (progressBar && video) {
      this.on(progressBar, 'click', (e) => {
        if (!video.duration) return;
        const rect = progressBar.getBoundingClientRect();
        video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
      });
    }

    // Comment submit
    const submitBtn = root.querySelector('#comment-submit');
    const input = root.querySelector('#comment-input');
    if (submitBtn && input) {
      this.on(submitBtn, 'click', () => this._handleComment(root, input));
      this.on(input, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleComment(root, input); }
      });
    }

    // Bell (subscribe)
    const bellBtn = root.querySelector('#bell-btn');
    if (bellBtn) this.on(bellBtn, 'click', () => this._handleBell(root));

    // Report button (other users' reels)
    const reportBtn = root.querySelector('#report-btn');
    if (reportBtn) this.on(reportBtn, 'click', () => this._openReport(root));

    // Delete button (own reels)
    const deleteBtn = root.querySelector('#delete-btn');
    if (deleteBtn) this.on(deleteBtn, 'click', () => this._handleDeleteReel());

    // Report modal — reason selection
    this.delegate('.reel-report-reason', 'click', (e, btn) => {
      this._reportReason = btn.dataset.reason;
      root.querySelectorAll('.reel-report-reason').forEach(b => {
        b.classList.toggle('reel-report-reason--selected', b.dataset.reason === this._reportReason);
      });
      const submitBtn = root.querySelector('#report-submit');
      if (submitBtn) submitBtn.disabled = false;
    });

    // Report cancel
    const reportCancel = root.querySelector('#report-cancel');
    if (reportCancel) this.on(reportCancel, 'click', () => this._closeReport(root));

    // Report backdrop click
    const reportBackdrop = root.querySelector('#report-backdrop');
    if (reportBackdrop) {
      this.on(reportBackdrop, 'click', (e) => {
        if (e.target === reportBackdrop) this._closeReport(root);
      });
    }

    // Report submit
    const reportSubmitBtn = root.querySelector('#report-submit');
    if (reportSubmitBtn) this.on(reportSubmitBtn, 'click', () => this._handleReport(root));

    // ── Continuous play: nav buttons ──────────────────────────────────────
    const prevReelBtn = root.querySelector('#prev-reel-btn');
    if (prevReelBtn) this.on(prevReelBtn, 'click', () => this._navigateToAdjacentReel(-1, root));
    const nextReelBtn = root.querySelector('#next-reel-btn');
    if (nextReelBtn) this.on(nextReelBtn, 'click', () => this._navigateToAdjacentReel(1, root));
    const nextSkipBtn = root.querySelector('#next-skip-btn');
    if (nextSkipBtn) this.on(nextSkipBtn, 'click', () => { this._cancelNextCountdown(root); this._navigateToAdjacentReel(1, root); });
    const nextCancelBtn = root.querySelector('#next-cancel-btn');
    if (nextCancelBtn) this.on(nextCancelBtn, 'click', () => { this._cancelNextCountdown(root); this._videoEl?.play(); });

    // ESC closes report modal; arrow keys navigate reels
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this._reportOpen) { this._closeReport(root); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); this._cancelNextCountdown(root); this._navigateToAdjacentReel(-1, root); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._cancelNextCountdown(root); this._navigateToAdjacentReel(1, root); }
    });
  }

  // ── Mute ──────────────────────────────────────────────────────────────

  _setMuted(root, muted) {
    const video = this._videoEl;
    const muteIcon = root.querySelector('#mute-icon');
    const muteBtn = root.querySelector('#mute-btn');
    if (!video) return;
    video.muted = muted;
    if (muteIcon) muteIcon.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
    if (muteBtn) muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  // ── Comments ──────────────────────────────────────────────────────────

  _toggleComments(root) {
    this._commentsOpen ? this._closeComments(root) : this._openComments(root);
  }

  _openComments(root) {
    this._commentsOpen = true;
    const panel = root.querySelector('#comments-panel');
    const btn = root.querySelector('#comment-toggle-btn');
    const layout = root.querySelector('#reel-layout');
    if (panel) { panel.classList.add('reel-detail__comments-panel--open'); panel.setAttribute('aria-hidden', 'false'); }
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (layout) layout.classList.add('reel-detail__layout--comments-open');
    setTimeout(() => root.querySelector('#comment-input')?.focus(), 320);
  }

  _closeComments(root) {
    this._commentsOpen = false;
    const panel = root.querySelector('#comments-panel');
    const btn = root.querySelector('#comment-toggle-btn');
    const layout = root.querySelector('#reel-layout');
    if (panel) { panel.classList.remove('reel-detail__comments-panel--open'); panel.setAttribute('aria-hidden', 'true'); }
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (layout) layout.classList.remove('reel-detail__layout--comments-open');
  }

  // ── Like ──────────────────────────────────────────────────────────────

  async _handleLike(root) {
    const likeIcon = root.querySelector('#like-icon');
    const likeBtn = root.querySelector('#like-btn');
    const likeCount = root.querySelector('#like-count');

    this._isLiked = !this._isLiked;
    if (likeIcon) {
      likeIcon.setAttribute('fill', this._isLiked ? 'var(--color-error)' : 'none');
      likeIcon.setAttribute('stroke', this._isLiked ? 'var(--color-error)' : 'white');
    }
    if (likeBtn) likeBtn.classList.toggle('reel-player__action-btn--liked', this._isLiked);

    const res = await api.reels.toggleLike(this._reel.reelId);
    if (res.error) {
      this._isLiked = !this._isLiked;
      if (likeIcon) {
        likeIcon.setAttribute('fill', this._isLiked ? 'var(--color-error)' : 'none');
        likeIcon.setAttribute('stroke', this._isLiked ? 'var(--color-error)' : 'white');
      }
      if (likeBtn) likeBtn.classList.toggle('reel-player__action-btn--liked', this._isLiked);
      showToast('error', 'Could not update like. Please try again.');
      return;
    }
    if (likeCount) likeCount.textContent = formatCount(res.data.likes);
  }

  // ── Share ─────────────────────────────────────────────────────────────

  async _handleShare() {
    const url = `${window.location.origin}/reels/${this._reel.reelId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: this._reel.caption || 'Check out this reel on Lagos Konect', url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      showToast('success', 'Link copied to clipboard.');
    }
  }

  // ── Bell (Subscribe) ─────────────────────────────────────────────────

  async _handleBell(root) {
    const bellBtn = root.querySelector('#bell-btn');
    if (bellBtn) bellBtn.disabled = true;

    const wasSubscribed = this._isSubscribed;
    const res = wasSubscribed
        ? await api.reels.unsubscribe(this._reel.reelId)
        : await api.reels.subscribe(this._reel.reelId);

    if (bellBtn) bellBtn.disabled = false;

    if (res.error) {
      showToast('error', res.error.message || 'Could not update notification preference.');
      return;
    }

    this._isSubscribed = !wasSubscribed;
    this._updateBellUI(root);
    showToast('success', this._isSubscribed ? 'You\'ll be notified when they post.' : 'Notifications turned off.');
  }

  _updateBellUI(root) {
    const bellBtn = root.querySelector('#bell-btn');
    const bellIcon = root.querySelector('#bell-icon');
    if (!bellBtn) return;
    bellBtn.setAttribute('aria-pressed', String(this._isSubscribed));
    bellBtn.setAttribute('aria-label', this._isSubscribed ? 'Unsubscribe from notifications' : 'Subscribe to notifications');
    if (bellIcon) bellIcon.setAttribute('fill', this._isSubscribed ? 'white' : 'none');
    bellBtn.classList.toggle('reel-player__bell-btn--subscribed', this._isSubscribed);
  }

  // ── Delete own reel ───────────────────────────────────────────────────

  async _handleDeleteReel() {
    if (!confirm('Delete this reel? This cannot be undone.')) return;
    this._videoEl?.pause();
    const res = await api.reels.deleteOwnReel(this._reel.reelId);
    if (res.error) {
      showToast('error', res.error.message || 'Could not delete reel.');
      return;
    }
    showToast('success', 'Reel deleted.');
    history.back();
  }

  // ── Report ────────────────────────────────────────────────────────────

  _openReport(root) {
    this._reportOpen = true;
    this._reportReason = null;
    // Reset selection
    root.querySelectorAll('.reel-report-reason').forEach(b => b.classList.remove('reel-report-reason--selected'));
    const submitBtn = root.querySelector('#report-submit');
    if (submitBtn) submitBtn.disabled = true;
    const details = root.querySelector('#report-details');
    if (details) details.value = '';
    const backdrop = root.querySelector('#report-backdrop');
    if (backdrop) { backdrop.classList.add('reel-report-backdrop--open'); backdrop.setAttribute('aria-hidden', 'false'); }
    // Pause video while reporting
    this._videoEl?.pause();
  }

  _closeReport(root) {
    this._reportOpen = false;
    const backdrop = root.querySelector('#report-backdrop');
    if (backdrop) { backdrop.classList.remove('reel-report-backdrop--open'); backdrop.setAttribute('aria-hidden', 'true'); }
    // Resume video
    this._videoEl?.play().catch(() => { });
  }

  async _handleReport(root) {
    if (!this._reportReason || this._reportSubmitting) return;
    this._reportSubmitting = true;

    const details = root.querySelector('#report-details')?.value.trim() || '';
    const submitBtn = root.querySelector('#report-submit');
    if (submitBtn) { submitBtn.textContent = 'Submitting…'; submitBtn.disabled = true; }

    const res = await api.reels.reportReel(this._reel.reelId, this._reportReason, details);

    this._reportSubmitting = false;
    if (submitBtn) { submitBtn.textContent = 'Submit Report'; submitBtn.disabled = false; }

    if (res.error) {
      if (res.error.code === 'ALREADY_REPORTED') {
        showToast('info', 'You have already reported this reel.');
      } else {
        showToast('error', res.error.message || 'Could not submit report.');
      }
      this._closeReport(root);
      return;
    }

    this._closeReport(root);
    showToast('success', 'Report submitted. Thank you.');
  }

  // ── Comment ───────────────────────────────────────────────────────────

  async _handleComment(root, input) {
    const text = input.value.trim();
    if (!text) return;

    const user = store.currentUser;
    const list = root.querySelector('#comments-list');
    const badge = root.querySelector('#comments-badge');
    const commentCountEl = root.querySelector('#comment-count');

    input.value = '';

    const empty = list?.querySelector('.reel-detail__comments-empty');
    if (empty) empty.remove();

    const tempId = `temp_${Date.now()}`;
    const tempComment = {
      id: tempId, reelId: this._reel.reelId,
      userId: user.id, userName: user.name,
      avatarUrl: user.avatarUrl, text,
      createdAt: new Date().toISOString(),
    };

    const tempEl = document.createElement('div');
    tempEl.innerHTML = this._commentHtml(tempComment, true);
    const tempNode = tempEl.firstElementChild;
    list?.prepend(tempNode);

    const res = await api.reels.addComment(this._reel.reelId, text);

    if (res.error) {
      tempNode?.remove();
      input.value = text;
      showToast('error', 'Could not post comment. Please try again.');
      return;
    }

    const confirmedEl = document.createElement('div');
    confirmedEl.innerHTML = this._commentHtml(res.data, false);
    tempNode?.replaceWith(confirmedEl.firstElementChild);

    this._reel.commentCount = (this._reel.commentCount || 0) + 1;
    const newCount = formatCount(this._reel.commentCount);
    if (badge) badge.textContent = `${newCount} Comments`;
    if (commentCountEl) commentCountEl.textContent = newCount;

    showToast('success', 'Comment posted.');
  }

  // ── Comment HTML helpers ──────────────────────────────────────────────

  _renderCommentsList(comments) {
    if (!comments.length) {
      return `<div class="reel-detail__comments-empty"><p>No comments yet. Be the first.</p></div>`;
    }
    return comments.map((c) => this._commentHtml(c, false)).join('');
  }

  _commentHtml(comment, muted = false) {
    return `
      <div class="reel-comment ${muted ? 'reel-comment--muted' : ''}" data-comment-id="${comment.id}">
        ${Avatar.html({ name: comment.userName, imageUrl: comment.avatarUrl, size: 'sm' })}
        <div class="reel-comment__body">
          <div class="reel-comment__header">
            <span class="reel-comment__name">${this.esc(comment.userName)}</span>
            <span class="reel-comment__time">${timeAgo(comment.createdAt)}</span>
          </div>
          <p class="reel-comment__text">${this.esc(comment.text)}</p>
        </div>
      </div>
    `;
  }

  // ── Continuous play helpers ───────────────────────────────────────────

  _syncTapIcon(root, isPaused) {
    const tapSvg = root.querySelector('#tap-svg');
    if (tapSvg) tapSvg.innerHTML = isPaused ? ICON_PLAY : ICON_PAUSE;
  }

  async _loadAdjacentReels() {
    try {
      const res = await api.reels.getForLGA({ page: 1, perPage: 30 });
      if (res.error || !res.data?.length) return;
      this._adjacentReels    = res.data;
      this._currentReelIndex = res.data.findIndex(r => r.reelId === this._reel?.reelId);
      // If there is only one reel in the feed, hide the nav arrows
      const arrows = this.getContentEl()?.querySelector('#reel-nav-arrows');
      if (arrows && this._adjacentReels.length <= 1) arrows.style.display = 'none';
    } catch { /* non-critical */ }
  }

  _onReelEnded(root) {
    if (this._adjacentReels.length <= 1 || this._currentReelIndex < 0) { this._videoEl?.play(); return; }
    const nextReel = this._adjacentReels[this._currentReelIndex + 1];
    if (!nextReel) { this._videoEl?.play(); return; }
    this._showNextCountdown(root, nextReel);
  }

  _showNextCountdown(root, nextReel) {
    const overlay     = root?.querySelector('#reel-next-overlay');
    const countdownEl = root?.querySelector('#next-countdown');
    if (!overlay || !nextReel) return;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('reel-next-overlay--visible');
    let secs = 3;
    if (countdownEl) countdownEl.textContent = secs;
    this._nextCountdownTimer = setInterval(() => {
      secs--;
      if (countdownEl) countdownEl.textContent = secs;
      if (secs <= 0) {
        clearInterval(this._nextCountdownTimer);
        this._nextCountdownTimer = null;
        router.push(`/reels/${nextReel.reelId}`);
      }
    }, 1000);
  }

  _cancelNextCountdown(root) {
    if (this._nextCountdownTimer) { clearInterval(this._nextCountdownTimer); this._nextCountdownTimer = null; }
    const r = root ?? this.getContentEl();
    const overlay = r?.querySelector('#reel-next-overlay');
    if (overlay) { overlay.setAttribute('aria-hidden', 'true'); overlay.classList.remove('reel-next-overlay--visible'); }
  }

  _navigateToAdjacentReel(direction, root) {
    if (!this._adjacentReels.length) {
      showToast('info', 'Still loading the reel list, please try again in a moment.');
      return;
    }
    if (this._currentReelIndex < 0) {
      showToast('info', 'This reel isn\'t in the current feed — navigation unavailable.');
      return;
    }
    const newIdx = this._currentReelIndex + direction;
    if (newIdx < 0) {
      showToast('info', 'You\'re already at the first reel.');
      return;
    }
    if (newIdx >= this._adjacentReels.length) {
      showToast('info', 'No more reels in the feed.');
      return;
    }
    this._cancelNextCountdown(root);
    router.push(`/reels/${this._adjacentReels[newIdx].reelId}`);
  }

  // ── Skeleton ──────────────────────────────────────────────────────────

  _renderSkeleton() {
    return `
      <div class="reel-detail__layout reel-detail__layout--skeleton" aria-hidden="true">
        <div class="reel-detail__skeleton-back"></div>
        <div class="reel-detail__video-col">
          <div class="reel-detail__skeleton-player"></div>
        </div>
        <div class="reel-detail__comments-panel">
          <div class="reel-detail__skeleton-heading"></div>
          ${[1, 2, 3, 4].map(() => `
            <div class="reel-detail__skeleton-comment">
              <div class="reel-detail__skeleton-avatar"></div>
              <div class="reel-detail__skeleton-lines">
                <div class="reel-detail__skeleton-line"></div>
                <div class="reel-detail__skeleton-line reel-detail__skeleton-line--short"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  beforeUnmount() {
    if (this._nextCountdownTimer) { clearInterval(this._nextCountdownTimer); this._nextCountdownTimer = null; }
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.src = '';
      this._videoEl.load();
    }
    cancelAnimationFrame(this._rafId);
  }
}
