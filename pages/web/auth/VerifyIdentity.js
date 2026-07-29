/**
 * KTG Connect — Verify Identity Page
 * Route: /verify-identity
 * ============================================================
 * Design: centred card with green shield icon, decorative
 * corner accent, 6 OTP boxes, "EXPIRES IN MM:SS" timer pill,
 * "Resend Code" link, "COMPLETE VERIFICATION →" button.
 *
 * On success: routes to /reset-credentials.
 * Uses PublicLayout (nav + footer).
 */

import { Component } from '../../../core/component.js';
import { Button } from '../../../components/base/Button.js';
import { PublicLayout } from './_PublicLayout.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { showToast } from '../../../core/store.js';

// OTP expires after this many seconds (display only in mock)
const OTP_EXPIRY_SECONDS = 114; // 1:54 as shown in design

export default class VerifyIdentityPage extends Component {
  static styles = '/pages/web/auth/_PublicLayout.css';
  static dependencies = ['/pages/web/auth/PublicForm.css', '/components/base/Button.css'];

  constructor(props) {
    super(props);
    this._otpBoxes = [];
    this._submitBtn = null;
    this._expiryTimer = null;
    this._resendTimer = null;

    // No state needed — timers write directly to DOM and instance vars
    // to avoid setState triggering a rerender that clears the OTP inputs

    this._identifier = sessionStorage.getItem('adm_reset_identifier') || '';
  }

  render() {
    const masked = this._identifier
      ? this._identifier.replace(/(\+\d{1,3}|0)(\d{2,3})(\d+)(\d{4})/, '••• ••• ••$4')
      : 'your registered contact';

    return PublicLayout.wrap({
      content: `
        <section class="public-form-section">
          <div class="public-form-outer">

            <!-- Icon -->
            <div class="public-form-icon" aria-hidden="true">
              <svg width="20" height="25" viewBox="0 0 20 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 25C7.10417 24.2708 4.71354 22.6094 2.82812 20.0156C0.942708 17.4219 0 14.5417 0 11.375V3.75L10 0L20 3.75V11.375C20 14.5417 19.0573 17.4219 17.1719 20.0156C15.2865 22.6094 12.8958 24.2708 10 25ZM7.5 17.5H12.5C12.8542 17.5 13.151 17.3802 13.3906 17.1406C13.6302 16.901 13.75 16.6042 13.75 16.25V12.5C13.75 12.1458 13.6302 11.849 13.3906 11.6094C13.151 11.3698 12.8542 11.25 12.5 11.25V10C12.5 9.3125 12.2552 8.72396 11.7656 8.23438C11.276 7.74479 10.6875 7.5 10 7.5C9.3125 7.5 8.72396 7.74479 8.23438 8.23438C7.74479 8.72396 7.5 9.3125 7.5 10V11.25C7.14583 11.25 6.84896 11.3698 6.60938 11.6094C6.36979 11.849 6.25 12.1458 6.25 12.5V16.25C6.25 16.6042 6.36979 16.901 6.60938 17.1406C6.84896 17.3802 7.14583 17.5 7.5 17.5ZM8.75 11.25V10C8.75 9.64583 8.86979 9.34896 9.10938 9.10938C9.34896 8.86979 9.64583 8.75 10 8.75C10.3542 8.75 10.651 8.86979 10.8906 9.10938C11.1302 9.34896 11.25 9.64583 11.25 10V11.25H8.75Z" fill="#0B1F16"/>
              </svg>

            </div>

            <!-- Heading -->
            <div class="public-form-heading">
              <h1 class="public-form-heading__title">Verify Identity</h1>
              <p class="public-form-heading__subtitle">
                We've sent a 6-digit secure code to ${masked}.<br />
                Please enter it below to continue.
              </p>
            </div>

            <!-- Card with corner accent -->
            <div class="public-form-card public-form-card--accent">

              <!-- OTP boxes -->
              <div class="public-form__otp-row" id="otp-row" role="group" aria-label="Verification code">
                <input class="public-form__otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 1" />
                <input class="public-form__otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2" />
                <input class="public-form__otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3" />
                <input class="public-form__otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4" />
                <input class="public-form__otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5" />
                <input class="public-form__otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6" />
              </div>

              <p class="public-form__error" id="otp-error" role="alert"></p>

              <!-- Timer pill -->
              <div class="public-form__timer" id="expiry-timer" aria-live="polite">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                EXPIRES IN <span id="timer-display">01:54</span>
              </div>

              <!-- Resend link -->
              <div class="public-form__resend">
                <button
                  class="public-form__resend-btn"
                  id="resend-btn"
                  type="button"
                  disabled
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                  Resend Code
                </button>
              </div>

              <!-- Submit -->
              <div id="submit-mount" class="public-form__submit"></div>

            </div>

          </div>
        </section>
      `,
    });
  }

  afterMount() {
    if (!this._identifier) {
      router.replace('/forgot-password');
      return;
    }

    // Wire OTP boxes
    this._otpBoxes = Array.from(this.$$('.public-form__otp-box'));
    this._wireOtpBoxes();

    // Submit button
    this._submitBtn = this.addChild(new Button({
      label: 'Complete Verification',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
      iconPosition: 'right',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleVerify(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));

    // Resend button
    const resendBtn = this.$('#resend-btn');
    this.on(resendBtn, 'click', () => this._handleResend());

    // Start timers
    this._startExpiryTimer();
    this._startResendCooldown();

    this._otpBoxes[0]?.focus();
  }

  /* ── OTP wiring ──────────────────────────────────────────────────────── */

  _wireOtpBoxes() {
    this._otpBoxes.forEach((box, i) => {
      this.on(box, 'input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        box.value = val.slice(-1);
        if (val && i < this._otpBoxes.length - 1) this._otpBoxes[i + 1].focus();
        this._clearError();
      });

      this.on(box, 'keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) this._otpBoxes[i - 1].focus();
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

  _getOtp() { return this._otpBoxes.map((b) => b.value).join(''); }

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

  /* ── Timers ──────────────────────────────────────────────────────────── */

  _startExpiryTimer() {
    clearInterval(this._expiryTimer);
    // Use plain instance variable — NOT setState — to avoid triggering rerender
    this._secondsLeft = OTP_EXPIRY_SECONDS;

    this._expiryTimer = setInterval(() => {
      this._secondsLeft -= 1;
      const left = this._secondsLeft;
      const display = this.$('#timer-display');
      const pill = this.$('#expiry-timer');

      if (display) {
        const m = String(Math.floor(Math.max(left, 0) / 60)).padStart(2, '0');
        const s = String(Math.max(left, 0) % 60).padStart(2, '0');
        display.textContent = `${m}:${s}`;
      }

      if (left <= 0) {
        clearInterval(this._expiryTimer);
        if (pill) pill.textContent = 'CODE EXPIRED';
      }
    }, 1000);
  }

  _startResendCooldown() {
    clearInterval(this._resendTimer);
    // Use plain instance variable — NOT setState — to avoid triggering rerender
    this._resendCooldown = 60;

    this._resendTimer = setInterval(() => {
      this._resendCooldown -= 1;
      const btn = this.$('#resend-btn');

      if (this._resendCooldown <= 0) {
        clearInterval(this._resendTimer);
        if (btn) btn.disabled = false;
      }
    }, 1000);
  }

  /* ── Handlers ────────────────────────────────────────────────────────── */

  async _handleVerify() {
    const otp = this._getOtp();
    if (otp.length < 6) {
      this._setError('Please enter the complete 6-digit code.');
      return;
    }

    this._submitBtn.setLoading(true);
    const res = await api.auth.verifyIdentity({ otp });
    this._submitBtn.setLoading(false);

    if (res.error) {
      this._setError(res.error.message || 'Invalid code. Please try again.');
      this._otpBoxes.forEach((b) => { b.value = ''; });
      this._otpBoxes[0]?.focus();
      return;
    }

    clearInterval(this._expiryTimer);
    clearInterval(this._resendTimer);
    router.push('/reset-credentials');
  }

  async _handleResend() {
    const btn = this.$('#resend-btn');
    if (btn) btn.disabled = true;

    const res = await api.auth.resendOtp({ type: 'identity' });
    if (res.error) { showToast('error', res.error.message); return; }

    showToast('success', 'A new code has been sent.');

    // Reset both timers (instance vars, not state, to avoid rerender)
    this._startExpiryTimer();
    this._startResendCooldown();

    this._otpBoxes.forEach((b) => { b.value = ''; });
    this._clearError();
    this._otpBoxes[0]?.focus();
  }

  beforeUnmount() {
    clearInterval(this._expiryTimer);
    clearInterval(this._resendTimer);
  }
}