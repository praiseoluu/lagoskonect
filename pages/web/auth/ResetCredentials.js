/**
 * LagKonnect — Reset Credentials Page
 * Route: /reset-credentials
 * ============================================================
 * Design: solid green circular icon above heading (outside card).
 * "RESET CREDENTIALS" in bold all-caps. Subtitle centred.
 * Card contains: new password field + strength bar +
 * requirement chips (MIN 8 CHARS, LETTER+NUMBER) + confirm
 * password field + "Reset Password →" button.
 * "Back to home" link below card.
 *
 * Password rules (kept at API spec): min 8 chars, 1 letter, 1 number.
 * On success: transitions to success state, then routes to /login.
 */

import { Component } from '../../../core/component.js?v=20260807a';
import { Input } from '../../../components/base/Input.js?v=20260807a';
import { Button } from '../../../components/base/Button.js?v=20260807a';
import { PublicLayout } from './_PublicLayout.js?v=20260807a';
import { router } from '../../../core/router.js?v=20260807a';
import { api } from '../../../api/client.js?v=20260807a';
import { showToast } from '../../../core/store.js?v=20260807a';

export default class ResetCredentialsPage extends Component {
  static styles = '/pages/web/auth/_PublicLayout.css?v=20260807a';
  static dependencies = ['/pages/web/auth/PublicForm.css', '/components/base/Button.css'];

  constructor(props) {
    super(props);
    this._passInput = null;
    this._confirmInput = null;
    this._submitBtn = null;
    this._hasResetToken = !!sessionStorage.getItem('adm_reset_token');
  }

  render() {
    return PublicLayout.wrap({
      content: `
        <section class="public-form-section">
          <div class="public-form-outer">

            <!-- Icon (solid green) -->
            <div class="public-form-icon public-form-icon--solid" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 30C12.925 30 10.975 29.6063 9.15 28.8188C7.325 28.0312 5.7375 26.9625 4.3875 25.6125C3.0375 24.2625 1.96875 22.675 1.18125 20.85C0.39375 19.025 0 17.075 0 15H3C3 16.65 3.3125 18.2063 3.9375 19.6688C4.5625 21.1313 5.41875 22.4062 6.50625 23.4937C7.59375 24.5812 8.86875 25.4437 10.3313 26.0812C11.7937 26.7188 13.35 27.0375 15 27.0375C18.35 27.0375 21.1875 25.875 23.5125 23.55C25.8375 21.225 27 18.3875 27 15.0375C27 11.6875 25.8375 8.85 23.5125 6.525C21.1875 4.2 18.35 3.0375 15 3.0375C12.775 3.0375 10.7563 3.58125 8.94375 4.66875C7.13125 5.75625 5.7 7.2 4.65 9H9V12H0V3H3V6C4.375 4.175 6.1 2.71875 8.175 1.63125C10.25 0.54375 12.525 0 15 0C17.075 0 19.025 0.39375 20.85 1.18125C22.675 1.96875 24.2625 3.0375 25.6125 4.3875C26.9625 5.7375 28.0312 7.325 28.8188 9.15C29.6063 10.975 30 12.925 30 15C30 17.075 29.6063 19.025 28.8188 20.85C28.0312 22.675 26.9625 24.2625 25.6125 25.6125C24.2625 26.9625 22.675 28.0312 20.85 28.8188C19.025 29.6063 17.075 30 15 30ZM12 21C11.575 21 11.2188 20.8563 10.9312 20.5688C10.6437 20.2812 10.5 19.925 10.5 19.5V15C10.5 14.575 10.6437 14.2188 10.9312 13.9312C11.2188 13.6437 11.575 13.5 12 13.5V12C12 11.175 12.2938 10.4688 12.8813 9.88125C13.4688 9.29375 14.175 9 15 9C15.825 9 16.5312 9.29375 17.1187 9.88125C17.7062 10.4688 18 11.175 18 12V13.5C18.425 13.5 18.7812 13.6437 19.0688 13.9312C19.3563 14.2188 19.5 14.575 19.5 15V19.5C19.5 19.925 19.3563 20.2812 19.0688 20.5688C18.7812 20.8563 18.425 21 18 21H12ZM13.5 13.5H16.5V12C16.5 11.575 16.3563 11.2188 16.0688 10.9312C15.7812 10.6437 15.425 10.5 15 10.5C14.575 10.5 14.2188 10.6437 13.9312 10.9312C13.6437 11.2188 13.5 11.575 13.5 12V13.5Z" fill="var(--color-bg)"/>
              </svg>
            </div>

            <!-- Heading (outside card, centred) -->
            <div class="public-form-heading">
              <h1 class="public-form-heading__title public-form-heading__title--caps">Reset Credentials</h1>
              <p class="public-form-heading__subtitle">
                Ensure your new password meets the security standards of LagKonnect.
              </p>
            </div>

            <!-- Card: fields only -->
            <div class="public-form-card" id="reset-card">
              <div class="public-form" id="reset-form">

                <!-- New password -->
                <div>
                  <label class="public-form__field-label" for="reset-password">New Password</label>
                  <div id="password-mount"></div>
                </div>

                <!-- Strength bar -->
                <div class="public-form__strength-bar" id="strength-bar" aria-hidden="true">
                  <div class="public-form__strength-segment" id="seg-0"></div>
                  <div class="public-form__strength-segment" id="seg-1"></div>
                  <div class="public-form__strength-segment" id="seg-2"></div>
                  <div class="public-form__strength-segment" id="seg-3"></div>
                </div>

                <!-- Requirement chips -->
                <div class="public-form__requirements" id="requirements" aria-live="polite">
                  <span class="public-form__req" id="req-length">
                    <span class="public-form__req-icon" aria-hidden="true"></span>
                    Min 8 Chars
                  </span>
                  <span class="public-form__req" id="req-letter">
                    <span class="public-form__req-icon" aria-hidden="true"></span>
                    Has Letter
                  </span>
                  <span class="public-form__req" id="req-number">
                    <span class="public-form__req-icon" aria-hidden="true"></span>
                    Has Number
                  </span>
                </div>

                <!-- Confirm password -->
                <div>
                  <label class="public-form__field-label" for="reset-confirm">Confirm New Password</label>
                  <div id="confirm-mount"></div>
                </div>

                <!-- Submit -->
                <div id="submit-mount" class="public-form__submit"></div>

              </div>
            </div>

            <!-- Back to home -->
            <div class="public-form__links">
              <a href="/" class="public-form__link public-form__link--back">Back to home</a>
            </div>

          </div>
        </section>
      `,
    });
  }

  afterMount() {
    if (!this._hasResetToken) {
      router.replace('/forgot-password');
      return;
    }

    // New password — onChange fires on every keystroke (Input.js line: this.props.onChange?.(val))
    this._passInput = this.addChild(new Input({
      id: 'reset-password',
      type: 'password',
      placeholder: 'Enter secure password',
      name: 'password',
      required: true,
      autocomplete: 'new-password',
      onChange: (val) => this._updateStrength(val),
      onEnter: () => this._confirmInput?.focus(),
    }));
    this._passInput.mount(this.$('#password-mount'));

    // Confirm password
    this._confirmInput = this.addChild(new Input({
      id: 'reset-confirm',
      type: 'password',
      placeholder: 'Re-enter password',
      name: 'confirmPassword',
      required: true,
      autocomplete: 'new-password',
      onEnter: () => this._handleSubmit(),
    }));
    this._confirmInput.mount(this.$('#confirm-mount'));

    // Submit
    this._submitBtn = this.addChild(new Button({
      label: 'Reset Password',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
      iconPosition: 'right',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleSubmit(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));
  }

  /* ── Strength indicator ──────────────────────────────────────────────── */

  _updateStrength(val = '') {
    const hasLength = val.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(val);
    const hasNumber = /[0-9]/.test(val);

    // Update requirement chips
    this._setReq('req-length', hasLength);
    this._setReq('req-letter', hasLetter);
    this._setReq('req-number', hasNumber);

    // Strength score 0–4
    let score = 0;
    if (hasLength) score++;
    if (hasLetter) score++;
    if (hasNumber) score++;
    if (val.length >= 12) score++;

    for (let i = 0; i < 4; i++) {
      const seg = this.$(`#seg-${i}`);
      if (seg) {
        seg.classList.toggle('public-form__strength-segment--filled', i < score);
      }
    }
  }

  _setReq(id, met) {
    const el = this.$(`#${id}`);
    if (!el) return;
    el.classList.toggle('public-form__req--met', met);
    // Swap icon: checkmark svg when met, empty circle otherwise
    const icon = el.querySelector('.public-form__req-icon');
    if (icon) {
      icon.innerHTML = met
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : '';
    }
  }

  /* ── Submit ──────────────────────────────────────────────────────────── */

  async _handleSubmit() {
    const newPassword = this._passInput?.getValue();
    const confirm = this._confirmInput?.getValue();
    let valid = true;

    if (!newPassword || newPassword.length < 8) {
      this._passInput?.setError('Password must be at least 8 characters.');
      valid = false;
    } else if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      this._passInput?.setError('Password must contain at least one letter and one number.');
      valid = false;
    } else {
      this._passInput?.setError('');
    }

    if (!confirm) {
      this._confirmInput?.setError('Please confirm your new password.');
      valid = false;
    } else if (confirm !== newPassword) {
      this._confirmInput?.setError('Passwords do not match.');
      valid = false;
    } else {
      this._confirmInput?.setError('');
    }

    if (!valid) return;

    this._submitBtn.setLoading(true);
    const res = await api.auth.resetPassword({ newPassword });
    this._submitBtn.setLoading(false);

    if (res.error) {
      showToast('error', res.error.message);
      return;
    }

    // Clean up (afx_reset_token already removed by api.auth.resetPassword)
    sessionStorage.removeItem('adm_reset_identifier');

    this._showSuccess();
  }

  /* ── Success state ───────────────────────────────────────────────────── */

  _showSuccess() {
    const card = this.$('#reset-card');
    if (!card) return;

    // Also update the heading outside the card
    const title = this.$('.public-form-heading__title');
    const subtitle = this.$('.public-form-heading__subtitle');
    if (title) title.textContent = 'Password Reset!';
    if (subtitle) subtitle.textContent = 'Your password has been updated. You can now log in with your new credentials.';

    // Swap icon to success tick
    const icon = this.$('.public-form-icon');
    if (icon) {
      icon.classList.remove('public-form-icon--solid');
      icon.innerHTML = `
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
    }

    card.innerHTML = `
      <div class="public-form">
        <div class="public-form__submit">
          <a href="/login" class="ktg-btn ktg-btn--primary ktg-btn--lg public-form__full-btn">
            Back to Login
          </a>
        </div>
      </div>
    `;
  }
}