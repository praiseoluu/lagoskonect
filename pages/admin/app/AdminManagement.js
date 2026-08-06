/**
 * KTG Connect Admin — Admin Management
 * Route: /admin/management
 * Guards: requireAdmin
 *
 * Section 1 — My Account: profile edit + password change
 * Section 2 — Admin Team: list, invite, role/status/remove (super_admin only)
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806a';
import { Input }       from '../../../components/base/Input.js?v=20260806a';
import { Button }      from '../../../components/base/Button.js?v=20260806a';
import { Modal }       from '../../../components/base/Modal.js?v=20260806a';
import { Avatar }      from '../../../components/base/UI.js?v=20260806a';
import { showToast, setPageLoading } from '../../../core/store.js?v=20260806a';
import { store }       from '../../../core/store.js?v=20260806a';
import { api }         from '../../../api/client.js?v=20260806a';
import { timeAgo }     from '../../../utils/date.js?v=20260806a';

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin' };
const ROLE_COLORS = { super_admin: 'am-role--super', admin: 'am-role--admin' };

const SHIELD_SVG  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
const USERS_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>';
const TABLE_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>';
const PLUS_SVG    = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const EDIT_SVG    = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const TRASH_SVG   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
const KEY_SVG     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>';
const EYE_SVG     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const CAM_SVG     = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';

export default class AdminManagementPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminManagement.css?v=20260806a';

  constructor(props) {
    super({
      title: 'Admin Management',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Admin Management' },
      ],
      ...props,
    });
    this._me           = null;
    this._team         = [];
    this._isSuperAdmin = false;
    this._inviteModal  = null;
    this._editModal    = null;
    this._viewModal    = null;
    this._addModal     = null;
    this._editTarget   = null;

    // My account inputs
    this._nameInput    = null;
    this._currPass     = null;
    this._newPass      = null;
    this._confirmPass  = null;

    // Admin Users table state
    this._auAdmins  = [];
    this._auPage    = 1;
    this._auPerPage = 10;
    this._auTotal   = 0;
    this._auSearch  = '';
    this._auSearchTimer = null;
  }

  getContent() {
    return '<div id="am-root" class="admin-management-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderShell();
    const [meRes, teamRes] = await Promise.all([
      api.adminTeam.getMe(),
      api.adminTeam.list(),
    ]);
    this._me           = meRes.data  || {};
    this._team         = teamRes.data || [];
    this._isSuperAdmin = this._me.role === 'super_admin';
    setPageLoading(false);
    this._renderContent();
  }

  _renderShell() {
    const root = document.getElementById('am-root');
    if (!root) return;

    root.innerHTML =
      '<div class="am-page-header">' +
        '<h1 class="am-page-header__title">Admin Management</h1>' +
        '<p class="am-page-header__sub">Manage your account and the admin team.</p>' +
      '</div>' +

      // My Account section
      '<section class="am-section" id="am-account-section">' +
        '<div class="am-section__header">' +
          '<div class="am-section__icon">' + SHIELD_SVG + '</div>' +
          '<h2 class="am-section__title">My Account</h2>' +
        '</div>' +
        '<div class="am-section__body" id="am-account-body">' +
          '<div class="am-skeleton-line"></div>' +
          '<div class="am-skeleton-line am-skeleton-line--sm"></div>' +
        '</div>' +
      '</section>' +

      // Admin Team section
      '<section class="am-section" id="am-team-section">' +
        '<div class="am-section__header">' +
          '<div class="am-section__icon">' + USERS_SVG + '</div>' +
          '<h2 class="am-section__title">Admin Team</h2>' +
          '<div id="am-invite-mount" class="am-section__action"></div>' +
        '</div>' +
        '<div class="am-section__body" id="am-team-body">' +
          '<div class="am-skeleton-line"></div>' +
          '<div class="am-skeleton-line am-skeleton-line--sm"></div>' +
        '</div>' +
      '</section>' +

      // Admin Users Management table (super_admin only — populated in _renderContent)
      '<section class="am-section" id="am-users-section" style="display:none">' +
        '<div class="am-section__header">' +
          '<div class="am-section__icon">' + TABLE_SVG + '</div>' +
          '<h2 class="am-section__title">Admin Users Management</h2>' +
          '<div class="am-section__header-right">' +
            '<input type="search" class="am-users-search" id="am-users-search" placeholder="Search admins…" autocomplete="off" />' +
            '<div id="am-add-admin-mount"></div>' +
          '</div>' +
        '</div>' +
        '<div class="am-section__body am-section__body--flush" id="am-users-body">' +
          '<div class="am-table-skeleton">' +
            [1,2,3,4,5].map(() => '<div class="am-table-skeleton__row"><div class="am-skeleton-line"></div></div>').join('') +
          '</div>' +
        '</div>' +
      '</section>';

    this._mountModals();
  }

  _mountModals() {
    this._inviteModal = this.addChild(new Modal({ title: 'Invite Admin', size: 'sm', body: '', footer: '' }));
    this._inviteModal.mount(document.body, { append: true });

    this._editModal = this.addChild(new Modal({ title: 'Edit Admin', size: 'sm', body: '', footer: '' }));
    this._editModal.mount(document.body, { append: true });

    this._viewModal = this.addChild(new Modal({ title: 'Admin Profile', size: 'lg', body: '', footer: '' }));
    this._viewModal.mount(document.body, { append: true });

    this._addModal = this.addChild(new Modal({ title: 'Add New Admin', size: 'sm', body: '', footer: '' }));
    this._addModal.mount(document.body, { append: true });
  }

  _renderContent() {
    this._renderAccount();
    this._renderTeam();
    if (this._isSuperAdmin) this._renderUsersSection();
  }

  // ── My Account ────────────────────────────────────────────────────────

  _renderAccount() {
    const body = document.getElementById('am-account-body');
    if (!body) return;
    const me = this._me;

    body.innerHTML =
      '<div class="am-account">' +

        // Profile card
        '<div class="am-profile-card">' +
          '<div class="am-profile-card__avatar">' +
            Avatar.html({ name: me.name, size: 'xl' }) +
          '</div>' +
          '<div class="am-profile-card__info">' +
            '<p class="am-profile-card__name">' + this.esc(me.name || '') + '</p>' +
            '<p class="am-profile-card__email">' + this.esc(me.email || '') + '</p>' +
            '<span class="am-role ' + (ROLE_COLORS[me.role] || '') + '">' + (ROLE_LABELS[me.role] || me.role) + '</span>' +
          '</div>' +
          '<p class="am-profile-card__id">' + this.esc(me.displayId || '') + '</p>' +
        '</div>' +

        // Edit profile form
        '<div class="am-account-form">' +
          '<div class="am-form-group">' +
            '<h3 class="am-form-group__title">Profile Details</h3>' +
            '<div class="am-form-row">' +
              '<div id="am-name-mount"></div>' +
              '<div id="am-email-mount"></div>' +
            '</div>' +
            '<div class="am-form-actions">' +
              '<div id="am-profile-save-mount"></div>' +
            '</div>' +
          '</div>' +
          '<div class="am-form-group">' +
            '<h3 class="am-form-group__title">Change Password</h3>' +
            '<div class="am-form-col">' +
              '<div id="am-curr-pass-mount"></div>' +
              '<div class="am-form-row">' +
                '<div id="am-new-pass-mount"></div>' +
                '<div id="am-confirm-pass-mount"></div>' +
              '</div>' +
            '</div>' +
            '<div class="am-form-actions">' +
              '<div id="am-pass-save-mount"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>';

    // Mount inputs
    this._nameInput = this.addChild(new Input({ label: 'Full Name', value: me.name || '' }));
    this._nameInput.mount(body.querySelector('#am-name-mount'));

    this.addChild(new Input({
      label: 'Email Address', value: me.email || '',
      readonly: true, hint: 'Email cannot be changed.',
    })).mount(body.querySelector('#am-email-mount'));

    this.addChild(new Button({
      label: 'Save Profile', variant: 'primary', size: 'md',
      onClick: () => this._saveProfile(),
    })).mount(body.querySelector('#am-profile-save-mount'));

    this._currPass    = this.addChild(new Input({ type: 'password', label: 'Current Password', autocomplete: 'current-password' }));
    this._newPass     = this.addChild(new Input({ type: 'password', label: 'New Password',      autocomplete: 'new-password' }));
    this._confirmPass = this.addChild(new Input({ type: 'password', label: 'Confirm Password',  autocomplete: 'new-password' }));

    this._currPass.mount(body.querySelector('#am-curr-pass-mount'));
    this._newPass.mount(body.querySelector('#am-new-pass-mount'));
    this._confirmPass.mount(body.querySelector('#am-confirm-pass-mount'));

    this.addChild(new Button({
      label: 'Update Password', icon: KEY_SVG, iconPosition: 'left',
      variant: 'secondary', size: 'md',
      onClick: () => this._changePassword(),
    })).mount(body.querySelector('#am-pass-save-mount'));
  }

  async _saveProfile() {
    const name = this._nameInput ? this._nameInput.getValue().trim() : '';
    if (!name) { this._nameInput && this._nameInput.setError('Name is required.'); return; }

    const res = await api.adminTeam.updateMe({ name });
    if (res.error) { showToast('error', res.error.message); return; }

    store.currentAdmin = { ...store.currentAdmin, name };
    showToast('success', 'Profile updated.');

    // Refresh avatar display
    const nameEl = document.querySelector('.am-profile-card__name');
    if (nameEl) nameEl.textContent = name;
  }

  async _changePassword() {
    const curr    = this._currPass    ? this._currPass.getValue()    : '';
    const newP    = this._newPass     ? this._newPass.getValue()     : '';
    const confirm = this._confirmPass ? this._confirmPass.getValue() : '';

    if (!curr)  { this._currPass    && this._currPass.setError('Required.');    return; }
    if (newP.length < 8) { this._newPass && this._newPass.setError('Min 8 characters.'); return; }
    if (newP !== confirm) { this._confirmPass && this._confirmPass.setError('Passwords do not match.'); return; }

    const res = await api.adminTeam.changePassword({
      currentPassword: curr,
      newPassword:     newP,
    });

    if (res.error) {
      if (res.error.code === 'INVALID_PASSWORD') {
        this._currPass && this._currPass.setError('Incorrect password.');
      } else {
        showToast('error', res.error.message);
      }
      return;
    }

    this._currPass    && this._currPass.setValue('');
    this._newPass     && this._newPass.setValue('');
    this._confirmPass && this._confirmPass.setValue('');
    showToast('success', 'Password updated successfully.');
  }

  // ── Admin Team ────────────────────────────────────────────────────────

  _renderTeam() {
    const body = document.getElementById('am-team-body');
    if (!body) return;

    // Invite button — super_admin only
    if (this._isSuperAdmin) {
      const mount = document.getElementById('am-invite-mount');
      if (mount) {
        this.addChild(new Button({
          label: 'Invite Admin', icon: PLUS_SVG, iconPosition: 'left',
          variant: 'primary', size: 'sm',
          onClick: () => this._openInviteModal(),
        })).mount(mount);
      }
    }

    if (!this._team.length) {
      body.innerHTML = '<p class="am-empty">No admins found.</p>';
      return;
    }

    body.innerHTML =
      '<div class="am-team-grid">' +
        this._team.map(a => this._buildAdminCard(a)).join('') +
      '</div>';

    this.delegate('[data-am-action]', 'click', (e, btn) => {
      const action = btn.dataset.amAction;
      const id     = parseInt(btn.dataset.amId, 10);
      const member = this._team.find(a => a.id === id);
      if (action === 'edit')    this._openEditModal(member);
      if (action === 'suspend') this._toggleStatus(member);
      if (action === 'remove')  this._confirmRemove(member);
    });
  }

  _buildAdminCard(a) {
    const isMe    = a.id === this._me.id;
    const isSelf  = isMe;
    const canEdit = this._isSuperAdmin && !isSelf;

    const statusDot = a.status === 'active'
      ? '<span class="am-status-dot am-status-dot--active"></span>'
      : '<span class="am-status-dot am-status-dot--suspended"></span>';

    const actions = canEdit
      ? '<div class="am-card__actions">' +
          '<button class="am-card__action-btn" data-am-action="edit" data-am-id="' + a.id + '" title="Edit admin">' + EDIT_SVG + '</button>' +
          '<button class="am-card__action-btn am-card__action-btn--warn" data-am-action="suspend" data-am-id="' + a.id + '" title="' + (a.status === 'active' ? 'Suspend' : 'Reactivate') + '">' +
            (a.status === 'active'
              ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
              : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            ) +
          '</button>' +
          '<button class="am-card__action-btn am-card__action-btn--danger" data-am-action="remove" data-am-id="' + a.id + '" title="Remove">' + TRASH_SVG + '</button>' +
        '</div>'
      : '';

    return '<div class="am-admin-card' + (a.status === 'suspended' ? ' am-admin-card--suspended' : '') + '" data-admin-id="' + a.id + '">' +
      '<div class="am-card__top">' +
        '<div class="am-card__avatar-wrap">' +
          Avatar.html({ name: a.name, size: 'md' }) +
          statusDot +
        '</div>' +
        '<div class="am-card__info">' +
          '<p class="am-card__name">' + this.esc(a.name) +
            (isMe ? ' <span class="am-card__you">(you)</span>' : '') +
          '</p>' +
          '<p class="am-card__email">' + this.esc(a.email) + '</p>' +
          '<span class="am-role ' + (ROLE_COLORS[a.role] || '') + '">' + (ROLE_LABELS[a.role] || a.role) + '</span>' +
        '</div>' +
        actions +
      '</div>' +
      '<div class="am-card__footer">' +
        '<span class="am-card__meta">' + this.esc(a.displayId) + '</span>' +
        '<span class="am-card__meta">' + (a.lastLogin ? 'Last login ' + timeAgo(a.lastLogin) : 'Never logged in') + '</span>' +
      '</div>' +
    '</div>';
  }

  // ── Modals ────────────────────────────────────────────────────────────

  _openInviteModal() {
    this._inviteModal.update({
      title: 'Invite Admin',
      body:
        '<div class="am-modal-form">' +
          '<div class="am-form-row">' +
            '<div class="am-modal-field"><label class="am-modal-label">SURNAME</label><input class="am-modal-input" id="inv-surname" placeholder="e.g. Yusuf" /></div>' +
            '<div class="am-modal-field"><label class="am-modal-label">FIRST NAME</label><input class="am-modal-input" id="inv-firstname" placeholder="e.g. Amina" /></div>' +
          '</div>' +
          '<div class="am-modal-field"><label class="am-modal-label">EMAIL ADDRESS</label><input class="am-modal-input" id="inv-email" type="email" placeholder="amina@afx.gov.ng" /></div>' +
          '<div class="am-modal-field"><label class="am-modal-label">ROLE</label>' +
            '<select class="am-modal-select" id="inv-role">' +
              '<option value="admin">Admin</option>' +
              '<option value="super_admin">Super Admin</option>' +
            '</select>' +
          '</div>' +
          '<div class="am-modal-field"><label class="am-modal-label">TEMPORARY PASSWORD</label><input class="am-modal-input" id="inv-pass" type="password" placeholder="Min. 8 characters" /></div>' +
        '</div>',
      footer:
        '<div class="am-modal-footer">' +
          '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>' +
          '<button class="ktg-btn ktg-btn--primary ktg-btn--md" id="inv-confirm">Add Admin</button>' +
        '</div>',
    });

    this._inviteModal.open();
    requestAnimationFrame(() => {
      const btn = document.getElementById('inv-confirm');
      if (btn) this.on(btn, 'click', () => this._submitInvite(btn));
    });
  }

  async _submitInvite(btn) {
    const surname    = (document.getElementById('inv-surname')    || {}).value?.trim() || '';
    const firstName  = (document.getElementById('inv-firstname')  || {}).value?.trim() || '';
    const email      = (document.getElementById('inv-email')      || {}).value?.trim() || '';
    const role       = (document.getElementById('inv-role')       || {}).value || 'admin';
    const pass       = (document.getElementById('inv-pass')       || {}).value || '';

    const name = (firstName + ' ' + surname).trim();
    if (!name || !email || pass.length < 8) {
      showToast('error', 'All fields required. Password min 8 chars.'); return;
    }

    btn.disabled = true; btn.textContent = 'Adding...';
    const res = await api.adminTeam.create({ name, email, role, temporaryPassword: pass });
    btn.disabled = false; btn.textContent = 'Add Admin';

    if (res.error) {
      showToast('error', res.error.code === 'DUPLICATE' ? 'Email already in use.' : res.error.message);
      return;
    }

    this._inviteModal.close();
    showToast('success', name + ' added to the admin team.');
    this._team = [...this._team, res.data];
    this._refreshTeamGrid();
    // Refresh table too
    if (this._isSuperAdmin) { this._auPage = 1; this._loadAdmins(); }
  }

  _openEditModal(member) {
    if (!member) return;
    this._editTarget = member;
    const a = {
      ...member,
      firstName: member.firstName || '',
      lastName:  member.lastName  || '',
      email:     member.email     || '',
    };

    const surnameField =
      '<div class="am-modal-field"><label class="am-modal-label">SURNAME</label>' +
      '<input class="am-modal-input" id="edit-surname" value="' + this.esc(a.lastName) + '" placeholder="Surname" /></div>';

    const firstNameField =
      '<div class="am-modal-field"><label class="am-modal-label">FIRST NAME</label>' +
      '<input class="am-modal-input" id="edit-firstname" value="' + this.esc(a.firstName) + '" placeholder="First name" /></div>';

    const emailField =
      '<div class="am-modal-field"><label class="am-modal-label">EMAIL ADDRESS</label>' +
      '<input class="am-modal-input" id="edit-email" value="' + this.esc(a.email) + '" placeholder="email@example.com" /></div>';

    const roleField =
      '<div class="am-modal-field"><label class="am-modal-label">ROLE</label>' +
      '<select class="am-modal-select" id="edit-role">' +
        '<option value="admin"'       + (a.role === 'admin'       ? ' selected' : '') + '>Admin</option>' +
        '<option value="super_admin"' + (a.role === 'super_admin' ? ' selected' : '') + '>Super Admin</option>' +
      '</select></div>';

    const passField =
      '<div class="am-modal-field"><label class="am-modal-label">UPDATE PASSWORD <span class="am-modal-label--hint">(leave blank to keep current)</span></label>' +
      '<input class="am-modal-input" id="edit-pass" type="password" placeholder="Min 8 characters..." autocomplete="new-password" /></div>';

    this._editModal.update({
      title: 'Edit Admin — ' + member.name,
      body:
        '<div class="am-modal-form">' +
          '<div class="am-form-row">' +
            surnameField +
            firstNameField +
          '</div>' +
          emailField +
          roleField +
          passField +
        '</div>',
      footer:
        '<div class="am-modal-footer">' +
          '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>' +
          '<button class="ktg-btn ktg-btn--primary ktg-btn--md" id="edit-confirm">Save Changes</button>' +
        '</div>',
    });

    this._editModal.open();

    requestAnimationFrame(() => {
      const btn = document.getElementById('edit-confirm');
      if (btn) this.on(btn, 'click', () => this._submitEdit(btn));
    });
  }

   async _submitEdit(btn) {
    const surname   = (document.getElementById('edit-surname')   || {}).value?.trim() || '';
    const firstName = (document.getElementById('edit-firstname') || {}).value?.trim() || '';
    const email     = (document.getElementById('edit-email')     || {}).value?.trim() || '';
    const role      = (document.getElementById('edit-role')      || {}).value    || 'admin';
    const pass      = (document.getElementById('edit-pass')      || {}).value    || '';

    if (!firstName || !surname) { showToast('error', 'Name fields are required.'); return; }
    if (!email) { showToast('error', 'Email is required.'); return; }
    if (pass && pass.length < 8) { showToast('error', 'Password must be at least 8 characters.'); return; }

    const payload = { surname, firstName, role, email };
    if (pass) payload.password = pass;

    btn.disabled = true; btn.textContent = 'Saving...';
    const res = await api.adminTeam.update(this._editTarget.id, payload);
    btn.disabled = false; btn.textContent = 'Save Changes';

    if (res.error) { showToast('error', res.error.message); return; }

    this._editModal.close();
    showToast('success', 'Admin updated.');

    // Update both the team cards and the admin users table
    this._team     = this._team.map(a => a.id === res.data.id ? res.data : a);
    this._auAdmins = this._auAdmins.map(a => a.id === res.data.id ? res.data : a);
    this._refreshTeamGrid();
    this._renderAdminsTable(document.getElementById('am-users-body'));
  }

  async _toggleStatus(member) {
    const newStatus = member.status === 'active' ? 'suspended' : 'active';
    const label     = newStatus === 'suspended' ? 'Suspend' : 'Reactivate';
    if (!confirm(label + ' ' + member.name + '?')) return;

    const res = await api.adminTeam.updateStatus(member.id, newStatus);
    if (res.error) { showToast('error', res.error.message); return; }

    showToast('success', member.name + ' ' + (newStatus === 'suspended' ? 'suspended.' : 'reactivated.'));
    this._updateTeamMember(res.data);
  }

  async _confirmRemove(member) {
    if (!confirm('Remove ' + member.name + ' from the admin team? This cannot be undone.')) return;
    const res = await api.adminTeam.remove(member.id);
    if (res.error) { showToast('error', res.error.message); return; }

    showToast('success', member.name + ' removed.');
    this._team = this._team.filter(a => a.id !== member.id);
    this._refreshTeamGrid();
  }

  _updateTeamMember(updated) {
    this._team = this._team.map(a => a.id === updated.id ? updated : a);
    this._refreshTeamGrid();
  }

  _refreshTeamGrid() {
    const grid = document.querySelector('.am-team-grid');
    if (!grid) return;
    grid.innerHTML = this._team.map(a => this._buildAdminCard(a)).join('');
  }

  // ── Admin Users Management (super_admin only) ─────────────────────────

  _renderUsersSection() {
    const section = document.getElementById('am-users-section');
    if (!section) return;
    section.style.display = '';

    // Add New Users button
    const mount = document.getElementById('am-add-admin-mount');
    if (mount) {
      this.addChild(new Button({
        label: 'Add New Users', icon: PLUS_SVG, iconPosition: 'left',
        variant: 'primary', size: 'sm',
        onClick: () => this._openInviteModal(),
      })).mount(mount);
    }

    // Search input
    const searchInput = document.getElementById('am-users-search');
    if (searchInput) {
      this.on(searchInput, 'input', () => {
        clearTimeout(this._auSearchTimer);
        this._auSearchTimer = setTimeout(() => {
          this._auSearch = searchInput.value.trim();
          this._auPage = 1;
          this._loadAdmins();
        }, 350);
      });
    }

    this._loadAdmins();
  }

  async _loadAdmins() {
    const body = document.getElementById('am-users-body');
    if (!body) return;

    body.innerHTML =
      '<div class="am-table-skeleton">' +
        [1,2,3,4,5].map(() => '<div class="am-table-skeleton__row"><div class="am-skeleton-line"></div></div>').join('') +
      '</div>';

    const res = await api.adminTeam.list({
      page: this._auPage,
      perPage: this._auPerPage,
      search: this._auSearch || undefined,
    });

    if (res.error) {
      body.innerHTML = '<p class="am-empty">Failed to load admins.</p>';
      return;
    }

    // Handle both paginated ({ data, total }) and plain array responses
    if (Array.isArray(res.data)) {
      this._auAdmins = res.data;
      this._auTotal  = res.data.length;
    } else {
      this._auAdmins = res.data?.data || [];
      this._auTotal  = res.data?.total ?? this._auAdmins.length;
    }

    this._renderAdminsTable(body);
  }

  _renderAdminsTable(body) {
    if (!this._auAdmins.length) {
      body.innerHTML = '<p class="am-empty">No admins found.</p>';
      return;
    }

    const start = (this._auPage - 1) * this._auPerPage + 1;
    const end   = Math.min(this._auPage * this._auPerPage, this._auTotal);

    body.innerHTML =
      '<div class="am-table-wrap">' +
        '<table class="am-table">' +
          '<thead><tr>' +
            '<th>Admin ID</th>' +
            '<th>Photo</th>' +
            '<th>Surname</th>' +
            '<th>First Name</th>' +
            '<th>Phone No</th>' +
            '<th>Reg Date</th>' +
            '<th>Status</th>' +
            '<th>Actions</th>' +
          '</tr></thead>' +
          '<tbody>' +
            this._auAdmins.map(a => this._buildAdminRow(a)).join('') +
          '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="am-table-footer">' +
        '<span class="am-table-footer__info">Showing ' + start + ' to ' + end + ' of ' + this._auTotal + ' users</span>' +
        this._buildPagination() +
      '</div>';

    this.delegate('[data-au-action]', 'click', (e, btn) => {
      const id     = parseInt(btn.dataset.auId, 10);
      const action = btn.dataset.auAction;
      const admin  = this._auAdmins.find(a => a.id === id);
      if (action === 'view')   this._openViewModal(admin);
      if (action === 'edit')   this._openAdminEditModal(admin);
      if (action === 'delete') this._deleteAdmin(admin);
    });

    this.delegate('[data-au-page]', 'click', (e, btn) => {
      const p = parseInt(btn.dataset.auPage, 10);
      if (!isNaN(p) && p !== this._auPage) { this._auPage = p; this._loadAdmins(); }
    });
  }

  _buildAdminRow(a) {
    const statusBadge = a.status === 'active'
      ? '<span class="am-status-badge am-status-badge--active">Active</span>'
      : '<span class="am-status-badge am-status-badge--suspended">Suspended</span>';

    const avatarHtml = a.avatarUrl
      ? '<img class="am-table-avatar" src="' + this.esc(a.avatarUrl) + '" alt="' + this.esc(a.name) + '" />'
      : '<div class="am-table-avatar am-table-avatar--initials">' + this.esc((a.firstName?.[0] || '') + (a.lastName?.[0] || '')) + '</div>';

    const isMe = a.id === this._me?.id;

    return '<tr>' +
      '<td class="am-table__id">' + this.esc(a.displayId) + '</td>' +
      '<td>' + avatarHtml + '</td>' +
      '<td>' + this.esc(a.lastName || '—') + '</td>' +
      '<td>' + this.esc(a.firstName || '—') + '</td>' +
      '<td>' + this.esc(a.phone || '—') + '</td>' +
      '<td>' + (a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—') + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td class="am-table__actions">' +
        '<button class="am-table-action" data-au-action="view" data-au-id="' + a.id + '" title="View">' + EYE_SVG + '</button>' +
        (!isMe ? '<button class="am-table-action" data-au-action="edit" data-au-id="' + a.id + '" title="Edit">' + EDIT_SVG + '</button>' : '') +
        (!isMe ? '<button class="am-table-action am-table-action--danger" data-au-action="delete" data-au-id="' + a.id + '" title="Delete">' + TRASH_SVG + '</button>' : '') +
      '</td>' +
    '</tr>';
  }

  _buildPagination() {
    const totalPages = Math.max(1, Math.ceil(this._auTotal / this._auPerPage));
    if (totalPages <= 1) return '';

    const pages = [];
    const curr  = this._auPage;

    const btn = (p, label, disabled = false, active = false) =>
      '<button class="am-page-btn' + (active ? ' am-page-btn--active' : '') + '" data-au-page="' + p + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';

    pages.push(btn(curr - 1, 'Previous', curr === 1));

    // Page numbers: show up to 5 around current
    const range = [];
    for (let p = Math.max(1, curr - 2); p <= Math.min(totalPages, curr + 2); p++) range.push(p);
    if (range[0] > 1) { pages.push(btn(1, '1')); if (range[0] > 2) pages.push('<span class="am-page-ellipsis">…</span>'); }
    range.forEach(p => pages.push(btn(p, String(p), false, p === curr)));
    if (range[range.length - 1] < totalPages) {
      if (range[range.length - 1] < totalPages - 1) pages.push('<span class="am-page-ellipsis">…</span>');
      pages.push(btn(totalPages, String(totalPages)));
    }

    pages.push(btn(curr + 1, 'Next', curr === totalPages));

    return '<div class="am-pagination">' + pages.join('') + '</div>';
  }

  // ── View modal (Admin Profile) ────────────────────────────────────────

  _openViewModal(admin) {
    if (!admin) return;
    const a = admin;

    const avatarHtml = a.avatarUrl
      ? '<img class="am-profile-modal__img" src="' + this.esc(a.avatarUrl) + '" alt="' + this.esc(a.name) + '" />'
      : Avatar.html({ name: a.name, size: 'xl' });

    const statusOptions = ['active', 'suspended'].map(s =>
      '<label class="am-profile-status__option' + (a.status === s ? ' am-profile-status__option--active' : '') + '">' +
        '<span class="am-profile-status__dot am-profile-status__dot--' + s + '"></span>' +
        this._capitalize(s) +
        (a.status === s ? ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
      '</label>'
    ).join('');

    const field = (label, value) =>
      '<div class="am-profile-field">' +
        '<span class="am-profile-field__label">' + label + '</span>' +
        '<div class="am-profile-field__value">' + this.esc(value || '—') + '</div>' +
      '</div>';

    this._viewModal.update({
      body:
        '<div class="am-profile-modal">' +
          '<div class="am-profile-modal__left">' +
            '<div class="am-profile-modal__avatar-wrap">' +
              avatarHtml +
              '<button class="am-profile-modal__cam-btn" title="Change photo" disabled>' + CAM_SVG + '</button>' +
            '</div>' +
            '<p class="am-profile-modal__name">' + this.esc(a.name) + '</p>' +
            '<p class="am-profile-modal__id">Admin ID: ' + this.esc(a.displayId) + '</p>' +
            '<div class="am-profile-modal__joined">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
              (a.createdAt ? 'JOINED DATE<br>' + new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '') +
            '</div>' +
            '<div class="am-profile-modal__status-block">' +
              '<p class="am-profile-modal__status-title">ACCOUNT STATUS</p>' +
              statusOptions +
            '</div>' +
          '</div>' +
          '<div class="am-profile-modal__right">' +
            '<h3 class="am-profile-modal__details-title">Admin Details</h3>' +
            '<div class="am-profile-fields-grid">' +
              field('SURNAME',      a.lastName) +
              field('FIRST NAME',   a.firstName) +
              field('STATE',        a.state) +
              field('CITY',         a.city) +
              field('PHONE NUMBER', a.phone) +
              field('EMAIL ADDRESS', a.email) +
              field('ROLE',         ROLE_LABELS[a.role] || a.role) +
            '</div>' +
          '</div>' +
        '</div>',
      footer: '',
    });

    this._viewModal.open();
  }

  // ── Edit modal (Account Settings) ─────────────────────────────────────

  _openAdminEditModal(admin) {
    if (!admin) return;
    this._editTarget = admin;
    const a = admin;

    this._addModal.update({
      title: 'Account Settings',
      body:
        '<div class="am-modal-form">' +
          '<div class="am-form-row">' +
            '<div class="am-modal-field"><label class="am-modal-label">SURNAME NAME</label><input class="am-modal-input" id="ae-surname" value="' + this.esc(a.lastName || '') + '" placeholder="Surname" /></div>' +
            '<div class="am-modal-field"><label class="am-modal-label">FIRST NAME</label><input class="am-modal-input" id="ae-firstname" value="' + this.esc(a.firstName || '') + '" placeholder="First name" /></div>' +
          '</div>' +
          '<div class="am-modal-field"><label class="am-modal-label">EMAIL ADDRESS</label><input class="am-modal-input" id="ae-email" value="' + this.esc(a.email) + '" placeholder="email@example.com" /></div>' +
          '<div class="am-modal-field"><label class="am-modal-label">ROLE</label>' +
            '<select class="am-modal-select" id="ae-role">' +
              '<option value="admin"'       + (a.role === 'admin'       ? ' selected' : '') + '>Admin</option>' +
              '<option value="super_admin"' + (a.role === 'super_admin' ? ' selected' : '') + '>Super Admin</option>' +
            '</select>' +
          '</div>' +
          '<div class="am-modal-field"><label class="am-modal-label">STATE</label><input class="am-modal-input" id="ae-state" value="' + this.esc(a.state || '') + '" placeholder="State" /></div>' +
          '<div class="am-modal-field"><label class="am-modal-label">PHONE NUMBER</label><input class="am-modal-input" id="ae-phone" value="' + this.esc(a.phone || '') + '" placeholder="+234 800 000 0000" /></div>' +
          '<div class="am-modal-field"><label class="am-modal-label">UPDATE PASSWORD <span class="am-modal-label--hint">(leave blank to keep current)</span></label>' +
            '<input class="am-modal-input" id="ae-pass" type="password" placeholder="New password…" autocomplete="new-password" /></div>' +
        '</div>',
      footer:
        '<div class="am-modal-footer">' +
          '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>' +
          '<button class="ktg-btn ktg-btn--primary ktg-btn--md" id="ae-confirm">Save Changes</button>' +
        '</div>',
    });

    this._addModal.open();
    requestAnimationFrame(() => {
      const btn = document.getElementById('ae-confirm');
      if (btn) this.on(btn, 'click', () => this._submitAdminEdit(btn));
    });
  }

   async _submitAdminEdit(btn) {
    const surname   = (document.getElementById('ae-surname')   || {}).value?.trim() || '';
    const firstName = (document.getElementById('ae-firstname') || {}).value?.trim() || '';
    const email     = (document.getElementById('ae-email')     || {}).value?.trim() || '';
    const role      = (document.getElementById('ae-role')      || {}).value    || 'admin';
    const state     = (document.getElementById('ae-state')     || {}).value?.trim() || '';
    const phone     = (document.getElementById('ae-phone')     || {}).value?.trim() || '';
    const pass      = (document.getElementById('ae-pass')      || {}).value    || '';

    if (!firstName || !surname) { showToast('error', 'Name fields are required.'); return; }
    if (!email) { showToast('error', 'Email is required.'); return; }
    if (pass && pass.length < 8) { showToast('error', 'Password must be at least 8 characters.'); return; }

    const payload = { surname, firstName, role, state, phone, email };
    if (pass) payload.password = pass;

    btn.disabled = true; btn.textContent = 'Saving...';
    const res = await api.adminTeam.update(this._editTarget.id, payload);
    btn.disabled = false; btn.textContent = 'Save Changes';

    if (res.error) { showToast('error', res.error.message); return; }

    this._addModal.close();
    showToast('success', 'Admin updated.');
    this._auAdmins = this._auAdmins.map(a => a.id === res.data.id ? res.data : a);
    this._team     = this._team.map(a => a.id === res.data.id ? res.data : a);
    this._renderAdminsTable(document.getElementById('am-users-body'));
    this._refreshTeamGrid();
  }

  // ── Delete admin ──────────────────────────────────────────────────────

  async _deleteAdmin(admin) {
    if (!admin) return;
    if (!confirm('Delete ' + admin.name + '? This cannot be undone.')) return;

    const res = await api.adminTeam.remove(admin.id);
    if (res.error) { showToast('error', res.error.message); return; }

    showToast('success', admin.name + ' removed.');
    this._team     = this._team.filter(a => a.id !== admin.id);
    this._auAdmins = this._auAdmins.filter(a => a.id !== admin.id);
    this._auTotal  = Math.max(0, this._auTotal - 1);
    this._refreshTeamGrid();
    this._renderAdminsTable(document.getElementById('am-users-body'));
  }

  _capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
}
