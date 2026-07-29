/**
 * KTG Connect — Verification Success Page
 * Route: /verification-success
 * ============================================================
 */

import { Component } from '../../../core/component.js';
import { Button } from '../../../components/base/Button.js';
import { AuthLayout } from './_AuthLayout.js';
import { router } from '../../../core/router.js';

export default class VerificationSuccessPage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css';
  render() {
    return AuthLayout.wrap({
      title: 'Phone verified!',
      subtitle: 'Your account is now active. You can sign in and join your LGA community.',
      narrow: true,
      content: `
        <div class="success-page">
          <div class="success-page__icon" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="#06892726"/>
              <circle cx="32" cy="32" r="24" fill="#06892740"/>
              <polyline points="20 32 28 40 44 24" stroke="#068927" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div id="btn-mount"></div>
        </div>
      `,
    });
  }

  afterMount() {
    const btn = this.addChild(new Button({
      label: 'Sign in to your account',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => router.replace('/login'),
    }));
    btn.mount(this.$('#btn-mount'));
  }
}


/**
 * KTG Connect — Forgot Password Page
 * Route: /forgot-password
 * ============================================================
 */

import { Input } from '../../../components/base/Input.js';
import { validateForm, validators } from '../../../utils/validators.js';
import { api } from '../../../api/client.js';
import { showToast } from '../../../core/store.js';

export class ForgotPasswordPage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css';
  constructor(props) {
    super(props);
    this._phoneInput = null;
    this._submitBtn = null;
  }

  render() {
    return AuthLayout.wrap({
      title: 'Forgot password?',
      subtitle: 'Enter your registered phone number and we\'ll send you a reset code.',
      narrow: true,
      content: `<div id="forgot-form-mount"></div>`,
      footer: `Remembered it? <a href="/login">Back to sign in</a>`,
    });
  }

  afterMount() {
    const mount = this.$('#forgot-form-mount');
    if (!mount) return;

    this._phoneInput = this.addChild(new Input({
      type: 'phone',
      label: 'Phone number',
      placeholder: '0801 234 5678',
      name: 'phone',
      required: true,
      onEnter: () => this._handleSubmit(),
    }));
    const phoneWrap = document.createElement('div');
    mount.appendChild(phoneWrap);
    this._phoneInput.mount(phoneWrap);

    this._submitBtn = this.addChild(new Button({
      label: 'Send reset code',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleSubmit(),
    }));
    const btnWrap = document.createElement('div');
    btnWrap.className = 'auth-form__submit';
    mount.appendChild(btnWrap);
    this._submitBtn.mount(btnWrap);
  }

  async _handleSubmit() {
    const rawPhone = this._phoneInput?.getValue()?.trim();
    const phone = rawPhone?.startsWith('0') ? '+234' + rawPhone.slice(1) : rawPhone;

    const { valid, errors } = validateForm({ phone }, { phone: validators.phone });
    this._phoneInput?.setError(errors.phone || '');
    if (!valid) return;

    this._submitBtn.setLoading(true);
    const res = await api.auth.forgotPassword({ phone });
    this._submitBtn.setLoading(false);

    if (res.error) {
      this._phoneInput.setError(res.error.message);
      return;
    }

    sessionStorage.setItem('afx_reset_user_id', String(res.data.userId));
    sessionStorage.setItem('afx_reset_phone', phone);

    showToast('success', 'Reset code sent to your phone.');
    router.push('/verify-identity');
  }
}

export default ForgotPasswordPage;


/**
 * KTG Connect — Verify Identity Page
 * Route: /verify-identity
 * OTP: 6 digits
 * ============================================================
 */

export class VerifyIdentityPage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css';
  constructor(props) {
    super(props);
    this._otpInput = null;
    this._submitBtn = null;
    this._resendBtn = null;
    this._resendTimer = null;
    this.state = { resendCooldown: 60 };

    this._userId = parseInt(sessionStorage.getItem('afx_reset_user_id') || '0', 10);
    this._phone = sessionStorage.getItem('afx_reset_phone') || '';
  }

  render() {
    const maskedPhone = this._phone
      ? this._phone.replace(/(\+234|0)(\d{3})(\d{4})(\d{4})/, '$1 $2 **** $4')
      : 'your phone';

    return AuthLayout.wrap({
      title: 'Verify your identity',
      subtitle: `Enter the 6-digit code sent to ${maskedPhone}.`,
      narrow: true,
      content: `
        <div class="verify-page">
          <div id="otp-mount"></div>
          <div id="submit-mount" class="auth-form__submit"></div>
          <div class="verify-page__resend">
            <span class="verify-page__resend-label">Didn't receive a code?</span>
            <div id="resend-mount"></div>
          </div>
          <p class="verify-page__hint">Hint: use <strong>123456</strong> for demo.</p>
        </div>
      `,
      footer: `<a href="/forgot-password">← Back</a>`,
    });
  }

  afterMount() {
    if (!this._userId) { router.replace('/forgot-password'); return; }

    const { OTPInput } = await import('../../../components/base/Forms.js').catch(() => ({}));

    this._otpInput = this.addChild(new OTPInput({
      length: 6,
      onComplete: () => this._handleVerify(),
    }));
    this._otpInput.mount(this.$('#otp-mount'));

    this._submitBtn = this.addChild(new Button({
      label: 'Verify identity',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleVerify(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));

    this._resendBtn = this.addChild(new Button({
      label: `Resend code (${this.state.resendCooldown}s)`,
      variant: 'ghost',
      size: 'sm',
      disabled: true,
      onClick: () => this._handleResend(),
    }));
    this._resendBtn.mount(this.$('#resend-mount'));

    this._startResendTimer();
  }

  async _handleVerify() {
    const otp = this._otpInput.getValue();
    if (otp.length < 6) {
      this._otpInput.setError('Please enter the complete 6-digit code.');
      return;
    }

    this._submitBtn.setLoading(true);
    const res = await api.auth.verifyIdentity({ userId: this._userId, otp });
    this._submitBtn.setLoading(false);

    if (res.error) {
      this._otpInput.setError(res.error.message);
      this._otpInput.clear();
      return;
    }

    sessionStorage.setItem('adm_reset_token', res.data.resetToken);
    router.replace('/reset-credentials');
  }

  async _handleResend() {
    this._resendBtn.setDisabled(true);
    await api.auth.resendOtp({ userId: this._userId, type: 'identity' });
    showToast('success', 'A new code has been sent.');
    this.setState({ resendCooldown: 60 });
    this._startResendTimer();
  }

  _startResendTimer() {
    clearInterval(this._resendTimer);
    this._resendTimer = setInterval(() => {
      const remaining = this.state.resendCooldown - 1;
      this.setState({ resendCooldown: remaining });
      if (remaining <= 0) {
        clearInterval(this._resendTimer);
        this._resendBtn.setLabel('Resend code');
        this._resendBtn.setDisabled(false);
      } else {
        this._resendBtn.setLabel(`Resend code (${remaining}s)`);
      }
    }, 1000);
  }

  beforeUnmount() { clearInterval(this._resendTimer); }
}

export { VerifyIdentityPage };


/**
 * KTG Connect — Reset Credentials Page
 * Route: /reset-credentials
 * ============================================================
 */

export class ResetCredentialsPage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css';
  constructor(props) {
    super(props);
    this._passInput = null;
    this._confirmInput = null;
    this._submitBtn = null;
    this._resetToken = sessionStorage.getItem('adm_reset_token') || '';
  }

  render() {
    return AuthLayout.wrap({
      title: 'Reset your password',
      subtitle: 'Choose a strong new password for your account.',
      narrow: true,
      content: `<div id="reset-form-mount"></div>`,
      footer: `<a href="/login">← Back to sign in</a>`,
    });
  }

  afterMount() {
    if (!this._resetToken) { router.replace('/forgot-password'); return; }

    const mount = this.$('#reset-form-mount');
    if (!mount) return;

    this._passInput = this.addChild(new Input({
      type: 'password',
      label: 'New password',
      placeholder: 'Minimum 8 characters',
      name: 'new_password',
      required: true,
      hint: 'Must contain at least one letter and one number.',
      autocomplete: 'new-password',
    }));
    const passWrap = document.createElement('div');
    mount.appendChild(passWrap);
    this._passInput.mount(passWrap);

    this._confirmInput = this.addChild(new Input({
      type: 'password',
      label: 'Confirm new password',
      placeholder: 'Repeat your new password',
      name: 'confirm_password',
      required: true,
      autocomplete: 'new-password',
      onEnter: () => this._handleSubmit(),
    }));
    const confirmWrap = document.createElement('div');
    mount.appendChild(confirmWrap);
    this._confirmInput.mount(confirmWrap);

    this._submitBtn = this.addChild(new Button({
      label: 'Reset password',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleSubmit(),
    }));
    const btnWrap = document.createElement('div');
    btnWrap.className = 'auth-form__submit';
    mount.appendChild(btnWrap);
    this._submitBtn.mount(btnWrap);
  }

  async _handleSubmit() {
    const newPassword = this._passInput?.getValue();
    const confirmPassword = this._confirmInput?.getValue();

    const { valid, errors } = validateForm(
      { newPassword, confirmPassword },
      {
        newPassword: (v) => validators.password(v),
        confirmPassword: (v) => validators.confirmPassword(v, newPassword),
      }
    );

    this._passInput?.setError(errors.newPassword || '');
    this._confirmInput?.setError(errors.confirmPassword || '');
    if (!valid) return;

    this._submitBtn.setLoading(true);
    const res = await api.auth.resetPassword({ resetToken: this._resetToken, newPassword });
    this._submitBtn.setLoading(false);

    if (res.error) {
      showToast('error', res.error.message);
      return;
    }

    // Clean up
    sessionStorage.removeItem('afx_reset_user_id');
    sessionStorage.removeItem('afx_reset_phone');
    sessionStorage.removeItem('adm_reset_token');

    showToast('success', 'Password reset successfully. Please sign in.');
    router.replace('/login');
  }
}

export { ResetCredentialsPage };