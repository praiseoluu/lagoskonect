/**
 * Lagos Konect — Topbar Component
 * ============================================================
 * Shared topbar used by both the web app and admin layouts.
 *
 *   WebTopbar   — citizen-facing: LGA selector + bell + avatar
 *   AdminTopbar — admin-facing:   breadcrumb + avatar + language switcher
 *
 * @module  Topbar
 * @version 2.0.0
 */

import { Component }        from '../../core/component.js?v=20260806h';
import { Avatar }           from '../base/UI.js?v=20260806h';
import { store }            from '../../core/store.js?v=20260806h';
import { t }                from '../../core/i18n.js?v=20260806h';
import { LanguageSwitcher } from '../feature/LanguageSwitcher.js?v=20260806h';

/* ── Icons ──────────────────────────────────────────────────────────────── */
const ICON = Object.freeze({
  menu:        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  bell:        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  map:         `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  chevronDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"/></svg>`,
});

/* ── Shared utility ─────────────────────────────────────────────────────── */

/**
 * Mounts a compact ghost LanguageSwitcher into the `[data-lang-slot]`
 * element of the given component. Shared by both WebTopbar and AdminTopbar.
 *
 * @param {Component} component
 */
function mountTopbarLangSwitcher(component) {
  const slot = component.$('[data-lang-slot]');
  if (!slot) return;

  const switcher = component.addChild(
    new LanguageSwitcher({ compact: true, variant: 'ghost', align: 'end' }),
  );
  switcher.mount(slot);
}

/* ══════════════════════════════════════════════════════════════════════════
   Base Topbar
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Abstract base — do not instantiate directly.
 * Use WebTopbar or AdminTopbar.
 */
export class Topbar extends Component {
  static styles = '/components/layout/Topbar.css?v=20260806h';

  constructor(props = {}) {
    super({ title: '', onMenuClick: null, ...props });
  }

  render() {
    throw new Error('Topbar is abstract. Use WebTopbar or AdminTopbar.');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Web App Topbar
   ══════════════════════════════════════════════════════════════════════════ */
export class WebTopbar extends Component {
  static styles = '/components/layout/Topbar.css?v=20260806h';

  constructor(props = {}) {
    super({ title: '', onMenuClick: null, ...props });
    this.state = {
      unread: store.unreadNotificationCount || 0,
      lga:    store.currentLGA,
    };
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  render() {
    const { title }    = this.props;
    const { unread, lga } = this.state;
    const user         = store.currentUser;
    const lgaName      = lga?.name || t('topbar.selectLGA');
    const region       = sessionStorage.getItem('lagosRegion') || 'west';

    return `
      <header class="ktg-topbar" role="banner">

        <!-- Left: hamburger + page title -->
        <div class="ktg-topbar__left">
          <button
            class="ktg-topbar__menu-btn"
            type="button"
            aria-label="${this.esc(t('topbar.openNav') || 'Open navigation')}"
            data-menu-btn
          >
            ${ICON.menu}
          </button>
          ${title
            ? `<h1 class="ktg-topbar__title">${this.esc(title)}</h1>`
            : ''}
        </div>

        <!-- Right: language + LGA + bell + avatar -->
        <div class="ktg-topbar__right">

          <div class="ktg-topbar__lang" data-lang-slot></div>

          <!-- LGA selector -->
          <button
            class="ktg-topbar__lga-btn"
            type="button"
            aria-label="${this.esc(t('topbar.changeLGA', { name: lgaName }) || `Change LGA: ${lgaName}`)}"
            aria-haspopup="dialog"
            data-lga-open
          >
            <span class="ktg-topbar__lga-icon">${ICON.map}</span>
            <span class="ktg-topbar__lga-name">${this.esc(lgaName)}</span>
            <span class="ktg-topbar__lga-chevron">${ICON.chevronDown}</span>
          </button>

          <!-- Notification bell -->
          <a
            href="/${region}/notifications"
            class="ktg-topbar__icon-btn"
            aria-label="${this.esc(
              unread > 0
                ? (t('topbar.unread', { count: unread }) || `${unread} unread notifications`)
                : (t('topbar.notifications') || 'Notifications')
            )}"
          >
            ${ICON.bell}
            ${unread > 0
              ? `<span class="ktg-topbar__badge" aria-hidden="true">
                   ${unread > 99 ? '99+' : unread}
                 </span>`
              : ''}
          </a>

          <!-- Avatar / profile -->
          <a
            href="/${region}/profile"
            class="ktg-topbar__avatar-btn"
            aria-label="${this.esc(t('topbar.myProfile') || 'My profile')}"
          >
            ${Avatar.html({ name: user?.name || '', imageUrl: user?.avatarUrl ?? null, size: 'sm' })}
          </a>

        </div>
      </header>
    `;
  }

  /* ── Lifecycle ──────────────────────────────────────────────────────── */

  afterMount() {
    mountTopbarLangSwitcher(this);

    this.delegate('[data-menu-btn]', 'click', () => {
      this.props.onMenuClick?.();
    });

    this.delegate('[data-lga-open]', 'click', () => {
      if (typeof window._selectLGAModal?.open === 'function') {
        window._selectLGAModal.open();
      }
    });

    this.subscribe(store, 'unreadNotificationCount', (count) => {
      this.setState({ unread: count || 0 });
    });

    this.subscribe(store, 'currentLGA', (lga) => {
      this.setState({ lga });
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Admin Topbar
   ══════════════════════════════════════════════════════════════════════════ */
export class AdminTopbar extends Component {
  static styles = '/components/layout/Topbar.css?v=20260806h';

  constructor(props = {}) {
    super({
      title:       '',
      breadcrumbs: [],
      onMenuClick: null,
      ...props,
    });
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  render() {
    const { title, breadcrumbs } = this.props;
    const admin = store.currentAdmin;

    return `
      <header class="ktg-topbar ktg-topbar--admin" role="banner">

        <div class="ktg-topbar__left">
          <button
            class="ktg-topbar__menu-btn"
            type="button"
            aria-label="${this.esc(t('topbar.openNav') || 'Open navigation')}"
            data-menu-btn
          >
            ${ICON.menu}
          </button>
          ${this._renderLeftContent(title, breadcrumbs)}
        </div>

        <div class="ktg-topbar__right">
          <div class="ktg-topbar__lang" data-lang-slot></div>
          <a
            href="/admin/settings"
            class="ktg-topbar__avatar-btn"
            aria-label="${this.esc(t('topbar.accountSettings') || 'Account settings')}"
          >
            ${Avatar.html({ name: admin?.name || t('topbar.admin') || 'Admin', size: 'sm' })}
            <span class="ktg-topbar__admin-name">
              ${this.esc(admin?.name?.split(' ')[0] || t('topbar.admin') || 'Admin')}
            </span>
          </a>
        </div>

      </header>
    `;
  }

  /**
   * Renders breadcrumbs when provided, otherwise a plain heading.
   * @private
   */
  _renderLeftContent(title, breadcrumbs) {
    if (breadcrumbs?.length > 0) {
      return this._renderBreadcrumb(breadcrumbs);
    }
    if (title) {
      return `<h1 class="ktg-topbar__title">${this.esc(title)}</h1>`;
    }
    return '';
  }

  /**
   * @private
   * @param {Array<{ label: string, path?: string }>} crumbs
   */
  _renderBreadcrumb(crumbs) {
    const items = crumbs.map((crumb, i) => {
      const isLast = i === crumbs.length - 1;
      const inner  = crumb.path && !isLast
        ? `<a href="${this.esc(crumb.path)}" class="ktg-topbar__breadcrumb-link">${this.esc(crumb.label)}</a>`
        : `<span class="ktg-topbar__breadcrumb-current"${isLast ? ' aria-current="page"' : ''}>${this.esc(crumb.label)}</span>`;

      return `
        <li class="ktg-topbar__breadcrumb-item">
          ${inner}
          ${!isLast ? `<span class="ktg-topbar__breadcrumb-sep" aria-hidden="true">/</span>` : ''}
        </li>
      `;
    }).join('');

    return `
      <nav class="ktg-topbar__breadcrumb" aria-label="${t('topbar.breadcrumb') || 'Breadcrumb'}">
        <ol class="ktg-topbar__breadcrumb-list">
          ${items}
        </ol>
      </nav>
    `;
  }

  /* ── Lifecycle ──────────────────────────────────────────────────────── */

  afterMount() {
    mountTopbarLangSwitcher(this);

    this.delegate('[data-menu-btn]', 'click', () => {
      this.props.onMenuClick?.();
    });
  }
}