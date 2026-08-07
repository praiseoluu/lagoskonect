/**
 * LagKonnect Admin — Advert Management
 * Route: /admin/adverts
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806f';
import { Table }       from '../../../components/base/Table.js?v=20260806f';
import { Button }      from '../../../components/base/Button.js?v=20260806f';
import { StatCard }    from '../../../components/base/Card.js?v=20260806f';
import { Modal }       from '../../../components/base/Modal.js?v=20260806f';
import { store, showToast, setPageLoading } from '../../../core/store.js?v=20260806f';
import { router }      from '../../../core/router.js?v=20260806f';
import { api }         from '../../../api/client.js?v=20260806f';
import { formatDate }  from '../../../utils/date.js?v=20260806f';

const PLUS_ICON   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
const EYE_ICON    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const INFO_ICON   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
const EDIT_ICON   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const TRASH_ICON  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
const PAUSE_ICON  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const RESUME_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const MEGAPHONE   = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>';
const CHART_ICON  = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
const EYE_STAT    = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const HEALTH_ICON = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.15" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';

const PLACEMENT_MAP = {
  banner:       'Home · Chat · Landing',
  news:         'News Page',
  feed:         'Reels Page',
  interstitial: 'Interstitial',
};

export default class AdminAdvertsPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminAdverts.css?v=20260806f';

  constructor(props) {
    super({
      title: 'Advert Management',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Advert Management' },
      ],
      ...props,
    });
    this._page      = 1;
    this._perPage   = 10;
    this._tab       = 'all';
    this._placement = '';
    this._search    = '';
    this._table     = null;
    this._adverts   = [];
    this._statCards = {};
    this._viewModal = null;
  }

  getContent() {
    return '<div id="adverts-root" class="admin-adverts-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderPage();
    await Promise.all([this._loadMetrics(), this._loadAdverts()]);
    setPageLoading(false);

    this.subscribe(store, 'adminRegion', () => {
      this._page = 1;
      this._loadMetrics();
      this._loadAdverts();
    });
  }

  _renderPage() {
    const root = document.getElementById('adverts-root');
    if (!root) return;

    root.innerHTML =
        '<div class="adverts-page-header">' +
        '<div>' +
        '<h1 class="adverts-page-header__title">Advert Management</h1>' +
        '<p class="adverts-page-header__sub">Manage public service announcements, community outreach, and awareness campaigns.</p>' +
        '</div>' +
        '<div id="add-btn-mount"></div>' +
        '</div>' +

        '<div class="adverts-stat-row">' +
        '<div id="stat-active-mount"></div>'  +
        '<div id="stat-awaiting-mount"></div>' +
        '<div id="stat-reach-mount"></div>'   +
        '<div class="adverts-roi-card">' +
        '<div>' +
        '<p class="adverts-roi-card__label">Campaign ROI</p>' +
        '<p class="adverts-roi-card__value" id="stat-roi">—</p>' +
        '</div>' +
        '<div class="adverts-roi-card__icon" aria-hidden="true">' + HEALTH_ICON + '</div>' +
        '</div>' +
        '</div>' +

        '<div class="adverts-table-card">' +
        '<div class="adverts-table-card__header">' +
        '<div class="adverts-queue">' +
        '<span class="adverts-queue__label">Advert Queue</span>' +
        '<div class="adverts-tabs" id="adverts-tabs">' +
        '<button class="adverts-tab adverts-tab--active" data-tab="all"     type="button">All</button>'       +
        '<button class="adverts-tab"                     data-tab="active"  type="button">Active</button>'    +
        '<button class="adverts-tab"                     data-tab="paused"  type="button">Paused</button>'    +
        '<button class="adverts-tab"                     data-tab="expired" type="button">Completed</button>' +
        '</div>' +
        '</div>' +
        '<div class="adverts-filter-row">' +
        '<select class="adverts-placement-select" id="adverts-placement-select" aria-label="Filter by placement">' +
        '<option value="">All Placements</option>' +
        '<option value="banner">Home · Chat · Landing</option>' +
        '<option value="news">News Page</option>' +
        '<option value="feed">Reels Page</option>' +
        '<option value="interstitial">Interstitial / Popup</option>' +
        '</select>' +
        '<input type="search" class="adverts-search" id="adverts-search" placeholder="Search adverts…" aria-label="Search adverts" />' +
        '</div>' +
        '</div>' +
        '<div id="adverts-table-mount"></div>' +
        '</div>';

    this.addChild(new Button({
      label: 'Add Advert', icon: PLUS_ICON, iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => router.push('/admin/adverts/new'),
    })).mount(root.querySelector('#add-btn-mount'));

    this._statCards.active = this.addChild(new StatCard({
      label: 'Active Campaigns', value: '—', icon: MEGAPHONE, iconColor: 'primary',
    }));
    this._statCards.active.mount(root.querySelector('#stat-active-mount'));

    this._statCards.awaiting = this.addChild(new StatCard({
      label: 'Awaiting Review', value: '—', icon: CHART_ICON, iconColor: 'warning',
    }));
    this._statCards.awaiting.mount(root.querySelector('#stat-awaiting-mount'));

    this._statCards.reach = this.addChild(new StatCard({
      label: 'Reach (MTD)', value: '—', icon: EYE_STAT, iconColor: 'info',
    }));
    this._statCards.reach.mount(root.querySelector('#stat-reach-mount'));

    this._mountTable(root);
    this._bindEvents(root);
    this._mountViewModal();
  }

  _mountTable(root) {
    const REGION_LABELS = { west: 'West', central: 'Central', east: 'East', all: 'All Regions' };
    this._table = this.addChild(new Table({
      columns: [
        {
          key: 'displayId', label: 'Advert ID', width: '120px',
          render: (v) => '<span class="adverts-id-badge">' + v + '</span>',
        },
        {
          key: 'title', label: 'Caption',
          render: (v, row) =>
              '<div>' +
              '<p class="adverts-caption-title">' + v + '</p>' +
              (row.advertiser ? '<p class="adverts-caption-sub">' + row.advertiser + '</p>' : '') +
              '</div>',
        },
        {
          key: 'region', label: 'Region', width: '110px',
          render: (v) => {
            const label = REGION_LABELS[v] || 'All';
            const cls = v ? 'advert-region-badge advert-region-badge--' + v : 'advert-region-badge';
            return '<span class="' + cls + '">' + label + '</span>';
          },
        },
        {
          key: 'type', label: 'Placement',
          render: (v) => {
            const label = PLACEMENT_MAP[v] || v || '—';
            return '<span class="advert-type-badge advert-type-badge--' + (v || 'other') + '">' + label + '</span>';
          },
        },
        { key: 'createdAt',    label: 'Received',  render: (v) => v ? formatDate(v) : '—' },
        { key: 'startDate',    label: 'Published',  render: (v) => v ? formatDate(v) : '—' },
        {
          key: 'durationDays', label: 'Duration',
          render: (v) => v != null
              ? '<span class="adverts-duration-badge">' + v + ' days</span>'
              : '—',
        },
        {
          key: '_actions', label: 'Actions', width: '130px',
          render: (_, row) => {
            const isPaused   = row.status === 'paused';
            const pauseIcon  = isPaused ? RESUME_ICON : PAUSE_ICON;
            const pauseTitle = isPaused ? 'Resume'    : 'Pause';
            return (
                '<div class="ktg-table__actions">' +
                '<button class="ktg-table__action-btn" title="View"   data-advert-action="view"   data-advert-id="' + row.id + '">' + EYE_ICON   + '</button>' +
                '<button class="ktg-table__action-btn" title="Info"   data-advert-action="info"   data-advert-id="' + row.id + '">' + INFO_ICON  + '</button>' +
                '<button class="ktg-table__action-btn" title="Edit"   data-advert-action="edit"   data-advert-id="' + row.id + '">' + EDIT_ICON  + '</button>' +
                '<button class="ktg-table__action-btn" title="' + pauseTitle + '" data-advert-action="pause"  data-advert-id="' + row.id + '">' + pauseIcon  + '</button>' +
                '<button class="ktg-table__action-btn ktg-table__action-btn--danger" title="Delete" data-advert-action="delete" data-advert-id="' + row.id + '">' + TRASH_ICON + '</button>' +
                '</div>'
            );
          },
        },
      ],
      data: [],
      loading: true,
      emptyTitle:   'No adverts yet',
      emptyMessage: 'Create your first advert using the Add Advert button.',
      onPageChange: (p) => { this._page = p; this._loadAdverts(); },
    }));
    this._table.mount(root.querySelector('#adverts-table-mount'));
  }

  _mountViewModal() {
    this._viewModal = this.addChild(new Modal({
      title:  'Advert Details',
      size:   'md',
      body:   '',
      footer: '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Close</button>',
    }));
    this._viewModal.mount(document.body, { append: true });
  }

  _bindEvents(root) {
    this.delegate('.adverts-tab', 'click', (e, btn) => {
      this._tab  = btn.dataset.tab;
      this._page = 1;
      root.querySelectorAll('.adverts-tab').forEach(b =>
          b.classList.toggle('adverts-tab--active', b.dataset.tab === this._tab)
      );
      this._loadAdverts();
    });

    const placementEl = root.querySelector('#adverts-placement-select');
    if (placementEl) {
      this.on(placementEl, 'change', () => {
        this._placement = placementEl.value;
        this._page      = 1;
        this._loadAdverts();
      });
    }

    let searchTimer;
    const searchEl = root.querySelector('#adverts-search');
    if (searchEl) {
      this.on(searchEl, 'input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this._search = searchEl.value.trim();
          this._page   = 1;
          this._loadAdverts();
        }, 350);
      });
    }

    this.delegate('[data-advert-action]', 'click', (e, btn) => {
      e.stopPropagation();
      const id     = parseInt(btn.dataset.advertId, 10);
      const action = btn.dataset.advertAction;
      const row    = this._adverts.find(a => a.id === id);
      if (action === 'view')   this._openViewModal(row || { id });
      if (action === 'info')   router.push('/admin/adverts/' + id + '/preview');
      if (action === 'edit')   router.push('/admin/adverts/' + id + '/edit');
      if (action === 'pause')  this._togglePause(id, row);
      if (action === 'delete') this._delete(id, row?.title || '');
    });
  }

  async _loadMetrics() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const res = await api.adverts.adminMetrics({ region });
    if (res.error || !res.data) return;
    const m = res.data;

    if (this._statCards.active) {
      this._statCards.active.props.value = (m.activeCampaigns || 0).toLocaleString();
      this._statCards.active.setState({});
    }
    if (this._statCards.awaiting) {
      this._statCards.awaiting.props.value = (m.awaitingReview || 0).toLocaleString();
      if (m.awaitingReview > 0) this._statCards.awaiting.props.badge = 'Action Required';
      this._statCards.awaiting.setState({});
    }
    if (this._statCards.reach) {
      const r = m.reachMTD || 0;
      this._statCards.reach.props.value = r >= 1_000_000
          ? (r / 1_000_000).toFixed(1) + 'M'
          : r >= 1_000
              ? (r / 1_000).toFixed(1) + 'k'
              : r.toLocaleString();
      this._statCards.reach.setState({});
    }

    const roiEl = document.getElementById('stat-roi');
    if (roiEl) roiEl.textContent = (m.campaignROI || 0) + '%';
  }

  async _loadAdverts() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    this._table?.setLoading(true);
    const res = await api.adverts.adminList({
      page:      this._page,
      perPage:   this._perPage,
      tab:       this._tab,
      search:    this._search,
      placement: this._placement,
      region,
    });
    this._table?.setLoading(false);

    if (res.error) { showToast('error', res.error.message); return; }

    this._adverts = (res.data || []).map(a => ({ ...a, _actions: null }));
    this._table?.setData(this._adverts, {
      page:       this._page,
      perPage:    this._perPage,
      total:      res.meta?.total      || 0,
      totalPages: res.meta?.totalPages || 1,
    });
  }

  _openViewModal(advert) {
    const bannerHtml = advert.imageUrl
        ? '<img src="' + advert.imageUrl + '" class="av-banner-img" alt="Banner" />'
        : '<div class="av-banner-placeholder"><span>No banner</span></div>';

    this._viewModal.setBody(
        '<div class="av-fields-grid">' +
        '<div class="av-field"><label class="av-field__label">Advert ID</label><div class="av-field__value">'     + (advert.displayId || '—')                              + '</div></div>' +
        '<div class="av-field"><label class="av-field__label">Caption</label><div class="av-field__value">'       + this.esc(advert.title || '—')                         + '</div></div>' +
        '<div class="av-field"><label class="av-field__label">Received</label><div class="av-field__value">'      + (advert.createdAt ? formatDate(advert.createdAt) : '—') + '</div></div>' +
        '<div class="av-field"><label class="av-field__label">Published</label><div class="av-field__value">'     + (advert.startDate ? formatDate(advert.startDate) : '—') + '</div></div>' +
        '<div class="av-field"><label class="av-field__label">Duration</label><div class="av-field__value">'      + (advert.durationDays != null ? advert.durationDays + ' days' : '—') + '</div></div>' +
        '</div>' +
        '<div class="av-banner-wrap">' + bannerHtml + '</div>'
    );

    this._viewModal.open();
  }

  async _togglePause(id, row) {
    const res = await api.adverts.adminTogglePause(id);
    if (res.error) { showToast('error', res.error.message); return; }
    const isPaused = res.data.status === 'paused';
    showToast('success', isPaused ? 'Advert paused.' : 'Advert resumed.');
    this._tab  = 'all';
    document.querySelectorAll('.adverts-tab').forEach(b =>
        b.classList.toggle('adverts-tab--active', b.dataset.tab === 'all')
    );
    this._loadAdverts();
    this._loadMetrics();
  }

  async _delete(id, title) {
    if (!confirm('Permanently delete "' + title + '"? This cannot be undone.')) return;
    const res = await api.adverts.adminDelete(id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Advert deleted.');
    this._loadAdverts();
    this._loadMetrics();
  }
}