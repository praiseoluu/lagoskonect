/**
 * Lagos Konect — Public User Profile Page (Central)
 * ============================================================
 * Route:     /central/u/:username
 * Auth:      Not required
 *
 * Shows the hero, stats and reels grid for any public citizen
 * profile in the Central zone. Private profiles render a minimal
 * locked view instead.
 *
 * Data flow:
 *   1. getPublicProfile(username) — hero + stats
 *   2. getByUser(id)              — reel thumbnails (deferred,
 *      only when reelCount > 0 on the public profile)
 *
 * @module  UserProfilePage (Central)
 * @version 2.0.0
 */

import { WebLayout }       from '../../../components/layout/BaseLayout.js?v=20260806c';
import { Avatar }          from '../../../components/base/UI.js?v=20260806c';
import { setPageLoading }  from '../../../core/store.js?v=20260806c';
import { router }          from '../../../core/router.js?v=20260806c';
import { api }             from '../../../api/client.js?v=20260806c';
import { formatDate }      from '../../../utils/date.js?v=20260806c';

/* ── Region config ──────────────────────────────────────────────────────── */
const REGION_BRAND  = 'LagKonnect - Central';
const REGION_PREFIX = '/central';

/* ── Inline SVG icons ───────────────────────────────────────────────────── */
const MAP_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
  <circle cx="12" cy="10" r="3"/>
</svg>`;

const CAL_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="3" y="4" width="18" height="18" rx="2"/>
  <line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8"  y1="2" x2="8"  y2="6"/>
  <line x1="3"  y1="10" x2="21" y2="10"/>
</svg>`;

const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

const LOCK_ICON = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
  <path d="M7 11V7a5 5 0 0110 0v4"/>
</svg>`;

const PLAY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polygon points="5 3 19 12 5 21 5 3"/>
</svg>`;

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Formats a raw number into a compact string.
 * @param {number} n
 * @returns {string}
 */
function formatCount(n) {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/**
 * Returns a human-readable membership duration string.
 * @param {string} createdAt  — ISO date string
 * @returns {string}
 */
function memberSince(createdAt) {
  const d   = new Date(createdAt);
  const now = new Date();
  if (isNaN(d.getTime())) return '—';

  const months =
    (now.getFullYear() - d.getFullYear()) * 12 +
    (now.getMonth() - d.getMonth());

  if (months < 1)  return '< 1 mo';
  if (months < 12) return `${months} mo`;
  const yrs = Math.floor(months / 12);
  return `${yrs} yr${yrs > 1 ? 's' : ''}`;
}

/** Skeleton placeholder cards shown while reels are loading. */
const SKELETON_CARDS = Array.from({ length: 6 }, () =>
  `<div class="uprofile-reel-card uprofile-reel-card--skeleton" aria-hidden="true">
     <div class="uprofile-reel-card__thumb skeleton-block"></div>
   </div>`
).join('');

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */
export default class UserProfilePage extends WebLayout {
  static styles = '/pages/web/app/Profile.css?v=20260806c';

  constructor(props) {
    super({ title: 'Profile', ...props });
    this._username = props?.params?.username?.trim() || '';
  }

  /* ── Shell ────────────────────────────────────────────────────────────── */

  getContent() {
    return `
      <div class="profile-page" id="uprofile-root" aria-busy="true" aria-live="polite">
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  async onContentReady() {
    if (!this._username) {
      router.replace('/404');
      return;
    }

    const root = this.getContentEl()?.querySelector('#uprofile-root');
    if (!root) return;

    setPageLoading(true);

    try {
      const res = await api.users.getPublicProfile(this._username);

      if (res.error) {
        this._renderError(root, res.error);
        return;
      }

      const p = res.data;

      document.title = `${p.isPrivate ? `@${p.username}` : p.name} — ${REGION_BRAND}`;
      root.setAttribute('aria-busy', 'false');
      root.innerHTML = p.isPrivate
        ? this._renderPrivate(p)
        : this._renderPublic(p);

      if (!p.isPrivate && p.reelCount > 0) {
        await this._loadReels(root, p.id);
      }

    } catch (err) {
      this._renderError(root, err?.message);
    } finally {
      setPageLoading(false);
    }
  }

  /* ── Data loading ─────────────────────────────────────────────────────── */

  /**
   * Deferred reel loading — fills the skeleton grid or removes the section.
   * @private
   * @param {HTMLElement} root
   * @param {string}      userId
   */
  async _loadReels(root, userId) {
    const reelsMount   = root.querySelector('#uprofile-reels');
    const reelsSection = root.querySelector('#uprofile-reels-section');
    if (!reelsMount) return;

    try {
      const reelsRes = await api.reels.getByUser(userId);

      if (!reelsRes.error && reelsRes.data?.length) {
        reelsMount.innerHTML = this._reelsHtml(reelsRes.data);
        this._bindReelCards();
      } else {
        reelsSection?.remove();
      }
    } catch {
      reelsSection?.remove();
    }
  }

  /* ── Event binding ────────────────────────────────────────────────────── */

  /** @private */
  _bindReelCards() {
    const navigate = (card) => {
      const id = card.dataset.reelId;
      if (id) router.push(`${REGION_PREFIX}/reels/${id}`);
    };

    this.delegate('.uprofile-reel-card', 'click', (_e, card) => {
      navigate(card);
    });

    this.delegate('.uprofile-reel-card', 'keydown', (e, card) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(card);
      }
    });
  }

  /* ── Renderers ────────────────────────────────────────────────────────── */

  /** @private */
  _renderError(root, message) {
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `
      <div class="profile-error" role="alert">
        <p>${message === 'not_found' || !message
          ? 'User not found.'
          : 'Something went wrong. Please try again.'
        }</p>
      </div>
    `;
  }

  /** @private */
  _renderPublic(p) {
    return `
      ${this._renderHero(p)}
      ${this._renderStats(p)}
      ${p.reelCount > 0 ? this._renderReelsSection() : ''}
    `;
  }

  /** @private */
  _renderHero(p) {
    const isPublic = !p.isPrivate;
    return `
      <div class="profile-hero" role="banner">
        <div class="profile-hero__inner">
          <div class="profile-hero__avatar-wrap">
            ${Avatar.html({
              name:     isPublic ? p.name : p.username,
              imageUrl: p.avatarUrl ?? null,
              size:     'xl',
            })}
          </div>
          <div class="profile-hero__info">
            ${isPublic ? `
              <div class="profile-hero__name-row">
                <h1 class="profile-hero__name">${this.esc(p.name)}</h1>
                ${p.isVerified
                  ? `<span class="profile-verified-badge" title="Verified citizen" aria-label="Verified">
                       ${CHECK_ICON} Verified
                     </span>`
                  : ''
                }
              </div>
            ` : ''}
            <p class="profile-hero__handle">@${this.esc(p.username)}</p>
            ${isPublic ? `
              <div class="profile-hero__meta" aria-label="Profile details">
                ${p.lgaName
                  ? `<span class="profile-meta-pill">${MAP_ICON} ${this.esc(p.lgaName)}</span>`
                  : ''
                }
                <span class="profile-meta-pill">
                  ${CAL_ICON} Joined ${formatDate(p.createdAt)}
                </span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /** @private */
  _renderStats(p) {
    const stats = [
      { value: formatCount(p.reelCount),   label: 'Reels'       },
      { value: formatCount(p.totalLikes),  label: 'Total Likes' },
      { value: memberSince(p.createdAt),   label: 'Member'      },
    ];

    const items = stats.map((s, i) => `
      ${i > 0 ? `<div class="profile-stat__divider" aria-hidden="true"></div>` : ''}
      <div class="profile-stat">
        <span class="profile-stat__value">${s.value}</span>
        <span class="profile-stat__label">${s.label}</span>
      </div>
    `).join('');

    return `
      <div class="profile-stats" role="group" aria-label="Profile statistics">
        ${items}
      </div>
    `;
  }

  /** @private */
  _renderReelsSection() {
    return `
      <section class="uprofile-reels-section" id="uprofile-reels-section" aria-labelledby="uprofile-reels-heading">
        <h2 class="uprofile-reels-section__title" id="uprofile-reels-heading">Reels</h2>
        <div class="uprofile-reels-grid" id="uprofile-reels" aria-label="Reel thumbnails">
          ${SKELETON_CARDS}
        </div>
      </section>
    `;
  }

  /** @private */
  _reelsHtml(reels) {
    return reels.map((r) => `
      <div
        class="uprofile-reel-card"
        data-reel-id="${this.esc(r.reelId)}"
        role="button"
        tabindex="0"
        aria-label="${this.esc(r.caption || 'Reel')}"
      >
        ${r.thumbnailUrl
          ? `<img
               src="${this.esc(r.thumbnailUrl)}"
               alt=""
               class="uprofile-reel-card__thumb"
               loading="lazy"
               decoding="async"
             />`
          : `<div class="uprofile-reel-card__thumb uprofile-reel-card__thumb--placeholder" aria-hidden="true"></div>`
        }
        <div class="uprofile-reel-card__overlay" aria-hidden="true">
          ${PLAY_ICON}
          <span>${formatCount(r.views)}</span>
        </div>
      </div>
    `).join('');
  }

  /** @private */
  _renderPrivate(p) {
    return `
      ${this._renderHero(p)}
      <div class="profile-private-notice" role="status" aria-live="polite">
        <span class="profile-private-notice__icon" aria-hidden="true">${LOCK_ICON}</span>
        <p class="profile-private-notice__text">This profile is private.</p>
      </div>
    `;
  }
}