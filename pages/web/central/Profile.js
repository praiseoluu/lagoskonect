/**
 * KTG Connect — Profile Page
 * Route: /profile
 * Guards: requireAuth + requireCitizen
 * ============================================================
 * Layout:
 *   Top hero  — avatar, name, LGA pill, join date, verified badge
 *   Stats row — Reels Uploaded, LGA Member Since
 *   Reels     — user's own reels, newest first, thumbnail grid
 *   Info card — phone, email, LGA, member since, account status
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js';
import { Avatar } from '../../../components/base/UI.js';
import { store, showToast, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { timeAgo, formatDate } from '../../../utils/date.js';
import { t } from '../../../core/i18n.js';

const MAP_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const CAL_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const EDIT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const PHONE_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;
const EMAIL_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
const PLAY_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const HEART_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
const EYE_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const FILM_ICON = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export default class ProfilePage extends WebLayout {
  static styles = '/pages/web/app/Profile.css';

  constructor(props) {
    super({ title: t('profile.title'), ...props });
    this._reels = [];
    this._reelsTotal = 0;
  }

  getContent() {
    return `<div class="profile-page" id="profile-root"></div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    const user = store.currentUser;
    if (!user) {
      const root = this.getContentEl()?.querySelector('#profile-root');
      if (root) root.innerHTML = `<p class="profile-error">${this.esc(t('profile.loadError'))}</p>`;
      setPageLoading(false);
      return;
    }

    // Fetch all published reels for the user's LGA, then filter to this user
    // TODO: add a dedicated /reels/mine endpoint when admin panel is built
    const res = await api.reels.getForLGA({ perPage: 50 });
    const all = res.data || [];
    this._reels = all.filter((r) => r.authorId === user.id);
    this._reelsTotal = this._reels.length;

    this._render();
    setPageLoading(false);
  }

  _render() {
    const root = this.getContentEl()?.querySelector('#profile-root');
    if (!root) return;
    const user = store.currentUser;

    root.innerHTML = `

      <!-- ── Hero ── -->
      <div class="profile-hero">
        <div class="profile-hero__inner">
          <div class="profile-hero__avatar-wrap">
            ${Avatar.html({ name: user.name, imageUrl: user.avatarUrl || null, size: 'xl' })}
          </div>
          <div class="profile-hero__info">
            <div class="profile-hero__name-row">
              <h1 class="profile-hero__name">${this.esc(user.name)}</h1>
              ${user.isVerified ? `
                <span class="profile-verified-badge" title="${this.esc(t('profile.verified'))}">
                  ${CHECK_ICON} ${this.esc(t('profile.verified'))}
                </span>` : ''}
            </div>
            ${user.username ? `<p class="profile-hero__handle">@${this.esc(user.username)}</p>` : ''}
            <div class="profile-hero__meta">
              <span class="profile-meta-pill">${MAP_ICON} ${this.esc(user.lgaName || '—')}</span>
              <span class="profile-meta-pill">${CAL_ICON} ${this.esc(t('profile.joined', { date: formatDate(user.createdAt) }))}</span>
              <span class="profile-meta-pill profile-meta-pill--status
                ${user.status === 'active' ? 'profile-meta-pill--active' : 'profile-meta-pill--inactive'}">
                ${this.esc(user.status === 'active' ? t('profile.statusActive') : t('profile.statusInactive'))}
              </span>
            </div>
          </div>
          <button class="profile-edit-btn" id="profile-edit-btn" type="button">
            ${EDIT_ICON} ${this.esc(t('profile.editProfile'))}
          </button>
        </div>
      </div>

      <!-- ── Stats row ── -->
      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat__value">${this._reelsTotal}</span>
          <span class="profile-stat__label">${this.esc(t('profile.reelsUploaded'))}</span>
        </div>
        <div class="profile-stat__divider" aria-hidden="true"></div>
        <div class="profile-stat">
          <span class="profile-stat__value">${this._totalLikes()}</span>
          <span class="profile-stat__label">${this.esc(t('profile.totalLikes'))}</span>
        </div>
        <div class="profile-stat__divider" aria-hidden="true"></div>
        <div class="profile-stat">
          <span class="profile-stat__value">${this._memberSince(user.createdAt)}</span>
          <span class="profile-stat__label">${this.esc(t('profile.memberSinceLabel'))}</span>
        </div>
      </div>

      <!-- ── Reels ── -->
      <section class="profile-section" aria-label="${this.esc(t('profile.myReels'))}">
        <h2 class="profile-section__title">${this.esc(t('profile.myReels'))}</h2>
        ${this._reelsHtml()}
      </section>

      <!-- ── Account info ── -->
      <section class="profile-section" aria-label="${this.esc(t('profile.accountInfo'))}">
        <h2 class="profile-section__title">${this.esc(t('profile.accountInfo'))}</h2>
        <div class="profile-info-card">
          ${this._infoRow(PHONE_ICON, t('profile.phone'), user.phone || '—')}
          ${this._infoRow(EMAIL_ICON, t('profile.email'), user.email || '—')}
          ${this._infoRow(MAP_ICON, t('profile.lga'), user.lgaName || '—')}
          ${this._infoRow(CAL_ICON, t('profile.memberSince'), formatDate(user.createdAt))}
        </div>
      </section>
    `;

    // Edit profile button
    root.querySelector('#profile-edit-btn')
        ?.addEventListener('click', () => router.push('/central/settings'));

    // Reel card clicks — navigate to reel detail
    this.delegate('.profile-reel-card', 'click', (e, card) => {
      const reelId = card.dataset.reelId;
      if (reelId) router.push(`/central/reels/${reelId}`);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  _totalLikes() {
    return formatCount(this._reels.reduce((sum, r) => sum + (r.likes || 0), 0));
  }

  _memberSince(createdAt) {
    const d = new Date(createdAt);
    const now = new Date();
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (months < 1) return t('profile.monthsShortUnder1');
    if (months < 12) return t('profile.monthsShort', { count: months });
    const years = Math.floor(months / 12);
    return years > 1
        ? t('profile.yearsShort', { count: years })
        : t('profile.yearShort', { count: years });
  }

  _reelsHtml() {
    if (!this._reels.length) {
      return `
        <div class="profile-posts-empty">
          <span class="profile-posts-empty__icon" aria-hidden="true">${FILM_ICON}</span>
          <p>${this.esc(t('profile.emptyTitle'))}</p>
          <p class="profile-posts-empty__sub">
            ${this.esc(t('profile.emptySubtitle'))}
          </p>
        </div>
      `;
    }

    return `
      <div class="profile-reels-grid">
        ${this._reels.map((reel) => {
      const isVideo = !!reel.videoUrl && !reel.videoUrl.match(/\.(jpg|jpeg|png|gif|webp)/i);
      const thumb = reel.thumbnailUrl || reel.videoUrl || '';
      return `
            <div class="profile-reel-card" data-reel-id="${this.esc(reel.reelId)}"
              role="button" tabindex="0" aria-label="${this.esc(reel.caption?.slice(0, 60) || t('profile.reelFallback'))}">
              <div class="profile-reel-card__thumb">
                ${thumb
          ? `<img src="${this.esc(thumb)}" alt="" loading="lazy" />`
          : `<div class="profile-reel-card__no-thumb">${FILM_ICON}</div>`}
                ${isVideo ? `<span class="profile-reel-card__play">${PLAY_ICON}</span>` : ''}
              </div>
              <div class="profile-reel-card__meta">
                <span class="profile-reel-card__stat">${HEART_ICON} ${formatCount(reel.likes || 0)}</span>
                <span class="profile-reel-card__stat">${EYE_ICON} ${formatCount(reel.views || 0)}</span>
                <span class="profile-reel-card__time">${timeAgo(reel.createdAt)}</span>
              </div>
              ${reel.caption ? `<p class="profile-reel-card__caption">${this.esc(reel.caption.slice(0, 80))}${reel.caption.length > 80 ? '…' : ''}</p>` : ''}
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  _infoRow(icon, label, value) {
    return `
      <div class="profile-info-row">
        <span class="profile-info-row__icon">${icon}</span>
        <div class="profile-info-row__content">
          <span class="profile-info-row__label">${this.esc(label)}</span>
          <span class="profile-info-row__value">${this.esc(value)}</span>
        </div>
      </div>
    `;
  }
}
