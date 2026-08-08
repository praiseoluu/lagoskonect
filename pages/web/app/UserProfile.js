/**
 * Lagos Konect — Public User Profile Page
 * Route: /u/:username
 * No auth required.
 * ============================================================
 * Layout mirrors Profile.js (own profile page).
 * Shows hero, stats, and LGA info for any public citizen profile.
 * Private profiles show a minimal locked view.
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260807a';
import { Avatar } from '../../../components/base/UI.js?v=20260807a';
import { setPageLoading } from '../../../core/store.js?v=20260807a';
import { router } from '../../../core/router.js?v=20260807a';
import { api } from '../../../api/client.js?v=20260807a';
import { formatDate } from '../../../utils/date.js?v=20260807a';

const MAP_ICON  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const CAL_ICON  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const LOCK_ICON  = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function memberSince(createdAt) {
  const d = new Date(createdAt);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months < 1) return '< 1 mo';
  if (months < 12) return `${months} mo`;
  const yrs = Math.floor(months / 12);
  return `${yrs} yr${yrs > 1 ? 's' : ''}`;
}

export default class UserProfilePage extends WebLayout {
  static styles = '/pages/web/app/Profile.css?v=20260807a';

  constructor(props) {
    super({ title: 'Profile', ...props });
    this._username = props?.params?.username || '';
  }

  getContent() {
    return `<div class="profile-page" id="uprofile-root"></div>`;
  }

  async onContentReady() {
    if (!this._username) { router.replace('/404'); return; }

    setPageLoading(true);
    const res = await api.users.getPublicProfile(this._username);
    setPageLoading(false);

    const root = this.getContentEl()?.querySelector('#uprofile-root');
    if (!root) return;

    if (res.error) {
      root.innerHTML = `<p class="profile-error">User not found.</p>`;
      return;
    }

    const p = res.data;

    document.title = (p.isPrivate ? `@${p.username}` : p.name) + ' — Lagos Konect';

    root.innerHTML = p.isPrivate ? this._renderPrivate(p) : this._renderPublic(p);

    if (!p.isPrivate && p.reelCount > 0) {
      const reelsRes = await api.reels.getByUser(p.id);
      const reelsMount = root.querySelector('#uprofile-reels');
      if (reelsMount && !reelsRes.error && reelsRes.data?.length) {
        reelsMount.innerHTML = this._reelsHtml(reelsRes.data);
        this.delegate('.uprofile-reel-card', 'click', (e, card) => {
          router.push(`/reels/${card.dataset.reelId}`);
        });
        this.delegate('.uprofile-reel-card', 'keydown', (e, card) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/reels/${card.dataset.reelId}`); }
        });
      } else if (reelsMount) {
        reelsMount.remove();
        root.querySelector('#uprofile-reels-section')?.remove();
      }
    }
  }

  _renderPublic(p) {
    return `
      <!-- ── Hero ── -->
      <div class="profile-hero">
        <div class="profile-hero__inner">
          <div class="profile-hero__avatar-wrap">
            ${Avatar.html({ name: p.name, imageUrl: p.avatarUrl || null, size: 'xl' })}
          </div>
          <div class="profile-hero__info">
            <div class="profile-hero__name-row">
              <h1 class="profile-hero__name">${this.esc(p.name)}</h1>
              ${p.isVerified ? `<span class="profile-verified-badge" title="Verified">${CHECK_ICON} Verified</span>` : ''}
            </div>
            <p class="profile-hero__handle">@${this.esc(p.username)}</p>
            <div class="profile-hero__meta">
              ${p.lgaName ? `<span class="profile-meta-pill">${MAP_ICON} ${this.esc(p.lgaName)}</span>` : ''}
              <span class="profile-meta-pill">${CAL_ICON} Joined ${formatDate(p.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Stats ── -->
      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat__value">${formatCount(p.reelCount)}</span>
          <span class="profile-stat__label">Reels</span>
        </div>
        <div class="profile-stat__divider" aria-hidden="true"></div>
        <div class="profile-stat">
          <span class="profile-stat__value">${formatCount(p.totalLikes)}</span>
          <span class="profile-stat__label">Total Likes</span>
        </div>
        <div class="profile-stat__divider" aria-hidden="true"></div>
        <div class="profile-stat">
          <span class="profile-stat__value">${memberSince(p.createdAt)}</span>
          <span class="profile-stat__label">Member</span>
        </div>
      </div>

      ${p.reelCount > 0 ? `
      <!-- ── Reels ── -->
      <section class="uprofile-reels-section" id="uprofile-reels-section">
        <h2 class="uprofile-reels-section__title">Reels</h2>
        <div class="uprofile-reels-grid" id="uprofile-reels">
          ${[1,2,3].map(() => `<div class="uprofile-reel-card uprofile-reel-card--skeleton"><div class="uprofile-reel-card__thumb skeleton-block"></div></div>`).join('')}
        </div>
      </section>
      ` : ''}
    `;
  }

  _reelsHtml(reels) {
    return reels.map(r => `
      <div class="uprofile-reel-card" data-reel-id="${r.reelId}" role="button" tabindex="0" aria-label="${this.esc(r.caption || 'Reel')}">
        ${r.thumbnailUrl
          ? `<img src="${r.thumbnailUrl}" alt="" class="uprofile-reel-card__thumb" loading="lazy" />`
          : `<div class="uprofile-reel-card__thumb uprofile-reel-card__thumb--placeholder" aria-hidden="true"></div>`
        }
        <div class="uprofile-reel-card__overlay">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>${formatCount(r.views)}</span>
        </div>
      </div>
    `).join('');
  }

  _renderPrivate(p) {
    return `
      <!-- ── Hero (minimal) ── -->
      <div class="profile-hero">
        <div class="profile-hero__inner">
          <div class="profile-hero__avatar-wrap">
            ${Avatar.html({ name: p.username, imageUrl: p.avatarUrl || null, size: 'xl' })}
          </div>
          <div class="profile-hero__info">
            <p class="profile-hero__handle">@${this.esc(p.username)}</p>
          </div>
        </div>
      </div>

      <!-- ── Private notice ── -->
      <div class="profile-private-notice">
        <span class="profile-private-notice__icon" aria-hidden="true">${LOCK_ICON}</span>
        <p class="profile-private-notice__text">This profile is private.</p>
      </div>
    `;
  }
}
