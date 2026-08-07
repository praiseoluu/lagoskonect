/**
 * Lagos Konnect - Notifications Page
 * Route: /notifications
 * Guards: requireAuth + requireCitizen
 * ============================================================
 * Two states:
 *   Empty — "All Caught Up!" illustration, Refresh button, PRO TIP card
 *   List  — "SYSTEM INBOX" label, notification items, Load Older pagination
 *
 * Each notification item:
 *   - Icon derived from category (Official → leaf, Community → user avatar,
 *     Security Alert → shield, Event → people group)
 *   - Title, body, time ago (right-aligned)
 *   - Category badge + optional HIGH PRIORITY badge (when priority === 'high')
 *   - Left green border on unread items
 *   - Click marks as read + navigates to linkTo if set
 *
 * Category filtering is kept in state but hidden in the UI per design.
 * Tabs are commented out — can be re-enabled if the client requests them.
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260806h';
import { Avatar } from '../../../components/base/UI.js?v=20260806h';
import { store, showToast, setPageLoading } from '../../../core/store.js?v=20260806h';
import { router } from '../../../core/router.js?v=20260806h';
import { api } from '../../../api/client.js?v=20260806h';
import { timeAgo } from '../../../utils/date.js?v=20260806h';
import { t } from '../../../core/i18n.js?v=20260806h';

// ── Category icon map ─────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  'Official': `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>`,
  'Security Alert': `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`,
  'Event': `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>`,
  // Community uses actor avatar — handled separately in _renderItem
};

const CATEGORY_COLORS = {
  'Official': 'official',
  'Community': 'community',
  'Security Alert': 'security',
  'Event': 'event',
};

// Map raw category → its i18n key for the badge label
const CATEGORY_LABEL_KEYS = {
  'Official': 'notifications.catOfficial',
  'Community': 'notifications.catCommunity',
  'Security Alert': 'notifications.catSecurity',
  'Event': 'notifications.catEvent',
};

// ── Page ──────────────────────────────────────────────────────────────────

export default class NotificationsPage extends WebLayout {
  static styles = '/pages/web/app/Notifications.css?v=20260806h';

  constructor(props) {
    super({ title: t('notifications.title'), ...props });
    this._notifications = [];
    this._page = 1;
    this._perPage = 20;
    this._totalPages = 1;
    this._loading = true;
    // Category filter kept in state but UI hidden — comment in tabs to re-enable
    // this._activeCategory = 'All';
  }

  getContent() {
    return `<div class="notif-page" id="notif-root"></div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    await this._load();
    setPageLoading(false);
    this._renderPage();
  }

  // ── Data ──────────────────────────────────────────────────────────────

  async _load(append = false) {
    const res = await api.notifications.getForUser({
      page: this._page, perPage: this._perPage,
    });
    if (res.error) return;
    if (append) {
      this._notifications = [...this._notifications, ...(res.data || [])];
    } else {
      this._notifications = res.data || [];
    }
    this._totalPages = res.meta?.totalPages ?? 1;
    this._loading = false;
  }

  // ── Top-level render decision ─────────────────────────────────────────

  _renderPage() {
    const root = this.getContentEl()?.querySelector('#notif-root');
    if (!root) return;

    if (this._loading) {
      root.innerHTML = this._skeletonHtml();
      return;
    }

    if (!this._notifications.length) {
      this._renderEmpty(root);
    } else {
      this._renderList(root);
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────

  _renderEmpty(root) {
    root.innerHTML = `
      <div class="notif-empty">
        <!-- Illustration -->
        <div class="notif-empty__illustration" aria-hidden="true">
          <div class="notif-empty__circle">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-primary)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </div>
          <div class="notif-empty__check" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-primary)" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>

        <h2 class="notif-empty__title">${this.esc(t('notifications.emptyTitle'))}</h2>
        <p class="notif-empty__subtitle">
          ${this.esc(t('notifications.emptySubtitle'))}
        </p>

        <button class="notif-empty__refresh" id="notif-refresh" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          ${this.esc(t('notifications.refresh'))}
        </button>

        <!-- PRO TIP card -->
        <div class="notif-pro-tip">
          <div class="notif-pro-tip__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-primary)" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </div>
          <div class="notif-pro-tip__body">
            <span class="notif-pro-tip__label">${this.esc(t('notifications.proTipLabel'))}</span>
            <p class="notif-pro-tip__title">${this.esc(t('notifications.proTipTitle'))}</p>
            <p class="notif-pro-tip__text">
              ${this.esc(t('notifications.proTipText'))}
            </p>
            <a href="/west/settings" class="notif-pro-tip__link">${this.esc(t('notifications.proTipLink'))}</a>
          </div>
        </div>
      </div>
    `;

    const refreshBtn = root.querySelector('#notif-refresh');
    if (refreshBtn) {
      this.on(refreshBtn, 'click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = t('notifications.refreshing');
        this._page = 1;
        await this._load();
        this._renderPage();
      });
    }
  }

  // ── Notifications list ────────────────────────────────────────────────

  _renderList(root) {
    const unread = this._notifications.filter((n) => !n.isRead).length;

    root.innerHTML = `
      <!-- Header -->
      <div class="notif-header">
        <span class="notif-header__label">${this.esc(t('notifications.inboxLabel'))}</span>
        <div class="notif-header__row">
          <h1 class="notif-header__title">${this.esc(t('notifications.title'))}</h1>
          ${unread > 0 ? `
            <button class="notif-mark-all" id="mark-all-btn" type="button">
              ${this.esc(t('notifications.markAllRead'))}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Notification items -->
      <div class="notif-list" id="notif-list" role="list" aria-label="${this.esc(t('notifications.listAria'))}"
        aria-live="polite">
        ${this._notifications.map((n) => this._itemHtml(n)).join('')}
      </div>

      <!-- Load older -->
      ${this._page < this._totalPages ? `
        <div class="notif-load-more" id="notif-load-more">
          <button class="notif-load-more__btn" id="load-older-btn" type="button">
            ${this.esc(t('notifications.loadOlder'))}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      ` : ''}
    `;

    // Mark all read
    const markAllBtn = root.querySelector('#mark-all-btn');
    if (markAllBtn) {
      this.on(markAllBtn, 'click', () => this._markAllRead());
    }

    // Item clicks — single delegate
    this.delegate('.notif-item', 'click', (e, item) => {
      const id = item.dataset.notifId;
      const linkTo = item.dataset.linkTo;
      this._markRead(id, linkTo);
    });

    // Keyboard access on items
    this.delegate('.notif-item', 'keydown', (e, item) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });

    // Load older
    const loadOlderBtn = root.querySelector('#load-older-btn');
    if (loadOlderBtn) {
      this.on(loadOlderBtn, 'click', async () => {
        loadOlderBtn.textContent = t('notifications.loading');
        loadOlderBtn.disabled = true;
        this._page += 1;
        await this._load(true); // append mode
        this._renderList(root);
      });
    }
  }

  // ── Item HTML ─────────────────────────────────────────────────────────

  _itemHtml(notif) {
    const isUnread = !notif.isRead;
    const colorClass = CATEGORY_COLORS[notif.category] || 'official';
    const isHigh = notif.priority === 'high';
    const categoryLabel = t(CATEGORY_LABEL_KEYS[notif.category] || 'notifications.catOfficial');

    // Translate title/body if the backend supplied a template key (i18n support)
    const tVars = notif.templateVars || {};
    const displayTitle = notif.templateKey
      ? t(`${notif.templateKey}.title`, tVars)
      : notif.title;
    // Only use translated body when a body key exists in the locale (falls back gracefully)
    const _bodyKeyAttempt = notif.templateKey ? t(`${notif.templateKey}.body`, tVars) : null;
    const displayBody = (_bodyKeyAttempt && _bodyKeyAttempt !== `${notif.templateKey}.body`)
      ? _bodyKeyAttempt
      : notif.body;

    // Icon: Community shows actor avatar, others show category icon
    let iconHtml;
    if (notif.category === 'Community' && notif.actorName) {
      iconHtml = `
        <div class="notif-item__avatar">
          ${Avatar.html({ name: notif.actorName, imageUrl: notif.actorAvatarUrl, size: 'md' })}
        </div>`;
    } else {
      iconHtml = `
        <div class="notif-item__icon notif-item__icon--${colorClass}" aria-hidden="true">
          ${CATEGORY_ICONS[notif.category] || CATEGORY_ICONS['Official']}
        </div>`;
    }

    return `
      <div
        class="notif-item ${isUnread ? 'notif-item--unread' : ''}"
        role="listitem"
        data-notif-id="${notif.id}"
        data-link-to="${this.esc(notif.linkTo || '')}"
        tabindex="0"
        aria-label="${this.esc(displayTitle)}${isUnread ? this.esc(t('notifications.unreadSuffix')) : ''}"
      >
        ${iconHtml}
        <div class="notif-item__body">
          <div class="notif-item__top">
            <div class="notif-item__titles">
              <p class="notif-item__title">${this.esc(displayTitle)}</p>
              <p class="notif-item__text">${this.esc(displayBody)}</p>
            </div>
            <span class="notif-item__time">${timeAgo(notif.createdAt)}</span>
          </div>
          <div class="notif-item__badges">
            <span class="notif-badge notif-badge--${colorClass}">
              ${this.esc(categoryLabel.toUpperCase())}
            </span>
            ${isHigh ? `<span class="notif-badge notif-badge--priority">${this.esc(t('notifications.highPriority'))}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ── Skeleton ──────────────────────────────────────────────────────────

  _skeletonHtml() {
    return `
      <div class="notif-skeleton-wrap" aria-hidden="true">
        <div class="notif-skeleton-header">
          <div class="notif-sk-line notif-sk-line--label"></div>
          <div class="notif-sk-line notif-sk-line--title"></div>
        </div>
        ${[1, 2, 3, 4, 5].map(() => `
          <div class="notif-skeleton-item">
            <div class="notif-sk-icon"></div>
            <div class="notif-sk-content">
              <div class="notif-sk-line notif-sk-line--title"></div>
              <div class="notif-sk-line notif-sk-line--body"></div>
              <div class="notif-sk-line notif-sk-line--badge"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Actions ───────────────────────────────────────────────────────────

  async _markRead(id, linkTo) {
    // String comparison — id from dataset is always a string
    const notif = this._notifications.find((n) => String(n.id) === String(id));
    if (!notif) return;

    if (!notif.isRead) {
      notif.isRead = true;
      store.unreadNotificationCount = Math.max(
          0, (store.unreadNotificationCount || 0) - 1
      );
      // Update DOM directly — no full re-render needed for a single item
      const el = this.getContentEl()?.querySelector(`[data-notif-id="${id}"]`);
      if (el) el.classList.remove('notif-item--unread');

      // Update header unread count
      this._updateUnreadSubtitle();

      await api.notifications.markRead(Number(id));
    }

    if (linkTo) router.push(linkTo);
  }

  async _markAllRead() {
    this._notifications.forEach((n) => { n.isRead = true; });
    store.unreadNotificationCount = 0;

    // Update DOM — remove all unread styles without full re-render
    this.getContentEl()?.querySelectorAll('.notif-item--unread').forEach((el) => {
      el.classList.remove('notif-item--unread');
    });

    // Remove the "Mark all as read" button
    const btn = this.getContentEl()?.querySelector('#mark-all-btn');
    btn?.remove();

    this._updateUnreadSubtitle();

    await api.notifications.markAllRead();
    showToast('success', t('notifications.allMarkedRead'));
  }

  _updateUnreadSubtitle() {
    // No subtitle in the list view design — just update sidebar badge
    // (store.unreadNotificationCount subscription handles sidebar re-render)
  }

  /*
   * ── Category filter (hidden — tabs commented out per design) ──────────
   * Uncomment the Tabs component and this method to re-enable filtering.
   *
   * _filterNotifications() {
   *   if (this._activeCategory === 'All') return this._notifications;
   *   return this._notifications.filter(
   *     (n) => n.category === this._activeCategory
   *   );
   * }
   *
   * To render tabs, add inside _renderList():
   *   const tabs = this.addChild(new Tabs({
   *     tabs: ['All','Official','Community','Security Alert','Event']
   *       .map((c) => ({ key: c, label: c })),
   *     activeKey: this._activeCategory,
   *     onChange: (key) => {
   *       this._activeCategory = key;
   *       this._renderList(root);
   *     },
   *   }));
   *   tabs.mount(root.querySelector('#tabs-mount'));
   */
}
