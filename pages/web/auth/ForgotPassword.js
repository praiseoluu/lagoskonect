/**
 * KTG Connect — Forgot Password Page
 * Route: /forgot-password
 * ============================================================
 * Design: centred card with a circular refresh icon above.
 * Single phone number field. "Send Verification Code →" button.
 * "Try recovering with email instead" link (envelope icon).
 * "← Return to Sign In" back link.
 *
 * On submit: calls api.auth.forgotPassword(), stores the mock
 * userId in sessionStorage, routes to /verify-identity.
 */

import { Component } from '../../../core/component.js';
import { Input } from '../../../components/base/Input.js';
import { Button } from '../../../components/base/Button.js';
import { PublicLayout } from './_PublicLayout.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { showToast } from '../../../core/store.js';

export default class ForgotPasswordPage extends Component {
  static styles = '/pages/web/auth/_PublicLayout.css';
  static dependencies = ['/pages/web/auth/PublicForm.css', '/components/base/Button.css'];

  constructor(props) {
    super(props);
    this._identifierInput = null;
    this._submitBtn = null;
  }

  render() {
    return PublicLayout.wrap({
      content: `
        <section class="public-form-section">
          <div class="public-form-outer">

            <!-- Icon -->
            <div class="public-form-icon" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 30C12.925 30 10.975 29.6063 9.15 28.8188C7.325 28.0312 5.7375 26.9625 4.3875 25.6125C3.0375 24.2625 1.96875 22.675 1.18125 20.85C0.39375 19.025 0 17.075 0 15H3C3 16.65 3.3125 18.2063 3.9375 19.6688C4.5625 21.1313 5.41875 22.4062 6.50625 23.4937C7.59375 24.5812 8.86875 25.4437 10.3313 26.0812C11.7937 26.7188 13.35 27.0375 15 27.0375C18.35 27.0375 21.1875 25.875 23.5125 23.55C25.8375 21.225 27 18.3875 27 15.0375C27 11.6875 25.8375 8.85 23.5125 6.525C21.1875 4.2 18.35 3.0375 15 3.0375C12.775 3.0375 10.7563 3.58125 8.94375 4.66875C7.13125 5.75625 5.7 7.2 4.65 9H9V12H0V3H3V6C4.375 4.175 6.1 2.71875 8.175 1.63125C10.25 0.54375 12.525 0 15 0C17.075 0 19.025 0.39375 20.85 1.18125C22.675 1.96875 24.2625 3.0375 25.6125 4.3875C26.9625 5.7375 28.0312 7.325 28.8188 9.15C29.6063 10.975 30 12.925 30 15C30 17.075 29.6063 19.025 28.8188 20.85C28.0312 22.675 26.9625 24.2625 25.6125 25.6125C24.2625 26.9625 22.675 28.0312 20.85 28.8188C19.025 29.6063 17.075 30 15 30ZM12 21C11.575 21 11.2188 20.8563 10.9312 20.5688C10.6437 20.2812 10.5 19.925 10.5 19.5V15C10.5 14.575 10.6437 14.2188 10.9312 13.9312C11.2188 13.6437 11.575 13.5 12 13.5V12C12 11.175 12.2938 10.4688 12.8813 9.88125C13.4688 9.29375 14.175 9 15 9C15.825 9 16.5312 9.29375 17.1187 9.88125C17.7062 10.4688 18 11.175 18 12V13.5C18.425 13.5 18.7812 13.6437 19.0688 13.9312C19.3563 14.2188 19.5 14.575 19.5 15V19.5C19.5 19.925 19.3563 20.2812 19.0688 20.5688C18.7812 20.8563 18.425 21 18 21H12ZM13.5 13.5H16.5V12C16.5 11.575 16.3563 11.2188 16.0688 10.9312C15.7812 10.6437 15.425 10.5 15 10.5C14.575 10.5 14.2188 10.6437 13.9312 10.9312C13.6437 11.2188 13.5 11.575 13.5 12V13.5Z" fill="var(--color-primary)"/>
              </svg>
            </div>

            <!-- Heading -->
            <div class="public-form-heading">
              <h1 class="public-form-heading__title">Forgot Password</h1>
              <p class="public-form-heading__subtitle">
                Enter your registered phone number or email address to receive a verification code.
              </p>
            </div>

            <!-- Card -->
            <div class="public-form-card">
              <div class="public-form" id="forgot-form">
                <div>
                  <label class="public-form__field-label" for="forgot-identifier">Phone Number or Email</label>
                  <div id="identifier-mount"></div>
                </div>
                <div id="submit-mount" class="public-form__submit"></div>
              </div>
            </div>

            <!-- Below-card links -->
            <div class="public-form__links">
              <a href="/login" class="public-form__link public-form__link--back">
                ← Return to Sign In
              </a>
            </div>

          </div>
        </section>
      `,
    });
  }

  afterMount() {
    this._identifierInput = this.addChild(new Input({
      id: 'forgot-identifier',
      type: 'text',
      placeholder: 'Phone number or email address',
      name: 'identifier',
      required: true,
      autocomplete: 'username',
      onEnter: () => this._handleSubmit(),
    }));
    this._identifierInput.mount(this.$('#identifier-mount'));

    this._submitBtn = this.addChild(new Button({
      label: 'Send Verification Code',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
      iconPosition: 'right',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => this._handleSubmit(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));
  }

  async _handleSubmit() {
    const raw = this._identifierInput?.getValue()?.trim();

    if (!raw) {
      this._identifierInput?.setError('Please enter your phone number or email.');
      return;
    }

    this._identifierInput?.setError('');

    // Normalise local phone numbers (08XX → +234XX); leave emails unchanged
    const identifier = (!raw.includes('@') && raw.startsWith('0'))
      ? '+234' + raw.slice(1)
      : raw;

    this._submitBtn.setLoading(true);
    const res = await api.auth.forgotPassword({ identifier });
    this._submitBtn.setLoading(false);

    if (res.error) {
      showToast('error', res.error.message);
      return;
    }

    // api.auth.forgotPassword() already saved identifier to sessionStorage
    showToast('success', 'If an account exists, a verification code has been sent.');
    router.push('/verify-identity');
  }
}