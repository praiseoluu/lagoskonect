/**
 * LagKonnect — Force Change Password Page
 * Route: /change-password
 * ============================================================
 * Shown to citizens whose account was created by an admin.
 * They cannot navigate anywhere else until they set a new password.
 * Uses the same AuthLayout as citizen auth pages.
 */

import { Component } from '../../../core/component.js?v=20260806e';
import { Input } from '../../../components/base/Input.js?v=20260806e';
import { Button } from '../../../components/base/Button.js?v=20260806e';
import { AuthLayout } from './_AuthLayout.js?v=20260806e';
import { store, showToast } from '../../../core/store.js?v=20260806e';
import { router } from '../../../core/router.js?v=20260806e';
import { api } from '../../../api/client.js?v=20260806e';
import { saveSession } from '../../../utils/storage.js?v=20260806e';

export default class ForceChangePasswordPage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css?v=20260806e';

  constructor(props) {
    super(props);
    this._newPassInput    = null;
    this._confirmInput    = null;
    this._submitBtn       = null;
  }

  render() {
    return AuthLayout.wrap({
      title: 'Set Your Password',
      subtitle: 'Your account was created by an administrator. Please set a personal password before continuing.',
      content: `
        <form class="auth-form" id="change-pass-form" novalidate>
          <div id="new-pass-mount"></div>
          <div id="confirm-pass-mount"></div>
          <div id="submit-mount" class="auth-form__submit"></div>
        </form>

        <p class="auth-panel__footer">
          This is required to secure your account.
        </p>
      `,
    });
  }

  afterMount() {
    // Guard — must be logged in and must need password change
    if (!store.isAuthenticated || store.role !== 'citizen') {
      router.replace('/login');
      return;
    }
    if (!store.currentUser?.mustChangePassword) {
      const region = sessionStorage.getItem('lagosRegion') || 'west';
      router.replace(`/${region}/home`);
      return;
    }

    this._newPassInput = this.addChild(new Input({
      type: 'password',
      label: 'New Password',
      placeholder: 'At least 8 characters',
      name: 'new_password',
      required: true,
      autocomplete: 'new-password',
      onEnter: () => this._confirmInput?.focus?.(),
    }));
    this._newPassInput.mount(this.$('#new-pass-mount'));

    this._confirmInput = this.addChild(new Input({
      type: 'password',
      label: 'Confirm Password',
      placeholder: 'Repeat your new password',
      name: 'confirm_password',
      required: true,
      autocomplete: 'new-password',
      onEnter: () => this._handleSubmit(),
    }));
    this._confirmInput.mount(this.$('#confirm-pass-mount'));

    this._submitBtn = this.addChild(new Button({
      label: 'Set Password & Continue',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleSubmit(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));
  }

  async _handleSubmit() {
    const newPass     = this._newPassInput?.getValue();
    const confirmPass = this._confirmInput?.getValue();

    this._newPassInput?.setError('');
    this._confirmInput?.setError('');

    let valid = true;

    if (!newPass || newPass.length < 8) {
      this._newPassInput?.setError('Password must be at least 8 characters.');
      valid = false;
    }
    if (!confirmPass) {
      this._confirmInput?.setError('Please confirm your password.');
      valid = false;
    } else if (newPass !== confirmPass) {
      this._confirmInput?.setError('Passwords do not match.');
      valid = false;
    }
    if (!valid) return;

    this._submitBtn.setLoading(true);
    const res = await api.users.changePassword(newPass);
    this._submitBtn.setLoading(false);

    if (res.error) {
      showToast('error', res.error.message || 'Could not update password.');
      return;
    }

    // Update session — clear mustChangePassword
    const updatedUser = { ...store.currentUser, mustChangePassword: false };
    store.currentUser = updatedUser;

    const auth = JSON.parse(sessionStorage.getItem('adm_auth') || '{}');
    saveSession({ token: auth.token, role: store.role, user: updatedUser });

    showToast('success', 'Password updated. Welcome to LagKonnect!');
    const region = sessionStorage.getItem('lagosRegion') || 'west';
    router.replace(updatedUser.has_seen_welcome ? `/${region}/home` : `/${region}/welcome`);
  }
}
