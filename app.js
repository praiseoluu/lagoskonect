/**
 * Lagos Konect — Application Bootstrap
 * ============================================================
 * Single entry point. Executed once on page load.
 *
 * Responsibilities (in strict order):
 *   1. Restore any existing session from storage
 *   2. Hydrate the global store with session data
 *   3. Register all web-app routes
 *   4. Register all admin-portal routes
 *   5. Mount the global ToastContainer
 *   6. Attach router lifecycle hooks
 *   7. Start the router (or render the maintenance screen)
 *
 * Order matters:
 *   The session MUST be restored before the router starts because
 *   every route guard reads auth state directly from the store.
 *
 * Entry point:
 *   / → SelectRegion — users choose their region first so all
 *   subsequent content (news, reels, home feed) can be personalised.
 *
 * @module  app
 * @version 2.0.0
 */

import { store }          from './core/store.js';
import {
  router,
  requireAuth,
  requireAdmin,
  requireCitizen,
  redirectIfAuthenticated,
  mustChangePassword,
}                         from './core/router.js';
import { loadSession }    from './utils/storage.js';
import { ToastContainer } from './components/base/UI.js';

/* ══════════════════════════════════════════════════════════════════════════
   1. RESTORE SESSION
   Reads the persisted session token (if any) and pre-populates the store
   so route guards have accurate auth state before the first render.
   ══════════════════════════════════════════════════════════════════════════ */

const session = loadSession();

if (session?.token) {
  store.isAuthenticated = true;
  store.role            = session.role;
  store.authToken       = session.token;

  if (session.role === 'citizen' && session.user) {
    store.currentUser = session.user;
    store.currentLGA  = session.user.lgaId
        ? { id: session.user.lgaId, name: session.user.lgaName }
        : null;
  }

  if (
      (session.role === 'admin' || session.role === 'super_admin') &&
      session.admin
  ) {
    store.currentAdmin = session.admin;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   2. VALID REGIONS
   Centralised so both the route redirect guards and the afterEach
   analytics filter use the same source of truth.
   ══════════════════════════════════════════════════════════════════════════ */

/** @type {ReadonlySet<string>} */
const VALID_REGIONS = Object.freeze(new Set(['west', 'central', 'east']));

/**
 * Returns the currently selected region from sessionStorage,
 * falling back to 'west' if none is set or the value is invalid.
 *
 * @returns {'north'|'central'|'south'}
 */
function getRegion() {
  const r = sessionStorage.getItem('lagosRegion');
  return VALID_REGIONS.has(r) ? r : 'west';
}

/* ══════════════════════════════════════════════════════════════════════════
   3. WEB APP ROUTES
   ══════════════════════════════════════════════════════════════════════════ */

router.register('web', [

  /* ── Entry point & region selection ────────────────────────────────── */

  {
    // Root entry point — every visitor picks their region first.
    // Region drives all personalised content: news, reels, home feed.
    // No guard — authenticated users can re-select their region freely.
    path:      '/',
    component: () => import('./pages/web/auth/SelectRegion.js'),
    guards:    [],
    meta:      { title: 'Select Your Region' },
  },
  {
    // Alias — users who bookmark /select-region land here too.
    path:      '/select-region',
    component: () => import('./pages/web/auth/SelectRegion.js'),
    guards:    [],
    meta:      { title: 'Select Your Region' },
  },

  /* ── Region landing pages ───────────────────────────────────────────── */

  {
    path:      '/west',
    component: () => import('./pages/web/auth/WestLanding.js?v=20260721b'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Lagos West Connect' },
  },
  {
    path:      '/central',
    component: () => import('./pages/web/auth/CentralLanding.js?v=20260721b'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Lagos Central Connect' },
  },
  {
    path:      '/east',
    component: () => import('./pages/web/auth/EastLanding.js?v=20260721b'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Lagos East Connect' },
  },

  /* ── Static public pages ────────────────────────────────────────────── */

  {
    path:      '/terms',
    component: () => import('./pages/web/auth/TermsPage.js'),
    guards:    [],
    meta:      { title: 'Terms & Conditions' },
  },

  {
    path:      '/newsletter/unsubscribe',
    component: () => import('./pages/web/auth/NewsletterUnsubscribe.js'),
    guards:    [],
    meta:      { title: 'Unsubscribe — Lagos Konect' },
  },

  /* ── Public auth routes ─────────────────────────────────────────────── */

  {
    path:      '/login',
    component: () => import('./pages/web/auth/Login.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Log In' },
  },
  {
    path:      '/signup',
    component: () => import('./pages/web/auth/Signup.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Create Account' },
  },
  {
    path:      '/2fa',
    component: () => import('./pages/web/auth/TwoFactorLogin.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Two-Factor Authentication' },
  },
  {
    path:      '/oauth/callback',
    component: () => import('./pages/web/auth/OAuthCallback.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'OAuth Callback' },
  },
  {
    path:      '/verify-phone',
    component: () => import('./pages/web/auth/VerifyPhone.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Verify Phone' },
  },
  {
    path:      '/forgot-password',
    component: () => import('./pages/web/auth/ForgotPassword.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Forgot Password' },
  },
  {
    path:      '/verify-identity',
    component: () => import('./pages/web/auth/VerifyIdentity.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Verify Identity' },
  },
  {
    path:      '/reset-credentials',
    component: () => import('./pages/web/auth/ResetCredentials.js'),
    guards:    [redirectIfAuthenticated],
    meta:      { title: 'Reset Password' },
  },

  /* ── Protected — onboarding ─────────────────────────────────────────── */

  {
    path:      '/change-password',
    component: () => import('./pages/web/auth/ForceChangePassword.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Change Password' },
  },
  {
    // Redirect /welcome → /{region}/welcome using the stored region preference
    path:      '/welcome',
    component: () => import('./pages/web/app/Welcome.js'),
    guards:    [({ next }) => next(`/${getRegion()}/welcome`)],
    meta:      { title: 'Welcome' },
  },

  /* ── Protected — main citizen app ───────────────────────────────────── */

  {
    // Redirect /home → /{region}/home
    path:      '/home',
    component: () => import('./pages/web/app/Home.js'),
    guards:    [({ next }) => next(`/${getRegion()}/home`)],
    meta:      { title: 'Home' },
  },
  {
    path:      '/news',
    component: () => import('./pages/web/app/News.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'News' },
  },
  {
    path:      '/news/:slug',
    component: () => import('./pages/web/app/NewsDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Article' },
  },
  {
    path:      '/reels',
    component: () => import('./pages/web/app/Reels.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reels' },
  },
  {
    path:      '/reels/:reelId',
    component: () => import('./pages/web/app/ReelDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reel' },
  },
  {
    path:      '/referrals',
    component: () => import('./pages/web/app/Referrals.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Referral Programme' },
  },
  {
    path:      '/chat',
    component: () => import('./pages/web/app/Chat.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Community Chat' },
  },
  {
    path:      '/notifications',
    component: () => import('./pages/web/app/Notifications.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Notifications' },
  },
  {
    path:      '/settings',
    component: () => import('./pages/web/app/Settings.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Settings' },
  },
  {
    path:      '/profile',
    component: () => import('./pages/web/app/Profile.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'My Profile' },
  },
  {
    path:      '/u/:username',
    component: () => import('./pages/web/app/UserProfile.js'),
    meta:      { title: 'Profile' },
  },

  /* ── North Region ───────────────────────────────────────────────────── */

  {
    path:      '/west/welcome',
    component: () => import('./pages/web/west/Welcome.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Welcome — Lagos West' },
  },
  {
    path:      '/west/home',
    component: () => import('./pages/web/west/Home.js?v=20260728a'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Home — Lagos West' },
  },
  {
    path:      '/west/news',
    component: () => import('./pages/web/west/News.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'News — Lagos West' },
  },
  {
    path:      '/west/news/:slug',
    component: () => import('./pages/web/west/NewsDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Article — Lagos West' },
  },
  {
    path:      '/west/reels',
    component: () => import('./pages/web/west/Reels.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reels — Lagos West' },
  },
  {
    path:      '/west/reels/:reelId',
    component: () => import('./pages/web/west/ReelDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reel — Lagos West' },
  },
  {
    path:      '/west/referrals',
    component: () => import('./pages/web/west/Referrals.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Referral Programme — Lagos West' },
  },
  {
    path:      '/west/chat',
    component: () => import('./pages/web/west/Chat.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Community Chat — Lagos West' },
  },
  {
    path:      '/west/notifications',
    component: () => import('./pages/web/west/Notifications.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Notifications — Lagos West' },
  },
  {
    path:      '/west/settings',
    component: () => import('./pages/web/west/Settings.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Settings — Lagos West' },
  },
  {
    path:      '/west/profile',
    component: () => import('./pages/web/west/Profile.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'My Profile — Lagos West' },
  },
  {
    path:      '/west/u/:username',
    component: () => import('./pages/web/west/UserProfile.js'),
    meta:      { title: 'Profile — Lagos West' },
  },

  /* ── Central Region ─────────────────────────────────────────────────── */

  {
    path:      '/central/welcome',
    component: () => import('./pages/web/central/Welcome.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Welcome — Lagos Central' },
  },
  {
    path:      '/central/home',
    component: () => import('./pages/web/central/Home.js?v=20260728a'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Home — Lagos Central' },
  },
  {
    path:      '/central/news',
    component: () => import('./pages/web/central/News.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'News — Lagos Central' },
  },
  {
    path:      '/central/news/:slug',
    component: () => import('./pages/web/central/NewsDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Article — Lagos Central' },
  },
  {
    path:      '/central/reels',
    component: () => import('./pages/web/central/Reels.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reels — Lagos Central' },
  },
  {
    path:      '/central/reels/:reelId',
    component: () => import('./pages/web/central/ReelDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reel — Lagos Central' },
  },
  {
    path:      '/central/referrals',
    component: () => import('./pages/web/central/Referrals.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Referral Programme — Lagos Central' },
  },
  {
    path:      '/central/chat',
    component: () => import('./pages/web/central/Chat.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Community Chat — Lagos Central' },
  },
  {
    path:      '/central/notifications',
    component: () => import('./pages/web/central/Notifications.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Notifications — Lagos Central' },
  },
  {
    path:      '/central/settings',
    component: () => import('./pages/web/central/Settings.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Settings — Lagos Central' },
  },
  {
    path:      '/central/profile',
    component: () => import('./pages/web/central/Profile.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'My Profile — Lagos Central' },
  },
  {
    path:      '/central/u/:username',
    component: () => import('./pages/web/central/UserProfile.js'),
    meta:      { title: 'Profile — Lagos Central' },
  },

  /* ── South Region ───────────────────────────────────────────────────── */

  {
    path:      '/east/welcome',
    component: () => import('./pages/web/east/Welcome.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Welcome — Lagos East' },
  },
  {
    path:      '/east/home',
    component: () => import('./pages/web/east/Home.js?v=20260728a'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Home — Lagos East' },
  },
  {
    path:      '/east/news',
    component: () => import('./pages/web/east/News.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'News — Lagos East' },
  },
  {
    path:      '/east/news/:slug',
    component: () => import('./pages/web/east/NewsDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Article — Lagos East' },
  },
  {
    path:      '/east/reels',
    component: () => import('./pages/web/east/Reels.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reels — Lagos East' },
  },
  {
    path:      '/east/reels/:reelId',
    component: () => import('./pages/web/east/ReelDetail.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Reel — Lagos East' },
  },
  {
    path:      '/east/referrals',
    component: () => import('./pages/web/east/Referrals.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Referral Programme — Lagos East' },
  },
  {
    path:      '/east/chat',
    component: () => import('./pages/web/east/Chat.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Community Chat — Lagos East' },
  },
  {
    path:      '/east/notifications',
    component: () => import('./pages/web/east/Notifications.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Notifications — Lagos East' },
  },
  {
    path:      '/east/settings',
    component: () => import('./pages/web/east/Settings.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'Settings — Lagos East' },
  },
  {
    path:      '/east/profile',
    component: () => import('./pages/web/east/Profile.js'),
    guards:    [requireAuth, requireCitizen],
    meta:      { title: 'My Profile — Lagos East' },
  },
  {
    path:      '/east/u/:username',
    component: () => import('./pages/web/east/UserProfile.js'),
    meta:      { title: 'Profile — Lagos East' },
  },

  /* ── 404 ────────────────────────────────────────────────────────────── */

  {
    path:      '/404',
    component: () => import('./pages/web/NotFound.js'),
    meta:      { title: 'Page Not Found' },
  },
  {
    path:      '*',
    component: () => import('./pages/web/NotFound.js'),
    meta:      { title: 'Page Not Found' },
  },
]);

/* ══════════════════════════════════════════════════════════════════════════
   4. ADMIN ROUTES
   ══════════════════════════════════════════════════════════════════════════ */

router.register('admin', [

  /* ── Admin auth ─────────────────────────────────────────────────────── */

  {
    // No redirectIfAuthenticated here — citizens who visit /admin/login are
    // handled by requireAdmin on the app routes, not by this public route.
    // This prevents citizens from ever landing on the admin login page.
    path:      '/admin/login',
    component: () => import('./pages/admin/auth/AdminLogin.js'),
    guards:    [],
    meta:      { title: 'Admin Login' },
  },

  /* ── Admin app (admin & super_admin only) ───────────────────────────── */

  {
    path:      '/admin',
    component: () => import('./pages/admin/app/Dashboard.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Dashboard' },
  },
  {
    path:      '/admin/users',
    component: () => import('./pages/admin/app/Users.js'),
    guards:    [requireAdmin],
    meta:      { title: 'User Management' },
  },

  /* News */
  {
    path:      '/admin/news',
    component: () => import('./pages/admin/app/News.js'),
    guards:    [requireAdmin],
    meta:      { title: 'News Management' },
  },
  {
    path:      '/admin/news/new',
    component: () => import('./pages/admin/app/NewsForm.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Create News' },
  },
  {
    // Must stay ahead of /admin/news/:id, otherwise "import" is matched as an id.
    path:      '/admin/news/import',
    component: () => import('./pages/admin/app/NewsImport.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Import News' },
  },
  {
    path:      '/admin/news/:id',
    component: () => import('./pages/admin/app/NewsView.js'),
    guards:    [requireAdmin],
    meta:      { title: 'View News' },
  },
  {
    path:      '/admin/news/:id/edit',
    component: () => import('./pages/admin/app/NewsForm.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Edit News' },
  },
  {
    path:      '/admin/news/:id/preview',
    component: () => import('./pages/admin/app/NewsPreview.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Preview News' },
  },

  /* Reels */
  {
    path:      '/admin/reels',
    component: () => import('./pages/admin/app/AdminReels.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Reels Management' },
  },
  {
    path:      '/admin/reels/new',
    component: () => import('./pages/admin/app/AdminReelForm.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Create Reel' },
  },
  {
    path:      '/admin/reels/:id/edit',
    component: () => import('./pages/admin/app/AdminReelForm.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Edit Reel' },
  },
  {
    path:      '/admin/reels/:id/preview',
    component: () => import('./pages/admin/app/AdminReelPreview.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Preview Reel' },
  },

  /* Content & chat */
  {
    path:      '/admin/content-moderation',
    component: () => import('./pages/admin/app/AdminContentModeration.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Content Moderation' },
  },
  {
    path:      '/admin/chat',
    component: () => import('./pages/admin/app/ChatManagement.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Chat Management' },
  },
  {
    path:      '/admin/chat/:lgaId',
    component: () => import('./pages/admin/app/ChatManagement.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Chat Management' },
  },
  {
    path:      '/admin/referrals',
    component: () => import('./pages/admin/app/ReferralLeaderboard.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Referral Contest' },
  },

  /* Adverts */
  {
    path:      '/admin/adverts',
    component: () => import('./pages/admin/app/AdminAdverts.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Advert Management' },
  },
  {
    path:      '/admin/adverts/new',
    component: () => import('./pages/admin/app/AdminAdvertForm.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Create Advert' },
  },
  {
    path:      '/admin/adverts/:id/edit',
    component: () => import('./pages/admin/app/AdminAdvertForm.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Edit Advert' },
  },
  {
    path:      '/admin/adverts/:id/preview',
    component: () => import('./pages/admin/app/AdminAdvertPreview.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Preview Advert' },
  },

  /* Analytics & platform */
  {
    path:      '/admin/lga-data',
    component: () => import('./pages/admin/app/AdminLGA.js'),
    guards:    [requireAdmin],
    meta:      { title: 'LGA Data' },
  },
   {
     path:      '/admin/analytics',
     component: () => import('./pages/admin/app/Analytics.js'),
     guards:    [requireAdmin],
     meta:      { title: 'Governance Analytics' },
   },
   {
     path:      '/admin/active-users',
     component: () => import('./pages/admin/app/ActiveUsers.js'),
     guards:    [requireAdmin],
     meta:      { title: 'Top Active Users' },
   },
   {
     path:      '/admin/traffic',
    component: () => import('./pages/admin/app/Traffic.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Site Traffic' },
  },
  {
    path:      '/admin/settings',
    component: () => import('./pages/admin/app/AdminSettings.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Platform Settings' },
  },
  {
    path:      '/admin/management',
    component: () => import('./pages/admin/app/AdminManagement.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Admin Management' },
  },

  /* ── Admin 404 ──────────────────────────────────────────────────────── */

  {
    // Citizens who type any /admin/* URL directly are caught by requireAdmin
    // and redirected to /admin/login before this component renders.
    path:      '/admin/404',
    component: () => import('./pages/admin/NotFound.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Page Not Found' },
  },
  {
    path:      '/admin/*',
    component: () => import('./pages/admin/NotFound.js'),
    guards:    [requireAdmin],
    meta:      { title: 'Page Not Found' },
  },
]);

/* ══════════════════════════════════════════════════════════════════════════
   5. GLOBAL TOAST CONTAINER
   Mounted once here so notifications work on all public pages (login,
   signup, landing) before any authenticated layout is loaded.
   BaseLayout's guard prevents double-mounting by checking for the
   .adm-toast-container selector first.
   ══════════════════════════════════════════════════════════════════════════ */

if (!document.querySelector('.adm-toast-container')) {
  new ToastContainer().mount(document.body, { append: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   6. ROUTER LIFECYCLE HOOKS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Paths that should never trigger a citizen page-view API call.
 * Checked as prefix matches in afterEach.
 *
 * @type {ReadonlyArray<string>}
 */
const EXCLUDED_PAGEVIEW_PREFIXES = Object.freeze([
  '/admin',
  '/login',
  '/signup',
  '/verify',
  '/oauth',
  '/forgot',
  '/reset',
  '/change',
  '/welcome',
  '/west/welcome',
  '/central/welcome',
  '/east/welcome',
  '/select-region',
]);

router.afterEach(({ to } = {}) => {
  const appEl = document.getElementById('app');

  /* ── Page transition animation ────────────────────────────────────── */
  if (appEl) {
    appEl.classList.remove('page-enter');
    // Force a reflow so removing and re-adding the class triggers the
    // CSS transition every time, not just on the first navigation.
    void appEl.offsetWidth;
    appEl.classList.add('page-enter');
  }

  /* ── Citizen page-view tracking ───────────────────────────────────── */
  const path = typeof to === 'string' ? to : window.location.pathname;

  const shouldTrack =
      store.isAuthenticated &&
      store.role === 'citizen' &&
      path !== '/' &&
      !EXCLUDED_PAGEVIEW_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (shouldTrack) {
    const lgaId  = store.currentLGA?.id   ?? null;
    const userId = store.currentUser?.id  ?? null;

    import('./api/client.js')
        .then(({ api }) => api.analytics.recordPageview(path, lgaId, userId))
        .catch(() => { /* Silently ignore — tracking must never break navigation */ });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   7. START ROUTER  (or render maintenance screen)
   ══════════════════════════════════════════════════════════════════════════ */

const urlParams = new URLSearchParams(window.location.search);

if (urlParams.get('maintenance') === '1') {
  // ── Maintenance mode ───────────────────────────────────────────────────
  // Clean the ?maintenance=1 query string without adding a history entry
  window.history.replaceState({}, '', '/');

  const appEl = document.getElementById('app');

  if (appEl) {
    document.title = 'Lagos Konect — Under Maintenance';

    // Inline styles are intentional here — the design-system CSS has not
    // loaded yet when this branch executes, so token values are unavailable.
    appEl.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8faf8;
        font-family: system-ui, sans-serif;
        padding: 24px;
        text-align: center;
      ">
        <div style="max-width: 420px;">
          <div style="font-size: 48px; margin-bottom: 16px;"
               aria-hidden="true">🔧</div>

          <h1 style="
            font-size: 24px;
            font-weight: 800;
            color: #0a1a0d;
            margin: 0 0 8px;
          ">Platform Under Maintenance</h1>

          <p style="
            color: #5a7a5c;
            font-size: 15px;
            line-height: 1.6;
            margin: 0 0 24px;
          ">
            Lagos Konect is currently undergoing scheduled maintenance.
            Your account is safe and we'll be back shortly.
          </p>

          <p style="color: #9ab09c; font-size: 13px;">
            You have been signed out automatically.
          </p>
        </div>
      </div>
    `;
  }

  // Router is NOT started — the maintenance screen is the final render.

} else {
  // ── Normal boot ────────────────────────────────────────────────────────
  router.start('#app');
}