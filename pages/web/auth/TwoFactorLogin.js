/**
 * Lagos Konnect - Two-Factor Auth Login Page
 * Route: /2fa
 * ============================================================
 * Shown after a successful password login when the user has
 * TOTP 2FA enabled. User enters their 6-digit authenticator code.
 *
 * The partialToken from the login response is stored in
 * sessionStorage['adm_2fa_partial'] by Login.js before navigating here.
 *
 * On success: receives full token, saves session, navigates to /home.
 * On "use backup code": switches to backup code input.
 */

import { Component } from '../../../core/component.js?v=20260805c';
import { AuthLayout } from './_AuthLayout.js?v=20260805c';
import { Input } from '../../../components/base/Input.js?v=20260805c';
import { Button } from '../../../components/base/Button.js?v=20260805c';
import { t } from '../../../core/i18n.js?v=20260805c';
import { store, showToast } from '../../../core/store.js?v=20260805c';
import { router } from '../../../core/router.js?v=20260805c';
import { api } from '../../../api/client.js?v=20260805c';
import { saveSession } from '../../../utils/storage.js?v=20260805c';

export default class TwoFactorLoginPage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css?v=20260805c';

  constructor(props) {
    super(props);
    this._mode        = 'totp';    // 'totp' | 'backup'
    this._codeInput   = null;
    this._submitBtn   = null;
    this._errorEl     = null;
  }

  render() {
    return AuthLayout.wrap({
      title: 'Two-Factor Authentication',
      subtitle: this._mode === 'totp'
        ? 'Enter the 6-digit code from your authenticator app.'
        : 'Enter one of your 8-character backup codes.',
      content: `
        <div class="auth-form" id="twofa-form">
          <div id="code-mount"></div>
          <p class="auth-form__error" id="twofa-error" aria-live="polite"></p>
          <div id="submit-mount" class="auth-form__submit"></div>

          <div class="auth-panel__footer" style="margin-top: 16px;">
            ${this._mode === 'totp'
              ? `Lost your phone? <button class="auth-form__forgot" id="use-backup" type="button">Use a backup code</button>`
              : `<button class="auth-form__forgot" id="use-totp" type="button">← Use authenticator app instead</button>`
            }
          </div>
        </div>
      `,
    });
  }

  afterMount() {
    // Guard: must have a partial token
    if (!sessionStorage.getItem('adm_2fa_partial')) {
      router.replace('/login');
      return;
    }

    this._mountInputs();
    this._bindSwitchLinks();
  }

  _mountInputs() {
    const codeMount   = this.$('#code-mount');
    const submitMount = this.$('#submit-mount');
    this._errorEl     = this.$('#twofa-error');

    if (this._codeInput) {
      this._codeInput.unmount?.();
      this._codeInput = null;
    }
    if (this._submitBtn) {
      this._submitBtn.unmount?.();
      this._submitBtn = null;
    }

    this._codeInput = this.addChild(new Input({
      label:       this._mode === 'totp' ? 'Authenticator Code' : 'Backup Code',
      placeholder: this._mode === 'totp' ? '000000' : 'XXXXXXXX',
      name:        'code',
      autocomplete:'one-time-code',
      maxLength:   this._mode === 'totp' ? 6 : 8,
      required:    true,
      onEnter:     () => this._handleSubmit(),
    }));
    this._codeInput.mount(codeMount);

    this._submitBtn = this.addChild(new Button({
      label:    'Verify',
      variant:  'primary',
      size:     'lg',
      fullWidth: true,
      onClick:  () => this._handleSubmit(),
    }));
    this._submitBtn.mount(submitMount);

    // Focus the input
    setTimeout(() => this._codeInput?.focus?.(), 100);
  }

  _bindSwitchLinks() {
    const useBackup = this.$('#use-backup');
    const useTotp   = this.$('#use-totp');

    if (useBackup) {
      this.on(useBackup, 'click', () => {
        this._mode = 'backup';
        this._rerender();
      });
    }
    if (useTotp) {
      this.on(useTotp, 'click', () => {
        this._mode = 'totp';
        this._rerender();
      });
    }
  }

  _rerender() {
    // Re-render just the content area
    const form = this.$('#twofa-form');
    if (!form) return;
    form.innerHTML = `
      <div id="code-mount"></div>
      <p class="auth-form__error" id="twofa-error" aria-live="polite"></p>
      <div id="submit-mount" class="auth-form__submit"></div>
      <div class="auth-panel__footer" style="margin-top: 16px;">
        ${this._mode === 'totp'
          ? `Lost your phone? <button class="auth-form__forgot" id="use-backup" type="button">Use a backup code</button>`
          : `<button class="auth-form__forgot" id="use-totp" type="button">← Use authenticator app instead</button>`
        }
      </div>
    `;
    this._errorEl = this.$('#twofa-error');
    this._mountInputs();
    this._bindSwitchLinks();
  }

  async _handleSubmit() {
    const code = this._codeInput?.getValue()?.trim();
    if (!code) {
      if (this._errorEl) this._errorEl.textContent = 'Please enter the code.';
      return;
    }
    if (this._errorEl) this._errorEl.textContent = '';

    this._submitBtn?.setLoading(true);

    const res = this._mode === 'totp'
      ? await api.auth.twoFaValidate(code)
      : await api.auth.twoFaBackup(code);

    this._submitBtn?.setLoading(false);

    if (res.error) {
      if (this._errorEl) {
        this._errorEl.textContent = res.error.code === 'INVALID_CODE'
          ? 'Incorrect code. Please try again.'
          : res.error.message;
      }
      return;
    }

    const { token, user, role } = res.data;

    store.isAuthenticated = true;
    store.role            = role;
    store.authToken       = token;
    store.currentUser     = user;
    store.currentLGA      = { id: user.lgaId, name: user.lgaName };

    saveSession({ token, role, user });

    if (res.data.remainingBackups !== undefined && res.data.remainingBackups < 3) {
      showToast('warning', `Only ${res.data.remainingBackups} backup code${res.data.remainingBackups !== 1 ? 's' : ''} remaining. Generate new ones in Settings.`);
    }

    showToast('success', t('login.welcomeToast', { name: user.name.split(' ')[0] }));
    const region = sessionStorage.getItem('lagosRegion') || 'west';
    router.replace(user.has_seen_welcome ? `/${region}/home` : `/${region}/welcome`);
  }
}
