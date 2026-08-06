/**
 * Lagos Konect — Sign Up Page
 * ============================================================
 * Route: /signup
 *
 * Two-panel auth layout: form panel left, hero image right.
 * Delegates structural markup to AuthLayout.wrap().
 *
 * Fields:
 *   Surname · First Name (two-column row)
 *   LGA (searchable dropdown, filtered by selected region)
 *   Gender dropdown
 *   Username · Email (two-column row)
 *   Password
 *
 * Post-submission flow:
 *   1. API registers the user and returns a userId.
 *   2. A non-dismissible OTP modal appears over the form.
 *   3. User enters the 6-digit code sent to their email.
 *   4. On success the modal transitions to a "Verified" state.
 *   5. "Done" auto-logs the user in and routes to /welcome.
 *      If the API does not return a session token, routes to /login.
 *
 * Resume flow:
 *   If lagos_pending_user_id is already in sessionStorage on mount,
 *   the page immediately redirects to /verify-phone to prevent
 *   duplicate registrations.
 *
 * @module  SignupPage
 * @version 2.0.0
 */

import { Component }                    from '../../../core/component.js?v=20260806a';
import { Input }                        from '../../../components/base/Input.js?v=20260806a';
import { Button }                       from '../../../components/base/Button.js?v=20260806a';
import { Dropdown }                     from '../../../components/base/Forms.js?v=20260806a';
import { AuthLayout }                   from './_AuthLayout.js?v=20260806a';
import { store, showToast }             from '../../../core/store.js?v=20260806a';
import { router }                       from '../../../core/router.js?v=20260806a';
import { api }                          from '../../../api/client.js?v=20260806a';
import { validateForm, validators }     from '../../../utils/validators.js?v=20260806a';
import { saveSession }                  from '../../../utils/storage.js?v=20260806a';
import { t }                            from '../../../core/i18n.js?v=20260806a';

/* ── SVG constants ──────────────────────────────────────────────────────── */

const GOOGLE_LOGO = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
       aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92
             c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57
             c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77
             c-.98.66-2.23 1.06-3.71 1.06
             -2.86 0-5.29-1.93-6.16-4.53H2.18v2.84
             C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09
             s.13-1.43.35-2.09V7.07H2.18
             C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15
             C17.45 2.09 14.97 1 12 1
             7.7 1 3.99 3.47 2.18 7.07l3.66 2.84
             c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"/>
  </svg>`;

const EMAIL_ICON = `
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
       stroke="white" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>`;

const CHECK_ICON = `
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
       stroke="var(--color-success)" stroke-width="2.5"
       stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;

/** Regex for valid usernames (3–30 chars, letters, digits, _ or -). */
const USERNAME_PATTERN = /^[a-zA-Z0-9_\-]{3,30}$/;

/** Number of OTP digits expected. */
const OTP_LENGTH = 6;

/* ══════════════════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════════════════ */

export default class SignupPage extends Component {
  static styles       = '/pages/web/auth/_AuthLayout.css?v=20260806a';
  static dependencies = ['/pages/web/auth/Signup.css'];

  constructor(props) {
    super(props);

    // ── Component state ──────────────────────────────────────────────────
    this._state = {
      pendingUserId: null,
      pendingEmail:  null,
    };

    // ── Form field refs ──────────────────────────────────────────────────
    /** @type {Input|null}    */ this._surnameInput    = null;
    /** @type {Input|null}    */ this._firstInput      = null;
    /** @type {Input|null}    */ this._usernameInput   = null;
    /** @type {Input|null}    */ this._emailInput      = null;
    /** @type {Dropdown|null} */ this._lgaDropdown     = null;
    /** @type {Dropdown|null} */ this._genderDropdown  = null;
    /** @type {Input|null}    */ this._passInput       = null;
    /** @type {Button|null}   */ this._submitBtn       = null;

    // ── OTP modal refs ───────────────────────────────────────────────────
    /** @type {HTMLElement|null}    */ this._backdrop  = null;
    /** @type {HTMLInputElement[]}  */ this._otpBoxes  = [];
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return AuthLayout.wrap({
      title:    this.esc(t('signup.title')),
      subtitle: this.esc(t('signup.subtitle')),
      content:  `
        <!-- Registration form -->
        <form class="auth-form"
              id="signup-form"
              novalidate
              aria-label="${this.esc(t('signup.title'))}">

          <!-- Row 1: Surname + First Name -->
          <div class="auth-form__row">
            <div id="surname-mount"></div>
            <div id="firstname-mount"></div>
          </div>

          <!-- Row 2: LGA + Gender -->
          <div class="auth-form__row">
            <div id="lga-mount"></div>
            <div id="gender-mount"></div>
          </div>

          <!-- Row 3: Username + Email -->
          <div class="auth-form__row">
            <div id="username-mount"></div>
            <div id="email-mount"></div>
          </div>

          <!-- Password -->
          <div id="password-mount"></div>

          <!-- Submit -->
          <div id="submit-mount" class="auth-form__submit"></div>
        </form>

        <!-- Divider -->
        <div class="auth-divider" aria-hidden="true">
          ${this.esc(t('login.orContinue'))}
        </div>

        <!-- Social buttons -->
        <div class="auth-social-buttons">
          <button
            type="button"
            class="auth-social-btn"
            id="google-signup-btn"
            aria-label="${this.esc(t('login.continueGoogle'))}"
          >${GOOGLE_LOGO}</button>
        </div>

        <!-- Sign-in link -->
        <div class="auth-panel__footer">
          ${this.esc(t('signup.haveAccount'))}
          <a href="/login">${this.esc(t('signup.login'))}</a>
        </div>

        <!-- Terms -->
        <p class="auth-panel__terms">
          <label>
            <input type="checkbox" id="signup-terms" />
            ${this.esc(t('signup.termsPre'))}
            <a href="/terms">${this.esc(t('signup.termsLink'))}</a>
          </label>
        </p>
      `,
    });
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    // Resume interrupted registration — skip re-registering
    if (sessionStorage.getItem('lagos_pending_user_id')) {
      router.replace('/verify-phone');
      return;
    }

    AuthLayout.mountLanguageSwitcher(this);
    this._mountForm();
    this._loadLGAs();

    // Google OAuth
    const googleBtn = this.$('#google-signup-btn');
    if (googleBtn) {
      this.on(googleBtn, 'click', () => {
        const ref = new URLSearchParams(window.location.search).get('ref');
        api.auth.loginWithGoogle(ref || undefined);
      });
    }
  }

  beforeUnmount() {
    // Always clean up the OTP backdrop if navigation occurs mid-flow
    this._backdrop?.remove();
    this._backdrop = null;
  }

  /* ── Form mounting ────────────────────────────────────────────────────── */

  /** Creates and mounts all form field child components. */
  _mountForm() {
    // ── Surname ──────────────────────────────────────────────────────────
    this._surnameInput = this.addChild(new Input({
      label:        `${t('signup.surnameLabel')}*`,
      placeholder:  t('signup.surnamePlaceholder'),
      name:         'surname',
      required:     true,
      autocomplete: 'family-name',
      onEnter:      () => this._firstInput?.focus(),
    }));
    this._surnameInput.mount(this.$('#surname-mount'));

    // ── First name ───────────────────────────────────────────────────────
    this._firstInput = this.addChild(new Input({
      label:        `${t('signup.firstNameLabel')}*`,
      placeholder:  t('signup.firstNamePlaceholder'),
      name:         'firstName',
      required:     true,
      autocomplete: 'given-name',
    }));
    this._firstInput.mount(this.$('#firstname-mount'));

    // ── LGA dropdown ─────────────────────────────────────────────────────
    this._lgaDropdown = this.addChild(new Dropdown({
      label:       `${t('signup.lgaLabel')}*`,
      placeholder: t('signup.lgaPlaceholder'),
      options:     [],      // Populated asynchronously by _loadLGAs()
      searchable:  true,
    }));
    this._lgaDropdown.mount(this.$('#lga-mount'));

    // ── Gender dropdown ──────────────────────────────────────────────────
    this._genderDropdown = this.addChild(new Dropdown({
      label:       `${t('signup.genderLabel')}*`,
      placeholder: t('signup.genderPlaceholder'),
      options: [
        { value: 'male',             label: t('signup.genderMale')       },
        { value: 'female',           label: t('signup.genderFemale')     },
        { value: 'prefer_not_to_say',label: t('signup.genderPreferNot')  },
      ],
    }));
    this._genderDropdown.mount(this.$('#gender-mount'));

    // ── Username ─────────────────────────────────────────────────────────
    this._usernameInput = this.addChild(new Input({
      label:        `${t('signup.usernameLabel')}*`,
      placeholder:  t('signup.usernamePlaceholder'),
      name:         'username',
      required:     true,
      hint:         t('signup.usernameHint'),
      autocomplete: 'username',
    }));
    this._usernameInput.mount(this.$('#username-mount'));

    // ── Email ────────────────────────────────────────────────────────────
    this._emailInput = this.addChild(new Input({
      type:         'email',
      label:        `${t('signup.emailLabel')}*`,
      placeholder:  t('signup.emailPlaceholder'),
      name:         'email',
      required:     true,
      autocomplete: 'email',
    }));
    this._emailInput.mount(this.$('#email-mount'));

    // ── Password ─────────────────────────────────────────────────────────
    this._passInput = this.addChild(new Input({
      type:         'password',
      label:        `${t('signup.passwordLabel')}*`,
      placeholder:  t('signup.passwordPlaceholder'),
      hint:         t('signup.passwordHint'),
      name:         'password',
      required:     true,
      autocomplete: 'new-password',
      onEnter:      () => this._handleSubmit(),
    }));
    this._passInput.mount(this.$('#password-mount'));

    // ── Submit button ────────────────────────────────────────────────────
    this._submitBtn = this.addChild(new Button({
      label:     t('signup.submit'),
      variant:   'primary',
      size:      'lg',
      fullWidth: true,
      onClick:   () => this._handleSubmit(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));
  }

  /* ── LGA loading ──────────────────────────────────────────────────────── */

  /**
   * Fetches all LGAs from the API and populates the LGA dropdown.
   * Results are filtered to match the region the user selected on
   * the landing page (stored in sessionStorage as 'lagosRegion').
   *
   * @returns {Promise<void>}
   */
  async _loadLGAs() {
    const res = await api.lgas.getAll();

    if (res.error) {
      if (res.error.code !== 'MAINTENANCE') {
        showToast('error', t('signup.errLoadLGA'));
      }
      return;
    }

    const selectedRegion = sessionStorage.getItem('lagosRegion');
    const filtered       = selectedRegion
      ? res.data.filter((l) => l.region === selectedRegion)
      : res.data;

    store.lgaList = filtered;
    this._lgaDropdown?.update({ options: filtered.map((l) => ({ value: l.id, label: l.name })) });
  }

  /* ── Form submission ──────────────────────────────────────────────────── */

  /**
   * Validates every field, submits the registration payload and handles
   * all API error codes. On success, shows the OTP verification modal.
   *
   * @returns {Promise<void>}
   */
  async _handleSubmit() {
    const surname   = this._surnameInput?.getValue()?.trim()          ?? '';
    const firstName = this._firstInput?.getValue()?.trim()            ?? '';
    const username  = this._usernameInput?.getValue()?.trim()         ?? '';
    const email     = this._emailInput?.getValue()?.trim().toLowerCase() ?? '';
    const lgaId     = this._lgaDropdown?.getValue();
    const gender    = this._genderDropdown?.getValue();
    const password  = this._passInput?.getValue()                     ?? '';
    const name      = [firstName, surname].filter(Boolean).join(' ');

    // ── Validation ───────────────────────────────────────────────────────
    const { valid, errors } = validateForm(
      { surname, firstName, username, email, lgaId, gender, password },
      {
        surname:   (v) => v
          ? { valid: true,  message: '' }
          : { valid: false, message: t('signup.errSurname') },

        firstName: (v) => v
          ? { valid: true,  message: '' }
          : { valid: false, message: t('signup.errFirstName') },

        username:  (v) => {
          if (!v)                        return { valid: false, message: t('signup.errUsernameRequired') };
          if (!USERNAME_PATTERN.test(v)) return { valid: false, message: t('signup.usernameHint') };
          return { valid: true, message: '' };
        },

        email: (v) => (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
          ? { valid: true,  message: '' }
          : { valid: false, message: t('signup.errEmail') },

        lgaId:  (v) => v
          ? { valid: true,  message: '' }
          : { valid: false, message: t('signup.errLGA') },

        gender: (v) => v
          ? { valid: true,  message: '' }
          : { valid: false, message: t('signup.errGender') },

        password: (v) => validators.password(v),
      }
    );

    // Surface errors on their respective fields
    this._surnameInput?.setError(errors.surname    ?? '');
    this._firstInput?.setError(errors.firstName    ?? '');
    this._usernameInput?.setError(errors.username  ?? '');
    this._emailInput?.setError(errors.email        ?? '');
    this._lgaDropdown?.setError(errors.lgaId       ?? '');
    this._genderDropdown?.setError(errors.gender   ?? '');
    this._passInput?.setError(errors.password      ?? '');

    if (!valid) return;

    // ── API request ──────────────────────────────────────────────────────
    const region = sessionStorage.getItem('lagosRegion') || '';
    const referralCode = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() || '';
    this._submitBtn.setLoading(true);
    const res = await api.auth.register({
      name,
      email,
      username,
      password,
      lgaId:  Number(lgaId),
      gender,
      region,
      referralCode,
    });
    this._submitBtn.setLoading(false);

    // ── Error handling ───────────────────────────────────────────────────
    if (res.error) {
      switch (res.error.code) {
        case 'EMAIL_TAKEN':
          this._emailInput?.setError(res.error.message);
          break;
        case 'USERNAME_TAKEN':
          this._usernameInput?.setError(t('signup.errUsernameTaken'));
          break;
        case 'PENDING_VERIFICATION':
          showToast('info', t('signup.pendingVerification'));
          router.replace('/verify-phone');
          break;
        default:
          showToast('error', res.error.message ?? t('signup.errGeneric'));
      }
      return;
    }

    // ── Show OTP modal ───────────────────────────────────────────────────
    this._state.pendingUserId = res.data.userId;
    this._state.pendingEmail  = email;
    this._showOtpModal(email);
  }

  /* ── OTP Modal ────────────────────────────────────────────────────────── */

  /**
   * Builds and appends the non-dismissible OTP verification modal.
   * The email address is masked for privacy before display.
   *
   * @param {string} email  Full email address of the newly registered user
   */
  _showOtpModal(email) {
    const masked = this._maskEmail(email);

    const backdrop     = document.createElement('div');
    backdrop.className = 'auth-modal-backdrop';
    backdrop.id        = 'otp-backdrop';
    // Intentionally no outside-click listener — modal is non-dismissible

    backdrop.innerHTML = `
      <div class="auth-modal"
           role="dialog"
           aria-modal="true"
           aria-labelledby="otp-title"
           id="otp-modal">

        <div class="auth-modal__icon" aria-hidden="true">
          ${EMAIL_ICON}
        </div>

        <h2 class="auth-modal__title" id="otp-title">
          ${this.esc(t('signup.otpTitle'))}
        </h2>
        <p class="auth-modal__subtitle" id="otp-subtitle">
          ${this.esc(t('signup.otpSubtitle', { email: masked }))}
        </p>

        <!-- OTP digit boxes -->
        <div class="auth-otp-row" id="otp-row" role="group" aria-label="Verification code">
          ${Array.from({ length: OTP_LENGTH }, (_, i) => `
            <input
              class="auth-otp-box"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="1"
              aria-label="${t('signup.otpDigitLabel', { n: i + 1, total: OTP_LENGTH })}"
            />`
          ).join('')}
        </div>

        <p class="auth-modal__error" id="otp-error" role="alert" aria-live="polite"></p>

        <div class="auth-modal__action">
          <button
            class="adm-btn adm-btn--primary adm-btn--lg"
            type="button"
            id="otp-verify-btn"
          >${this.esc(t('signup.verify'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    this._backdrop = backdrop;

    this._otpBoxes = Array.from(backdrop.querySelectorAll('.auth-otp-box'));
    this._wireOtpBoxes();

    this.on(backdrop.querySelector('#otp-verify-btn'), 'click', () =>
      this._handleVerify()
    );

    // Auto-focus the first box
    requestAnimationFrame(() => this._otpBoxes[0]?.focus());
  }

  /**
   * Attaches input, keydown and paste handlers to all OTP digit boxes.
   * Implements auto-advance, backspace-retreat and full-code paste.
   */
  _wireOtpBoxes() {
    this._otpBoxes.forEach((box, i) => {
      // ── Input: accept only digits, advance focus ─────────────────────
      this.on(box, 'input', (e) => {
        const digit   = e.target.value.replace(/\D/g, '');
        box.value     = digit.slice(-1);
        if (digit && i < this._otpBoxes.length - 1) {
          this._otpBoxes[i + 1].focus();
        }
        this._clearOtpError();
      });

      // ── Keydown: backspace retreat + Enter submit ─────────────────────
      this.on(box, 'keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          this._otpBoxes[i - 1].focus();
        }
        if (e.key === 'Enter') this._handleVerify();
      });

      // ── Paste: distribute digits across boxes ─────────────────────────
      this.on(box, 'paste', (e) => {
        e.preventDefault();
        const raw = (e.clipboardData ?? window.clipboardData)
          .getData('text')
          .replace(/\D/g, '');

        raw.slice(0, OTP_LENGTH).split('').forEach((ch, idx) => {
          if (this._otpBoxes[idx]) this._otpBoxes[idx].value = ch;
        });

        this._otpBoxes[Math.min(raw.length, OTP_LENGTH - 1)]?.focus();
        this._clearOtpError();
      });
    });
  }

  /* ── OTP state helpers ────────────────────────────────────────────────── */

  /** @returns {string} Current OTP value assembled from all digit boxes. */
  _getOtpValue() {
    return this._otpBoxes.map((b) => b.value).join('');
  }

  /**
   * @param {string} message  Error message to display below the OTP row.
   */
  _setOtpError(message) {
    const el = this._backdrop?.querySelector('#otp-error');
    if (el) el.textContent = message;
    this._otpBoxes.forEach((b) => b.classList.add('is-error'));
  }

  /** Clears any displayed OTP error and removes error styling from boxes. */
  _clearOtpError() {
    const el = this._backdrop?.querySelector('#otp-error');
    if (el) el.textContent = '';
    this._otpBoxes.forEach((b) => b.classList.remove('is-error'));
  }

  /* ── OTP verification ─────────────────────────────────────────────────── */

  /**
   * Submits the assembled OTP code to the API.
   * On success, transitions the modal to its verification-success state.
   *
   * @returns {Promise<void>}
   */
  async _handleVerify() {
    const otp = this._getOtpValue();

    if (otp.length < OTP_LENGTH) {
      this._setOtpError(t('signup.errOtpIncomplete'));
      return;
    }

    const verifyBtn = this._backdrop?.querySelector('#otp-verify-btn');
    if (verifyBtn) {
      verifyBtn.disabled   = true;
      verifyBtn.textContent = t('signup.verifying');
    }

    const res = await api.auth.verifyPhone({
      userId: this._state.pendingUserId,
      otp,
    });

    if (res.error) {
      if (verifyBtn) {
        verifyBtn.disabled    = false;
        verifyBtn.textContent = t('signup.verify');
      }
      this._setOtpError(res.error.message ?? t('signup.errOtpInvalid'));
      // Clear boxes and return focus so the user can re-enter
      this._otpBoxes.forEach((b) => { b.value = ''; });
      requestAnimationFrame(() => this._otpBoxes[0]?.focus());
      return;
    }

    this._showSuccessState(res.data);
  }

  /**
   * Replaces the modal contents with the success state.
   * If the API returns a session token the user is auto-logged in;
   * otherwise they are redirected to /login.
   *
   * @param {{ token?: string, user?: object }} [data={}]
   */
  _showSuccessState({ token, user } = {}) {
    const modal = this._backdrop?.querySelector('#otp-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="auth-modal__success-icon" aria-hidden="true">
        ${CHECK_ICON}
      </div>
      <h2 class="auth-modal__title">
        ${this.esc(t('signup.successTitle'))}
      </h2>
      <p class="auth-modal__subtitle">
        ${this.esc(t('signup.successSubtitle'))}
      </p>
      <div class="auth-modal__action">
        <button
          class="adm-btn adm-btn--primary adm-btn--lg"
          type="button"
          id="otp-done-btn"
        >${this.esc(t('signup.done'))}</button>
      </div>
    `;

    this.on(modal.querySelector('#otp-done-btn'), 'click', () => {
      this._backdrop?.remove();
      this._backdrop = null;

      // Clean up any pending-registration session keys
      sessionStorage.removeItem('adm_pending_user_id');
      sessionStorage.removeItem('adm_register_email');

      if (token && user) {
        // Auto-login — skip the /login screen entirely
        store.isAuthenticated = true;
        store.role            = user.role;
        store.authToken       = token;
        store.currentUser     = user;
        store.currentLGA      = { id: user.lgaId, name: user.lgaName };
        saveSession({ token, role: user.role, user });

        const firstName = user.name?.split(' ')[0] ?? t('signup.defaultName');
        showToast('success', t('signup.welcomeToast', { name: firstName }));

        const region = sessionStorage.getItem('lagosRegion') ?? 'west';
        router.replace(`/${region}/welcome`);
      } else {
        router.replace('/login');
      }
    });
  }

  /* ── Private utilities ────────────────────────────────────────────────── */

  /**
   * Masks an email address for display in the OTP modal subtitle.
   * "johnsmith@example.com" → "jo***h@example.com"
   *
   * @param {string} email
   * @returns {string}
   */
  _maskEmail(email) {
    const atIdx  = email.indexOf('@');
    const local  = email.slice(0, atIdx);
    const domain = email.slice(atIdx);

    const masked = local.length > 3
      ? `${local.slice(0, 2)}***${local.slice(-1)}`
      : `${local[0]}***`;

    return `${masked}${domain}`;
  }
}