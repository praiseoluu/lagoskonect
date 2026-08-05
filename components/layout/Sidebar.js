/**
 * Lagos Konect - Sidebar Component
 * ============================================================
 * Shared base sidebar used by both the web app and admin dashboard.
 * Subclasses provide their own nav items via getNavItems().
 *
 * Features:
 *   - Collapsible (icon-only mode) with state persisted to store
 *   - Active route highlighting (subscribes to store.currentRoute)
 *   - Mobile drawer with overlay
 *   - Notification + unread-chat badges
 *   - Modal trigger support (e.g. Create Reel)
 *
 * @module  Sidebar
 * @version 2.0.0
 */

import { Component }  from '../../core/component.js';
import { Avatar }     from '../base/UI.js';
import { store }      from '../../core/store.js';
import { router }     from '../../core/router.js';
import { t }          from '../../core/i18n.js';

/* ── Constants ──────────────────────────────────────────────────────────── */
const VALID_REGIONS  = Object.freeze(['west', 'central', 'east']);
const DEFAULT_REGION = 'west';

const BRAND_MAP = Object.freeze({
  west:    'Lagos Konect - West',
  central: 'Lagos Konect - Central',
  east:    'Lagos Konect - East',
});

/* ── Shared icons ───────────────────────────────────────────────────────── */
const ICON = Object.freeze({
  chevronLeft:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronRight: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="9 18 15 12 9 6"/></svg>`,

  // Web nav
  home:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  trending:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  reels:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  chat:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  bell:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  settings:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  user:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  createPost:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  logout:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,

  // Admin nav
  star:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  dashboard:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  users:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  news:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6z"/></svg>`,
  contentMod:   `<svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M0 19V17H12V19H0ZM5.65 14.15L0 8.5L2.1 6.35L7.8 12L5.65 14.15ZM12 7.8L6.35 2.1L8.5 0L14.15 5.65L12 7.8ZM16.6 18L3.55 4.95L4.95 3.55L18 16.6L16.6 18Z" fill="currentColor"/></svg>`,
  advert:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  lgaData:      `<svg width="18" height="16" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M0 10V8H7V10H0ZM0 6V4H11V6H0ZM0 2V0H11V2H0ZM9 16V12.925L14.525 7.425C14.675 7.275 14.8417 7.16667 15.025 7.1C15.2083 7.03333 15.3917 7 15.575 7C15.775 7 15.9667 7.0375 16.15 7.1125C16.3333 7.1875 16.5 7.3 16.65 7.45L17.575 8.375C17.7083 8.525 17.8125 8.69167 17.8875 8.875C17.9625 9.05833 18 9.24167 18 9.425C18 9.60833 17.9667 9.79583 17.9 9.9875C17.8333 10.1792 17.725 10.35 17.575 10.5L12.075 16H9ZM16.5 9.425L15.575 8.5L16.5 9.425ZM10.5 14.5H11.45L14.475 11.45L14.025 10.975L13.55 10.525L10.5 13.55V14.5ZM14.025 10.975L13.55 10.525L14.475 11.45L14.025 10.975Z" fill="currentColor"/></svg>`,
  analytics:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  traffic:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
});

/* ── Utility ────────────────────────────────────────────────────────────── */

/** @returns {'west'|'central'|'east'} */
function getRegion() {
  try {
    const r = sessionStorage.getItem('lagosRegion');
    return VALID_REGIONS.includes(r) ? r : DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION;
  }
}

/** @returns {string} */
function getBrandName() {
  return BRAND_MAP[getRegion()] ?? 'Lagos Konect';
}

/* ══════════════════════════════════════════════════════════════════════════
   Base Sidebar
   ══════════════════════════════════════════════════════════════════════════ */
export class Sidebar extends Component {
  static styles = '/components/layout/Sidebar.css';

  constructor(props = {}) {
    super(props);
    this.state = {
      collapsed:    store.sidebarCollapsed ?? false,
      currentRoute: window.location.pathname,
    };
  }

  /* ── Extension points ─────────────────────────────────────────────────── */

  /**
   * Override in subclasses to provide navigation items.
   * @returns {Array<{
   *   path:      string,
   *   label:     string,
   *   icon:      string,
   *   exact?:    boolean,
   *   badge?:    number|null,
   *   isModal?:  boolean,
   * }>}
   */
  getNavItems()     { return []; }
  getLogo()         { return `<span class="ktg-sidebar__brand-text">${getBrandName()}</span>`; }
  getFooterContent(){ return ''; }
  getRegionSelector(){ return ''; } // Override in AdminSidebar

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { collapsed, currentRoute } = this.state;
    const navItems = this.getNavItems();
    const activePath = this._activePath(navItems, currentRoute);
    const regionSelector = this.getRegionSelector();

    return `
      <aside
        class="ktg-sidebar${collapsed ? ' ktg-sidebar--collapsed' : ''}"
        aria-label="${t('nav.mainNavLabel') || 'Main navigation'}"
      >

        <!-- Brand -->
        <div class="ktg-sidebar__brand">
          <div class="ktg-sidebar__logo">${this.getLogo()}</div>
          <button
            class="ktg-sidebar__collapse-btn"
            type="button"
            aria-label="${collapsed ? (t('nav.expandSidebar') || 'Expand sidebar') : (t('nav.collapseSidebar') || 'Collapse sidebar')}"
            aria-expanded="${!collapsed}"
            data-collapse
          >
            ${collapsed ? ICON.chevronRight : ICON.chevronLeft}
          </button>
        </div>

        ${regionSelector}

        <!-- Nav -->
        <nav class="ktg-sidebar__nav" aria-label="${t('nav.pageLinks') || 'Page navigation'}">
          <ul class="ktg-sidebar__nav-list" role="list">
            ${navItems.map((item) => this._renderNavItem(item, currentRoute, activePath)).join('')}
          </ul>
        </nav>

        <!-- Footer -->
        <div class="ktg-sidebar__footer">
          ${this.getFooterContent()}
        </div>

      </aside>
    `;
  }

  /* ── Nav item renderer ────────────────────────────────────────────────── */

  /**
   * Which nav path best describes the current route.
   *
   * Matching is prefix-based so /admin/news/42/edit still lights up
   * /admin/news. But when one nav path is a prefix of another, a route under
   * the deeper one matches both and two entries highlight at once. Resolving
   * to the longest matching path means the most specific entry wins and every
   * other one stays inactive.
   *
   * @private
   * @returns {string|null}
   */
  _activePath(navItems, currentRoute) {
    let best = null;

    for (const item of navItems) {
      const matches = item.exact
        ? currentRoute === item.path
        : currentRoute === item.path || currentRoute.startsWith(`${item.path}/`);

      if (matches && (best === null || item.path.length > best.length)) {
        best = item.path;
      }
    }

    return best;
  }

  /** @private */
  _renderNavItem(item, currentRoute, activePath = null) {
    const isActive = activePath !== null
      ? item.path === activePath
      : (item.exact
          ? currentRoute === item.path
          : currentRoute === item.path || currentRoute.startsWith(`${item.path}/`));

    const badgeHtml = item.badge
      ? `<span class="ktg-sidebar__badge" aria-label="${item.badge} unread">
           ${item.badge > 99 ? '99+' : item.badge}
         </span>`
      : '';

    // Tooltip only shows in collapsed mode (title attr)
    const tooltip = this.state.collapsed ? `title="${this.esc(item.label)}"` : '';

    const linkClass = `ktg-sidebar__nav-link${isActive ? ' ktg-sidebar__nav-link--active' : ''}`;
    const innerHtml = `
      <span class="ktg-sidebar__nav-icon" aria-hidden="true">${item.icon}</span>
      <span class="ktg-sidebar__nav-label">${this.esc(item.label)}</span>
      ${badgeHtml}
    `;

    if (item.isModal) {
      return `
        <li class="ktg-sidebar__nav-item">
          <button
            class="${linkClass}"
            type="button"
            data-modal-trigger="${this.esc(item.path)}"
            aria-label="${this.esc(item.label)}"
            ${tooltip}
          >
            ${innerHtml}
          </button>
        </li>
      `;
    }

    return `
      <li class="ktg-sidebar__nav-item">
        <a
          href="${this.esc(item.path)}"
          class="${linkClass}"
          aria-current="${isActive ? 'page' : 'false'}"
          ${tooltip}
        >
          ${innerHtml}
        </a>
      </li>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    // Collapse toggle
    this.delegate('[data-collapse]', 'click', () => {
      const collapsed = !this.state.collapsed;
      this.setState({ collapsed });
      store.sidebarCollapsed = collapsed;
    });

    // Active route tracking
    this.subscribe(store, 'currentRoute', (route) => {
      this.setState({ currentRoute: route });
    });

    // Badge count changes trigger a re-render
    this.subscribe(store, 'unreadNotificationCount', () => this.setState({}));
    this.subscribe(store, 'unreadChatCount',         () => this.setState({}));
  }

  /* ── Mobile API ───────────────────────────────────────────────────────── */

  openMobile() {
    this.el?.classList.add('ktg-sidebar--mobile-open');
    document.body.classList.add('ktg-sidebar-overlay-visible');
  }

  closeMobile() {
    this.el?.classList.remove('ktg-sidebar--mobile-open');
    document.body.classList.remove('ktg-sidebar-overlay-visible');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Web App Sidebar
   ══════════════════════════════════════════════════════════════════════════ */
export class WebSidebar extends Sidebar {

  getLogo() {
    const brandName = getBrandName();
    return `
      <div class="ktg-sidebar__logo-wrap">
        <div class="ktg-sidebar__logo-icon" aria-hidden="true">
          <svg width="35" height="35" viewBox="0 0 40 40" fill="none"
               xmlns="http://www.w3.org/2000/svg" focusable="false">
            <rect width="40" height="40" rx="10" fill="url(#webSidebarGrad)"/>
            <path d="M40 0 H30 A10 10 0 0 1 40 10 Z" fill="#E5B23A"/>
            <text x="50%" y="56%"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-family="Inter, system-ui, sans-serif"
                  font-weight="800"
                  font-size="15"
                  letter-spacing="-0.5"
                  fill="#ffffff">LK</text>
            <defs>
              <linearGradient id="webSidebarGrad" x1="0" y1="0" x2="40" y2="40"
                              gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stop-color="#0d4724"/>
                <stop offset="100%" stop-color="#068927"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="ktg-sidebar__brand-stack">
          <span class="ktg-sidebar__brand-text">${brandName}</span>
          <span class="ktg-sidebar__brand-sub">Lagos State</span>
        </div>
      </div>
    `;
  }

  getNavItems() {
    const region       = getRegion();
    const unreadNotifs = store.unreadNotificationCount || 0;
    const unreadChat   = store.unreadChatCount         || 0;

    return [
      { path: `/${region}/home`,          label: t('nav.home'),          icon: ICON.home,       exact: true },
      { path: `/${region}/news`,          label: t('nav.news'),          icon: ICON.trending    },
      { path: `/${region}/reels`,         label: t('nav.reels'),         icon: ICON.reels       },
      { path: `/${region}/chat`,          label: t('nav.chat'),          icon: ICON.chat,       badge: unreadChat   || null },
      { path: '/create-new-reel',         label: t('nav.createReel'),    icon: ICON.createPost, isModal: true },
      { path: `/${region}/notifications`, label: t('nav.notifications'), icon: ICON.bell,       badge: unreadNotifs || null },
      { path: '/referrals',               label: 'Referrals',            icon: ICON.star        },
      { path: `/${region}/settings`,      label: t('nav.settings'),      icon: ICON.settings    },
      { path: `/${region}/profile`,       label: t('nav.profile'),       icon: ICON.user        },
    ];
  }

  getFooterContent() {
    const user = store.currentUser;
    if (!user) return '';

    return `
      <div class="ktg-sidebar__user">
        <div class="ktg-sidebar__user-avatar">
          ${Avatar.html({ name: user.name, imageUrl: user.avatarUrl ?? null, size: 'md' })}
        </div>
        <div class="ktg-sidebar__user-info">
          <p class="ktg-sidebar__user-name">${this.esc(user.name)}</p>
          <p class="ktg-sidebar__user-lga">${this.esc(user.lgaName || '')}</p>
        </div>
        <button
          class="ktg-sidebar__logout"
          type="button"
          data-logout
          aria-label="${t('common.logout')}"
        >
          ${ICON.logout}
        </button>
      </div>
    `;
  }

  afterMount() {
    super.afterMount();

    // Create Reel modal
    this.delegate('[data-modal-trigger]', 'click', (_e, btn) => {
      if (btn.dataset.modalTrigger === '/create-new-reel') {
        window._createReelModal?.open();
      }
    });

    // Logout
    this.delegate('[data-logout]', 'click', async () => {
      try {
        const [{ clearSession }, { showToast }, { sseClient }] = await Promise.all([
          import('../../utils/storage.js'),
          import('../../core/store.js'),
          import('../../core/sseClient.js'),
        ]);
        sseClient.disconnect();
        clearSession();
        store.reset();
        router.replace('/login');
      } catch (err) {
        console.error('[WebSidebar] logout error:', err);
      }
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Admin Sidebar
   ══════════════════════════════════════════════════════════════════════════ */
export class AdminSidebar extends Sidebar {

  getLogo() {
    return `
      <div class="ktg-sidebar__logo-wrap">
        <div class="ktg-sidebar__logo-icon" aria-hidden="true">
          <svg width="35" height="35" viewBox="0 0 40 40" fill="none"
               xmlns="http://www.w3.org/2000/svg" focusable="false">
            <rect width="40" height="40" rx="10" fill="url(#admSidebarGrad)"/>
            <path d="M40 0 H30 A10 10 0 0 1 40 10 Z" fill="#E5B23A"/>
            <text x="50%" y="56%"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-family="Inter, system-ui, sans-serif"
                  font-weight="800"
                  font-size="15"
                  letter-spacing="-0.5"
                  fill="#ffffff">LK</text>
            <defs>
              <linearGradient id="admSidebarGrad" x1="0" y1="0" x2="40" y2="40"
                              gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stop-color="#0d4724"/>
                <stop offset="100%" stop-color="#068927"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="ktg-sidebar__brand-stack">
          <span class="ktg-sidebar__brand-text">Lagos Konect</span>
          <span class="ktg-sidebar__brand-sub">Lagos State</span>
        </div>
      </div>
    `;
  }

  /**
   * Returns the region selector tabs for admin.
   * Admin can switch between North, Central, South to manage content per region.
   */
  getRegionSelector() {
    const currentRegion = this._getAdminRegion();
    const regions = [
      { key: 'west',    label: 'West'    },
      { key: 'central', label: 'Central' },
      { key: 'east',    label: 'East'    },
    ];

    const tabs = regions.map(r => `
      <button
        class="admin-region-tab${r.key === currentRegion ? ' admin-region-tab--active' : ''}"
        type="button"
        data-region="${r.key}"
        aria-pressed="${r.key === currentRegion}"
      >${r.label}</button>
    `).join('');

    return `
      <div class="admin-region-selector" role="group" aria-label="Select region to manage">
        <span class="admin-region-label">Region:</span>
        <div class="admin-region-tabs">${tabs}</div>
      </div>
    `;
  }

  /**
   * Gets the current admin-selected region from sessionStorage.
   * @returns {'west'|'central'|'east'}
   */
  _getAdminRegion() {
    try {
      const r = sessionStorage.getItem('adminRegion');
      return VALID_REGIONS.includes(r) ? r : 'west';
    } catch {
      return 'west';
    }
  }

  /**
   * Sets the admin region in sessionStorage and triggers a re-render.
   * @param {string} region
   */
  _setAdminRegion(region) {
    if (!VALID_REGIONS.includes(region)) return;
    sessionStorage.setItem('adminRegion', region);
    store.adminRegion = region;
    this.setState({});
  }

  getNavItems() {
    return [
      { path: '/admin',                   label: t('adminNav.dashboard'),  icon: ICON.dashboard, exact: true },
      { path: '/admin/users',             label: t('adminNav.users'),      icon: ICON.users      },
      { path: '/admin/news',              label: t('adminNav.news'),       icon: ICON.news       },
      { path: '/admin/news/import',       label: 'Import News',            icon: ICON.news       },
      { path: '/admin/reels',             label: t('adminNav.reels'),      icon: ICON.reels      },
      { path: '/admin/chat',              label: t('adminNav.chat'),       icon: ICON.chat       },
      { path: '/admin/referrals',         label: 'Referral Contest',       icon: ICON.star       },
      { path: '/admin/withdrawals',       label: 'Referral Payouts',       icon: ICON.star       },
      { path: '/admin/content-moderation',label: t('adminNav.moderation'), icon: ICON.contentMod },
      { path: '/admin/adverts',           label: t('adminNav.adverts'),    icon: ICON.advert     },
      { path: '/admin/lga-data',          label: t('adminNav.lgaData'),    icon: ICON.lgaData    },
       { path: '/admin/analytics',         label: t('adminNav.analytics'),  icon: ICON.analytics  },
       { path: '/admin/active-users',     label: 'Active Users',           icon: ICON.star       },
       { path: '/admin/traffic',           label: t('adminNav.traffic'),    icon: ICON.traffic    },
      { path: '/admin/management',        label: t('adminNav.management'), icon: ICON.users      },
      { path: '/admin/settings',          label: t('adminNav.settings'),   icon: ICON.settings   },
    ];
  }

  getFooterContent() {
    const admin = store.currentAdmin;
    if (!admin) return '';

    const roleLabel = admin.role?.replace(/_/g, ' ') ?? '';

    return `
      <div class="ktg-sidebar__user">
        <div class="ktg-sidebar__user-avatar ktg-sidebar__user-avatar--admin">
          ${Avatar.html({ name: admin.name, imageUrl: admin.avatarUrl ?? null, size: 'md' })}
        </div>
        <div class="ktg-sidebar__user-info">
          <p class="ktg-sidebar__user-name">${this.esc(admin.name)}</p>
          <p class="ktg-sidebar__user-lga">${this.esc(roleLabel)}</p>
        </div>
        <button
          class="ktg-sidebar__logout"
          type="button"
          data-logout
          aria-label="${t('common.logout')}"
        >
          ${ICON.logout}
        </button>
      </div>
    `;
  }

  afterMount() {
    super.afterMount();

    // Region selector
    this.delegate('[data-region]', 'click', (_, btn) => {
      const region = btn.dataset.region;
      this._setAdminRegion(region);
    });

    this.delegate('[data-logout]', 'click', async () => {
      try {
        const [{ clearSession }, { api }] = await Promise.all([
          import('../../utils/storage.js'),
          import('../../api/client.js'),
        ]);
        await api.auth.adminLogout();
        clearSession();
        store.reset();
        router.replace('/admin/login');
      } catch (err) {
        console.error('[AdminSidebar] logout error:', err);
      }
    });
  }
}