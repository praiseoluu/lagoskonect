/**
 * KTG Connect Admin — News Management
 * Route: /admin/news
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Table } from '../../../components/base/Table.js';
import { Button } from '../../../components/base/Button.js';
import { Badge } from '../../../components/base/Badge.js';
import { StatCard } from '../../../components/base/Card.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { formatDate } from '../../../utils/date.js';

const PLUS_ICON   = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
const EYE_ICON    = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const PAUSE_ICON  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const RESUME_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const EDIT_ICON   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const TRASH_ICON  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;
const NEWS_ICON   = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/></svg>`;
const CLOCK_ICON  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const EYE20_ICON  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const HEALTH_ICON = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.15"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;

export default class AdminNewsPage extends AdminLayout {
  static styles = '/pages/admin/app/News.css';

  constructor(props) {
    super({
      title: 'News Management',
      breadcrumbs: [
        { label: 'Dashboard',       path: '/admin' },
        { label: 'News Management'                 },
      ],
      ...props,
    });
    this._page       = 1;
    this._perPage    = 10;
    this._search     = '';
    this._tab        = 'all';
    this._table      = null;
    this._statCards  = {};
    this._news       = [];
  }

  getContent() {
    return `<div id="news-root" class="admin-news-page"></div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderPage();
    await Promise.all([this._loadMetrics(), this._loadNews()]);
    setPageLoading(false);
  }

  // ── Page structure ────────────────────────────────────────────────────

  _renderPage() {
    const root = document.getElementById('news-root');
    if (!root) return;

    root.innerHTML = `
      <!-- Header -->
      <div class="news-page-header">
        <div>
          <h1 class="news-page-header__title">News Management</h1>
          <p class="news-page-header__sub">Create, publish and manage all news articles. Mark any article as a headline to feature it on the citizen news page.</p>
        </div>
        <div id="add-btn-mount"></div>
      </div>

      <!-- Stat cards -->
      <div class="news-stat-row">
        <div id="stat-published-mount"></div>
        <div id="stat-pending-mount"></div>
        <div id="stat-views-mount"></div>
        <div class="news-health-card" id="news-health-card">
          <div>
            <p class="news-health-card__label">HEALTH INDEX</p>
            <p class="news-health-card__value" id="stat-health">—</p>
          </div>
          <div class="news-health-card__icon" aria-hidden="true">${HEALTH_ICON}</div>
        </div>
      </div>

      <!-- Content queue -->
      <div class="news-table-card">
        <div class="news-table-card__header">
          <div class="news-tabs" id="news-tabs">
            <button class="news-tab news-tab--active" data-tab="all"       type="button">All</button>
            <button class="news-tab"                  data-tab="published" type="button">Active</button>
            <button class="news-tab"                  data-tab="paused"    type="button">Paused</button>
          </div>
          <div class="news-table-card__meta">
            <input type="search" class="news-search" id="news-search"
              placeholder="Search news…" aria-label="Search" />
          </div>
        </div>
        <div id="news-table-mount"></div>
      </div>
    `;

    // Add button
    const addBtn = this.addChild(new Button({
      label: 'Add News',
      icon: PLUS_ICON,
      iconPosition: 'left',
      variant: 'primary',
      size: 'md',
      onClick: () => router.push('/admin/news/new'),
    }));
    addBtn.mount(root.querySelector('#add-btn-mount'));

    // Stat cards (values filled by _loadMetrics)
    this._statCards.published = this.addChild(new StatCard({
      label: 'Total Published', value: '—',
      icon: NEWS_ICON, iconColor: 'primary',
    }));
    this._statCards.published.mount(root.querySelector('#stat-published-mount'));

    this._statCards.pending = this.addChild(new StatCard({
      label: 'Pending Approval', value: '—',
      icon: CLOCK_ICON, iconColor: 'warning',
    }));
    this._statCards.pending.mount(root.querySelector('#stat-pending-mount'));

    this._statCards.views = this.addChild(new StatCard({
      label: 'Avg. View Duration', value: '—',
      icon: EYE20_ICON, iconColor: 'info',
    }));
    this._statCards.views.mount(root.querySelector('#stat-views-mount'));

    this._mountTable(root);
    this._bindPageEvents(root);
  }

  _mountTable(root) {
    this._table = this.addChild(new Table({
      columns: [
        { key: 'newsId', label: 'NEWS ID', width: '90px' },
        {
          key: 'title', label: 'CAPTION NAME',
          render: (val, row) => `
            <div>
              <p class="news-caption-title">
                ${this.esc(val)}
                ${row.isHeadline ? `<span class="news-headline-badge">★ Headline</span>` : ''}
                ${row.breaking   ? `<span class="news-breaking-badge">Breaking</span>`   : ''}
              </p>
              <p class="news-caption-sub">${this.esc(row.category || '')}${row.sourceName ? ` | ${this.esc(row.sourceName)}` : ''}</p>
            </div>
          `,
        },
        { key: 'createdAt',   label: 'DATE RECEIVED',  render: (v) => v ? formatDate(v) : '—' },
        { key: 'publishedAt', label: 'DATE PUBLISHED',  render: (v) => v ? formatDate(v) : '—' },
        {
          key: 'durationDays', label: 'DURATION',
          render: (v) => v != null
            ? `<span class="news-duration-badge">${v} Day${v !== 1 ? 's' : ''}</span>`
            : '—',
        },
        {
          key: '_actions', label: 'ACTIONS', width: '120px',
          render: (val, row) => `
            <div class="ktg-table__actions">
              <button class="ktg-table__action-btn" title="View" data-news-action="view" data-row-id="${row.id}">${EYE_ICON}</button>
              <button class="ktg-table__action-btn" title="Edit" data-news-action="edit" data-row-id="${row.id}">${EDIT_ICON}</button>
              <button class="ktg-table__action-btn"
                title="${row.status === 'paused' ? 'Resume' : 'Pause'}"
                data-news-action="pause"
                data-row-id="${row.id}">
                ${row.status === 'paused' ? RESUME_ICON : PAUSE_ICON}
              </button>
              <button class="ktg-table__action-btn ktg-table__action-btn--danger" title="Delete" data-news-action="delete" data-row-id="${row.id}">${TRASH_ICON}</button>
            </div>
          `,
        },
      ],
      data: [],
      loading: true,
      rowActions: [],
      emptyTitle: 'No news articles',
      emptyMessage: 'Create your first article using the Add News button above.',
      onPageChange: (p) => { this._page = p; this._loadNews(); },
    }));
    this._table.mount(root.querySelector('#news-table-mount'));
  }

  _bindPageEvents(root) {
    // Tabs
    this.delegate('.news-tab', 'click', (e, btn) => {
      this._tab  = btn.dataset.tab;
      this._page = 1;
      root.querySelectorAll('.news-tab').forEach(b =>
        b.classList.toggle('news-tab--active', b.dataset.tab === this._tab)
      );
      this._loadNews();
    });

    // Search — debounced
    let timer;
    const searchEl = root.querySelector('#news-search');
    if (searchEl) {
      this.on(searchEl, 'input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { this._search = searchEl.value.trim(); this._page = 1; this._loadNews(); }, 350);
      });
    }

    // Row actions
    this.delegate('[data-news-action]', 'click', (e, btn) => {
      e.stopPropagation();
      const id     = parseInt(btn.dataset.rowId, 10);
      const action = btn.dataset.newsAction;
      const row    = this._news.find(n => n.id === id);
      if (!row && action !== 'delete') return;
      if (action === 'view')    router.push(`/admin/news/${id}`);
      if (action === 'edit')    router.push(`/admin/news/${id}/edit`);
      if (action === 'pause')   this._togglePause(row);
      if (action === 'delete')  this._deleteNews(id, row?.title || '');
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────

  async _loadMetrics() {
    const res = await api.news.adminMetrics();
    if (res.error) return;
    const m = res.data;

    if (this._statCards.published) {
      this._statCards.published.props.value = (m.totalPublished || 0).toLocaleString();
      this._statCards.published.props.trend = { direction: 'up', value: '+12%', label: '' };
      this._statCards.published.setState({});
    }

    if (this._statCards.pending) {
      this._statCards.pending.props.value = (m.pendingCount || 0).toLocaleString();
      this._statCards.pending.setState({});
    }

    if (this._statCards.views) {
      const avg = m.avgViews || 0;
      this._statCards.views.props.value = avg >= 60
        ? `${(avg / 60).toFixed(1)}m`
        : `${avg}s`;
      this._statCards.views.setState({});
    }

    const healthEl = document.getElementById('stat-health');
    if (healthEl) healthEl.textContent = `${m.healthIndex || 0}%`;
  }

  async _loadNews() {
    this._table?.setLoading(true);
    const res = await api.news.adminList({
      page: this._page, perPage: this._perPage,
      search: this._search, tab: this._tab,
    });
    this._table?.setLoading(false);

    if (res.error) { showToast('error', res.error.message); return; }

    this._news = (res.data || []).map(n => ({ ...n, _actions: null }));
    this._table?.setData(this._news, {
      page: this._page, perPage: this._perPage,
      total: res.meta?.total || 0, totalPages: res.meta?.totalPages || 1,
    });
  }

  async _togglePause(row) {
    const res = await api.news.adminTogglePause(row.id);
    if (res.error) { showToast('error', res.error.message); return; }
    const isPaused = res.data.status === 'paused';
    showToast('success', isPaused ? 'Article paused.' : 'Article resumed.');

    // Switch to All tab so the article stays visible with updated icon
    this._tab = 'all';
    const root = document.getElementById('news-root');
    root?.querySelectorAll('.news-tab').forEach(b =>
      b.classList.toggle('news-tab--active', b.dataset.tab === 'all')
    );

    this._loadNews();
  }

  async _deleteNews(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await api.news.adminDelete(id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Article deleted.');
    this._loadNews();
    this._loadMetrics();
  }
}