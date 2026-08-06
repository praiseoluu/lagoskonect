/**
 * Lagos Konect - OAuth Callback Page
 * Route: /oauth/callback
 * ============================================================
 * This page is the landing point after Google redirects back.
 * The backend redirects to:
 *   /oauth/callback#token=...&role=citizen&new_user=0
 * or on error:
 *   /oauth/callback#error=oauth_denied
 *
 * This page reads the hash, saves the session, and navigates
 * the user to the appropriate next screen.
 *
 * For new users (new_user=1) with no LGA set, we open the
 * SelectLGA modal immediately so they pick their LGA before
 * seeing any content.
 */

import { Component } from '../../../core/component.js?v=20260806b';
import { t } from '../../../core/i18n.js?v=20260806b';
import { store, showToast } from '../../../core/store.js?v=20260806b';
import { router } from '../../../core/router.js?v=20260806b';
import { saveSession } from '../../../utils/storage.js?v=20260806b';
import { api } from '../../../api/client.js?v=20260806b';

export default class OAuthCallbackPage extends Component {
  render() {
    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        flex-direction: column;
        gap: 16px;
        font-family: inherit;
        color: var(--color-text-secondary, #666);
      ">
        <div style="
          width: 40px; height: 40px;
          border: 3px solid var(--color-border-secondary, #e5e7eb);
          border-top-color: var(--color-primary, #068927);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        "></div>
        <p style="font-size: 14px;">Completing sign in…</p>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      </div>
    `;
  }

  async afterMount() {
    // Parse the hash params set by the backend redirect
    const hash   = window.location.hash.slice(1); // remove the #
    const params = Object.fromEntries(new URLSearchParams(hash));

    // Clear the hash from the URL immediately
    history.replaceState(null, '', window.location.pathname);

    // Handle errors
    if (params.error) {
      const messages = {
        oauth_denied:        'Sign in was cancelled.',
        oauth_invalid:       'Invalid OAuth response. Please try again.',
        oauth_state_invalid: 'Security check failed. Please try again.',
        oauth_token_failed:  'Could not complete sign in. Please try again.',
        oauth_profile_failed:'Could not retrieve your Google profile. Please try again.',
        account_suspended:   'This account has been suspended. Please contact support.',
      };
      showToast('error', messages[params.error] || t('login.errSignIn'));
      router.replace('/login');
      return;
    }

    const { token, role, new_user } = params;

    if (!token) {
      showToast('error', 'Sign in failed. No token received.');
      router.replace('/login');
      return;
    }

    // Fetch the full user profile using the token
    // Temporarily store token so _fetch can use it
    const tempAuth = JSON.stringify({ token, role });
    sessionStorage.setItem('adm_auth', tempAuth);

    const profileRes = await api.users.getProfile();

    if (profileRes.error) {
      showToast('error', 'Could not load your profile. Please try again.');
      sessionStorage.removeItem('adm_auth');
      router.replace('/login');
      return;
    }

    const user = profileRes.data;

    // Save full session
    store.isAuthenticated = true;
    store.role            = role;
    store.authToken       = token;
    store.currentUser     = user;

    if (user.lgaId) {
      store.currentLGA = { id: user.lgaId, name: user.lgaName };
    }

    saveSession({ token, role, user });

    const isNew = new_user === '1';
    const region = sessionStorage.getItem('lagosRegion') || 'west';

    // New user or user with no LGA — show LGA selection first
    if (!user.lgaId) {
      showToast('info', t('login.welcomeNewUserLGA', { name: user.name.split(' ')[0] }));
      // Navigate to welcome first (which mounts SelectLGAModal), then open it
      await router.replace(`/${region}/welcome`);
      // Give the layout a moment to mount before opening the modal
      setTimeout(() => {
        if (window._selectLGAModal) {
          window._selectLGAModal._redirectAfter = `/${region}/welcome`;
          window._selectLGAModal.open();
        }
      }, 500);
      return;
    }

    // Returning user
    if (isNew) {
      showToast('success', t('login.welcomeNewUser', { name: user.name.split(' ')[0] }));
      router.replace(`/${region}/welcome`);
    } else {
      showToast('success', t('login.welcomeToast', { name: user.name.split(' ')[0] }));
      router.replace(user.has_seen_welcome ? `/${region}/home` : `/${region}/welcome`);
    }
  }
}
