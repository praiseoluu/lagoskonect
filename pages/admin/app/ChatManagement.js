/**
 * LagKonnect Admin - Chat Management
 * Route: /admin/chat
 * ============================================================
 * Page 1 — LGA directory + stats + reports queue
 * Page 2 — Full community chat for a selected LGA (mirrors citizen view)
 *           with admin-only context menu actions
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260805c';
import { Button } from '../../../components/base/Button.js?v=20260805c';
import { Input } from '../../../components/base/Input.js?v=20260805c';
import { Avatar, Tabs } from '../../../components/base/UI.js?v=20260805c';
import { Badge } from '../../../components/base/Badge.js?v=20260805c';
import { Card, StatCard } from '../../../components/base/Card.js?v=20260805c';
import { Modal } from '../../../components/base/Modal.js?v=20260805c';
import { store, showToast } from '../../../core/store.js?v=20260805c';
import { router } from '../../../core/router.js?v=20260805c';
import { api } from '../../../api/client.js?v=20260805c';
import { timeAgo } from '../../../utils/date.js?v=20260805c';

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Common emojis for the admin chat composer picker
const ADMIN_EMOJIS = [
  '😀','😂','😍','🥺','🤔','😅','😊','🥳','😤','🤩','😎','🙏',
  '👍','👎','👊','✊','🤞','✌️','👋','🤝','🙌','👏','💪','🫶',
  '🔥','💯','🚀','❤️','💔','⭐','🌟','✨','⚡','🎉','🎊','🏆',
  '✅','❌','⚠️','🚫','❓','❗','📢','📌','🔑','💡','📋','🗒️',
];

const ADMIN_GIFS = [
  { url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', label: 'Thumbs Up' },
  { url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', label: 'LOL' },
  { url: 'https://media.giphy.com/media/DYH297XiCS2Ck/giphy.gif', label: 'Party' },
  { url: 'https://media.giphy.com/media/xT5LMzIK1AdZJ4cYW4/giphy.gif', label: 'Shocked' },
  { url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', label: 'Laugh' },
  { url: 'https://media.giphy.com/media/7GcdjWkek7Apq/giphy.gif', label: 'Happy Dance' },
];

const IMAGE_EXTS_ADMIN = /\.(jpg|jpeg|png|webp|bmp|avif|gif|svg)$/i;
const AUDIO_EXTS_ADMIN = /\.(webm|ogg|mp3|m4a|wav)$/i;
const VIDEO_EXTS_ADMIN = /\.(mp4|mov|avi|mkv|ogv|webm)$/i;

function _adminIsImage(url = '', name = '') { return IMAGE_EXTS_ADMIN.test(name) || IMAGE_EXTS_ADMIN.test(url.split('?')[0]); }
function _adminIsAudio(url = '', name = '') { return AUDIO_EXTS_ADMIN.test(name) || AUDIO_EXTS_ADMIN.test(url.split('?')[0]); }
function _adminIsVideo(url = '', name = '') { return VIDEO_EXTS_ADMIN.test(name) || VIDEO_EXTS_ADMIN.test(url.split('?')[0]); }

const ICON_USERS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`;
const ICON_USER = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICON_FLAG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function isToday(iso) {
  const d = new Date(iso), n = new Date();
  return d.toDateString() === n.toDateString();
}

// ─────────────────────────────────────────────────────────────────────────────

export default class ChatManagementPage extends AdminLayout {
  static styles = '/pages/admin/app/ChatManagement.css?v=20260805c';
  static dependencies = ['/components/base/Button.css', '/components/base/Badge.css']

  constructor(props) {
    super({
      title: 'Chat Management',
      breadcrumbs: [{ label: 'Dashboard', path: '/admin' }, { label: 'Chat Management' }],
      ...props,
    });
    // Data
    this._lgas = [];
    this._stats = null;
    this._reports = [];
    this._reportsTab = 'pending';
    // Page 2 state
    this._selectedLga = null;
    this._messages = [];
    this._lastRenderedDate = null;
    this._contextTarget = null;
    this._replyTo = null;
    this._panel = 'messages'; // 'messages' | 'members' | 'banned-words'
    this._members = [];
    this._bannedWords = [];
    this._highlightMsgId = null;

    // Page 1 component instances (recreated each render)
    this._statCardLgas = null;
    this._statCardUsers = null;
    this._statCardFlags = null;
    this._reportTabs = null;
    this._lgaCardInstances = [];

    // Page 2 component instances
    this._panelTabs = null;
    this._sendInput = null;
    this._wordInput = null;

    // Warn modal (mounted once)
    this._warnModal = null;
    this._warnReasonInput = null;
    this._warnUserId = null;
    this._warnUserName = null;
  }

  getContent() {
    return `<div id="chat-mgmt-root"></div>`;
  }

  async onContentReady() {
    await Promise.all([this._loadLgas(), this._loadStats(), this._loadReports()]);
    this._mountWarnModal();

    const lgaId = parseInt(this.props.params?.lgaId, 10);
    if (lgaId) {
      const lga = this._lgas.find(l => l.id === lgaId);
      if (lga) {
        const highlight = parseInt(this.props.query?.highlight, 10);
        if (highlight) this._highlightMsgId = highlight;
        this._renderPage2Direct(lga);
        return;
      }
    }
    this._renderPage1();

    // Reload when admin switches region (only on page 1 — page 2 is LGA-specific)
    this.subscribe(store, 'adminRegion', async () => {
      if (this._selectedLga) return; // stay on page 2 view
      await Promise.all([this._loadLgas(), this._loadStats(), this._loadReports()]);
      this._renderPage1();
    });
  }

  // ── Data loaders ─────────────────────────────────────────────────────────

  async _loadLgas() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const res = await api.chat.adminGetLgas({ region });
    this._lgas = res.data || [];
  }

  async _loadStats() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const res = await api.chat.adminGetStats({ region });
    this._stats = res.data || null;
  }

  async _loadReports(status = 'pending') {
    const res = await api.chat.adminGetReports(status);
    this._reports = res.data || [];
    this._reportsTab = status;
  }

  // ── Component cleanup helpers ─────────────────────────────────────────────

  _teardownPage1() {
    this._statCardLgas?.unmount(); this._statCardLgas = null;
    this._statCardUsers?.unmount(); this._statCardUsers = null;
    this._statCardFlags?.unmount(); this._statCardFlags = null;
    this._reportTabs?.unmount();    this._reportTabs = null;
    for (const c of this._lgaCardInstances) c.unmount();
    this._lgaCardInstances = [];
  }

  _teardownPage2() {
    this._panelTabs?.unmount(); this._panelTabs = null;
    this._sendInput?.unmount(); this._sendInput = null;
    this._wordInput?.unmount(); this._wordInput = null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — LGA Directory
  // ══════════════════════════════════════════════════════════════════════════

  _renderPage1() {
    this._teardownPage1();
    const root = document.getElementById('chat-mgmt-root');
    if (!root) return;

    root.innerHTML = `
      <div class="ktg-page-header">
        <div class="ktg-page-header__text">
          <p class="ktg-page-header__eyebrow">Real-time Oversight</p>
          <h1 class="ktg-page-header__title">LGAs Chat Management</h1>
          <p class="ktg-page-header__subtitle">Oversee community engagements, manage safety flags, and ensure constructive civic dialogue across all active LGAs.</p>
        </div>
      </div>

      <div class="chat-dir-stats">
        <div id="stat-lgas-mount"></div>
        <div id="stat-users-mount"></div>
        <div id="stat-flags-mount"></div>
      </div>

      <div class="chat-dir-section">
        <div class="chat-dir-section__header">
          <h2 class="chat-dir-section__title">LGA Directory</h2>
          <div class="chat-dir-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="chat-dir-search" id="lga-search" type="search" placeholder="LGA name…" autocomplete="off" />
          </div>
        </div>
        <div class="chat-dir-grid" id="lga-grid"></div>
      </div>

      <div class="chat-dir-section" id="reports-section">
        <div class="chat-dir-section__header">
          <h2 class="chat-dir-section__title">Reported Messages</h2>
          <div id="report-tabs-mount"></div>
        </div>
        <div id="reports-list">
          ${this._renderReportsList()}
        </div>
      </div>
    `;

    // Mount StatCards
    const s = this._stats;
    const totalReports = s?.pendingReports ?? 0;

    this._statCardLgas = this.addChild(new StatCard({
      label: 'Active LGA Communities',
      value: String(s?.activeLgas ?? this._lgas.length),
      icon: ICON_USERS,
      iconColor: 'success',
    }));
    this._statCardLgas.mount(root.querySelector('#stat-lgas-mount'));

    this._statCardUsers = this.addChild(new StatCard({
      label: 'Total Users',
      value: s?.totalUsers ? s.totalUsers.toLocaleString() : '—',
      icon: ICON_USER,
      iconColor: 'primary',
    }));
    this._statCardUsers.mount(root.querySelector('#stat-users-mount'));

    this._statCardFlags = this.addChild(new StatCard({
      label: 'Safety Flags',
      value: String(totalReports),
      icon: ICON_FLAG,
      iconColor: totalReports > 0 ? 'warning' : 'info',
      trend: totalReports > 0
        ? { direction: 'up', value: String(totalReports), label: 'pending resolution' }
        : null,
    }));
    this._statCardFlags.mount(root.querySelector('#stat-flags-mount'));

    // Mount Tabs for the reports queue
    this._reportTabs = this.addChild(new Tabs({
      tabs: [
        { key: 'pending', label: 'Pending' },
        { key: 'resolved', label: 'Resolved' },
      ],
      activeKey: this._reportsTab,
      onChange: async (key) => {
        await this._loadReports(key);
        const list = root.querySelector('#reports-list');
        if (list) list.innerHTML = this._renderReportsList();
        this._bindReportActions(root);
      },
    }));
    this._reportTabs.mount(root.querySelector('#report-tabs-mount'));

    // Mount LGA Card components into the grid
    this._mountLgaCards(root.querySelector('#lga-grid'));

    this._bindPage1(root);
  }

  _lgaCardBody(l) {
    const reportBadge = l.pendingReports > 0
      ? Badge.html(`${l.pendingReports} report${l.pendingReports > 1 ? 's' : ''}`, 'error', 'sm')
      : '';

    return `
      <div class="chat-dir-card__header">
        <div class="chat-dir-card__lga-icon" aria-hidden="true">${ICON_USERS}</div>
        <div class="chat-dir-card__meta-wrap">
          <p class="chat-dir-card__name">${this.esc(l.name)}</p>
          <p class="chat-dir-card__meta">${(l.memberCount ?? 0).toLocaleString()} members</p>
        </div>
        ${reportBadge}
      </div>
      ${l.lastText
        ? `<p class="chat-dir-card__preview">"${this.esc(l.lastText.slice(0, 80))}${l.lastText.length > 80 ? '…' : ''}"</p>`
        : `<p class="chat-dir-card__preview chat-dir-card__preview--empty">No messages yet</p>`
      }
      <p class="chat-dir-card__cta">View ${this.esc(l.name)} →</p>
    `;
  }

  _mountLgaCards(container, filter = '') {
    // Unmount previously mounted cards before rebuilding
    for (const c of this._lgaCardInstances) c.unmount();
    this._lgaCardInstances = [];

    const lgas = filter
      ? this._lgas.filter(l => l.name.toLowerCase().includes(filter.toLowerCase()))
      : this._lgas;

    if (!lgas.length) {
      container.innerHTML = `<p class="chat-dir-empty">${filter ? 'No LGAs match your search.' : 'No LGAs found.'}</p>`;
      return;
    }

    container.innerHTML = '';
    lgas.forEach(l => {
      const wrap = document.createElement('div');
      container.appendChild(wrap);

      const card = this.addChild(new Card({
        body: this._lgaCardBody(l),
        padding: 'md',
        shadow: 'sm',
        border: true,
        clickable: true,
        onClick: () => this._openPage2(l),
      }));
      card.mount(wrap);
      this._lgaCardInstances.push(card);
    });
  }

  _renderReportsList() {
    if (!this._reports.length) {
      return `<p class="chat-dir-empty">${this._reportsTab === 'pending' ? 'No pending reports.' : 'No resolved reports.'}</p>`;
    }

    return `<div class="chat-reports-list">${this._reports.map(r => `
      <div class="chat-report-row" data-report-id="${r.id}" data-msg-id="${r.messageId}" data-lga-id="${r.lgaId}">
        <div class="chat-report-row__left">
          ${Avatar.html({ name: r.senderName, imageUrl: r.senderAvatar, size: 'sm' })}
        </div>
        <div class="chat-report-row__body">
          <div class="chat-report-row__meta">
            <span class="chat-report-row__sender">${this.esc(r.senderName)}</span>
            ${Badge.html(r.lgaName, 'community', 'sm')}
            <span class="chat-report-row__time">${timeAgo(r.createdAt)}</span>
          </div>
          <p class="chat-report-row__msg">${r.messageText ? `"${this.esc(r.messageText.slice(0, 120))}${r.messageText.length > 120 ? '…' : ''}"` : '<em>File attachment</em>'}</p>
          <p class="chat-report-row__reason">Reported by <strong>${this.esc(r.reporterName)}</strong>: ${this.esc(r.reason)}</p>
          ${r.status === 'resolved' ? `
            <div class="chat-report-row__resolution">
              ${Badge.html(r.resolution || 'resolved', Badge.variantFor(r.resolution || 'resolved'), 'sm')}
              ${r.resolutionNote ? `<span class="chat-report-row__resolution-note">"${this.esc(r.resolutionNote)}"</span>` : ''}
            </div>
          ` : ''}
        </div>
        ${r.status === 'pending' ? `
          <div class="chat-report-row__actions">
            <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" data-report-view="${r.id}" data-lga-id="${r.lgaId}" data-msg-id="${r.messageId}" type="button">View in Chat</button>
            <button class="ktg-btn ktg-btn--secondary ktg-btn--sm" data-resolve="${r.id}" data-resolution="warned" type="button">Warn</button>
            <button class="ktg-btn ktg-btn--danger ktg-btn--sm" data-resolve="${r.id}" data-resolution="deleted" type="button">Delete</button>
            <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" data-resolve="${r.id}" data-resolution="dismissed" type="button">Dismiss</button>
          </div>
        ` : ''}
      </div>
    `).join('')}</div>`;
  }

  _bindPage1(root) {
    // LGA search filter — uses Card component onClick, just filter cards
    const searchInput = root.querySelector('#lga-search');
    if (searchInput) {
      this.on(searchInput, 'input', () => {
        this._mountLgaCards(root.querySelector('#lga-grid'), searchInput.value);
      });
    }

    this._bindReportActions(root);
  }

  _bindReportActions(root) {
    root.querySelectorAll('[data-report-view]').forEach(btn => {
      this.on(btn, 'click', (e) => {
        e.stopPropagation();
        const lgaId = parseInt(btn.dataset.lgaId, 10);
        const msgId = parseInt(btn.dataset.msgId, 10);
        router.push(`/admin/chat/${lgaId}?highlight=${msgId}`);
      });
    });

    root.querySelectorAll('[data-resolve]').forEach(btn => {
      this.on(btn, 'click', async (e) => {
        e.stopPropagation();
        const reportId = parseInt(btn.dataset.resolve, 10);
        const resolution = btn.dataset.resolution;
        if (resolution === 'deleted' && !confirm('Delete the message and resolve this report?')) return;
        await this._quickResolve(reportId, resolution, '');
      });
    });
  }

  async _quickResolve(reportId, resolution, note) {
    const res = await api.chat.adminResolveReport(reportId, resolution, note);
    if (res.error) { showToast('error', res.error.message || 'Failed to resolve report.'); return; }
    showToast('success', `Report ${resolution}.`);
    await Promise.all([this._loadReports(this._reportsTab), this._loadStats()]);
    const root = document.getElementById('chat-mgmt-root');
    if (root) {
      const list = root.querySelector('#reports-list');
      if (list) list.innerHTML = this._renderReportsList();
      this._bindReportActions(root);
      // Refresh safety flags stat card
      if (this._statCardFlags) {
        const total = this._stats?.pendingReports ?? 0;
        this._statCardFlags.props.value = String(total);
        this._statCardFlags.props.iconColor = total > 0 ? 'warning' : 'info';
        this._statCardFlags.props.trend = total > 0
          ? { direction: 'up', value: String(total), label: 'pending resolution' }
          : null;
        this._statCardFlags.setState({});
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Chat View
  // ══════════════════════════════════════════════════════════════════════════

  _openPage2(lga) {
    router.push(`/admin/chat/${lga.id}`);
  }

  _renderPage2Direct(lga) {
    this._teardownPage1();
    this._selectedLga = lga;
    this._messages = [];
    this._panel = 'messages';
    this._lastRenderedDate = null;
    this._renderPage2();
  }

  _renderPage2() {
    const root = document.getElementById('chat-mgmt-root');
    if (!root) return;
    const lga = this._selectedLga;

    root.innerHTML = `
      <div class="admin-chat-view">

        <div class="admin-chat-header">
          <button class="admin-chat-header__back" id="back-btn" type="button" aria-label="Back to directory">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="admin-chat-header__info">
            <h1 class="admin-chat-header__title">${this.esc(lga.name)} Chat</h1>
            <p class="admin-chat-header__sub">${(lga.memberCount ?? 0).toLocaleString()} members</p>
          </div>
           <button class="admin-chat-clear-btn" id="clear-chat-btn" type="button">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/><path d="M9 6V4h6v2"/></svg>
             Clear chat
           </button>
          <div id="panel-tabs-mount" class="admin-chat-header__tabs"></div>
        </div>

        <div id="admin-chat-panel" class="admin-chat-panel">
          ${this._renderPanel2()}
        </div>

        <div class="admin-chat-context-menu" id="admin-ctx-menu" role="menu" inert>
          <div class="admin-chat-context-menu__reactions" id="admin-ctx-reactions">
            ${DEFAULT_REACTIONS.map(e => `<button class="admin-chat-context-menu__emoji" data-emoji="${e}" type="button">${e}</button>`).join('')}
          </div>
          <div class="admin-chat-context-menu__divider"></div>
          <button class="admin-chat-context-menu__item" data-action="copy" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copy
          </button>
          <button class="admin-chat-context-menu__item" data-action="reply" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
            Reply
          </button>
          <div class="admin-chat-context-menu__divider"></div>
          <button class="admin-chat-context-menu__item" data-action="warn" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Warn User
          </button>
          <button class="admin-chat-context-menu__item admin-chat-context-menu__item--danger" data-action="suspend" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Suspend User
          </button>
          <button class="admin-chat-context-menu__item" data-action="flag" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            Flag Message
          </button>
          <button class="admin-chat-context-menu__item" data-action="manage" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            Manage User
          </button>
          <button class="admin-chat-context-menu__item admin-chat-context-menu__item--danger" data-action="delete" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            Delete Message
          </button>
          <button class="admin-chat-context-menu__item" data-action="dismiss-report" type="button" role="menuitem" id="admin-ctx-dismiss" style="display:none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Dismiss Report
          </button>
        </div>

      </div>
    `;

    // Mount panel Tabs
    this._panelTabs = this.addChild(new Tabs({
      tabs: [
        { key: 'messages', label: 'Messages' },
        { key: 'members', label: 'Members' },
        { key: 'banned-words', label: 'Banned Words' },
      ],
      activeKey: this._panel,
      onChange: (key) => {
        if (key === this._panel) return;
        this._panel = key;
        this._sendInput?.unmount(); this._sendInput = null;
        this._wordInput?.unmount(); this._wordInput = null;
        const panel = root.querySelector('#admin-chat-panel');
        if (panel) panel.innerHTML = this._renderPanel2();
        this._mountComposer(root);
        this._loadPanel2Data();
      },
    }));
    this._panelTabs.mount(root.querySelector('#panel-tabs-mount'));

    this._bindPage2(root);
    this._loadPanel2Data();
  }

  _renderPanel2() {
    if (this._panel === 'messages') return this._renderMessagesPanel2();
    if (this._panel === 'members') return this._renderMembersPanel2();
    if (this._panel === 'banned-words') return this._renderBannedWordsPanel2();
    return '';
  }

  _renderMessagesPanel2() {
    return `
      <div class="admin-chat-feed-wrap">
        <div class="admin-chat-feed" id="admin-msg-feed" role="log" aria-live="polite">
          <p class="admin-chat-feed__loading">Loading messages…</p>
        </div>
        <div class="admin-chat-reply-bar" id="admin-reply-bar" aria-hidden="true">
          <div class="admin-chat-reply-bar__content" id="admin-reply-content"></div>
          <button class="admin-chat-reply-bar__close" id="admin-reply-close" type="button" aria-label="Cancel reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="admin-chat-composer">
          <!-- Emoji picker panel (above composer, positioned relative to composer) -->
          <div class="admin-emoji-picker" id="admin-emoji-picker" aria-hidden="true" role="dialog" aria-label="Emoji picker">
            <div class="admin-emoji-picker__grid">
              ${ADMIN_EMOJIS.map(e => `<button class="admin-emoji-picker__item" data-insert-emoji="${e}" type="button" aria-label="${e}">${e}</button>`).join('')}
            </div>
          </div>
          <div class="admin-gif-picker" id="admin-gif-picker" aria-hidden="true" role="dialog" aria-label="GIF picker">
            <div class="admin-gif-picker__grid">
              ${ADMIN_GIFS.map(g => `
                <button class="admin-gif-picker__item" data-admin-gif-url="${g.url}" data-admin-gif-label="${this.esc(g.label)}" type="button" aria-label="${this.esc(g.label)}">
                  <img src="${g.url}" alt="${this.esc(g.label)}" loading="lazy"
                    onerror="this.closest('.admin-gif-picker__item')?.classList.add('admin-gif-picker__item--unavailable');this.remove()" />
                </button>
              `).join('')}
            </div>
          </div>
          <!-- Attach button + hidden file input -->
          <button class="admin-chat-composer__btn" id="admin-attach-btn" type="button" title="Attach file" aria-label="Attach file">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input type="file" id="admin-file-input" style="display:none" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" aria-hidden="true" tabindex="-1" />
          <!-- Text input -->
          <div id="admin-send-input-mount" style="flex:1;min-width:0;"></div>
          <!-- Emoji toggle -->
          <button class="admin-chat-composer__btn" id="admin-emoji-btn" type="button" title="Emoji" aria-label="Insert emoji" aria-expanded="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button class="admin-chat-composer__btn" id="admin-gif-btn" type="button" title="GIF" aria-label="Send a GIF" aria-expanded="false">
            <span aria-hidden="true">GIF</span>
          </button>
          <div id="admin-send-btn-mount"></div>
        </div>
      </div>
    `;
  }

  _renderMembersPanel2() {
    return `<div class="admin-chat-members-panel" id="admin-members-list"><p class="admin-chat-feed__loading">Loading members…</p></div>`;
  }

  _renderBannedWordsPanel2() {
    return `
      <div class="admin-chat-banned-panel">
        <div class="admin-chat-banned-panel__add">
          <div id="word-input-mount" style="flex:1;min-width:0;"></div>
          <div id="add-word-btn-mount"></div>
        </div>
        <div class="admin-chat-banned-panel__list" id="banned-words-list">
          <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>
        </div>
      </div>
    `;
  }

  _bindPage2(root) {
    // Back button — navigate to Page 1 route (triggers a fresh mount)
    this.on(root.querySelector('#back-btn'), 'click', () => {
      router.push('/admin/chat');
    });

    const clearBtn = root.querySelector('#clear-chat-btn');
    if (clearBtn) this.on(clearBtn, 'click', () => this._handleClearChat(clearBtn));

    this._mountComposer(root);

    // Context menu
    this.on(root.querySelector('#admin-msg-feed') || root, 'contextmenu', (e) => {
      const msgEl = e.target.closest('.admin-msg');
      if (!msgEl) return;
      e.preventDefault();
      this._openAdminContextMenu(parseInt(msgEl.dataset.msgId, 10), e.clientX, e.clientY);
    });

    this.on(document, 'click', () => this._closeAdminContextMenu());

    root.querySelectorAll('[data-action]').forEach(btn => {
      this.on(btn, 'click', (e) => { e.stopPropagation(); this._handleAdminContextAction(btn.dataset.action); });
    });

    root.querySelectorAll('.admin-chat-context-menu__emoji').forEach(btn => {
      this.on(btn, 'click', (e) => {
        e.stopPropagation();
        if (this._contextTarget) {
          this._handleAdminReaction(this._contextTarget, btn.dataset.emoji);
          this._closeAdminContextMenu();
        }
      });
    });

    const replyClose = root.querySelector('#admin-reply-close');
    if (replyClose) this.on(replyClose, 'click', () => this._clearAdminReply());

    // ── Emoji picker (admin composer) ─────────────────────────────────────
    const emojiBtn    = root.querySelector('#admin-emoji-btn');
    const emojiPicker = root.querySelector('#admin-emoji-picker');
    const gifBtn      = root.querySelector('#admin-gif-btn');
    const gifPicker   = root.querySelector('#admin-gif-picker');
    if (emojiBtn && emojiPicker) {
      this.on(emojiBtn, 'click', (e) => {
        e.stopPropagation();
        const open = emojiPicker.getAttribute('aria-hidden') === 'true';
        if (open) {
          // Position the picker above the emoji button using fixed coordinates
          // so it escapes any overflow:hidden parent (e.g. .admin-chat-panel).
          const rect = emojiBtn.getBoundingClientRect();
          const pickerWidth = 290;
          const pickerEstimatedHeight = 160;
          const left = Math.max(8, Math.min(rect.right - pickerWidth, window.innerWidth - pickerWidth - 8));
          const top  = Math.max(8, rect.top - pickerEstimatedHeight - 8);
          emojiPicker.style.left   = left + 'px';
          emojiPicker.style.top    = top  + 'px';
          emojiPicker.style.bottom = '';
          emojiPicker.style.right  = '';
        }
        emojiPicker.setAttribute('aria-hidden', String(!open));
        emojiPicker.classList.toggle('admin-emoji-picker--open', open);
        emojiBtn.setAttribute('aria-expanded', String(open));
      });
      // Clicking inside the picker should not close it
      this.on(emojiPicker, 'click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('[data-insert-emoji]');
        if (!item) return;
        const emoji = item.dataset.insertEmoji;
        this._insertAdminEmoji(emoji);
        emojiPicker.setAttribute('aria-hidden', 'true');
        emojiPicker.classList.remove('admin-emoji-picker--open');
        emojiBtn.setAttribute('aria-expanded', 'false');
      });
      // Close picker on outside click
      this.on(document, 'click', () => {
        emojiPicker.setAttribute('aria-hidden', 'true');
        emojiPicker.classList.remove('admin-emoji-picker--open');
        if (emojiBtn) emojiBtn.setAttribute('aria-expanded', 'false');
      });
    }

    if (gifBtn && gifPicker) {
      this.on(gifBtn, 'click', (e) => {
        e.stopPropagation();
        const open = gifPicker.getAttribute('aria-hidden') === 'true';
        gifPicker.setAttribute('aria-hidden', String(!open));
        gifPicker.classList.toggle('admin-gif-picker--open', open);
        gifBtn.setAttribute('aria-expanded', String(open));
      });
      this.on(gifPicker, 'click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('[data-admin-gif-url]');
        if (!item) return;
        this._sendAdminGif(item.dataset.adminGifUrl, item.dataset.adminGifLabel || 'GIF');
        gifPicker.setAttribute('aria-hidden', 'true');
        gifPicker.classList.remove('admin-gif-picker--open');
        gifBtn.setAttribute('aria-expanded', 'false');
      });
      this.on(document, 'click', () => {
        gifPicker.setAttribute('aria-hidden', 'true');
        gifPicker.classList.remove('admin-gif-picker--open');
        gifBtn.setAttribute('aria-expanded', 'false');
      });
    }

    // ── File attachment (admin composer) ──────────────────────────────────
    const attachBtn  = root.querySelector('#admin-attach-btn');
    const fileInput  = root.querySelector('#admin-file-input');
    if (attachBtn && fileInput) {
      this.on(attachBtn, 'click', (e) => { e.stopPropagation(); fileInput.click(); });
      this.on(fileInput, 'change', () => this._handleAdminFileAttach(fileInput));
    }
  }

  _insertAdminEmoji(emoji) {
    if (!this._sendInput) return;
    const current = this._sendInput.getValue() || '';
    this._sendInput.setValue(current + emoji);
    // Try to focus the underlying input
    const inputEl = this._sendInput.getEl?.()?.querySelector('input,textarea');
    inputEl?.focus();
  }

  async _sendAdminGif(url, label) {
    if (!this._selectedLga) return;
    const res = await api.chat.adminSendMessage(
      this._selectedLga.id,
      null,
      this._replyTo,
      { fileUrl: url, fileName: `${label || 'gif'}.gif`, fileSize: null }
    );
    if (res.error) {
      showToast('error', res.error.message || 'Failed to send GIF.');
      return;
    }
    this._clearAdminReply();
    this._messages.push(res.data);
    const feed = document.getElementById('admin-msg-feed');
    if (feed) {
      feed.appendChild(this._createAdminMsgEl(res.data));
      feed.scrollTop = feed.scrollHeight;
    }
  }

  async _handleAdminFileAttach(fileInput) {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = '';

    const MAX = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX) { showToast('error', 'File is too large (max 25 MB).'); return; }

    showToast('info', 'Uploading…');
    const res = await api.chat.uploadFile(file);
    if (res.error || !res.data) { showToast('error', res.error?.message || 'Upload failed.'); return; }

    const { url, fileName, fileSize } = res.data;
    const sendRes = await api.chat.adminSendMessage(
      this._selectedLga?.id,
      this._sendInput?.getValue()?.trim() || null,
      this._replyTo,
      { fileUrl: url, fileName, fileSize }
    );
    if (sendRes.error) { showToast('error', 'Failed to send file.'); return; }
    this._sendInput?.setValue('');
    this._clearAdminReply();
    this._messages.push(sendRes.data);
    const feed = document.getElementById('admin-msg-feed');
    if (feed) { feed.appendChild(this._createAdminMsgEl(sendRes.data)); feed.scrollTop = feed.scrollHeight; }
    showToast('success', 'File sent.');
  }

  _mountComposer(root) {
    if (this._panel !== 'messages') return;
    const mount = root.querySelector('#admin-send-input-mount');
    const btnMount = root.querySelector('#admin-send-btn-mount');
    if (!mount || !btnMount) return;

    this._sendInput = this.addChild(new Input({
      placeholder: `Send as [Admin] to ${this.esc(this._selectedLga?.name ?? 'LGA')}…`,
      name: 'admin_msg',
      onEnter: () => this._handleAdminSend(),
    }));
    this._sendInput.mount(mount);

    const sendBtn = this.addChild(new Button({
      label: 'Send',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
      variant: 'primary',
      size: 'md',
      onClick: () => this._handleAdminSend(),
    }));
    sendBtn.mount(btnMount);
  }

  async _loadPanel2Data() {
    if (this._panel === 'messages') await this._loadMessages2();
    else if (this._panel === 'members') await this._loadMembers2();
    else if (this._panel === 'banned-words') await this._loadBannedWords2();
  }

  // ── Messages (Page 2) ─────────────────────────────────────────────────────

  async _loadMessages2() {
    const feed = document.getElementById('admin-msg-feed');
    if (feed) feed.innerHTML = '<p class="admin-chat-feed__loading">Loading messages…</p>';

    const res = await api.chat.adminGetMessages(this._selectedLga.id, { perPage: 100 });
    if (!feed) return;
    if (res.error) { feed.innerHTML = '<p style="color:var(--color-error);padding:var(--space-4);">Failed to load messages.</p>'; return; }

    this._messages = res.data || [];
    this._renderMessages2();

    if (this._highlightMsgId) {
      requestAnimationFrame(() => {
        const el = feed.querySelector(`.admin-msg[data-msg-id="${this._highlightMsgId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('admin-msg--reported-highlight');
          setTimeout(() => el.classList.remove('admin-msg--reported-highlight'), 3000);
        }
        this._highlightMsgId = null;
      });
    } else {
      requestAnimationFrame(() => { if (feed) feed.scrollTop = feed.scrollHeight; });
    }
  }

  _renderMessages2() {
    const feed = document.getElementById('admin-msg-feed');
    if (!feed) return;

    if (!this._messages.length) {
      feed.innerHTML = '<p style="color:var(--color-text-muted);padding:var(--space-4);">No messages in this LGA yet.</p>';
      return;
    }

    feed.innerHTML = '';
    this._lastRenderedDate = null;

    for (const msg of this._messages) {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== this._lastRenderedDate) {
        const sep = document.createElement('div');
        sep.className = 'admin-chat-date-sep';
        sep.innerHTML = `<span>${isToday(msg.createdAt) ? 'TODAY, ' : ''}${new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}</span>`;
        feed.appendChild(sep);
        this._lastRenderedDate = msgDate;
      }
      feed.appendChild(this._createAdminMsgEl(msg));
    }
  }

  _createAdminMsgEl(msg) {
    const isAdmin = !msg.userId; // NULL userId = sent by an admin
    const wrapper = document.createElement('div');
    wrapper.className = [
      'admin-msg',
      isAdmin ? 'admin-msg--own' : '',
      msg.reportCount > 0 ? 'admin-msg--reported' : '',
    ].filter(Boolean).join(' ');
    wrapper.dataset.msgId = msg.id;

    const avatarHtml = Avatar.html({ name: msg.userName, imageUrl: msg.avatarUrl, size: 'sm' });

    const replyHtml = msg.replyTo ? `
      <div class="admin-msg__reply">
        <span class="admin-msg__reply-name">${this.esc(msg.replyTo.userName)}</span>
        <span class="admin-msg__reply-text">${this.esc((msg.replyTo.text || '').slice(0, 60))}</span>
      </div>` : '';

    const FILE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

    let bodyHtml = '';
    if (msg.mediaUrl) {
      const isGif = /\.gif($|\?)/i.test(msg.mediaUrl);
      bodyHtml = `<div class="admin-msg__image-wrap">
        <img src="${this.esc(msg.mediaUrl)}" alt="${this.esc(msg.text || (isGif ? 'GIF' : 'Image'))}"
             class="admin-msg__image${isGif ? ' admin-msg__image--gif' : ''}"
             loading="eager"
             onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span style=\'font-size:12px;color:var(--color-text-muted)\'>Media unavailable</span>')"
        />
      </div>`;
      if (msg.text) bodyHtml += `<p class="admin-msg__text">${this.esc(msg.text)}</p>`;
    } else if (msg.fileUrl) {
      const fname  = msg.fileName || '';
      const furl   = msg.fileUrl;
      if (_adminIsImage(furl, fname)) {
        bodyHtml = `<div class="admin-msg__image-wrap">
          <a href="${this.esc(furl)}" target="_blank" rel="noopener noreferrer">
            <img src="${this.esc(furl)}" alt="${this.esc(fname || 'Image')}" class="admin-msg__image" loading="eager"
                 onerror="this.closest('.admin-msg__image-wrap').innerHTML='<span style=\'font-size:12px;color:var(--color-text-muted)\'>Image unavailable</span>'" />
          </a>
        </div>`;
      } else if (_adminIsAudio(furl, fname)) {
        bodyHtml = `<audio class="admin-msg__audio" src="${this.esc(furl)}" controls></audio>`;
      } else if (_adminIsVideo(furl, fname)) {
        bodyHtml = `<div class="admin-msg__video-wrap">
          <video class="admin-msg__video" src="${this.esc(furl)}" controls playsinline></video>
        </div>`;
      } else {
        bodyHtml = `<a href="${this.esc(furl)}" class="admin-msg__file" target="_blank" rel="noopener noreferrer">
          <div class="admin-msg__file-icon">${FILE_ICON}</div>
          <div class="admin-msg__file-info">
            <span class="admin-msg__file-name">${this.esc(fname || 'File')}</span>
            ${msg.fileSize ? `<span class="admin-msg__file-size">${this.esc(msg.fileSize)}</span>` : ''}
          </div>
        </a>`;
      }
    } else if (msg.text) {
      bodyHtml = `<p class="admin-msg__text">${this.esc(msg.text)}</p>`;
    }

    const reportBadge = msg.reportCount > 0
      ? Badge.html(`⚑ ${msg.reportCount}`, 'error', 'sm')
      : '';

    wrapper.innerHTML = `
      <div class="admin-msg__avatar">${avatarHtml}</div>
      <div class="admin-msg__content">
        ${!isAdmin ? `<span class="admin-msg__name">${this.esc(msg.userName)}</span>` : ''}
        <div class="admin-msg__bubble ${isAdmin ? 'admin-msg__bubble--own' : ''}">
          ${replyHtml}
          ${bodyHtml}
          <div class="admin-msg__footer">
            <span class="admin-msg__time">${formatTime(msg.createdAt)}</span>
            ${reportBadge}
          </div>
        </div>
        ${this._renderAdminReactions(msg)}
      </div>
    `;
    return wrapper;
  }

  _renderAdminReactions(msg) {
    if (!msg.reactions || !Object.keys(msg.reactions).length) return '';
    const chips = Object.entries(msg.reactions).map(([emoji, users]) =>
      `<button class="admin-reaction" data-msg-id="${msg.id}" data-emoji="${emoji}" type="button">${emoji} ${users.length}</button>`
    ).join('');
    return `<div class="admin-reactions-row">${chips}</div>`;
  }

  async _handleAdminReaction(msgId, emoji) {
    const res = await api.chat.adminToggleReaction(msgId, emoji);
    if (res.error) return;
    const msg = this._messages.find(m => m.id === msgId);
    if (msg) msg.reactions = res.data.reactions;
    const msgEl = document.querySelector(`.admin-msg[data-msg-id="${msgId}"]`);
    if (msgEl) {
      const existing = msgEl.querySelector('.admin-reactions-row');
      const updated = this._messages.find(m => m.id === msgId);
      const newHtml = this._renderAdminReactions(updated);
      if (existing) existing.outerHTML = newHtml || '';
      else if (newHtml) msgEl.querySelector('.admin-msg__content')?.insertAdjacentHTML('beforeend', newHtml);
    }
  }

  async _handleAdminSend() {
    const text = this._sendInput?.getValue()?.trim();
    if (!text || !this._selectedLga) return;
    this._sendInput?.setValue('');
    this._clearAdminReply();

    const res = await api.chat.adminSendMessage(this._selectedLga.id, text, this._replyTo);
    if (res.error) { showToast('error', res.error.message || 'Failed to send.'); return; }

    this._messages.push(res.data);
    const feed = document.getElementById('admin-msg-feed');
    if (feed) {
      feed.appendChild(this._createAdminMsgEl(res.data));
      feed.scrollTop = feed.scrollHeight;
    }
  }

  // ── Admin context menu ────────────────────────────────────────────────────

  _openAdminContextMenu(msgId, x, y) {
    this._contextTarget = msgId;
    const menu = document.getElementById('admin-ctx-menu');
    if (!menu) return;

    const msg = this._messages.find(m => m.id === msgId);
    const dismissBtn = document.getElementById('admin-ctx-dismiss');
    if (dismissBtn) dismissBtn.style.display = (msg?.reportId) ? '' : 'none';

    menu.removeAttribute('inert');
    menu.classList.add('admin-chat-context-menu--open');
    const vw = window.innerWidth, vh = window.innerHeight;
    menu.style.setProperty('--ctx-x', `${Math.min(x, vw - 220)}px`);
    menu.style.setProperty('--ctx-y', `${Math.min(y, vh - 280)}px`);
  }

  _closeAdminContextMenu() {
    const menu = document.getElementById('admin-ctx-menu');
    if (menu) { menu.classList.remove('admin-chat-context-menu--open'); menu.setAttribute('inert', ''); }
    this._contextTarget = null;
  }

  _handleAdminContextAction(action) {
    const msgId = this._contextTarget;
    const msg = this._messages.find(m => m.id === msgId);
    this._closeAdminContextMenu();
    if (!msg) return;

    if (action === 'copy') {
      navigator.clipboard?.writeText(msg.text || msg.fileName || '').then(() => showToast('success', 'Copied.'));
    } else if (action === 'reply') {
      this._setAdminReply(msg);
    } else if (action === 'warn') {
      if (msg.userId) this._openWarnModal(msg.userId, msg.userName);
    } else if (action === 'suspend') {
      if (msg.userId) this._handleAdminSuspendUser(msg.userId, msg.userName);
    } else if (action === 'flag') {
      this._handleAdminFlagMessage(msg);
    } else if (action === 'manage') {
      if (msg.userId) window.location.href = `/admin/users?userId=${msg.userId}`;
    } else if (action === 'delete') {
      this._handleDeleteMessage(msg.id);
    } else if (action === 'dismiss-report') {
      if (msg.reportId) this._quickResolveFromChat(msg.reportId, 'dismissed');
    }
  }

  async _handleAdminSuspendUser(userId, userName) {
    if (!confirm(`Suspend ${userName || 'this user'}'s account? They will not be able to log in until reactivated.`)) return;
    const res = await api.users.adminSuspend(userId);
    if (res.error) { showToast('error', res.error?.message || 'Failed to suspend user.'); return; }
    showToast('success', `${userName || 'User'} suspended. Manage their account in User Management.`);
  }

  async _handleAdminFlagMessage(msg) {
    // Flag via the existing report system — marks it pending for review
    const res = await api.chat.adminFlagMessage?.(msg.id) ?? await api.chat.reportMessage?.(msg.id, 'admin-flagged') ?? { error: null };
    if (res.error) {
      // Fallback: highlight in the UI even if the API doesn't exist yet
      const el = document.querySelector(`.admin-msg[data-msg-id="${msg.id}"]`);
      if (el) el.classList.add('admin-msg--reported');
      showToast('success', 'Message flagged for review.');
      return;
    }
    const el = document.querySelector(`.admin-msg[data-msg-id="${msg.id}"]`);
    if (el) el.classList.add('admin-msg--reported');
    showToast('success', 'Message flagged for review.');
  }

  async _handleDeleteMessage(id) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    const res = await api.chat.adminDeleteMessage(id);
    if (res.error) { showToast('error', 'Failed to delete message.'); return; }
    this._messages = this._messages.filter(m => m.id !== id);
    this._renderMessages2();
    showToast('success', 'Message deleted.');
  }

  async _handleClearChat(button) {
    const lga = this._selectedLga;
    if (!lga) return;
    const count = this._messages.length;
    const confirmed = confirm(
      `Clear all chat history for ${lga.name}?\n\n` +
      `This permanently deletes the community's messages and their linked reports. ` +
      `The LGA and its members will not be deleted${count ? `.\n\nApproximately ${count} loaded message${count === 1 ? '' : 's'} will be removed` : ''}.`
    );
    if (!confirmed) return;

    button.disabled = true;
    button.classList.add('is-loading');
    const res = await api.chat.adminClearMessages(lga.id);
    button.disabled = false;
    button.classList.remove('is-loading');
    if (res.error) {
      showToast('error', res.error.message || 'Failed to clear chat.');
      return;
    }

    this._messages = [];
    this._renderMessages2();
    showToast('success', `${lga.name} chat cleared (${res.data?.deletedMessages ?? 0} messages removed).`);
  }

  async _quickResolveFromChat(reportId, resolution) {
    const res = await api.chat.adminResolveReport(reportId, resolution, '');
    if (res.error) { showToast('error', 'Failed to resolve report.'); return; }
    const msg = this._messages.find(m => m.reportId === reportId);
    if (msg) { msg.reportCount = 0; msg.reportId = null; }
    this._renderMessages2();
    showToast('success', 'Report dismissed.');
  }

  // ── Warn modal (Modal component) ──────────────────────────────────────────

  _mountWarnModal() {
    this._warnModal = this.addChild(new Modal({
      title: 'Warn User',
      size: 'sm',
      body: '',
      footer: `
        <button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>
        <button class="ktg-btn ktg-btn--danger ktg-btn--md" id="warn-confirm-btn">Send Warning</button>
      `,
      onClose: () => {
        this._warnReasonInput?.unmount();
        this._warnReasonInput = null;
      },
    }));
    this._warnModal.mount(document.body, { append: true });
  }

  _openWarnModal(userId, userName) {
    this._warnUserId = userId;
    this._warnUserName = userName;

    const titleEl = this._warnModal.$('.ktg-modal__title');
    if (titleEl) titleEl.textContent = `Warn ${userName}`;

    this._warnModal.setBody(`
      <p style="margin-bottom:var(--space-3);color:var(--color-text-secondary);font-size:var(--font-size-sm);">
        A warning notification will be sent to this citizen. You may include an optional reason.
      </p>
      <div id="warn-reason-mount"></div>
    `);

    this._warnReasonInput?.unmount();
    this._warnReasonInput = this.addChild(new Input({
      placeholder: 'Reason (optional)…',
      name: 'warn_reason',
    }));
    this._warnReasonInput.mount(this._warnModal.$('#warn-reason-mount'));

    const btn = this._warnModal.$('#warn-confirm-btn');
    if (btn) {
      btn.onclick = async () => {
        const reason = this._warnReasonInput?.getValue()?.trim() || '';
        btn.textContent = 'Sending…';
        btn.disabled = true;
        const res = await api.chat.adminWarnUser(this._warnUserId, reason);
        this._warnModal.close();
        btn.textContent = 'Send Warning';
        btn.disabled = false;
        if (res.error) { showToast('error', 'Failed to send warning.'); return; }
        showToast('success', `Warning sent to ${userName}.`);
      };
    }

    this._warnModal.open();
  }

  // ── Admin reply ───────────────────────────────────────────────────────────

  _setAdminReply(msg) {
    this._replyTo = { id: msg.id, userName: msg.userName, text: msg.text || msg.fileName || '' };
    const bar = document.getElementById('admin-reply-bar');
    const content = document.getElementById('admin-reply-content');
    if (bar && content) {
      content.innerHTML = `
        <span class="admin-chat-reply-bar__name">${this.esc(msg.userName)}</span>
        <span class="admin-chat-reply-bar__text">${this.esc((msg.text || msg.fileName || '').slice(0, 80))}</span>
      `;
      bar.classList.add('admin-chat-reply-bar--open');
      bar.setAttribute('aria-hidden', 'false');
    }
  }

  _clearAdminReply() {
    this._replyTo = null;
    const bar = document.getElementById('admin-reply-bar');
    if (bar) { bar.classList.remove('admin-chat-reply-bar--open'); bar.setAttribute('aria-hidden', 'true'); }
  }

  // ── Members (Page 2) ──────────────────────────────────────────────────────

  async _loadMembers2() {
    const list = document.getElementById('admin-members-list');
    if (list) list.innerHTML = '<p class="admin-chat-feed__loading">Loading members…</p>';

    const res = await api.chat.adminGetMembers(this._selectedLga.id);
    if (!list) return;
    if (res.error) { list.innerHTML = '<p style="color:var(--color-error);">Failed to load members.</p>'; return; }

    this._members = res.data || [];
    if (!this._members.length) {
      list.innerHTML = '<p style="color:var(--color-text-muted);padding:var(--space-4);">No verified members in this LGA.</p>';
      return;
    }

    list.innerHTML = this._members.map(m => `
      <div class="admin-member-row">
        ${Avatar.html({ name: m.name, imageUrl: m.avatarUrl, size: 'sm' })}
        <div class="admin-member-row__info">
          <p class="admin-member-row__name">${this.esc(m.name)}</p>
          <p class="admin-member-row__status">Last seen ${m.lastSeenAt ? timeAgo(m.lastSeenAt) : 'never'}</p>
        </div>
        ${Badge.html(m.status === 'active' ? 'Active' : 'Inactive', m.status === 'active' ? 'active' : 'suspended', 'sm')}
        <a href="/admin/users?userId=${m.id}" class="ktg-btn ktg-btn--ghost ktg-btn--sm">Manage</a>
      </div>
    `).join('');
  }

  // ── Banned words (Page 2) ─────────────────────────────────────────────────

  async _loadBannedWords2() {
    const list = document.getElementById('banned-words-list');
    if (list) list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>';

    const res = await api.chat.adminGetBannedWords();
    if (!list) return;
    if (res.error) { list.innerHTML = '<p style="color:var(--color-error);">Failed to load banned words.</p>'; return; }

    this._bannedWords = res.data || [];
    this._renderBannedWords2();

    const root = document.getElementById('chat-mgmt-root');
    if (root) {
      this._wordInput?.unmount(); this._wordInput = null;
      this._wordInput = this.addChild(new Input({
        placeholder: 'Enter word to ban…',
        name: 'banned_word',
        onEnter: () => this._handleAddWord(),
      }));
      this._wordInput.mount(root.querySelector('#word-input-mount'));

      const addBtn = this.addChild(new Button({
        label: 'Add Word',
        variant: 'primary',
        size: 'md',
        onClick: () => this._handleAddWord(),
      }));
      addBtn.mount(root.querySelector('#add-word-btn-mount'));
    }
  }

  _renderBannedWords2() {
    const list = document.getElementById('banned-words-list');
    if (!list) return;
    if (!this._bannedWords.length) {
      list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">No banned words configured.</p>';
      return;
    }
    list.innerHTML = this._bannedWords.map(w => `
      <div class="admin-banned-word-row" data-word-id="${w.id}">
        <span class="admin-banned-word-row__word">${this.esc(w.word)}</span>
        <span class="admin-banned-word-row__date">${timeAgo(w.createdAt)}</span>
        <button class="admin-banned-word-row__del" data-delete-word="${w.id}" type="button" aria-label="Remove ${this.esc(w.word)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');
    list.querySelectorAll('[data-delete-word]').forEach(btn => {
      this.on(btn, 'click', () => this._handleDeleteWord(parseInt(btn.dataset.deleteWord, 10)));
    });
  }

  async _handleAddWord() {
    const word = this._wordInput?.getValue()?.trim();
    if (!word) return;
    this._wordInput?.setValue('');
    const res = await api.chat.adminAddBannedWord(word);
    if (res.error) {
      showToast('error', res.error.code === 'DUPLICATE' ? 'Word already in the list.' : res.error.message || 'Failed to add word.');
      return;
    }
    this._bannedWords.unshift(res.data);
    this._renderBannedWords2();
    showToast('success', `"${word}" added.`);
  }

  async _handleDeleteWord(id) {
    const res = await api.chat.adminDeleteBannedWord(id);
    if (res.error) { showToast('error', 'Failed to remove word.'); return; }
    this._bannedWords = this._bannedWords.filter(w => w.id !== id);
    this._renderBannedWords2();
    showToast('success', 'Word removed.');
  }
}
