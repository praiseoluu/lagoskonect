/**
 * Lagos Konect — SPA Router
 * ============================================================
 * History API client-side router with:
 *   - Two separate route trees: 'web' and 'admin'
 *   - Role-based route guards (hard security boundary)
 *   - Clean URLs at all times (never falls back to /)
 *   - Page reload resilience (.htaccess rewrites to index.html)
 *   - Scroll restoration
 *   - Transition hooks for page animations
 *
 * Architecture:
 *   The router holds two separate route registries.
 *   On each navigation, it determines the tree from the URL prefix,
 *   runs guards, then calls the registered page component factory.
 *
 * Security model:
 *   Guards run on EVERY navigation, including the initial load.
 *   A citizen can never reach /admin/* — they are redirected to /home.
 *   An admin can never reach /home, /reels, etc — redirected to /admin.
 *   An unauthenticated user can only reach public routes.
 *
 *   This is frontend enforcement. The PHP backend enforces the same
 *   rules on every API call. Both layers must pass for data to flow.
 *
 * Usage:
 *   import { router } from './router.js?v=20260806f';
 *
 *   // Register routes
 *   router.register('web', webRoutes);
 *   router.register('admin', adminRoutes);
 *
 *   // Navigate
 *   router.push('/home');
 *   router.replace('/login');
 *   router.back();
 *
 *   // Start (call once after registering all routes)
 *   router.start('#app');
 */

import { store } from './store.js?v=20260806f';

// ─── Route Definition Types ───────────────────────────────────────────────
//
// A route object:
// {
//   path: '/home',                       // Exact path or pattern (see matching)
//   component: () => import('...'),      // Async factory returning a Component class
//   guards: [guardFn, guardFn],          // Optional array of guard middleware
//   meta: { title: 'Home' }             // Optional metadata (e.g. document.title)
// }
//
// A guard function:
// (context) => void
// context: { to, from, store, next(path?), abort() }
//   - next()        → allow navigation to proceed
//   - next('/path') → redirect to a different path
//   - abort()       → cancel navigation entirely (stay on current page)

// ─── Built-in Guards ─────────────────────────────────────────────────────

/**
 * Blocks navigation if not authenticated.
 * Redirects to the appropriate login page based on URL tree.
 */
export function requireAuth({ to, next, abort }) {
  if (!store.isAuthenticated) {
    const isAdminRoute = to.startsWith('/admin');
    next(isAdminRoute ? '/admin/login' : '/login');
    return;
  }
  next();
}

/**
 * Blocks navigation if not an admin.
 * Redirects citizens away from /admin/* entirely.
 */
export function requireAdmin({ to, next }) {
  const isAdmin = store.isAuthenticated && (store.role === 'admin' || store.role === 'super_admin');
  if (!isAdmin) {
    const region = sessionStorage.getItem('lagosRegion') || 'west';
    next(store.isAuthenticated ? `/${region}/home` : '/admin/login');
    return;
  }
  next();
}

/**
 * Blocks navigation if not a citizen.
 * Prevents admins from accessing web app routes.
 */
export function requireCitizen({ next }) {
  if (!store.isAuthenticated || store.role !== 'citizen') {
    const isAdmin = store.role === 'admin' || store.role === 'super_admin';
    next(store.isAuthenticated ? (isAdmin ? '/admin' : '/login') : '/login');
    return;
  }
  next();
}

/**
 * Redirects already-authenticated users away from auth pages.
 * (e.g. visiting /login when already logged in → go to /home)
 */
export function redirectIfAuthenticated({ next }) {
  if (store.isAuthenticated) {
    const isAdmin = store.role === 'admin' || store.role === 'super_admin';
    const region = sessionStorage.getItem('lagosRegion') || 'west';
    next(isAdmin ? '/admin' : `/${region}/home`);
    return;
  }
  next();
}

/**
 * Forces users flagged for a password change to visit the password update screen.
 * Ensures that authenticated users with a pending password change cannot access other routes first.
 */
export function mustChangePassword({ next }) {
  if (store.isAuthenticated && store.currentUser.mustChangePassword) {
    next('/change-password');
    return;
  }
  next();
}

// ─── Router Factory ───────────────────────────────────────────────────────

function createRouter() {
  /**
   * Route registries, keyed by tree name ('web' | 'admin').
   * @type {Map<string, Array>}
   */
  const _trees = new Map();

  /**
   * The ID of the mount container element.
   * @type {string}
   */
  let _mountSelector = '#app';

  /**
   * The currently active page component instance.
   * @type {import('./component.js?v=20260806f').Component|null}
   */
  let _currentPage = null;

  /**
   * The path of the previous route. Used for guards.
   * @type {string}
   */
  let _previousPath = null;

  /**
   * Callbacks to invoke before each navigation.
   * @type {Function[]}
   */
  const _beforeEachHooks = [];

  /**
   * Callbacks to invoke after each navigation.
   * @type {Function[]}
   */
  const _afterEachHooks = [];

  // ── Route Registration ─────────────────────────────────────────────

  /**
   * Registers a set of routes under a named tree.
   *
   * @param {'web'|'admin'} treeName
   * @param {Array<Object>} routes
   */
  function register(treeName, routes) {
    if (_trees.has(treeName)) {
      console.warn(`[Router] Overwriting route tree: "${treeName}"`);
    }
    _trees.set(treeName, routes);
  }

  // ── Path Matching ──────────────────────────────────────────────────

  /**
   * Matches a URL path against a route definition.
   * Supports:
   *   - Exact: /home
   *   - Param: /article/:id
   *   - Wildcard: /admin/* (404 catch-all)
   *
   * @param {string} routePath - The route definition path
   * @param {string} urlPath - The actual URL path
   * @returns {{ matched: boolean, params: Object }}
   */
  function matchRoute(routePath, urlPath) {
    // Wildcard
    if (routePath === '*') return { matched: true, params: {} };

    const routeParts = routePath.split('/').filter(Boolean);
    const urlParts = urlPath.split('/').filter(Boolean);

    if (routeParts.length !== urlParts.length) {
      // Allow trailing wildcard
      if (
        routeParts[routeParts.length - 1] !== '*' ||
        urlParts.length < routeParts.length - 1
      ) {
        return { matched: false, params: {} };
      }
    }

    const params = {};

    for (let i = 0; i < routeParts.length; i++) {
      const rp = routeParts[i];
      const up = urlParts[i];

      if (rp === '*') break; // Wildcard matches anything from here

      if (rp.startsWith(':')) {
        // Named parameter
        params[rp.slice(1)] = decodeURIComponent(up);
      } else if (rp !== up) {
        return { matched: false, params: {} };
      }
    }

    return { matched: true, params };
  }

  /**
   * Finds the matching route and tree for a given path.
   *
   * @param {string} path
   * @returns {{ route: Object|null, tree: string|null, params: Object }}
   */
  function resolve(path) {
    // Determine which tree to search based on prefix
    const isAdminPath = path.startsWith('/admin');
    const treeOrder = isAdminPath ? ['admin', 'web'] : ['web', 'admin'];

    for (const treeName of treeOrder) {
      const routes = _trees.get(treeName) || [];
      for (const route of routes) {
        const { matched, params } = matchRoute(route.path, path);
        if (matched) {
          return { route, tree: treeName, params };
        }
      }
    }

    return { route: null, tree: null, params: {} };
  }

  // ── Navigation ─────────────────────────────────────────────────────

  /**
   * Navigates to a path, pushing to history stack.
   * @param {string} path
   * @param {Object} [state] - Optional history state
   */
  function push(path, state = {}) {
    window.history.pushState(state, '', path);
    _handleNavigation(path);
  }

  /**
   * Navigates to a path, replacing the current history entry.
   * @param {string} path
   * @param {Object} [state]
   */
  function replace(path, state = {}) {
    window.history.replaceState(state, '', path);
    _handleNavigation(path);
  }

  /** Goes back in history */
  function back() {
    window.history.back();
  }

  /** Goes forward in history */
  function forward() {
    window.history.forward();
  }

  /**
   * Rerenders the current route in place.
   *
   * Unlink push()/replace(), this does NOT touch the history stack,
   * it simply reruns _handleNavigation() for the *current* URL, which tears down the active page
   * and remounts it (along with its sidebar/topbar children).
   *
   * Primary use: the i18n engine calls router.reload() after a language change so every t()
   * call across the mounted tree is re-evaluated with the newly selected dictionary. Query strings are preserved.
   */
  function reload() {
    _handleNavigation(window.location.pathname + window.location.search);
  }

  // ── Core Navigation Logic ──────────────────────────────────────────

  /**
   * The heart of the router. Called on every navigation.
   * Runs guards, loads the component, mounts it.
   *
   * @param {string} path
   */
  async function _handleNavigation(path) {
    // Normalise path (strip query strings for matching, preserve for params)
    const [pathname] = path.split('?');

    const { route, tree, params } = resolve(pathname);

    // ── Run global beforeEach hooks ──────────────────────────────────
    for (const hook of _beforeEachHooks) {
      await hook({ to: pathname, from: _previousPath, store });
    }

    // ── Route not found ──────────────────────────────────────────────
    if (!route) {
      console.warn(`[Router] No route found for: ${pathname}`);
      // Determine the appropriate 404 page based on the tree
      const is404Admin = pathname.startsWith('/admin');
      replace(is404Admin ? '/admin/404' : '/404');
      return;
    }

    // ── Run route-level guards ───────────────────────────────────────
    const guards = [...(route.guards || [])];
    let navigationResolved = false;
    let redirectTarget = null;
    let aborted = false;

    const runGuards = async () => {
      for (const guard of guards) {
        if (aborted || redirectTarget) break;

        await new Promise((resolve) => {
          guard({
            to: pathname,
            from: _previousPath,
            params,
            store,
            next: (target) => {
              if (target && target !== pathname) {
                redirectTarget = target;
              } else {
                navigationResolved = true;
              }
              resolve();
            },
            abort: () => {
              aborted = true;
              resolve();
            },
          });
        });
      }

      if (!guards.length) {
        navigationResolved = true;
      }
    };

    await runGuards();

    if (aborted) return;

    if (redirectTarget) {
      replace(redirectTarget);
      return;
    }

    if (!navigationResolved) return;

    // ── Unmount current page ─────────────────────────────────────────
    if (_currentPage) {
      _currentPage.unmount();
      _currentPage = null;
    }

    // ── Mount new page ───────────────────────────────────────────────
    const container = document.querySelector(_mountSelector);
    if (!container) {
      console.error(`[Router] Mount container not found: "${_mountSelector}"`);
      return;
    }

    try {
      // Route component is a factory: () => ComponentClass
      // This supports both sync and async (dynamic import) factories
      let ComponentClass = route.component;
      if (typeof ComponentClass === 'function' && !ComponentClass.prototype) {
        // It's an arrow function factory — call it
        ComponentClass = await ComponentClass();
        // Handle ES module default exports
        if (ComponentClass.default) {
          ComponentClass = ComponentClass.default;
        }
      }

      // Update store with current route
      store.currentRoute = pathname;
      _previousPath = pathname;

      _currentPage = new ComponentClass({ params, query: _parseQuery(path) });
      await _currentPage.mount(container);

      // Update document title
      if (route.meta?.title) {
        const _r = sessionStorage.getItem('lagosRegion');
        const _brand = _r === 'west' ? 'Lagos Konect - West' : _r === 'east' ? 'Lagos Konect - East' : _r === 'central' ? 'Lagos Konect - Central' : 'Lagos Konect';
        document.title = `${route.meta.title} — ${_brand}`;
      }

      // Scroll to top on navigation
      window.scrollTo({ top: 0, behavior: 'instant' });

    } catch (err) {
      console.error(`[Router] Failed to mount page for "${pathname}":`, err);
    }

    // ── Run global afterEach hooks ───────────────────────────────────
    for (const hook of _afterEachHooks) {
      await hook({ to: pathname, from: _previousPath, store });
    }
  }

  // ── Utility: Parse query string ───────────────────────────────────

  /**
   * Parses a URL query string into an object.
   * @param {string} path
   * @returns {Object}
   */
  function _parseQuery(path) {
    const queryString = path.split('?')[1];
    if (!queryString) return {};
    return Object.fromEntries(new URLSearchParams(queryString));
  }

  // ── Lifecycle Hooks ────────────────────────────────────────────────

  /**
   * Registers a global before-navigation hook.
   * @param {Function} fn - Called with ({ to, from, store })
   */
  function beforeEach(fn) {
    _beforeEachHooks.push(fn);
  }

  /**
   * Registers a global after-navigation hook.
   * @param {Function} fn - Called with ({ to, from, store })
   */
  function afterEach(fn) {
    _afterEachHooks.push(fn);
  }

  // ── Initialisation ─────────────────────────────────────────────────

  /**
   * Starts the router. Call once after all routes are registered.
   * - Intercepts link clicks (no full-page reloads)
   * - Handles popstate (back/forward buttons)
   * - Handles the initial page load
   *
   * @param {string} [mountSelector='#app'] - CSS selector for the mount container
   */
  function start(mountSelector = '#app') {
    _mountSelector = mountSelector;

    // ── Intercept all <a> clicks ─────────────────────────────────────
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');

      // External links, anchors, and mailto: / tel: pass through
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        link.target === '_blank' ||
        link.hasAttribute('data-external')
      ) {
        return;
      }

      e.preventDefault();
      push(href);
    });

    // ── Handle browser back/forward ──────────────────────────────────
    window.addEventListener('popstate', () => {
      _handleNavigation(window.location.pathname + window.location.search);
    });

    // ── Handle initial page load ─────────────────────────────────────
    // The .htaccess rewrites all paths to index.html,
    // so we resolve the current URL immediately on load.
    _handleNavigation(window.location.pathname + window.location.search);
  }

  // ── Public API ─────────────────────────────────────────────────────

  return {
    register,
    push,
    replace,
    back,
    forward,
    reload,
    beforeEach,
    afterEach,
    start,
    resolve,
    /** Returns the current path */
    get currentPath() {
      return window.location.pathname;
    },
  };
}

// ─── Singleton Export ─────────────────────────────────────────────────────

/**
 * The single global router instance.
 */
export const router = createRouter();