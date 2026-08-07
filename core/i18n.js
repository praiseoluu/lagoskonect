/**
 * Lagos Konect - i18n Engine
 * =====================================================================
 * A tiny, build less translation layer for the vanilla JS SPA
 *
 * Source of truth for the active language is THIS module(`_lang`) mirrored to localStorage via savePrefs/loadPrefs.
 * It is intentionally NOT kept in the reactive store so that store.reset() on logout never wipes the chosen language
 *
 * Switching language re-renders the whole UI by asking the router to rehandle the current path (router.reload()).
 * That tears down and remounts the active page (and its sidebar/topbar children), so every t() call is re-evaluated with new dictionary.
 *
 * Usage:
 *   import { t, setLanguage, getLanguage } from '../core/i18n.js?v=20260806h';
 *
 *   t('nav.home)                       -> "Ilé" (in Yoruba)
 *   t('topbar.changeLGA', { name })    -> interpolates {name}
 *   t('missing.key')                   -> falls back to English, then the key
 *
 * Languages (Lagos - English first):
 *      en  -   English (master)
 *      yo  -   Yoruba
 *      ig  -   Igo
 *      pcm -   Nigerian Pidgin
 */

import { loadPrefs, savePrefs } from '../utils/storage.js?v=20260806h';
import en from '../locales/en.js?v=20260806h';
import yo from '../locales/yo.js?v=20260806h';
import ig from '../locales/ig.js?v=20260806h';
import pcm from '../locales/pcm.js?v=20260806h';


// ------ Supported languages ---------------------------------------------------------------------
// `code` is the dictionary key, `native` is shown to users,
// `name` is the English name, `short` is the compact badge used in the switcher.
export const LANGUAGES = [
    { code: 'en',   name: 'English',            native: 'English',  short: 'EN' },
    { code: 'yo',   name: 'Yoruba',             native: 'Yorùbá',   short: 'YO' },
    { code: 'ig',   name: 'Igbo',               native: 'Igbo',     short: 'IG' },
    { code: 'pcm',  name: 'Nigerian Pidgin',    native: 'Naijá',    short: 'PCM' },
];

const DICTS = { en, yo, ig, pcm };
const DEFAULT_LANG = 'en';

let _lang = DEFAULT_LANG;
const _listeners = new Set();

// --------- Lookup -----------------------------------------------------------------------------------

/** Walks a dot path ("nav.home") into a nested dictionary object. */
function _resolve(dict, path) {
    if (!dict) return undefined;
    return path.split('.').reduce(
        (node, key) => (node == null ? undefined : node[key]),
        dict
    );
}

/** Replaces {placeholders} in a string from the vars object. */
function _interpolate(str, vars) {
    if(!vars) return str;
    return str.replace(/\{(\w+)\}/g, (match, key) =>
        vars[key] != null ? String(vars[key]) : match
    );
}

/**
 * Translate a dot path key
 * Falls back: current language -> English -> the key itself.
 *
 * @param {string} key
 * @param {Object} [vars] - values for {placeholders}
 * @returns {string}
 */
export function t(key, vars) {
    let value = _resolve(DICTS[_lang], key);
    if (value == null) value = _resolve(DICTS[DEFAULT_LANG], key);
    if (value == null) return key;
    return typeof value === 'string' ? _interpolate(value, vars) : value;
}

// ----- State ---------------------------------------------------------------------------------------

/** @returns {string} the active language code */
export function getLanguage() {
    return _lang;
}

/** @returns {{code,name,native,short}} metadata for a language code */
export function getLanguageMeta(code = _lang) {
    return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

/**
 * Reads the persisted language and applies it.
 * Call once on app boat, BEFORE the router starts.
 */
export function initI18n() {
    const saved = loadPrefs().language;
    if (saved && DICTS[saved]) _lang = saved;
    document.documentElement.lang = _lang;
    return _lang;
}

/**
 * Subscribe to language changes. Returns an unsubscribe function.
 * Most UI updates happen via the page reload, but body level singletons
 * can use this to refresh in place if needed.
 *
 * @param {(code: string) => void} fn
 */
export function onLanguageChange(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}

/**
 * Change the active language, persist it, add re-render the app.
 *
 * @param {string} code - one of LANGUAGes[].code
 */
export async function setLanguage(code) {
    if(!DICTS[code] || code === _lang) return;

    _lang = code;
    savePrefs({ language: code });
    document.documentElement.lang = code;

    // Tear down body level singletons so they rebuild in the new language
    // on the next page mount (WebLayout recreates them in afterMount).
    try { window._createReelModal?.unmount?.(); } catch { /* noop */ }
    try { window._selectLGAModal?.unmount?.(); } catch { /* noop */ }
    try { window._twoFaModal?.unmount?.(); } catch {/* noop */ }
    window._createReelModal = null;
    window._selectLGAModal = null;
    window._twoFaModal = null;

    _listeners.forEach((fn) => {
        try { fn(code); } catch (err) { console.error('[i18n] listener error:', err ); }
    });

    // Re-render the current page with the new dictionary.
    const { router } = await import('./router.js?v=20260806h');
    router.reload();


}