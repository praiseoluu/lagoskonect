/**
 * Lagos Connect Admin — LGA Data Management
 * Route: /admin/lga-data
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806c';
import { Table }  from '../../../components/base/Table.js?v=20260806c';
import { Button } from '../../../components/base/Button.js?v=20260806c';
import { Modal }  from '../../../components/base/Modal.js?v=20260806c';
import { Input }  from '../../../components/base/Input.js?v=20260806c';
import { showToast, setPageLoading } from '../../../core/store.js?v=20260806c';
import { api }    from '../../../api/client.js?v=20260806c';
import { BASE_URL } from '../../../api/_fetch.js?v=20260806c';
import { formatDate } from '../../../utils/date.js?v=20260806c';

const PLUS_ICON   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
const EXPORT_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const EYE_ICON    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EDIT_ICON   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const MERGE_ICON  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><polyline points="8 18 6 18 6 16"/><line x1="6" y1="6" x2="18" y2="6"/><polyline points="16 4 18 4 18 6"/></svg>';

export default class AdminLGAPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminLGA.css?v=20260806c';

  constructor(props) {
    super({
      title: 'LGA Data',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'LGA Data' },
      ],
      ...props,
    });
    this._page        = 1;
    this._perPage     = 10;
    this._search      = '';
    this._regionFilter = ''; // New: region filter
    this._lgas        = [];
    this._table       = null;
    this._viewModal   = null;
    this._editModal   = null;
    this._addModal    = null;
    this._mergeModal  = null;
    this._editTarget  = null;
    this._mergeTarget = null;
  }

  getContent() {
    return '<div id="lga-root" class="admin-lga-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    this._render();
    await Promise.all([this._loadMetrics(), this._loadLgas()]);
    setPageLoading(false);
  }

  _render() {
    const root = document.getElementById('lga-root');
    if (!root) return;

    root.innerHTML =
        '<div class="lga-page-header">' +
        '<div>' +
        '<h1 class="lga-page-header__title">Local Government Data</h1>' +
        '<p class="lga-page-header__sub">Review and manage official local government area information and leadership details.</p>' +
        '</div>' +
        '<div class="lga-page-header__actions">' +
        '<div id="export-btn-mount"></div>' +
        '<div id="add-btn-mount"></div>' +
        '</div>' +
        '</div>' +

        '<div class="lga-stat-row">' +
        '<div class="lga-stat-card">' +
        '<p class="lga-stat-card__label">Total LGA Records</p>' +
        '<p class="lga-stat-card__value" id="lga-total">—</p>' +
        '</div>' +
        '</div>' +

        '<div class="lga-table-card">' +
        '<div class="lga-table-card__header">' +
        '<span class="lga-table-card__title">LGA Directory</span>' +
        '<div class="lga-table-card__filters">' +
        '<select class="lga-region-filter" id="lga-region-filter" aria-label="Filter by region">' +
        '<option value="">All Regions</option>' +
        '<option value="west">Lagos West</option>' +
        '<option value="central">Lagos Central</option>' +
        '<option value="east">Lagos East</option>' +
        '</select>' +
        '<input type="search" class="lga-search" id="lga-search" placeholder="Search LGAs…" aria-label="Search LGAs" />' +
        '</div>' +
        '</div>' +
        '<div id="lga-table-mount"></div>' +
        '</div>';

    this.addChild(new Button({
      label: 'Export', icon: EXPORT_ICON, iconPosition: 'left',
      variant: 'secondary', size: 'md',
      onClick: () => this._exportCSV(),
    })).mount(root.querySelector('#export-btn-mount'));

    this.addChild(new Button({
      label: 'Add LGA', icon: PLUS_ICON, iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => this._openAddModal(),
    })).mount(root.querySelector('#add-btn-mount'));

    this._mountTable(root);
    this._bindEvents(root);
    this._mountModals();
  }

  async _exportCSV() {
    try {
      const auth  = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
      const token = auth?.token || '';
      const res   = await fetch(BASE_URL + '/admin/lgas/export', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) { showToast('error', 'Export failed.'); return; }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'lgas_export_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true }));
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast('error', 'Export failed. Please try again.');
    }
  }

  _mountTable(root) {
    this._table = this.addChild(new Table({
      columns: [
        {
          key: 'displayId', label: 'LGA ID', width: '110px',
          render: (v) => '<span class="lga-id-badge">' + v + '</span>',
        },
        {
          key: 'region', label: 'Region', width: '140px',
          render: (v) => {
            const regionLabels = {
              west: 'Lagos West',
              central: 'Lagos Central',
              east: 'Lagos East'
            };
            return '<span class="lga-region-badge">' + (regionLabels[v] || v || '—') + '</span>';
          },
        },
        {
          key: 'name', label: 'Name',
          render: (v, row) =>
              '<div>' +
              '<p class="lga-name-title">' + v + '</p>' +
              '<p class="lga-name-sub">' + (row.state || '') + (row.isCapital ? ' · Capital' : '') + '</p>' +
              '</div>',
        },
        { key: 'state',        label: 'State'    },
        {
          key: 'chairmanName', label: 'Chairman',
          render: (v) => v || '<span class="lga-empty">—</span>',
        },
        {
          key: 'userCount', label: 'Citizens',
          render: (v) => '<span class="lga-user-count">' + (v || 0).toLocaleString() + '</span>',
        },
        {
          key: '_actions', label: 'Actions', width: '120px',
          render: (_, row) =>
              '<div class="ktg-table__actions">' +
              '<button class="ktg-table__action-btn" title="View"  data-lga-action="view"  data-lga-id="' + row.id + '">' + EYE_ICON   + '</button>' +
              '<button class="ktg-table__action-btn" title="Edit"  data-lga-action="edit"  data-lga-id="' + row.id + '">' + EDIT_ICON  + '</button>' +
              '<button class="ktg-table__action-btn" title="Merge" data-lga-action="merge" data-lga-id="' + row.id + '">' + MERGE_ICON + '</button>' +
              '</div>',
        },
      ],
      data: [],
      loading: true,
      emptyTitle:   'No LGAs found',
      emptyMessage: 'Add your first LGA using the Add LGA button.',
      onPageChange: (p) => { this._page = p; this._loadLgas(); },
    }));
    this._table.mount(root.querySelector('#lga-table-mount'));
  }

  _bindEvents(root) {
    let searchTimer;
    const searchEl = root.querySelector('#lga-search');
    if (searchEl) {
      this.on(searchEl, 'input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this._search = searchEl.value.trim();
          this._page   = 1;
          this._loadLgas();
        }, 350);
      });
    }

    const regionFilterEl = root.querySelector('#lga-region-filter');
    if (regionFilterEl) {
      this.on(regionFilterEl, 'change', () => {
        this._regionFilter = regionFilterEl.value;
        this._page = 1;
        this._loadLgas();
      });
    }

    this.delegate('[data-lga-action]', 'click', (e, btn) => {
      e.stopPropagation();
      const id     = parseInt(btn.dataset.lgaId, 10);
      const action = btn.dataset.lgaAction;
      const row    = this._lgas.find(l => l.id === id);
      if (action === 'view')  this._openViewModal(row);
      if (action === 'edit')  this._openEditModal(row);
      if (action === 'merge') this._openMergeModal(row);
    });
  }

  // ── Modals ────────────────────────────────────────────────────────────────

  _mountModals() {
    this._viewModal = this.addChild(new Modal({
      title: 'LGA Details', size: 'md', body: '',
      footer: '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Close</button>',
    }));
    this._viewModal.mount(document.body, { append: true });

    this._editModal = this.addChild(new Modal({
      title: 'Edit Local Government Data', size: 'md', body: '', footer: '',
    }));
    this._editModal.mount(document.body, { append: true });

    this._addModal = this.addChild(new Modal({
      title: 'Add LGA Data', size: 'md', body: '', footer: '',
    }));
    this._addModal.mount(document.body, { append: true });

    this._mergeModal = this.addChild(new Modal({
      title: 'Merge LGA', size: 'md', body: '', footer: '',
    }));
    this._mergeModal.mount(document.body, { append: true });
  }

  _openViewModal(row) {
    if (!row) return;

    this._viewModal.setBody(
        '<div class="lga-modal-fields">' +
        '<div class="lga-modal-field"><label class="lga-modal-label">LGA ID</label><div class="lga-modal-value">'              + this.esc(row.displayId)                                + '</div></div>' +
        '<div class="lga-modal-field"><label class="lga-modal-label">Name</label><div class="lga-modal-value">'                + this.esc(row.name)                                     + '</div></div>' +
        '<div class="lga-modal-field"><label class="lga-modal-label">State</label><div class="lga-modal-value">'               + this.esc(row.state || '—')                             + '</div></div>' +
        '<div class="lga-modal-field"><label class="lga-modal-label">State Capital</label><div class="lga-modal-value">'       + (row.isCapital ? 'Yes' : 'No')                         + '</div></div>' +
        '<div class="lga-modal-field lga-modal-field--full"><label class="lga-modal-label">LGA Chairman</label><div class="lga-modal-value">' + this.esc(row.chairmanName || '—') + '</div></div>' +
        '<div class="lga-modal-field"><label class="lga-modal-label">Registered Citizens</label><div class="lga-modal-value">' + (row.userCount || 0).toLocaleString()                  + '</div></div>' +
        '<div class="lga-modal-field"><label class="lga-modal-label">Last Updated</label><div class="lga-modal-value">'        + (row.updatedAt ? formatDate(row.updatedAt) : '—')      + '</div></div>' +
        '</div>'
    );

    this._viewModal.open();
  }

  _openEditModal(row) {
    if (!row) return;
    this._editTarget = row;

    this._editModal.update({
      title: 'Edit Local Government Data',
      body:
        '<p class="lga-modal-subtitle">Updating record for ' + this.esc(row.displayId) + '</p>' +
        '<div class="lga-modal-form">' +
        '<div class="lga-modal-row">' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">LGA ID</label>' +
        '<div class="lga-id-readonly">' +
        '<span>' + this.esc(row.displayId) + '</span>' +
        '<span class="lga-id-lock">🔒 Read-only</span>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="lga-modal-row">' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">Name of LGA</label>' +
        '<input class="lga-modal-input" id="edit-name" value="' + this.esc(row.name) + '" />' +
        '</div>' +
        '</div>' +
        '<div class="lga-modal-row">' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">State / Location</label>' +
        '<input class="lga-modal-input" id="edit-state" value="' + this.esc(row.state || '') + '" />' +
        '</div>' +
        '</div>' +
        '<div class="lga-modal-row">' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">LGA Chairman</label>' +
        '<input class="lga-modal-input" id="edit-chairman" placeholder="e.g. Hon. Aliyu B." value="' + this.esc(row.chairmanName || '') + '" />' +
        '</div>' +
        '</div>' +
        '</div>',
      footer:
        '<div class="lga-modal-footer">' +
        '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>' +
        '<button class="ktg-btn ktg-btn--primary ktg-btn--md" id="edit-save-btn">Save Changes</button>' +
        '</div>',
    });

    this._editModal.open();

    requestAnimationFrame(() => {
      const saveBtn = document.getElementById('edit-save-btn');
      if (saveBtn) this.on(saveBtn, 'click', () => this._saveEdit());
    });
  }

  async _saveEdit() {
    const row      = this._editTarget;
    const name     = document.getElementById('edit-name')?.value.trim()     || '';
    const state    = document.getElementById('edit-state')?.value.trim()    || '';
    const chairman = document.getElementById('edit-chairman')?.value.trim() || '';

    if (!name) { showToast('error', 'LGA name is required.'); return; }

    const res = await api.lgasAdmin.update(row.id, {
      name, state, chairmanName: chairman || null,
    });

    if (res.error) {
      showToast('error', res.error.code === 'DUPLICATE'
          ? 'An LGA with this name already exists.'
          : res.error.message);
      return;
    }

    this._editModal.close();
    showToast('success', 'LGA updated successfully.');
    this._loadLgas();
  }

  _openAddModal() {
    this._addModal.update({
      body:
        '<div class="lga-modal-form">' +
        '<div class="lga-modal-row">' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">Name of LGA <span class="lga-required">*</span></label>' +
        '<input class="lga-modal-input" id="add-name" placeholder="e.g. Yola" />' +
        '</div>' +
        '</div>' +
        '<div class="lga-modal-row">' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">State / Location <span class="lga-required">*</span></label>' +
        '<input class="lga-modal-input" id="add-state" placeholder="e.g. Lagos State" />' +
        '</div>' +
        '</div>' +
        '<div class="lga-modal-row">' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">LGA Chairman</label>' +
        '<input class="lga-modal-input" id="add-chairman" placeholder="e.g. Hon. Aliyu B." />' +
        '</div>' +
        '</div>' +
        '<div class="lga-modal-row">' +
        '<label class="lga-capital-label">' +
        '<input type="checkbox" id="add-capital" />' +
        '<span>This is a state capital</span>' +
        '</label>' +
        '</div>' +
        '</div>',
      footer:
        '<div class="lga-modal-footer">' +
        '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>' +
        '<button class="ktg-btn ktg-btn--primary ktg-btn--md" id="add-save-btn">Add LGA</button>' +
        '</div>',
    });

    this._addModal.open();

    requestAnimationFrame(() => {
      const saveBtn = document.getElementById('add-save-btn');
      if (saveBtn) this.on(saveBtn, 'click', () => this._saveAdd());
    });
  }

  async _saveAdd() {
    const name     = document.getElementById('add-name')?.value.trim()     || '';
    const state    = document.getElementById('add-state')?.value.trim()    || '';
    const chairman = document.getElementById('add-chairman')?.value.trim() || '';
    const capital  = document.getElementById('add-capital')?.checked ?? false;

    if (!name)  { showToast('error', 'LGA name is required.'); return; }
    if (!state) { showToast('error', 'State is required.');    return; }

    const res = await api.lgasAdmin.create({
      name, state, isCapital: capital,
      chairmanName: chairman || null,
    });

    if (res.error) {
      showToast('error', res.error.code === 'DUPLICATE'
          ? 'An LGA with this name already exists.'
          : res.error.message);
      return;
    }

    this._addModal.close();
    showToast('success', res.data.name + ' added successfully.');
    this._loadLgas();
    this._loadMetrics();
  }

  _openMergeModal(row) {
    if (!row) return;
    this._mergeTarget = row;

    const options = this._lgas
        .filter(l => l.id !== row.id)
        .map(l =>
            '<option value="' + l.id + '">' +
            this.esc(l.name) + (l.state ? ' (' + this.esc(l.state) + ')' : '') +
            '</option>'
        ).join('');

    this._mergeModal.update({
      body:
        '<div class="lga-merge-body">' +
        '<div>' +
        '<p class="lga-merge-label">Merging From (duplicate)</p>' +
        '<div class="lga-merge-card lga-merge-card--from">' +
        '<strong>' + this.esc(row.name) + '</strong>' +
        '<span>' + row.userCount.toLocaleString() + ' registered citizens will be moved</span>' +
        '</div>' +
        '</div>' +
        '<div class="lga-merge-arrow">↓</div>' +
        '<div class="lga-form-field">' +
        '<label class="lga-modal-label">Merge Into (correct LGA)</label>' +
        '<select class="lga-modal-select" id="merge-target">' +
        '<option value="">Select target LGA…</option>' +
        options +
        '</select>' +
        '</div>' +
        '<div class="lga-merge-warning">' +
        '<strong>⚠ This cannot be undone.</strong> All citizens registered to <strong>' + this.esc(row.name) + '</strong> will be moved to the selected LGA, and this record will be permanently removed.' +
        '</div>' +
        '</div>',
      footer:
        '<div class="lga-modal-footer">' +
        '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>' +
        '<button class="ktg-btn ktg-btn--danger ktg-btn--md" id="merge-confirm-btn">Confirm Merge</button>' +
        '</div>',
    });

    this._mergeModal.open();

    requestAnimationFrame(() => {
      const confirmBtn = document.getElementById('merge-confirm-btn');
      if (confirmBtn) this.on(confirmBtn, 'click', () => this._confirmMerge());
    });
  }

  async _confirmMerge() {
    const row      = this._mergeTarget;
    const targetId = parseInt(document.getElementById('merge-target')?.value || '0', 10);

    if (!targetId) { showToast('error', 'Please select a target LGA.'); return; }

    const confirmBtn = document.getElementById('merge-confirm-btn');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Merging…'; }

    const res = await api.lgasAdmin.merge(row.id, targetId);

    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Merge'; }

    if (res.error) { showToast('error', res.error.message); return; }

    this._mergeModal.close();
    showToast('success', '"' + res.data.fromName + '" merged into "' + res.data.toName + '".');
    this._loadLgas();
    this._loadMetrics();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async _loadMetrics() {
    const res = await api.lgasAdmin.metrics();
    if (res.error || !res.data) return;
    const el = document.getElementById('lga-total');
    if (el) el.textContent = (res.data.totalLgas || 0).toLocaleString();
  }

  async _loadLgas() {
    this._table?.setLoading(true);
    const res = await api.lgasAdmin.list({
      page: this._page, perPage: this._perPage, search: this._search, region: this._regionFilter,
    });
    this._table?.setLoading(false);

    if (res.error) { showToast('error', res.error.message); return; }

    this._lgas = (res.data || []).map(l => ({ ...l, _actions: null }));
    this._table?.setData(this._lgas, {
      page:       this._page,
      perPage:    this._perPage,
      total:      res.meta?.total      || 0,
      totalPages: res.meta?.totalPages || 1,
    });
  }
}