/**
 * Lagos Konect — User Login Page
 * ============================================================
 * Route: /login
 *
 * Two-panel auth layout: form panel left, hero image right.
 * Delegates structural markup to AuthLayout.wrap() so visual
 * consistency with all other auth screens is guaranteed.
 *
 * Fields:
 *   • Email or phone number (auto-normalises Nigerian 0xxx → +234xxx)
 *   • Password (with visibility toggle)
 *   • Remember me (30-day session token)
 *   • Forgot password link
 *
 * Auth flows handled:
 *   • Standard credential login
 *   • 2FA challenge redirect (/2fa)
 *   • Unverified phone redirect (/verify-phone)
 *   • Forced password change redirect (/change-password)
 *   • Google OAuth
 *
 * @module  LoginPage
 * @version 2.0.0
 */

import { Component }                    from '../../../core/component.js?v=20260806c';
import { Input }                        from '../../../components/base/Input.js?v=20260806c';
import { Button }                       from '../../../components/base/Button.js?v=20260806c';
import { AuthLayout }                   from './_AuthLayout.js?v=20260806c';
import { store, showToast }             from '../../../core/store.js?v=20260806c';
import { router }                       from '../../../core/router.js?v=20260806c';
import { api }                          from '../../../api/client.js?v=20260806c';
import { validateForm }                 from '../../../utils/validators.js?v=20260806c';
import { saveSession }                  from '../../../utils/storage.js?v=20260806c';
import { t }                            from '../../../core/i18n.js?v=20260806c';

/* ── SVG icons ──────────────────────────────────────────────────────────── */

/**
 * Google "G" colour logo used on the OAuth button.
 * Kept as a named constant so it is defined once and reused
 * without inline noise at the render call-site.
 */
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

/* ══════════════════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════════════════ */

export default class LoginPage extends Component {
  static styles = '/pages/web/auth/_AuthLayout.css?v=20260806c';

  constructor(props) {
    super(props);

    /** @type {Input|null}  Email-or-phone field */
    this._identifierInput = null;
    /** @type {Input|null}  Password field */
    this._passInput       = null;
    /** @type {HTMLInputElement|null}  Remember-me checkbox */
    this._rememberChk     = null;
    /** @type {Button|null} */
    this._submitBtn       = null;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return AuthLayout.wrap({
      title:         this.esc(t('login.title')),
      subtitle:      this.esc(t('login.subtitle')),
      showCopyright: true,
      content: `
        <!-- Login form -->
        <form class="auth-form"
              id="login-form"
              novalidate
              aria-label="${this.esc(t('login.title'))}">

          <div id="identifier-mount"></div>
          <div id="password-mount"></div>

          <!-- Remember me + Forgot password -->
          <div class="auth-form__meta">
            <label class="auth-form__remember" for="login-remember">
              <input
                type="checkbox"
                id="login-remember"
                name="remember"
                aria-label="${this.esc(t('login.remember'))}"
              />
              ${this.esc(t('login.remember'))}
            </label>
            <a href="/forgot-password"
               class="auth-form__forgot">
              ${this.esc(t('login.forgot'))}
            </a>
          </div>

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
            class="auth-social-btn oauth-btn oauth-btn--google"
            id="google-login-btn"
            aria-label="${this.esc(t('login.continueGoogle'))}"
          >${GOOGLE_LOGO}</button>
        </div>

        <!-- Sign-up link -->
        <div class="auth-panel__footer">
          ${this.esc(t('login.noAccount'))}
          <a href="/signup">${this.esc(t('login.signUp'))}</a>
        </div>
      `,
    });
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    AuthLayout.mountLanguageSwitcher(this);

    // ── Identifier (email or phone) field ────────────────────────────────
    this._identifierInput = this.addChild(new Input({
      label:        t('login.identifierLabel'),
      placeholder:  t('login.identifierPlaceholder'),
      name:         'identifier',
      required:     true,
      autocomplete: 'username',
      // Advance focus to password on Enter
      onEnter:      () => this._passInput?.focus(),
    }));
    this._identifierInput.mount(this.$('#identifier-mount'));

    // ── Password field ───────────────────────────────────────────────────
    this._passInput = this.addChild(new Input({
      type:         'password',
      label:        t('login.passwordLabel'),
      placeholder:  '••••••••',
      name:         'password',
      required:     true,
      autocomplete: 'current-password',
      onEnter:      () => this._handleSubmit(),
    }));
    this._passInput.mount(this.$('#password-mount'));

    // ── Remember-me checkbox reference ───────────────────────────────────
    this._rememberChk = this.$('#login-remember');

    // ── Submit button ────────────────────────────────────────────────────
    this._submitBtn = this.addChild(new Button({
      label:     t('login.submit'),
      variant:   'primary',
      size:      'lg',
      fullWidth: true,
      onClick:   () => this._handleSubmit(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));

     // ── Google OAuth ─────────────────────────────────────────────────────
     const googleBtn = this.$('#google-login-btn');
     if (googleBtn) {
       this.on(googleBtn, 'click', () => {
         const ref = new URLSearchParams(window.location.search).get('ref');
         api.auth.loginWithGoogle(ref || undefined);
       });
     }
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  /**
   * Validates the form, submits credentials and handles every possible
   * API response — including 2FA challenges, unverified accounts and
   * forced password-change redirects.
   *
   * @returns {Promise<void>}
   */
  async _handleSubmit() {
    const raw      = this._identifierInput?.getValue()?.trim() ?? '';
    const password = this._passInput?.getValue() ?? '';
    const remember = this._rememberChk?.checked ?? false;

    // Normalise Nigerian local numbers: 0xxx → +234xxx
    const identifier = raw.startsWith('0') ? `+234${raw.slice(1)}` : raw;

    // ── Client-side validation ───────────────────────────────────────────
    const { valid, errors } = validateForm(
      { identifier, password },
      {
        identifier: (v) => v
          ? { valid: true,  message: '' }
          : { valid: false, message: t('login.errIdentifier') },
        password: (v) => v
          ? { valid: true,  message: '' }
          : { valid: false, message: t('login.errPassword') },
      }
    );

    this._identifierInput?.setError(errors.identifier ?? '');
    this._passInput?.setError(errors.password ?? '');

    if (!valid) return;

    // ── API request ──────────────────────────────────────────────────────
    this._submitBtn.setLoading(true);
    const res = await api.auth.login({ identifier, password });
    this._submitBtn.setLoading(false);

    // ── Error handling ───────────────────────────────────────────────────
    if (res.error) {
      switch (res.error.code) {
        case 'INVALID_CREDENTIALS':
          this._passInput?.setError(t('login.errInvalid'));
          break;

        case 'UNVERIFIED_PHONE':
          // Account exists but was never OTP-verified — resume verification
          sessionStorage.setItem('afx_register_phone', identifier);
          await api.auth.resendOtp({ type: 'phone' });
          showToast('info', t('login.verifyPhone'));
          router.replace('/verify-phone');
          break;

        default:
          showToast('error', res.error.message ?? t('login.errGeneric'));
      }
      return;
    }

    const { token, user, role, requires2FA, partialToken } = res.data;

    // ── 2FA challenge ────────────────────────────────────────────────────
    if (requires2FA) {
      sessionStorage.setItem('adm_2fa_partial', partialToken);
      router.replace('/2fa');
      return;
    }

    // ── Forced password change ───────────────────────────────────────────
    if (res.data.mustChangePassword) {
      this._hydrateStore({ token, user, role });
      saveSession({ token, role, user });
      router.replace('/change-password');
      return;
    }

    // ── Success ──────────────────────────────────────────────────────────
    this._hydrateStore({ token, user, role });
    saveSession({ token, role, user, remember });

    const firstName = user.name?.split(' ')[0] ?? t('login.defaultName');
    showToast('success', t('login.welcomeToast', { name: firstName }));

    const region = sessionStorage.getItem('lagosRegion') ?? 'west';
    router.replace(`/${region}/home`);
  }

  /**
   * Writes auth data into the global store.
   * Extracted to avoid repeating the same five assignments across
   * the mustChangePassword and success branches.
   *
   * @param {{ token: string, user: object, role: string }} param0
   */
  _hydrateStore({ token, user, role }) {
    store.isAuthenticated = true;
    store.role            = role;
    store.authToken       = token;
    store.currentUser     = user;
    store.currentLGA      = { id: user.lgaId, name: user.lgaName };
  }
}