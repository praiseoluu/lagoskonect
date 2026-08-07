/**
 * LagKonnect — Auth API
 * ============================================================
 * Citizen methods → real PHP backend via fetch()
 * Admin login     → mock (admin endpoints not yet built)
 *
 * 2FA flow:
 *   login() may return { requires2FA: true, method: 'totp', partialToken }
 *   The frontend must then show a code input and call twoFaValidate()
 *   or twoFaBackup() to complete login and get the real token.
 */

import { MOCK, _delay, _ok, _err } from './_mockData.js?v=20260806d';
import { _fetch } from './_fetch.js?v=20260806d';

// ─── Mock admin helper ────────────────────────────────────────────────────

function _findAdmin(identifier) {
  const isEmail = identifier.includes('@');
  if (isEmail) return MOCK.admins.find((a) => a.email === identifier) || null;
  const normalised = identifier.startsWith('0') ? '+234' + identifier.slice(1) : identifier;
  return MOCK.admins.find((a) => a.phone === normalised) || null;
}

function _sanitise(record) {
  const { password, ...safe } = record;
  return safe;
}

// ─── Auth Namespace ───────────────────────────────────────────────────────

export const auth = {

  async login({ identifier, password, remember = false }) {
    if (!identifier || !password) {
      return _err('VALIDATION_ERROR', 'Identifier and password are required.');
    }

    // Citizen: real backend
    // Response may be:
    //   { data: { token, role, user } }              — normal login
    //   { data: { requires2FA, method, partialToken }} — 2FA required
    return await _fetch('POST', '/auth/login', { identifier: identifier.trim(), password }, false);
  },

  async register({ name, email, username, password, lgaId, gender, region, referralCode }) {
    const res = await _fetch('POST', '/auth/register', { name, email, username, password, lgaId, gender, region, referralCode }, false);
    if (res.data?.userId) {
      sessionStorage.setItem('adm_register_email', res.data.email || email);
      sessionStorage.setItem('adm_pending_user_id', String(res.data.userId));
    }
    if (res.error?.code === 'PENDING_VERIFICATION') {
      sessionStorage.setItem('adm_register_email', res.error.email || email);
      sessionStorage.setItem('adm_pending_user_id', String(res.error.userId));
    }
    return res;
  },

  async verifyPhone({ userId, otp }) {
    const resolvedId = userId || parseInt(sessionStorage.getItem('adm_pending_user_id') || '0', 10);
    const res = await _fetch('POST', '/auth/verify-phone', { userId: resolvedId, otp }, false);
    if (res.data) {
      sessionStorage.removeItem('adm_register_email');
      sessionStorage.removeItem('adm_pending_user_id');
    }
    return res;
  },

  async verifyIdentity({ otp }) {
    const identifier = sessionStorage.getItem('adm_reset_identifier') || '';
    const res = await _fetch('POST', '/auth/verify-identity', { identifier, otp }, false);
    if (res.data?.resetToken) {
      sessionStorage.setItem('adm_reset_token', res.data.resetToken);
    }
    return res;
  },

  async resendOtp({ type }) {
    if (type === 'identity') {
      const identifier = sessionStorage.getItem('adm_reset_identifier') || '';
      return await _fetch('POST', '/auth/resend-otp', { identifier, type }, false);
    }
    const userId = parseInt(sessionStorage.getItem('adm_pending_user_id') || '0', 10);
    return await _fetch('POST', '/auth/resend-otp', { identifier: String(userId), type }, false);
  },

  async forgotPassword({ identifier }) {
    const id = identifier?.trim() || '';
    sessionStorage.setItem('adm_reset_identifier', id);
    return await _fetch('POST', '/auth/forgot-password', { identifier: id }, false);
  },

  async resetPassword({ userId, otp, newPassword }) {
    const resetToken = sessionStorage.getItem('adm_reset_token') || '';
    const res = await _fetch('POST', '/auth/reset-password', { resetToken, newPassword }, false);
    if (res.data?.reset) {
      sessionStorage.removeItem('afx_reset_phone');
      sessionStorage.removeItem('adm_reset_token');
    }
    return res;
  },

  async logout() {
    const auth = (() => {
      try { return JSON.parse(sessionStorage.getItem('adm_auth')); } catch { return null; }
    })();
    const token = auth?.token || '';
    const isMockToken = token.startsWith('mock_');
    if (token && !isMockToken) {
      await _fetch('POST', '/auth/logout', null, true);
    }
    sessionStorage.removeItem('afx_register_phone');
    sessionStorage.removeItem('adm_register_email');
    sessionStorage.removeItem('adm_reset_identifier');
    sessionStorage.removeItem('adm_reset_token');
    sessionStorage.removeItem('adm_2fa_partial');
    return _ok({ loggedOut: true });
  },

  // ── Admin auth ───────────────────────────────────────────────────────────

  /**
   * Admin login — dedicated endpoint, email only.
   * Returns { token, role, admin } on success.
   */
  async adminLogin({ email, password, remember = false }) {
    return await _fetch('POST', '/admin/auth/login', { email, password, remember }, false);
  },

  /**
   * Admin logout — blacklists the admin JWT.
   */
  async adminLogout() {
    const auth = (() => {
      try { return JSON.parse(sessionStorage.getItem('adm_auth')); } catch { return null; }
    })();
    const token = auth?.token || '';
    if (token) {
      await _fetch('POST', '/admin/auth/logout', null, true);
    }
    return _ok({ loggedOut: true });
  },

  // ── OAuth methods ────────────────────────────────────────────────────────

  /**
   * Initiate Google OAuth login.
   * Fetches the Google auth URL from the backend and redirects the browser.
   * @param {string} [referralCode] - Optional referral code to pass through OAuth flow.
   */
  async loginWithGoogle(referralCode) {
    const params = new URLSearchParams();
    if (referralCode) params.set('ref', referralCode);
    const qs = params.toString() ? '?' + params : '';
    const res = await _fetch('GET', '/auth/oauth/google/redirect' + qs, null, false);
    if (res.error) return res;
    // Redirect the full browser window to Google's consent screen
    window.location.href = res.data.url;
  },

  // ── 2FA methods ───────────────────────────────────────────────────────

  /**
   * Get TOTP setup data (secret + QR code URL).
   * Call when user clicks "Enable Authenticator 2FA" in Settings.
   */
  async twoFaSetup() {
    return await _fetch('POST', '/auth/2fa/setup');
  },

  /**
   * Confirm TOTP setup by verifying the first code from the app.
   * Returns backup codes on success — show them ONCE to the user.
   */
  async twoFaConfirm(code) {
    return await _fetch('POST', '/auth/2fa/confirm', { code });
  },

  /**
   * Complete login by validating the TOTP code.
   * partialToken is stored in sessionStorage by the login flow.
   */
  async twoFaValidate(code) {
    const partialToken = sessionStorage.getItem('adm_2fa_partial') || '';
    const res = await _fetch('POST', '/auth/2fa/validate', { partialToken, code }, false);
    if (res.data?.token) {
      sessionStorage.removeItem('adm_2fa_partial');
    }
    return res;
  },

  /**
   * Disable TOTP 2FA. Requires current authenticator code for confirmation.
   */
  async twoFaDisable(code) {
    return await _fetch('POST', '/auth/2fa/disable', { code });
  },

  /**
   * Use a backup code instead of TOTP (e.g. lost phone).
   */
  async twoFaBackup(backupCode) {
    const partialToken = sessionStorage.getItem('adm_2fa_partial') || '';
    const res = await _fetch('POST', '/auth/2fa/backup', { partialToken, backupCode }, false);
    if (res.data?.token) {
      sessionStorage.removeItem('adm_2fa_partial');
    }
    return res;
  },

  /**
   * Get current 2FA status for the logged-in user.
   */
  async twoFaStatus() {
    return await _fetch('GET', '/auth/2fa/status');
  },

  /**
   * Exchange main JWT for a short-lived SSE token.
   * The SSE token is used as the ?token= query param on /events/stream
   * so the main JWT is never exposed in URLs or server logs.
   */
  async getSseToken() {
    return await _fetch('GET', '/auth/sse-token');
  },
};