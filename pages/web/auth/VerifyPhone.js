/**
 * Lagos Konect — Phone Verification Page
 * Route: /verify-phone
 * ============================================================
 * Standalone OTP page using the two-panel AuthLayout.
 * Same function as the inline signup OTP modal but as a full page
 * so the UI stays synchronised for any flow that routes here directly
 * (e.g. deep-link, resend, post-login re-verification).
 *
 * OTP: 4 digits.
 * On success: transitions to a success state within the same page,
 * then "Done" routes to /home (or /verification-success).
 */

import { Component } from '../../../core/component.js?v=20260805c';
import { Button } from '../../../components/base/Button.js?v=20260805c';
import { AuthLayout } from './_AuthLayout.js?v=20260805c';
import { store, showToast } from '../../../core/store.js?v=20260805c';
import { router } from '../../../core/router.js?v=20260805c';
import { api } from '../../../api/client.js?v=20260805c';
import { saveSession } from '../../../utils/storage.js?v=20260805c';

export default class VerifyPhonePage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css?v=20260805c';
  static dependencies = ['/pages/web/auth/VerifyPhone.css'];

  constructor(props) {
    super(props);
    this._otpBoxes = [];
    this._submitBtn = null;
    this._resendBtn = null;
    this._resendTimer = null;
    this._resendCooldown = 60;
    this.state = {
      verified: false,
    };

    this._userId = parseInt(sessionStorage.getItem('adm_pending_user_id') || '0', 10);
    this._email = sessionStorage.getItem('adm_register_email') || '';
  }

  render() {
    let masked = 'your email';
    if (this._email) {
      const atIdx = this._email.indexOf('@');
      const local = this._email.slice(0, atIdx);
      const domain = this._email.slice(atIdx);
      masked = local.length > 3
        ? local.slice(0, 2) + '***' + local.slice(-1) + domain
        : local[0] + '***' + domain;
    }

    return AuthLayout.wrap({
      title: 'Verification',
      subtitle: `Enter the 6-digit code sent to ${masked}`,
      content: `
        <div class="verify-page" id="verify-content">

          <!-- Icon -->
          <div class="verify-page__icon-row">
            <div class="auth-modal__icon" id="verify-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M2 7l10 7 10-7"/>
              </svg>
            </div>
          </div>

          <!-- OTP boxes -->
          <div class="auth-otp-row" id="otp-row">
            <input class="auth-otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 1" />
            <input class="auth-otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2" />
            <input class="auth-otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3" />
            <input class="auth-otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4" />
            <input class="auth-otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5" />
            <input class="auth-otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6" />
          </div>

          <p class="auth-modal__error" id="otp-error"></p>
          <!-- Verify button -->
          <div id="submit-mount" class="auth-form__submit"></div>

          <!-- Resend -->
          <div class="verify-page__resend">
            <span class="verify-page__resend-label">Didn't receive a code?</span>
            <div id="resend-mount"></div>
          </div>
        </div>
      `,
      footer: `<a href="/signup">← Back to sign up</a>`,
    });
  }

  afterMount() {
    if (!this._userId) {
      router.replace('/signup');
      return;
    }

    // Wire OTP boxes
    this._otpBoxes = Array.from(this.$$('.auth-otp-box'));
    this._wireOtpBoxes();

    // Submit button
    this._submitBtn = this.addChild(new Button({
      label: 'Verify',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleVerify(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));

    // Resend button
    this._resendBtn = this.addChild(new Button({
      label: `Resend code (${this._resendCooldown}s)`,
      variant: 'ghost',
      size: 'sm',
      disabled: true,
      onClick: () => this._handleResend(),
    }));
    this._resendBtn.mount(this.$('#resend-mount'));

    this._startResendTimer();
    this._otpBoxes[0]?.focus();
  }

  /* ── OTP wiring ──────────────────────────────────────────────────────── */

  _wireOtpBoxes() {
    this._otpBoxes.forEach((box, i) => {
      this.on(box, 'input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        box.value = val.slice(-1);
        if (val && i < this._otpBoxes.length - 1) {
          this._otpBoxes[i + 1].focus();
        }
        this._clearError();
      });

      this.on(box, 'keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          this._otpBoxes[i - 1].focus();
        }
        if (e.key === 'Enter') this._handleVerify();
      });

      this.on(box, 'paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        pasted.slice(0, 6).split('').forEach((ch, idx) => {
          if (this._otpBoxes[idx]) this._otpBoxes[idx].value = ch;
        });
        this._otpBoxes[Math.min(pasted.length, 5)]?.focus();
        this._clearError();
      });
    });
  }

  _getOtp() {
    return this._otpBoxes.map((b) => b.value).join('');
  }

  _setError(msg) {
    const el = this.$('#otp-error');
    if (el) el.textContent = msg;
    this._otpBoxes.forEach((b) => b.classList.add('is-error'));
  }

  _clearError() {
    const el = this.$('#otp-error');
    if (el) el.textContent = '';
    this._otpBoxes.forEach((b) => b.classList.remove('is-error'));
  }

  /* ── Handlers ────────────────────────────────────────────────────────── */

  async _handleVerify() {
    const otp = this._getOtp();
    if (otp.length < 6) {
      this._setError('Please enter the complete 6-digit code.');
      return;
    }

    this._submitBtn.setLoading(true);
    const res = await api.auth.verifyPhone({ userId: this._userId, otp });
    this._submitBtn.setLoading(false);

    if (res.error) {
      this._setError(res.error.message || 'Invalid code. Please try again.');
      this._otpBoxes.forEach((b) => { b.value = ''; });
      this._otpBoxes[0]?.focus();
      return;
    }

    clearInterval(this._resendTimer);
    this._showSuccess(res.data);
  }

  async _handleResend() {
    this._resendBtn.setDisabled(true);
    const res = await api.auth.resendOtp({ userId: this._userId, type: 'phone' });

    if (res.error) {
      showToast('error', res.error.message);
      return;
    }

    showToast('success', 'A new code has been sent to your email.');
    this._resendCooldown = 60;
    this._startResendTimer();
  }

  _startResendTimer() {
    clearInterval(this._resendTimer);
    this._resendTimer = setInterval(() => {
      this._resendCooldown -= 1;
      if (this._resendCooldown <= 0) {
        clearInterval(this._resendTimer);
        this._resendBtn.setLabel('Resend code');
        this._resendBtn.setDisabled(false);
      } else {
        this._resendBtn.setLabel(`Resend code (${this._resendCooldown}s)`);
      }
    }, 1000);
  }

  /* ── Success state ───────────────────────────────────────────────────── */

  _showSuccess({ token, user } = {}) {
    const content = this.$('#verify-content');
    if (!content) return;

    const title = this.$('.auth-panel__title');
    const subtitle = this.$('.auth-panel__subtitle');
    if (title) title.textContent = 'Verification Successful!';
    if (subtitle) subtitle.textContent = 'Your email has been verified. Welcome to LagKonnect!';

    content.innerHTML = `
      <div class="verify-page__success-icon-row">
        <div class="auth-modal__success-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
      <div class="verify-page__done" id="done-wrap">
        <button class="ktg-btn ktg-btn--primary ktg-btn--lg" id="done-btn">Done</button>
      </div>
    `;

    this.on(this.$('#done-btn'), 'click', () => {
      sessionStorage.removeItem('adm_pending_user_id');
      sessionStorage.removeItem('adm_register_email');

      if (token && user) {
        store.isAuthenticated = true;
        store.role = user.role;
        store.authToken = token;
        store.currentUser = user;
        store.currentLGA = { id: user.lgaId, name: user.lgaName };
        saveSession({ token, role: user.role, user });
        showToast('success', `Welcome to LagKonnect, ${user.name.split(' ')[0]}!`);
        const region = sessionStorage.getItem('lagosRegion') || 'west';
    router.replace(`/${region}/welcome`);
        return;
      }
      router.replace('/login');
    });
  }

  beforeUnmount() {
    clearInterval(this._resendTimer);
  }
}