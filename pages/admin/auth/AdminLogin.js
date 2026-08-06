/**
 * Lagos Konect — Admin Login Page
 * ============================================================
 * Route: /admin/login
 *
 * Two-panel auth layout rendered directly (not via AuthLayout.wrap)
 * so the hero image and overlay copy can be customised without
 * touching the shared _AuthLayout.js shell.
 *
 * Design notes:
 *   • Inherits two-panel scaffolding from _AuthLayout.css
 *   • Page-specific hero and form overrides live in AdminLogin.css
 *   • Uses the dedicated /admin/auth/login API endpoint
 *   • No "forgot password" flow — admin accounts are managed internally
 *   • "Remember me" issues a 30-day token; default session is 1 day
 *
 * Auth guard:
 *   If a valid admin session is already present on mount, the user is
 *   redirected to /admin immediately without rendering the form.
 *
 * @module  AdminLoginPage
 * @version 2.0.0
 */

import { Component }              from '../../../core/component.js?v=20260806a';
import { Input }                  from '../../../components/base/Input.js?v=20260806a';
import { Button }                 from '../../../components/base/Button.js?v=20260806a';
import { store, showToast }       from '../../../core/store.js?v=20260806a';
import { router }                 from '../../../core/router.js?v=20260806a';
import { api }                    from '../../../api/client.js?v=20260806a';
import { saveSession }            from '../../../utils/storage.js?v=20260806a';

/* ── Constants ──────────────────────────────────────────────────────────── */

/** Roles that are permitted to access the admin portal. */
const ADMIN_ROLES = Object.freeze(['admin', 'super_admin']);

/** SVG arrow used on the submit button. */
const ARROW_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2.5"
       stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>`;

/* ══════════════════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════════════════ */

export default class AdminLoginPage extends Component {
  static styles       = '/pages/web/auth/_AuthLayout.css?v=20260806a';
  static dependencies = ['/pages/admin/auth/AdminLogin.css'];

  constructor(props) {
    super(props);

    /** @type {Input|null} */
    this._emailInput = null;
    /** @type {Input|null} */
    this._passInput  = null;
    /** @type {Button|null} */
    this._submitBtn  = null;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return `
      <div class="auth-shell">

        <!-- ════════════════════════════════════════════════
             Left panel — login form
             ════════════════════════════════════════════════ -->
        <div class="auth-panel">

          <!-- Header row: logo only (no lang switcher on admin) -->
          <div class="auth-panel__header">
            <div class="auth-panel__logo">
              <img
                src="/assets/icons/logo-green.svg"
                alt="Lagos Konect logo"
                width="40"
                height="40"
              />
              <span class="auth-panel__logo-name">Lagos Konect</span>
            </div>
          </div>

          <!-- Scrollable form body -->
          <div class="auth-panel__body">

            <!-- Heading -->
            <div class="auth-panel__heading">
              <h1 class="auth-panel__title">Admin Login</h1>
              <p class="auth-panel__subtitle">
                Welcome back. Enter your official government credentials
                to access the admin portal.
              </p>
            </div>

            <!-- Form -->
            <form class="auth-form"
                  id="admin-login-form"
                  novalidate
                  aria-label="Admin login form">

              <div id="email-mount"></div>
              <div id="password-mount"></div>

              <div class="auth-form__meta">
                <label class="auth-form__remember" for="adm-remember">
                  <input
                    type="checkbox"
                    id="adm-remember"
                    name="remember"
                    aria-label="Stay signed in for 30 days"
                  />
                  Remember me for 30 days
                </label>
              </div>

              <div id="submit-mount" class="auth-form__submit"></div>
            </form>

            <!-- Divider -->
            <div class="auth-divider" aria-hidden="true">AUTHORIZED ACCESS ONLY</div>

            <!-- Security notice -->
            <p class="adm-login__security-notice">
              Access to this system is monitored and logged. Unauthorised
              attempts are strictly prohibited and may be subject to legal action.
            </p>

            <!-- Copyright -->
            <p class="auth-panel__copyright adm-login__copyright">© Lagos Konect 2026</p>

          </div><!-- end auth-panel__body -->

        </div>

        <!-- ════════════════════════════════════════════════
             Right panel — decorative hero image
             ════════════════════════════════════════════════ -->
        <div class="auth-image-panel" aria-hidden="true">
          <img
            src="/assets/images/auth/admin--img.jpg"
            alt=""
            class="auth-image-panel__img"
          />
          <div class="auth-image-panel__overlay"></div>

          <div class="adm-login__hero-content">
            <div class="adm-login__hero-badge">
              <span class="adm-login__hero-dot"></span>
              SYSTEM OPERATIONAL
            </div>

            <h2 class="adm-login__hero-title">
              Digital Infrastructure for<br/>Tomorrow's Cities
            </h2>

            <p class="adm-login__hero-desc">
              Managing citizen engagement, infrastructure projects,
              and urban development through a unified digital interface.
            </p>
          </div>
        </div>

      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    // ── Auth guard ───────────────────────────────────────────────────────
    // Redirect immediately if an admin session is already active
    if (store.isAuthenticated && ADMIN_ROLES.includes(store.role)) {
      router.replace('/admin');
      return;
    }

    // ── Email field ──────────────────────────────────────────────────────
    this._emailInput = this.addChild(new Input({
      type:         'email',
      label:        'Official Email',
      placeholder:  'admin@lagoskonect.com',
      name:         'email',
      required:     true,
      autocomplete: 'email',
      // Advance focus to password on Enter
      onEnter:      () => this._passInput?.focus(),
    }));
    this._emailInput.mount(this.$('#email-mount'));

    // ── Password field ───────────────────────────────────────────────────
    this._passInput = this.addChild(new Input({
      type:         'password',
      label:        'Password',
      placeholder:  '••••••••',
      name:         'password',
      required:     true,
      autocomplete: 'current-password',
      // Submit on Enter from password field
      onEnter:      () => this._handleSubmit(),
    }));
    this._passInput.mount(this.$('#password-mount'));

    // ── Submit button ────────────────────────────────────────────────────
    this._submitBtn = this.addChild(new Button({
      label:        'Sign In to Portal',
      variant:      'primary',
      size:         'lg',
      fullWidth:    true,
      icon:         ARROW_ICON,
      iconPosition: 'right',
      onClick:      () => this._handleSubmit(),
    }));
    this._submitBtn.mount(this.$('#submit-mount'));
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  /**
   * Validates form fields, submits credentials to the API and handles
   * the response — setting session state on success or surfacing field
   * errors on failure.
   *
   * @returns {Promise<void>}
   */
  async _handleSubmit() {
    const email    = this._emailInput?.getValue()?.trim() ?? '';
    const password = this._passInput?.getValue() ?? '';
    const remember = this.$('#adm-remember')?.checked ?? false;

    // ── Clear previous errors ────────────────────────────────────────────
    this._emailInput?.clearError();
    this._passInput?.clearError();

    // ── Client-side validation ───────────────────────────────────────────
    let valid = true;

    if (!email) {
      this._emailInput?.setError('Email is required.');
      valid = false;
    } else if (!email.includes('@')) {
      this._emailInput?.setError('Enter a valid email address.');
      valid = false;
    }

    if (!password) {
      this._passInput?.setError('Password is required.');
      valid = false;
    }

    if (!valid) return;

    // ── API request ──────────────────────────────────────────────────────
    this._submitBtn.setLoading(true);
    const res = await api.auth.adminLogin({ email, password, remember });
    this._submitBtn.setLoading(false);

    // ── Error handling ───────────────────────────────────────────────────
    if (res.error) {
      const message = res.error.code === 'INVALID_CREDENTIALS'
        ? 'Incorrect email or password.'
        : (res.error.message ?? 'Something went wrong. Please try again.');
      this._passInput?.setError(message);
      return;
    }

    // ── Success — hydrate store and persist session ───────────────────────
    const { token, admin, role } = res.data;

    store.isAuthenticated = true;
    store.role            = role;
    store.authToken       = token;
    store.currentAdmin    = admin;

    saveSession({ token, role, admin });

    // Greet by first name only
    const firstName = admin.name?.split(' ')[0] ?? 'Admin';
    showToast('success', `Welcome back, ${firstName}.`);

    router.replace('/admin');
  }
}