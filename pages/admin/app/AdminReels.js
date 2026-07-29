/**
 * KTG Connect Admin — Reels Management
 * Route: /admin/reels
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Table } from '../../../components/base/Table.js';
import { Button } from '../../../components/base/Button.js';
import { StatCard } from '../../../components/base/Card.js';
import { Modal } from '../../../components/base/Modal.js';
import { store, showToast, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { formatDate } from '../../../utils/date.js';

const PLUS_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
const EYE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const PAUSE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const RESUME_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const EDIT_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const TRASH_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
const FILM_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>';
const FLAG_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
const EYE20_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const HEALTH_ICON = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.15"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';

export default class AdminReelsPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminReels.css';

  constructor(props) {
    super({
      title: 'Reels',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Reels' },
      ],
      ...props,
    });
    this._page = 1;
    this._perPage = 10;
    this._search = '';
    this._tab = 'all';
    this._table = null;
    this._reels = [];
    this._statCards = {};
    this._viewModal = null;
  }

  getContent() {
    return '<div id="reels-root" class="admin-reels-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderPage();
    await Promise.all([this._loadMetrics(), this._loadReels()]);
    setPageLoading(false);

    this.subscribe(store, 'adminRegion', () => {
      this._page = 1;
      Promise.all([this._loadMetrics(), this._loadReels()]);
    });
  }

  _renderPage() {
    const root = document.getElementById('reels-root');
    if (!root) return;

    root.innerHTML =
      '<div class="reels-page-header">' +
      '<div>' +
      '<h1 class="reels-page-header__title">REELS</h1>' +
      '<p class="reels-page-header__sub">Review and manage official government reels and video announcements.</p>' +
      '</div>' +
      '<div id="add-btn-mount"></div>' +
      '</div>' +

      '<div class="reels-stat-row">' +
      '<div id="stat-published-mount"></div>' +
      '<div id="stat-pending-mount"></div>' +
      '<div id="stat-views-mount"></div>' +
      '<div class="reels-health-card">' +
      '<div>' +
      '<p class="reels-health-card__label">HEALTH INDEX</p>' +
      '<p class="reels-health-card__value" id="stat-health">—</p>' +
      '</div>' +
      '<div class="reels-health-card__icon" aria-hidden="true">' + HEALTH_ICON + '</div>' +
      '</div>' +
      '</div>' +

      '<div class="reels-table-card">' +
      '<div class="reels-table-card__header">' +
      '<div class="reels-content-queue">' +
      '<span class="reels-content-queue__label">Content Queue</span>' +
      '<div class="reels-tabs" id="reels-tabs">' +
      '<button class="reels-tab reels-tab--active" data-tab="all"       type="button">All</button>' +
      '<button class="reels-tab"                  data-tab="published" type="button">Active</button>' +
      '<button class="reels-tab"                  data-tab="paused"    type="button">Paused</button>' +
      '</div>' +
      '</div>' +
      '<input type="search" class="reels-search" id="reels-search" placeholder="Search reels..." aria-label="Search" />' +
      '</div>' +
      '<div id="reels-table-mount"></div>' +
      '</div>';

    // Add button
    this.addChild(new Button({
      label: 'Add Reels', icon: PLUS_ICON, iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => router.push('/admin/reels/new'),
    })).mount(root.querySelector('#add-btn-mount'));

    // Stat cards
    this._statCards.published = this.addChild(new StatCard({ label: 'Total Post', value: '—', icon: FILM_ICON, iconColor: 'primary' }));
    this._statCards.published.mount(root.querySelector('#stat-published-mount'));

    this._statCards.pending = this.addChild(new StatCard({ label: 'Flagged Reels', value: '—', icon: FLAG_ICON, iconColor: 'danger' }));
    this._statCards.pending.mount(root.querySelector('#stat-pending-mount'));

    this._statCards.views = this.addChild(new StatCard({ label: 'Total Views', value: '—', icon: EYE20_ICON, iconColor: 'info' }));
    this._statCards.views.mount(root.querySelector('#stat-views-mount'));

    this._mountTable(root);
    this._bindEvents(root);
    this._mountViewModal();
  }

  _mountTable(root) {
    this._table = this.addChild(new Table({
      columns: [
        { key: 'reelId', label: 'REELS ID', width: '100px' },
        {
          key: 'caption', label: 'CAPTION NAME',
          render: function (val, row) {
            return '<div>' +
              '<p class="reels-caption-title">' + (val || row.title || '—') + '</p>' +
              '<p class="reels-caption-sub">' + (row.lgaName || 'All LGAs') + '</p>' +
              '</div>';
          },
        },
        { key: 'createdAt', label: 'DATE RECEIVED', render: function (v) { return v ? formatDate(v) : '—'; } },
        { key: 'publishedAt', label: 'DATE POSTED', render: function (v) { return v ? formatDate(v) : '—'; } },
        {
          key: 'durationDays', label: 'DURATION',
          render: function (v) {
            if (v == null) return '—';
            return '<span class="reels-duration-badge">' + v + ' Day' + (v !== 1 ? 's' : '') + '</span>';
          },
        },
        {
          key: '_actions', label: 'ACTIONS', width: '120px',
          render: function (val, row) {
            const pauseIcon = row.status === 'paused' ? RESUME_ICON : PAUSE_ICON;
            const pauseTitle = row.status === 'paused' ? 'Resume' : 'Pause';
            return '<div class="ktg-table__actions">' +
              '<button class="ktg-table__action-btn" title="View"  data-reel-action="view"   data-reel-id="' + row.reelId + '">' + EYE_ICON + '</button>' +
              '<button class="ktg-table__action-btn" title="Edit"  data-reel-action="edit"   data-reel-id="' + row.reelId + '">' + EDIT_ICON + '</button>' +
              '<button class="ktg-table__action-btn" title="' + pauseTitle + '" data-reel-action="pause" data-reel-id="' + row.reelId + '">' + pauseIcon + '</button>' +
              '<button class="ktg-table__action-btn ktg-table__action-btn--danger" title="Delete" data-reel-action="delete" data-reel-id="' + row.reelId + '">' + TRASH_ICON + '</button>' +
              '</div>';
          },
        },
      ],
      data: [],
      loading: true,
      rowActions: [],
      emptyTitle: 'No reels yet',
      emptyMessage: 'Create your first reel using the Add Reels button.',
      onPageChange: (p) => { this._page = p; this._loadReels(); },
    }));
    this._table.mount(root.querySelector('#reels-table-mount'));
  }

  _mountViewModal() {
    this._viewModal = this.addChild(new Modal({
      title: 'View Reels Details',
      size: 'md',
      body: '',
      footer: '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Close</button>',
    }));
    this._viewModal.mount(document.body, { append: true });
  }

  _bindEvents(root) {
    // Tabs
    this.delegate('.reels-tab', 'click', (e, btn) => {
      this._tab = btn.dataset.tab;
      this._page = 1;
      root.querySelectorAll('.reels-tab').forEach(b =>
        b.classList.toggle('reels-tab--active', b.dataset.tab === this._tab)
      );
      this._loadReels();
    });

    // Search
    let timer;
    const searchEl = root.querySelector('#reels-search');
    if (searchEl) {
      this.on(searchEl, 'input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { this._search = searchEl.value.trim(); this._page = 1; this._loadReels(); }, 350);
      });
    }

    // Row actions
    this.delegate('[data-reel-action]', 'click', (e, btn) => {
      e.stopPropagation();
      const id = btn.dataset.reelId;
      const action = btn.dataset.reelAction;
      const row = this._reels.find(r => r.reelId === id);
      if (action === 'view') this._openViewModal(row || { reelId: id });
      if (action === 'edit') router.push('/admin/reels/' + id + '/edit');
      if (action === 'pause') this._togglePause(id, row);
      if (action === 'delete') this._delete(id, row ? (row.caption || row.title || '') : '');
    });
  }

  async _loadMetrics() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const res = await api.reels.adminMetrics(region);
    if (res.error || !res.data) return;
    const m = res.data;

    if (this._statCards.published) {
      this._statCards.published.props.value = (m.totalPublished || 0).toLocaleString();
      this._statCards.published.props.trend = { direction: 'up', value: '+12%', label: '' };
      this._statCards.published.setState({});
    }
    if (this._statCards.pending) {
      this._statCards.pending.props.value = (m.flaggedCount || 0).toLocaleString();
      if (m.flaggedCount > 0) {
        this._statCards.pending.props.trend = { direction: 'up', value: m.flaggedCount + ' need review', label: '' };
      }
      this._statCards.pending.setState({});
    }
    if (this._statCards.views) {
      const views = m.totalViews || 0;
      this._statCards.views.props.value = views >= 1000000
        ? (views / 1000000).toFixed(1) + 'M'
        : views >= 1000
          ? (views / 1000).toFixed(1) + 'K'
          : views.toLocaleString();
      this._statCards.views.setState({});
    }
    const healthEl = document.getElementById('stat-health');
    if (healthEl) healthEl.textContent = (m.healthIndex || 0) + '%';
  }

  async _loadReels() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    this._table && this._table.setLoading(true);
    const res = await api.reels.adminList({
      page: this._page, perPage: this._perPage,
      search: this._search, tab: this._tab, region,
    });
    this._table && this._table.setLoading(false);
    if (res.error) { showToast('error', res.error.message); return; }

    this._reels = (res.data || []).map(r => Object.assign({}, r, { _actions: null }));
    this._table && this._table.setData(this._reels, {
      page: this._page, perPage: this._perPage,
      total: (res.meta && res.meta.total) || 0,
      totalPages: (res.meta && res.meta.totalPages) || 1,
    });
  }

  _openViewModal(reel) {
    const dateReceived = reel.createdAt ? formatDate(reel.createdAt) : '—';
    const datePosted = reel.publishedAt ? formatDate(reel.publishedAt) : '—';
    const duration = reel.durationDays != null ? reel.durationDays + ' Days' : '—';

    const videoHtml = reel.videoUrl
      ? '<video class="rv-video-player" src="' + reel.videoUrl + '" controls playsinline></video>'
      : '<div class="rv-video-placeholder"><span>Short Video Reels</span></div>';

    this._viewModal.setBody(
      '<div class="rv-fields-grid">' +
      '<div class="rv-field"><label class="rv-field__label">REELS ID</label><div class="rv-field__value">' + this.esc(reel.reelId || '—') + '</div></div>' +
      '<div class="rv-field"><label class="rv-field__label">CAPTION NAME</label><div class="rv-field__value">' + this.esc(reel.caption || reel.title || '—') + '</div></div>' +
      '<div class="rv-field"><label class="rv-field__label">DATE RECEIVED</label><div class="rv-field__value">' + dateReceived + '</div></div>' +
      '<div class="rv-field"><label class="rv-field__label">DATE POSTED</label><div class="rv-field__value">' + datePosted + '</div></div>' +
      '<div class="rv-field"><label class="rv-field__label">DURATION</label><div class="rv-field__value">' + duration + '</div></div>' +
      '</div>' +
      '<div class="rv-video-wrap">' + videoHtml + '</div>'
    );

    this._viewModal.open();
  }

  async _togglePause(id, row) {
    const res = await api.reels.adminTogglePause(id);
    if (res.error) { showToast('error', res.error.message); return; }
    const isPaused = res.data.status === 'paused';
    showToast('success', isPaused ? 'Reel paused.' : 'Reel resumed.');
    this._tab = 'all';
    const root = document.getElementById('reels-root');
    root && root.querySelectorAll('.reels-tab').forEach(b =>
      b.classList.toggle('reels-tab--active', b.dataset.tab === 'all')
    );
    this._loadReels();
  }

  async _delete(id, caption) {
    if (!confirm('Delete "' + caption + '"? This cannot be undone.')) return;
    const res = await api.reels.adminDelete(id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Reel deleted.');
    this._loadReels();
    this._loadMetrics();
  }
}