/**
 * LagKonnect — CSS Loader Utility
 * ============================================================
 * Injects component stylesheet <link> tags into <head> on demand.
 * Prevents duplicate injection — safe to call multiple times.
 *
 * Usage:
 *   import { loadCSS } from '../utils/cssLoader.js?v=20260806e';
 *
 *   // Load a single file
 *   loadCSS('/components/base/Button.css');
 *
 */

const _loaded = new Set();

/**
 * Injects a CSS file as a <link> tag if not already loaded.
 * @param {string} href - Absolute path to CSS file
 * @returns {Promise<void>} Resolves when stylesheet is loaded
 */
export function loadCSS(href) {
  if (!href.startsWith('/')) href = '/' + href;
  if (_loaded.has(href)) return Promise.resolve();

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => { _loaded.add(href); resolve(); };
    link.onerror = () => {
      console.error(`CSS failed to load: ${href}`);
      _loaded.add(href);
      resolve();
    };
    document.head.appendChild(link);
  });
}

