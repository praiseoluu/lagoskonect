/**
 * LagKonnect Admin — User Management
 * Route: /admin/users
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260805b';
import { Table }    from '../../../components/base/Table.js';
import { Modal }    from '../../../components/base/Modal.js';
import { Input }    from '../../../components/base/Input.js';
import { Button }   from '../../../components/base/Button.js';
import { Badge }    from '../../../components/base/Badge.js';
import { StatCard } from '../../../components/base/Card.js';
import { Dropdown } from '../../../components/base/Forms.js';
import { Avatar }   from '../../../components/base/UI.js';
import { store, showToast, setPageLoading } from '../../../core/store.js';
import { api }      from '../../../api/client.js';
import { formatDate } from '../../../utils/date.js';

// ── Icons ─────────────────────────────────────────────────────────────────────
const EYE_ICON     = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EDIT_ICON    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const SUSPEND_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const RESUME_ICON  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const PLUS_ICON    = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const USER_ICON    = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const SHIELD_ICON  = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
const MAP_ICON     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const CAL_ICON     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

export default class UsersPage extends AdminLayout {
  static styles       = '/pages/admin/app/Users.css';
  static dependencies = ['/components/base/Badge.css'];

  constructor(props) {
    super({
      title: 'User Management',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Users' },
      ],
      ...props,
    });
    this._users        = [];
    this._page         = 1;
    this._perPage      = 30;
    this._search       = '';
    this._lgaFilter    = 0;
    this._statusFilter = '';
    this._lgaList      = [];
    this._table        = null;
    this._statCardTotal  = null;
    this._statCardActive = null;
    this._modal          = null;
    this._modalMode      = null;
    this._selectedUser   = null;

    // Modal input refs — recreated per open
    this._firstNameInput  = null;
    this._lastNameInput   = null;
    this._phoneInput      = null;
    this._emailInput      = null;
    this._dobInput        = null;
    this._cityInput       = null;
    this._addressInput    = null;
    this._tempPassInput   = null;
    this._lgaDropdown     = null;
    this._statusDropdown  = null;
    this._saveBtn         = null;
  }

  getContent() {
    return '<div id="users-root" class="admin-users-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    const lgaRes  = await api.lgas.getAll();
    this._lgaList = lgaRes.data || [];
    this._renderPage();
    await this._loadUsers();
    setPageLoading(false);

    this.subscribe(store, 'adminRegion', () => {
      this._page = 1;
      this._loadUsers();
    });
  }

  // ── Page structure ────────────────────────────────────────────────────────

  _renderPage() {
    const root = document.getElementById('users-root');
    if (!root) return;

    const lgaTabs = this._lgaList.slice(0, 6).map(l =>
        '<button class="users-lga-tab" data-lga="' + l.id + '" type="button">' + this.esc(l.name) + '</button>'
    ).join('');

    const lgaMoreSelect = this._lgaList.length > 6
        ? '<select class="users-lga-select" id="users-lga-select" aria-label="More LGAs">' +
        '<option value="0">More LGAs…</option>' +
        this._lgaList.slice(6).map(l =>
            '<option value="' + l.id + '">' + this.esc(l.name) + '</option>'
        ).join('') +
        '</select>'
        : '';

    root.innerHTML =
        '<div class="users-page-header">' +
        '<div>' +
        '<h1 class="users-page-header__title">User Management</h1>' +
        '<p class="users-page-header__sub">Manage and monitor registered citizens across all Local Government Areas.</p>' +
        '</div>' +
        '<div id="add-btn-mount"></div>' +
        '</div>' +

        '<div class="users-lga-tabs" id="users-lga-tabs">' +
        '<button class="users-lga-tab users-lga-tab--active" data-lga="0" type="button">All LGAs</button>' +
        lgaTabs +
        lgaMoreSelect +
        '</div>' +

        '<div class="users-filters-bar">' +
        '<input type="search" class="users-search" id="users-search" placeholder="Search by name, phone or email…" aria-label="Search users" />' +
        '<select class="users-status-filter" id="users-status-filter" aria-label="Filter by status">' +
        '<option value="">All statuses</option>' +
        '<option value="active">Active</option>' +
        '<option value="suspended">Suspended</option>' +
        '</select>' +
        '</div>' +

        '<div class="users-table-section">' +
        '<div id="users-table-mount"></div>' +
        '</div>' +

        '<div class="users-stat-cards">' +
        '<div id="stat-total-mount"></div>' +
        '<div id="stat-active-mount"></div>' +
        '</div>';

    this.addChild(new Button({
      label: 'Add New User', icon: PLUS_ICON, iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => this._openModal('add', null),
    })).mount(root.querySelector('#add-btn-mount'));

    this._mountTable(root);
    this._bindPageEvents(root);
    this._mountModal();

    this._statCardTotal = this.addChild(new StatCard({
      label: 'Total Citizens', value: '—', icon: USER_ICON, iconColor: 'primary',
    }));
    this._statCardTotal.mount(root.querySelector('#stat-total-mount'));

    this._statCardActive = this.addChild(new StatCard({
      label: 'Active Users', value: '—', icon: SHIELD_ICON, iconColor: 'success',
    }));
    this._statCardActive.mount(root.querySelector('#stat-active-mount'));
  }

  _mountTable(root) {
    this._table = this.addChild(new Table({
      columns: [
        { key: 'citizenId', label: 'User ID', width: '90px' },
        {
          key: 'avatarUrl', label: 'Photo', width: '60px',
          render: (val, row) =>
              '<div class="users-avatar-cell">' + Avatar.html({ name: row.name, imageUrl: val, size: 'sm' }) + '</div>',
        },
        { key: 'username',  label: 'Username',   render: (v) => v ? this.esc(v) : '—' },
        { key: 'lastName',  label: 'Surname'  },
        { key: 'firstName', label: 'First Name' },
        { key: 'phone',     label: 'Phone'    },
        { key: 'lgaName',   label: 'LGA'      },
        { key: 'createdAt', label: 'Registered', render: (v) => formatDate(v) },
        { key: 'status',    label: 'Status',     render: (v) => Badge.html(v, Badge.variantFor(v)) },
        {
          key: '_actions', label: 'Actions', width: '110px',
          render: (_, row) => {
            const isSuspended = row.status === 'suspended';
            return (
                '<div class="ktg-table__actions">' +
                '<button class="ktg-table__action-btn" title="View"   data-user-action="View"    data-row-id="' + row.id + '">' + EYE_ICON + '</button>' +
                '<button class="ktg-table__action-btn" title="Edit"   data-user-action="Edit"    data-row-id="' + row.id + '">' + EDIT_ICON + '</button>' +
                '<button class="ktg-table__action-btn ktg-table__action-btn--danger" ' +
                'title="' + (isSuspended ? 'Reactivate' : 'Suspend') + '" ' +
                'data-user-action="Suspend" data-row-id="' + row.id + '">' +
                (isSuspended ? RESUME_ICON : SUSPEND_ICON) +
                '</button>' +
                '</div>'
            );
          },
        },
      ],
      data: [],
      loading: true,
      emptyTitle:   'No users found',
      emptyMessage: 'Try adjusting your search or filter.',
      onPageChange: (page) => { this._page = page; this._loadUsers(); },
    }));
    this._table.mount(root.querySelector('#users-table-mount'));
  }

  _mountModal() {
    this._modal = this.addChild(new Modal({
      title:     '',
      size:      'lg',
      body:      '',
      footer:    '',
      showClose: true,
      onClose:   () => this._teardownModalInputs(),
    }));
    this._modal.mount(document.body, { append: true });
  }

  // ── Page events ───────────────────────────────────────────────────────────

  _bindPageEvents(root) {
    let searchTimer;
    const searchEl = root.querySelector('#users-search');
    if (searchEl) {
      this.on(searchEl, 'input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this._search = searchEl.value.trim();
          this._page   = 1;
          this._loadUsers();
        }, 350);
      });
    }

    const statusEl = root.querySelector('#users-status-filter');
    if (statusEl) {
      this.on(statusEl, 'change', () => {
        this._statusFilter = statusEl.value;
        this._page         = 1;
        this._loadUsers();
      });
    }

    this.delegate('.users-lga-tab', 'click', (e, btn) => {
      this._lgaFilter = parseInt(btn.dataset.lga, 10);
      this._page      = 1;
      root.querySelectorAll('.users-lga-tab').forEach(b =>
          b.classList.toggle('users-lga-tab--active', b.dataset.lga === btn.dataset.lga)
      );
      const sel = root.querySelector('#users-lga-select');
      if (sel) sel.value = '0';
      this._loadUsers();
    });

    const lgaSel = root.querySelector('#users-lga-select');
    if (lgaSel) {
      this.on(lgaSel, 'change', () => {
        this._lgaFilter = parseInt(lgaSel.value, 10);
        this._page      = 1;
        root.querySelectorAll('.users-lga-tab').forEach(b => b.classList.remove('users-lga-tab--active'));
        this._loadUsers();
      });
    }

    this.delegate('[data-user-action]', 'click', (e, btn) => {
      e.stopPropagation();
      const row    = this._users.find(u => String(u.id) === String(btn.dataset.rowId));
      if (!row) return;
      const action = btn.dataset.userAction;
      if (action === 'View')    this._openModal('view', row);
      if (action === 'Edit')    this._openModal('edit', row);
      if (action === 'Suspend') this._toggleStatus(row);
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async _loadUsers() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    this._table?.setLoading(true);
    const res = await api.users.adminList({
      page:    this._page,
      perPage: this._perPage,
      search:  this._search,
      status:  this._statusFilter,
      lgaId:   this._lgaFilter || undefined,
      region,
    });
    this._table?.setLoading(false);

    if (res.error) { showToast('error', res.error.message); return; }

    // Normalize id and citizenId so both are always defined consistently
    this._users = (res.data || []).map(u => ({
      ...u,
      id:        u.id        ?? u.citizenId,
      citizenId: u.citizenId ?? u.id,
      _actions:  null,
    }));
    this._table?.setData(this._users, {
      page:       this._page,
      perPage:    this._perPage,
      total:      res.meta?.total      || 0,
      totalPages: res.meta?.totalPages || 1,
    });

    this._updateStatCards();
  }

  async _updateStatCards() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const res = await api.analytics.getMetrics(region);
    if (res.error || !res.data) return;
    const m = res.data;

    if (this._statCardTotal) {
      this._statCardTotal.props.value = (m.totalUsers || 0).toLocaleString();
      this._statCardTotal.props.trend = {
        direction: 'up',
        value:     '+' + (m.newUsersThisWeek || 0).toLocaleString(),
        label:     'this week',
      };
      this._statCardTotal.setState({});
    }

    if (this._statCardActive) {
      const pct = m.totalUsers
          ? Math.round((m.weeklyActiveUsers / m.totalUsers) * 100)
          : 0;
      this._statCardActive.props.value = (m.weeklyActiveUsers || 0).toLocaleString();
      this._statCardActive.props.trend = {
        direction: 'up',
        value:     pct + '%',
        label:     'weekly active rate',
      };
      this._statCardActive.setState({});
    }
  }

  // ── Modal open ────────────────────────────────────────────────────────────

  _openModal(mode, user) {
    this._modalMode    = mode;
    this._selectedUser = user;
    this._teardownModalInputs();

    const isView = mode === 'view';
    const isAdd  = mode === 'add';
    const u      = user || {};

    const subtitles = {
      edit: 'Update identity and account status for registered citizens.',
      add:  'Create a new citizen account. The user must change their password on first login.',
    };

    const titles = { view: 'Citizen Profile', edit: 'Edit Citizen Profile', add: 'Add New User' };

    const leftPanel = !isAdd ? (
        '<div class="um-left">' +
        '<div class="um-left__profile-card">' +
        '<div class="um-left__avatar">' + Avatar.html({ name: u.name || '', imageUrl: u.avatarUrl || null, size: 'xl' }) + '</div>' +
        '<p class="um-left__name">' + this.esc(u.name || '') + '</p>' +
        '<p class="um-left__id">CITIZEN ID: ' + this.esc(String(u.citizenId || '')) + '</p>' +
        '<div class="um-left__joined">' +
        '<span>' + CAL_ICON + '</span>' +
        '<div>' +
        '<p class="um-left__joined-label">JOINED DATE</p>' +
        '<p class="um-left__joined-val">' + formatDate(u.createdAt) + '</p>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="um-left__status-card">' +
        '<p class="um-left__status-label">ACCOUNT STATUS</p>' +
        (isView
                ? '<div class="um-status-option' + (u.status === 'active'    ? ' um-status-option--active' : '') + '"><span class="um-status-dot um-status-dot--active"></span>Active'    + (u.status === 'active'    ? '<span class="um-status-check">✓</span>' : '') + '</div>' +
                '<div class="um-status-option' + (u.status === 'suspended' ? ' um-status-option--active' : '') + '"><span class="um-status-dot um-status-dot--suspended"></span>Suspended' + (u.status === 'suspended' ? '<span class="um-status-check">✓</span>' : '') + '</div>'
                : '<div id="status-dropdown-mount"></div>'
        ) +
        '</div>' +
        '</div>'
    ) : '';

    const primaryFields =
        '<div class="um-fields-grid">' +
        '<div class="um-field"><label class="um-field__label">Surname</label>'      + (isView ? '<div class="um-field__value">' + this.esc(u.lastName  || '—') + '</div>' : '<div id="last-name-mount"></div>')  + '</div>' +
        '<div class="um-field"><label class="um-field__label">First Name</label>'   + (isView ? '<div class="um-field__value">' + this.esc(u.firstName || '—') + '</div>' : '<div id="first-name-mount"></div>') + '</div>' +
        '<div class="um-field"><label class="um-field__label">Phone Number</label>' + (isView ? '<div class="um-field__value">' + this.esc(u.phone     || '—') + '</div>' : '<div id="phone-mount"></div>')       + '</div>' +
        '<div class="um-field"><label class="um-field__label">Date of Birth</label>'+ (isView ? '<div class="um-field__value">' + (u.dob ? this._formatDob(u.dob) : '—') + '</div>' : '<div id="dob-mount"></div>') + '</div>' +
        '<div class="um-field"><label class="um-field__label">Email Address</label>'+ (isView ? '<div class="um-field__value">' + this.esc(u.email     || '—') + '</div>' : '<div id="email-mount"></div>')       + '</div>' +
        '<div class="um-field"><label class="um-field__label">Registered</label><div class="um-field__value">' + (isAdd ? '—' : formatDate(u.createdAt)) + '</div></div>' +
        (isAdd
            ? '<div class="um-field"><label class="um-field__label">Temp Password <span style="color:var(--color-error)">*</span></label><div id="temp-pass-mount"></div></div>' +
            '<div class="um-field"></div>'
            : '') +
        '</div>';

    const locationFields =
        '<div class="um-fields-grid">' +
        '<div class="um-field um-field--full"><label class="um-field__label">State</label><div class="um-field__value um-field__value--disabled">Lagos State</div></div>' +
        '<div class="um-field"><label class="um-field__label">LGA</label>'                  + (isView ? '<div class="um-field__value">' + this.esc(u.lgaName || '—') + '</div>' : '<div id="lga-dropdown-mount"></div>') + '</div>' +
        '<div class="um-field"><label class="um-field__label">City</label>'                 + (isView ? '<div class="um-field__value">' + this.esc(u.city    || '—') + '</div>' : '<div id="city-mount"></div>')          + '</div>' +
        '<div class="um-field um-field--full"><label class="um-field__label">Address</label>' + (isView ? '<div class="um-field__value">' + this.esc(u.address  || '—') + '</div>' : '<div id="address-mount"></div>')     + '</div>' +
        '</div>';

    // Identity and payout details are read-only here. They are what a citizen
    // submitted about themselves, and what an admin checks before sending
    // money, so the admin panel shows them rather than offering to edit them.
    const idDoc = u.idDocumentUrl
        ? '<a class="um-id-link" href="' + this.esc(u.idDocumentUrl) + '" target="_blank" rel="noopener noreferrer">Open document</a>'
        : '<span class="um-id-missing">Not uploaded</span>';

    const identityFields = !isAdd
        ? '<div class="um-fields-grid">' +
          '<div class="um-field"><label class="um-field__label">ID Type</label><div class="um-field__value">' + this.esc(u.idType || '—') + '</div></div>' +
          '<div class="um-field"><label class="um-field__label">ID Document</label><div class="um-field__value">' + idDoc + '</div></div>' +
          '<div class="um-field"><label class="um-field__label">Bank</label><div class="um-field__value">' + this.esc(u.bankName || '—') + '</div></div>' +
          '<div class="um-field"><label class="um-field__label">Account Number</label><div class="um-field__value">' + this.esc(u.bankAccountNumber || '—') + '</div></div>' +
          '<div class="um-field um-field--full"><label class="um-field__label">Account Name</label><div class="um-field__value">' + this.esc(u.bankAccountName || '—') + '</div></div>' +
          (u.idDocumentUrl
            ? '<div class="um-field um-field--full"><img class="um-id-preview" src="' + this.esc(u.idDocumentUrl) + '" alt="Uploaded identification" loading="lazy" onerror="this.remove()" /></div>'
            : '') +
          '</div>'
        : '';

    const body =
        '<div class="um-modal-layout">' +
        leftPanel +
        '<div class="um-right' + (isAdd ? ' um-right--full' : '') + '">' +
        (subtitles[mode] ? '<p class="um-modal-subtitle__text">' + this.esc(subtitles[mode]) + '</p>' : '') +
        '<div class="um-section">' +
        '<div class="um-section__header"><div class="um-section__icon">📋</div><h4 class="um-section__title">Primary Info</h4></div>' +
        primaryFields +
        '</div>' +
        '<div class="um-section">' +
        '<div class="um-section__header"><div class="um-section__icon">' + MAP_ICON + '</div><h4 class="um-section__title">Location Details</h4></div>' +
        locationFields +
        '</div>' +
        (identityFields
            ? '<div class="um-section">' +
              '<div class="um-section__header"><div class="um-section__icon">🪪</div><h4 class="um-section__title">Identity &amp; Payout</h4></div>' +
              identityFields +
              '</div>'
            : '') +
        (isAdd ? '<p class="um-temp-pass-hint">⚠ Share the temporary password with the citizen securely. They will be required to change it on first login.</p>' : '') +
        '<p class="um-error" id="um-error" aria-live="polite"></p>' +
        '</div>' +
        '</div>';

    this._modal.update({
      title:  titles[mode],
      body,
      footer: '<div id="um-footer-mount" class="um-footer"></div>',
    });

    this._modal.open();

    const footerMount = this._modal.$('#um-footer-mount');
    if (footerMount) {
      this.addChild(new Button({
        label: 'Cancel', variant: 'ghost', size: 'md',
        onClick: () => this._modal.close(),
      })).mount(footerMount);

      if (isView) {
        this.addChild(new Button({
          label: 'Edit Details', variant: 'primary', size: 'md',
          onClick: () => { this._modal.close(); setTimeout(() => this._openModal('edit', user), 50); },
        })).mount(footerMount);
      } else {
        this._saveBtn = this.addChild(new Button({
          label:   isAdd ? 'Create Account' : 'Save Changes',
          variant: 'primary', size: 'md',
          onClick: () => isAdd ? this._saveAdd() : this._saveEdit(user),
        }));
        this._saveBtn.mount(footerMount);
      }
    }

    if (!isView) this._mountModalInputs(mode, u);
  }

  // ── Modal inputs ──────────────────────────────────────────────────────────

  _mountModalInputs(mode, user) {
    const isAdd = mode === 'add';
    const m     = this._modal;

    this._lastNameInput  = this.addChild(new Input({ placeholder: 'Surname',     value: isAdd ? '' : (user.lastName  || '') }));
    this._firstNameInput = this.addChild(new Input({ placeholder: 'First name',  value: isAdd ? '' : (user.firstName || '') }));
    this._phoneInput     = this.addChild(new Input({ type: 'tel',   placeholder: '+234…',  value: isAdd ? '' : (user.phone  || '') }));
    this._dobInput       = this.addChild(new Input({ type: 'date',                          value: isAdd ? '' : (user.dob   || '') }));
    this._emailInput     = this.addChild(new Input({ type: 'email', placeholder: 'Email',   value: isAdd ? '' : (user.email || '') }));
    this._cityInput      = this.addChild(new Input({ placeholder: 'City',                   value: isAdd ? '' : (user.city  || '') }));
    this._addressInput   = this.addChild(new Input({ placeholder: 'Residential address',    value: isAdd ? '' : (user.address || '') }));

    this._lastNameInput.mount(m.$('#last-name-mount'));
    this._firstNameInput.mount(m.$('#first-name-mount'));
    this._phoneInput.mount(m.$('#phone-mount'));
    this._dobInput.mount(m.$('#dob-mount'));
    this._emailInput.mount(m.$('#email-mount'));
    this._cityInput.mount(m.$('#city-mount'));
    this._addressInput.mount(m.$('#address-mount'));

    if (isAdd) {
      this._tempPassInput = this.addChild(new Input({ type: 'password', placeholder: 'Temporary password (min 6 chars)' }));
      this._tempPassInput.mount(m.$('#temp-pass-mount'));
    }

    this._lgaDropdown = this.addChild(new Dropdown({
      placeholder: 'Select LGA…',
      value:   isAdd ? null : String(user.lgaId || ''),
      options: this._lgaList.map(l => ({ value: String(l.id), label: l.name })),
      onChange: () => {},
    }));
    this._lgaDropdown.mount(m.$('#lga-dropdown-mount'));

    if (!isAdd) {
      this._statusDropdown = this.addChild(new Dropdown({
        value: user.status || 'active',
        options: [
          { value: 'active',    label: 'Active'    },
          { value: 'suspended', label: 'Suspended' },
        ],
        onChange: () => {},
      }));
      this._statusDropdown.mount(m.$('#status-dropdown-mount'));
    }
  }

  _teardownModalInputs() {
    const refs = [
      this._firstNameInput, this._lastNameInput, this._phoneInput,
      this._emailInput,     this._dobInput,      this._cityInput,
      this._addressInput,   this._tempPassInput,
      this._lgaDropdown,    this._statusDropdown, this._saveBtn,
    ].filter(Boolean);

    for (const c of refs) {
      try { c.unmount?.(); } catch { /* ignore */ }
    }

    this._firstNameInput = this._lastNameInput = this._phoneInput =
        this._emailInput     = this._dobInput      = this._cityInput  =
            this._addressInput   = this._tempPassInput =
                this._lgaDropdown    = this._statusDropdown = this._saveBtn = null;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async _saveEdit(user) {
    this._saveBtn?.setLoading(true);

    const lgaId = parseInt(
        this._lgaDropdown?.getValue?.() ?? this._lgaDropdown?.state?.value ?? '0',
        10
    ) || null;

    const data = {
      firstName: this._firstNameInput?.getValue()?.trim(),
      lastName:  this._lastNameInput?.getValue()?.trim(),
      phone:     this._phoneInput?.getValue()?.trim(),
      email:     this._emailInput?.getValue()?.trim() || null,
      dob:       this._dobInput?.getValue()?.trim()   || null,
      city:      this._cityInput?.getValue()?.trim()   || null,
      address:   this._addressInput?.getValue()?.trim() || null,
      lgaId,
    };

    const newStatus = this._statusDropdown?.state?.value || user.status;

    const [updateRes] = await Promise.all([api.users.adminUpdate(user.id, data)]);

    if (newStatus !== user.status) {
      await api.users[newStatus === 'suspended' ? 'adminSuspend' : 'adminReactivate'](user.id);
    }

    this._saveBtn?.setLoading(false);

    if (updateRes.error) {
      const errEl = this._modal.$('#um-error');
      if (errEl) errEl.textContent = updateRes.error.message;
      return;
    }

    showToast('success', 'User updated successfully.');
    this._modal.close();
    this._loadUsers();
  }

  async _saveAdd() {
    const errEl = this._modal.$('#um-error');
    if (errEl) errEl.textContent = '';

    const lgaId = parseInt(this._lgaDropdown?.getValue?.() ?? '0', 10) || 0;

    const data = {
      firstName:    this._firstNameInput?.getValue()?.trim(),
      lastName:     this._lastNameInput?.getValue()?.trim(),
      phone:        this._phoneInput?.getValue()?.trim(),
      email:        this._emailInput?.getValue()?.trim() || null,
      dob:          this._dobInput?.getValue()?.trim()   || null,
      city:         this._cityInput?.getValue()?.trim()   || null,
      address:      this._addressInput?.getValue()?.trim() || null,
      lgaId,
      tempPassword: this._tempPassInput?.getValue(),
    };

    if (!data.firstName || !data.lastName) {
      if (errEl) errEl.textContent = 'First and last name are required.'; return;
    }
    if (!data.phone) {
      if (errEl) errEl.textContent = 'Phone number is required.'; return;
    }
    if (!data.tempPassword || data.tempPassword.length < 6) {
      if (errEl) errEl.textContent = 'Temporary password must be at least 6 characters.'; return;
    }
    if (!lgaId) {
      if (errEl) errEl.textContent = 'Please select an LGA.'; return;
    }

    this._saveBtn?.setLoading(true);
    const res = await api.users.adminCreate(data);
    this._saveBtn?.setLoading(false);

    if (res.error) {
      if (errEl) errEl.textContent = res.error.message;
      return;
    }

    showToast('success', 'Account created for ' + res.data.name + '. Share the temporary password with them.');
    this._modal.close();
    this._loadUsers();
  }

  async _toggleStatus(user) {
    const isSuspended = user.status === 'suspended';
    if (!confirm('Are you sure you want to ' + (isSuspended ? 'reactivate' : 'suspend') + ' ' + user.name + '?')) return;
    const res = isSuspended
        ? await api.users.adminReactivate(user.id)
        : await api.users.adminSuspend(user.id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'User ' + (isSuspended ? 'reactivated' : 'suspended') + ' successfully.');
    this._loadUsers();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _formatDob(dob) {
    if (!dob) return '—';
    const d = new Date(dob);
    return (
        String(d.getDate()).padStart(2, '0') + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + '/' +
        d.getFullYear()
    );
  }
}