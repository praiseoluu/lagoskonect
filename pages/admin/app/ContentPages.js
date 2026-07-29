/**
 * KTG Connect Admin — Reels Management
 * Route: /admin/reels
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Table } from '../../../components/base/Table.js';
import { Modal } from '../../../components/base/Modal.js';
import { Input } from '../../../components/base/Input.js';
import { Button } from '../../../components/base/Button.js';
import { Badge } from '../../../components/base/Badge.js';
import { Dropdown } from '../../../components/base/Forms.js';
import { FileUpload } from '../../../components/base/Forms.js';
import { store, showToast } from '../../../core/store.js';
import { api } from '../../../api/client.js';
import { formatDate } from '../../../utils/date.js';

const EYE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const TRASH_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;


// ─── Trending News Management ─────────────────────────────────────────────

/**
 * KTG Connect Admin — Trending News
 * Route: /admin/trending
 */
export class TrendingAdminPage extends AdminLayout {
  constructor(props) {
    super({
      title: 'Trending News',
      breadcrumbs: [{ label: 'Dashboard', path: '/admin' }, { label: 'Trending News' }],
      ...props,
    });
    this.state = { page: 1, perPage: 20 };
    this._table = null;
    this._createModal = null;
  }

  getContent() {
    return `<div id="trending-admin-inner"></div>`;
  }

  async onContentReady() {
    const inner = document.getElementById('trending-admin-inner');
    if (!inner) return;

    inner.innerHTML = `
      <div class="ktg-page-header">
        <div class="ktg-page-header__text">
          <h1 class="ktg-page-header__title">Trending News</h1>
          <p class="ktg-page-header__subtitle">Pin and manage trending stories for each LGA.</p>
        </div>
        <div class="ktg-page-header__actions"><div id="trend-add-btn-mount"></div></div>
      </div>
      <div id="trend-table-mount"></div>
    `;

    this.addChild(new Button({
      label: 'Add trending item',
      variant: 'primary',
      size: 'md',
      onClick: () => this._openCreateModal(),
    })).mount(inner.querySelector('#trend-add-btn-mount'));

    this._table = this.addChild(new Table({
      columns: [
        {
          key: 'title', label: 'Story',
          render: (val, row) => `
            <div class="admin-content-meta">
              <p class="admin-content-meta__title">${this.esc(val)}</p>
              <p class="admin-content-meta__sub">${this.esc(row.lgaName)} · ${this.esc(row.sourceName || '')}</p>
            </div>`,
        },
        { key: 'category', label: 'Category' },
        { key: 'status', label: 'Status', render: (v) => Badge.html(v === 'active' ? 'active' : 'draft', Badge.variantFor(v === 'active' ? 'active' : 'draft')) },
        { key: 'engagementScore', label: 'Engagement', render: (v) => Number(v || 0).toLocaleString(), sortable: true },
      ],
      data: [], loading: true,
      emptyTitle: 'No trending items',
      emptyMessage: 'Add items to promote stories in citizen feeds.',
      rowActions: [
        {
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
          label: 'Toggle status',
          onClick: (row) => this._toggleStatus(row),
        },
        {
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`,
          label: 'Delete', variant: 'danger',
          onClick: (row) => this._delete(row),
        },
      ],
      onPageChange: (p) => { this.state.page = p; this._load(); },
    }));
    this._table.mount(inner.querySelector('#trend-table-mount'));
    await this._load();
    this._setupCreateModal();
  }

  async _load() {
    this._table?.setLoading(true);
    const res = await api.trending.adminList({ page: this.state.page, perPage: this.state.perPage });
    this._table?.setLoading(false);
    if (res.error) { showToast('error', res.error.message); return; }
    this._table?.setData(res.data, res.meta);
  }

  _setupCreateModal() {
    this._createModal = this.addChild(new Modal({
      title: 'Add Trending Story',
      size: 'md',
      body: '',
      footer: `
        <button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>
        <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="trend-submit-btn">Add story</button>
      `,
    }));
    this._createModal.mount(document.body, { append: true });
  }

  _openCreateModal() {
    this._createModal.setBody(`
      <div class="admin-content-form">
        <div id="trend-title-m"></div>
        <div id="trend-summary-m"></div>
        <div id="trend-source-m"></div>
        <div id="trend-sourceurl-m"></div>
        <div class="admin-content-form__row">
          <div id="trend-lga-m"></div>
          <div id="trend-cat-m"></div>
        </div>
      </div>
    `);
    this._createModal.open();

    const m = this._createModal;
    const f = this._trendForm = {
      title: this.addChild(new Input({ label: 'Story headline', name: 'trend_title', required: true })),
      summary: this.addChild(new Input({ type: 'textarea', label: 'Summary', name: 'trend_summary', rows: 2 })),
      source: this.addChild(new Input({ label: 'Source name', name: 'trend_source', placeholder: 'e.g. Lagos State Government' })),
      sourceUrl: this.addChild(new Input({ label: 'Source URL', name: 'trend_url', placeholder: 'https://' })),
      lga: this.addChild(new Dropdown({ label: 'LGA', options: (store.lgaList || []).map((l) => ({ value: l.id, label: l.name })), searchable: true })),
      category: this.addChild(new Dropdown({
        label: 'Category', options: [
          { value: 'Governance', label: 'Governance' }, { value: 'Security', label: 'Security' },
          { value: 'Utilities', label: 'Utilities' }, { value: 'Health', label: 'Health' },
          { value: 'Infrastructure', label: 'Infrastructure' },
        ]
      })),
    };
    f.title.mount(m.$('#trend-title-m'));
    f.summary.mount(m.$('#trend-summary-m'));
    f.source.mount(m.$('#trend-source-m'));
    f.sourceUrl.mount(m.$('#trend-sourceurl-m'));
    f.lga.mount(m.$('#trend-lga-m'));
    f.category.mount(m.$('#trend-cat-m'));

    this.on(m.$('#trend-submit-btn'), 'click', () => this._submit());
  }

  async _submit() {
    const f = this._trendForm;
    const title = f.title.getValue()?.trim();
    const lgaId = f.lga.getValue();
    if (!title) { f.title.setError('Required.'); return; }
    if (!lgaId) { f.lga.setError('Required.'); return; }

    const lga = store.lgaList?.find((l) => l.id === lgaId || l.id === Number(lgaId));
    const res = await api.trending.adminCreate({
      title, summary: f.summary.getValue()?.trim(),
      sourceName: f.source.getValue()?.trim(), sourceUrl: f.sourceUrl.getValue()?.trim(),
      lgaId: Number(lgaId), lgaName: lga?.name || '',
      category: f.category.getValue() || 'Governance',
      status: 'active',
    });
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Trending story added.');
    this._createModal.close();
    this._load();
  }

  async _toggleStatus(item) {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    const res = await api.trending.adminUpdate(item.id, { status: newStatus });
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', `Story ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
    this._load();
  }

  async _delete(item) {
    if (!confirm(`Remove "${item.title}" from trending?`)) return;
    const res = await api.trending.adminDelete(item.id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Removed.');
    this._load();
  }
}

// ─── Adverts Management ───────────────────────────────────────────────────

/**
 * KTG Connect Admin — Advert Management
 * Route: /admin/adverts
 */
export class AdvertsPage extends AdminLayout {
  constructor(props) {
    super({
      title: 'Advert Management',
      breadcrumbs: [{ label: 'Dashboard', path: '/admin' }, { label: 'Adverts' }],
      ...props,
    });
    this.state = { page: 1, perPage: 20 };
    this._table = null;
    this._createModal = null;
  }

  getContent() {
    return `<div id="adverts-inner"></div>`;
  }

  async onContentReady() {
    const inner = document.getElementById('adverts-inner');
    if (!inner) return;

    inner.innerHTML = `
      <div class="ktg-page-header">
        <div class="ktg-page-header__text">
          <h1 class="ktg-page-header__title">Advert Management</h1>
          <p class="ktg-page-header__subtitle">Create and manage banner and interstitial adverts.</p>
        </div>
        <div class="ktg-page-header__actions"><div id="advert-add-mount"></div></div>
      </div>
      <div id="advert-table-mount"></div>
    `;

    this.addChild(new Button({ label: 'Create advert', variant: 'primary', size: 'md', onClick: () => this._openCreateModal() }))
      .mount(inner.querySelector('#advert-add-mount'));

    this._table = this.addChild(new Table({
      columns: [
        {
          key: 'title', label: 'Advert',
          render: (val, row) => `
            <div class="admin-content-meta">
              <p class="admin-content-meta__title">${this.esc(val)}</p>
              <p class="admin-content-meta__sub">${this.esc(row.advertiser)} · ${row.type}</p>
            </div>`,
        },
        { key: 'status', label: 'Status', render: (v) => Badge.html(v, Badge.variantFor(v === 'active' ? 'active' : v === 'paused' ? 'pending' : 'draft')) },
        {
          key: 'impressions', label: 'Impressions',
          render: (v) => Number(v || 0).toLocaleString(), sortable: true,
        },
        {
          key: 'clicks', label: 'Clicks / CTR',
          render: (v, row) => {
            const ctr = row.impressions > 0 ? ((row.clicks / row.impressions) * 100).toFixed(1) : '0.0';
            return `${Number(v || 0).toLocaleString()} <span style="color:var(--color-text-muted);font-size:var(--font-size-xs)">(${ctr}%)</span>`;
          },
        },
        { key: 'endDate', label: 'Ends', render: (v) => formatDate(v) },
      ],
      data: [], loading: true,
      emptyTitle: 'No adverts yet',
      emptyMessage: 'Create your first advert campaign.',
      rowActions: [
        {
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="10 15 15 12 10 9 10 15"/></svg>`,
          label: 'Toggle status',
          onClick: (row) => this._toggleStatus(row),
        },
        {
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`,
          label: 'Delete', variant: 'danger',
          onClick: (row) => this._delete(row),
        },
      ],
      onPageChange: (p) => { this.state.page = p; this._load(); },
    }));
    this._table.mount(inner.querySelector('#advert-table-mount'));
    await this._load();
    this._setupModal();
  }

  async _load() {
    this._table?.setLoading(true);
    const res = await api.adverts.adminList({ page: this.state.page, perPage: this.state.perPage });
    this._table?.setLoading(false);
    if (res.error) { showToast('error', res.error.message); return; }
    this._table?.setData(res.data, res.meta);
  }

  _setupModal() {
    this._createModal = this.addChild(new Modal({
      title: 'Create Advert',
      size: 'md',
      body: '',
      footer: `
        <button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>
        <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="advert-submit-btn">Create advert</button>
      `,
    }));
    this._createModal.mount(document.body, { append: true });
  }

  _openCreateModal() {
    this._createModal.setBody(`
      <div class="admin-content-form">
        <div id="adv-title-m"></div>
        <div id="adv-adv-m"></div>
        <div class="admin-content-form__row">
          <div id="adv-type-m"></div>
          <div id="adv-status-m"></div>
        </div>
        <div class="admin-content-form__row">
          <div id="adv-start-m"></div>
          <div id="adv-end-m"></div>
        </div>
        <div id="adv-image-m"></div>
      </div>
    `);
    this._createModal.open();

    const m = this._createModal;
    const f = this._advForm = {
      title: this.addChild(new Input({ label: 'Campaign title', name: 'adv_title', required: true })),
      advertiser: this.addChild(new Input({ label: 'Advertiser', name: 'adv_advertiser', required: true })),
      type: this.addChild(new Dropdown({ label: 'Ad type', options: [{ value: 'banner', label: 'Banner' }, { value: 'interstitial', label: 'Interstitial' }] })),
      status: this.addChild(new Dropdown({ label: 'Initial status', value: 'active', options: [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }] })),
      startDate: this.addChild(new Input({ label: 'Start date', name: 'adv_start', type: 'text', placeholder: 'YYYY-MM-DD' })),
      endDate: this.addChild(new Input({ label: 'End date', name: 'adv_end', type: 'text', placeholder: 'YYYY-MM-DD' })),
      image: this.addChild(new FileUpload({ label: 'Creative image', accept: 'image/*', maxSizeMB: 5 })),
    };
    f.title.mount(m.$('#adv-title-m'));
    f.advertiser.mount(m.$('#adv-adv-m'));
    f.type.mount(m.$('#adv-type-m'));
    f.status.mount(m.$('#adv-status-m'));
    f.startDate.mount(m.$('#adv-start-m'));
    f.endDate.mount(m.$('#adv-end-m'));
    f.image.mount(m.$('#adv-image-m'));

    this.on(m.$('#advert-submit-btn'), 'click', () => this._submit());
  }

  async _submit() {
    const f = this._advForm;
    const title = f.title.getValue()?.trim();
    const advertiser = f.advertiser.getValue()?.trim();
    if (!title) { f.title.setError('Required.'); return; }
    if (!advertiser) { f.advertiser.setError('Required.'); return; }

    const res = await api.adverts.adminCreate({
      title, advertiser,
      type: f.type.getValue() || 'banner',
      status: f.status.getValue() || 'active',
      startDate: f.startDate.getValue()?.trim(),
      endDate: f.endDate.getValue()?.trim(),
      imageUrl: null,
      targetLgaIds: [],
    });
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Advert created.');
    this._createModal.close();
    this._load();
  }

  async _toggleStatus(item) {
    const newStatus = item.status === 'active' ? 'paused' : 'active';
    const res = await api.adverts.adminUpdate(item.id, { status: newStatus });
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', `Advert ${newStatus}.`);
    this._load();
  }

  async _delete(item) {
    if (!confirm(`Delete advert "${item.title}"?`)) return;
    const res = await api.adverts.adminDelete(item.id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Advert deleted.');
    this._load();
  }
}