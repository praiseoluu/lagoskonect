/**
 * Lagos Konect — BaseLayout Component
 * ============================================================
 * Authenticated page shell: Sidebar + Topbar + main content area.
 *
 * Subclasses:
 *   WebLayout   — citizen app   (WebSidebar + WebTopbar)
 *   AdminLayout — admin dashboard (AdminSidebar + AdminTopbar)
 *
 * Usage — extend for pages that need full control:
 *   export default class HomePage extends WebLayout {
 *     getContent()     { return `<div>…</div>`; }
 *     onContentReady() { /* fetch data, mount children * / }
 *   }
 *
 * @module  BaseLayout
 * @version 2.0.0
 */

import { Component }      from '../../core/component.js?v=20260806c';
// Versioned: the sidebar and topbar are shared by every page, so a browser
// holding an old copy shows stale navigation no matter what else is deployed.
// A fresh URL is the only thing a populated cache cannot ignore.
import { WebSidebar, AdminSidebar } from './Sidebar.js?v=20260806c';
import { WebTopbar, AdminTopbar }   from './Topbar.js?v=20260806c';
import { ToastContainer } from '../base/UI.js?v=20260806c';
import { store }          from '../../core/store.js?v=20260806c';
import { api }            from '../../api/client.js?v=20260806c';
import { CreateReelModal }  from '../feature/CreateReel.js?v=20260806c';
import { SelectLGAModal }   from '../feature/SelectLGAModal.js?v=20260806c';
import { sseClient }        from '../../core/sseClient.js?v=20260806c';

/* ── Brand helper ───────────────────────────────────────────────────────── */
const BRAND_MAP = Object.freeze({
  west:    'Lagos Konect - West',
  central: 'Lagos Konect - Central',
  east:    'Lagos Konect - East',
});

function getBrandName() {
  try {
    const r = sessionStorage.getItem('lagosRegion');
    return BRAND_MAP[r] ?? 'Lagos Konect';
  } catch {
    return 'Lagos Konect';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BaseLayout
   ══════════════════════════════════════════════════════════════════════════ */
export class BaseLayout extends Component {
  static styles = '/components/layout/BaseLayout.css?v=20260806c';

  constructor(props = {}) {
    super({ title: '', breadcrumbs: [], ...props });
    this._sidebar = null;
    this._topbar  = null;
    this._toast   = null;
  }

  /* ── Extension points ─────────────────────────────────────────────────── */

  getSidebarClass() { throw new Error('getSidebarClass() must be implemented'); }
  getTopbarClass()  { throw new Error('getTopbarClass() must be implemented'); }

  /** @returns {string} HTML for the main content area */
  getContent() { return ''; }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return `
      <div class="ktg-layout">
        <div class="ktg-layout__main" id="layout-main">
          <div class="ktg-layout__topbar" id="layout-topbar"></div>
          <main
            class="ktg-layout__content"
            id="layout-content"
            role="main"
            aria-label="${this.esc(this.props.title || 'Main content')}"
          >
            ${this.getContent()}
          </main>
        </div>
      </div>
    `;
    /*
     * NOTE: the sidebar is mounted directly onto document.body (see afterMount).
     * If it were inside .ktg-layout, any transform / overflow / filter on that
     * ancestor would create a containing block that traps position:fixed
     * children, breaking the mobile slide-out behaviour.
     */
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  async afterMount() {
    // ── Sidebar ────────────────────────────────────────────────────────
    const SidebarClass = this.getSidebarClass();
    this._sidebar = this.addChild(new SidebarClass());
    await this._sidebar.mount(document.body, { append: true });

    // Move to start of body so it appears before the app shell in the DOM order
    if (this._sidebar.el && document.body.firstChild !== this._sidebar.el) {
      document.body.insertBefore(this._sidebar.el, document.body.firstChild);
    }

    // ── Topbar ─────────────────────────────────────────────────────────
    const TopbarClass = this.getTopbarClass();
    this._topbar = this.addChild(new TopbarClass({
      title:       this.props.title,
      breadcrumbs: this.props.breadcrumbs,
      onMenuClick: () => this._handleMenuClick(),
    }));
    await this._topbar.mount(document.getElementById('layout-topbar'));

    // ── Toast container (singleton) ────────────────────────────────────
    if (!document.querySelector('.ktg-toast-container')) {
      this._toast = new ToastContainer();
      await this._toast.mount(document.body, { append: true });
    }

    // ── Page loading overlay ────────────────────────────────────────────
    this.subscribe(store, 'isPageLoading', (loading) => {
      this._handlePageLoading(loading);
    });

    // ── Page-level init ─────────────────────────────────────────────────
    await this.onContentReady();
  }

  /**
   * Called after the layout is fully mounted.
   * Override in page subclasses to fetch data, mount child components, etc.
   */
  onContentReady() { }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  /** @private */
  _handleMenuClick() {
    this._sidebar.openMobile();

    const closeOverlay = (e) => {
      const sidebar = document.querySelector('.ktg-sidebar');
      if (!sidebar?.contains(e.target)) {
        this._sidebar.closeMobile();
        document.removeEventListener('click', closeOverlay);
      }
    };

    // Defer so the current click doesn't immediately close the drawer
    setTimeout(() => document.addEventListener('click', closeOverlay), 10);
  }

  /** @private */
  _handlePageLoading(loading) {
    const contentEl = document.getElementById('layout-content');
    if (!contentEl) return;

    const existing = contentEl.querySelector('#layout-loading');

    if (loading && !existing) {
      const overlay       = document.createElement('div');
      overlay.id          = 'layout-loading';
      overlay.className   = 'page-loading-overlay';
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML   = `
        <div class="page-loading-spinner" role="status" aria-label="${'Loading'}"></div>
      `;
      contentEl.appendChild(overlay);
    } else if (!loading && existing) {
      existing.remove();
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  setContent(html) {
    const content = document.getElementById('layout-content');
    if (content) content.innerHTML = html;
  }

  /** @returns {HTMLElement|null} */
  getContentEl() {
    return document.getElementById('layout-content');
  }

  setTitle(title) {
    this.props.title = title;
    this._topbar?.update({ title });
    document.title = `${title} — ${getBrandName()}`;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Web App Layout
   ══════════════════════════════════════════════════════════════════════════ */
export class WebLayout extends BaseLayout {
  getSidebarClass() { return WebSidebar; }
  getTopbarClass()  { return WebTopbar;  }

  async afterMount() {
    // Auth guard
    if (!store.isAuthenticated || store.role !== 'citizen') {
      const { router } = await import('../../core/router.js?v=20260806c');
      router.replace('/login');
      return;
    }

    await super.afterMount();

    // ── Global singletons ────────────────────────────────────────────
    // Mounted once for the entire session lifetime. Not registered as
    // addChild() — these must survive layout re-renders.
    if (!window._createReelModal) {
      window._createReelModal = new CreateReelModal();
      await window._createReelModal.mount(document.body, { append: true });
    }

    if (!window._selectLGAModal) {
      window._selectLGAModal = new SelectLGAModal();
      await window._selectLGAModal.mount(document.body, { append: true });
    }

    // ── Badge seed (fire-and-forget) ────────────────────────────────
    // After the initial fetch, SSE pushes keep the counts fresh.
    if (store.currentUser) {
      api.notifications.getUnreadCount().then((res) => {
        if (res?.data?.count != null) store.unreadNotificationCount = res.data.count;
      }).catch(() => { /* non-critical */ });

      api.chat.getUnreadCount().then((res) => {
        if (res?.data?.count != null) store.unreadChatCount = res.data.count;
      }).catch(() => { /* non-critical */ });
    }

    // ── LGA list ────────────────────────────────────────────────────
    if (!store.lgaList?.length) {
      api.lgas.getAll().then((res) => {
        if (res?.data) store.lgaList = res.data;
      }).catch(() => { /* non-critical */ });
    }

    // ── SSE connection ──────────────────────────────────────────────
    // connect() is idempotent — safe to call on every page navigation.
    sseClient.connect();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Admin Layout
   ══════════════════════════════════════════════════════════════════════════ */
export class AdminLayout extends BaseLayout {
  constructor(props = {}) {
    super({ title: '', breadcrumbs: [], ...props });
  }

  getSidebarClass() { return AdminSidebar; }
  getTopbarClass()  { return AdminTopbar;  }

  async afterMount() {
    // Auth guard
    const isAdmin = store.isAuthenticated &&
      (store.role === 'admin' || store.role === 'super_admin');

    if (!isAdmin) {
      const { router } = await import('../../core/router.js?v=20260806c');
      router.replace('/login');
      return;
    }

    await super.afterMount();
  }

  /* ── Admin helpers ────────────────────────────────────────────────────── */

  /**
   * Inserts a standard page header into the content area.
   *
   * @param {{ title: string, subtitle?: string, actionsHtml?: string }} opts
   * @returns {HTMLElement|null}
   */
  renderPageHeader({ title, subtitle = '', actionsHtml = '' } = {}) {
    const content = this.getContentEl();
    if (!content) return null;

    const header = document.createElement('div');
    header.className = 'ktg-page-header';
    header.innerHTML = `
      <div class="ktg-page-header__text">
        <h1 class="ktg-page-header__title">${this.esc(title)}</h1>
        ${subtitle
          ? `<p class="ktg-page-header__subtitle">${this.esc(subtitle)}</p>`
          : ''}
      </div>
      ${actionsHtml
        ? `<div class="ktg-page-header__actions" id="page-header-actions">
             ${actionsHtml}
           </div>`
        : ''}
    `;

    content.insertBefore(header, content.firstChild);
    return header;
  }

  /**
   * Mounts a button component into the page header actions slot.
   *
   * @param {Component} buttonInstance
   */
  mountHeaderAction(buttonInstance) {
    const slot = this.getContentEl()?.querySelector('#page-header-actions');
    if (!slot) return;
    this.addChild(buttonInstance);
    buttonInstance.mount(slot);
  }
}