/**
 * Lagos Konect - Dynamic Content Translator
 * ==========================================================
 * Translates news articles content on demand using the Google Translate
 * public endpoint. No API key is needed for testing (free tier via the
 * unofficial widget endpoint). Results are cached in localStorage so
 * each article/language pair is fetched once.
 *
 * Supported languages:
 * yo - Yoruba (full Google support)
 * ig - Igbo   (full Google support)
 * pcm - Nigerian Pidgin (limited Google support; falls back to English gracefully)
 *
 * For production scale, swap GT_ENDPOINT for the official Cloud Translation
 * API v2 endpoint and proxy it through the PHP backend to keep the key secure.
 */

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `1k_trans${CACHE_VERSION}`;
const SOURCE_LANG = 'en';

// Public Google Translate widget endpoint free, key required for testing.
// Rate limited by IP; suitable for low volume testing / demo use.
const GT_ENDPOINT = 'https://translate.googleapis.com/translate_a/single'

// Map app language codes -> Google Translate language codes
const LANG_MAP = {
    yo: 'yo',   // Yoruba - officially supported
    ig: 'ig',   // Igbo   - officially supported
    pcm: 'pcm', // Nigerian Pidgin partial; gracefully falls back to English
};

// Friendly language names for UI banners
export const LANG_LABEL = {
    yo: 'Yoruba',
    ig: 'Igbo',
    pcm: 'Pidgin',
};

// Whether full translation quality is expected for a language
export const FULL_SUPPORT = { yo: true, ig: true, pcm: false };

// -------- Cache helpers -------------------------------------------

/** Fast, non-cryptographic has for cache key generation. */
function hashStr(str) {
    let h = 5381;
    for (let i = 0; i < Math.min(str.length, 250); i++) {
        h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

function cacheKey(lang, text) {
    return `${CACHE_PREFIX}_${lang}_${hashStr(text)}`;
}

function getCache(lang, text) {
    try { return localStorage.getItem(cacheKey(lang, text)); } catch { return null; }
}

function setCache(lang, text, translated) {
    try { localStorage.setItem(cacheKey(lang, text), translated); } catch {/* noop */}
}

// -------- Core translation ------------------------------------------------------
/**
 * Translate a single string to the target language.
 * Returns the original string if translation fails or is unsupported.
 *
 * @param {string} text
 * @param {string} targetLang one of LANG_MAP keys
 * @returns {Promise<string>}
 */
export async function translateText(text,targetLang) {
    if (!text?.trim() || !targetLang || targetLang === SOURCE_LANG) return text;

    const googleLang = LANG_MAP[targetLang];
    if (!googleLang) return text;

    // Serve from cache if available
    const cached = getCache(targetLang, text);
    if (cached) return cached;

    try {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: SOURCE_LANG,
            tl: googleLang,
            dt: 't',
            q: text,
        });

        const res = await fetch (`${GT_ENDPOINT}?${params}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return text;

        const data = await res.json();
        // Response shape: [ [ ["translated_chunk", "original_chunk"], ... ], ... ]
        const translated = data?.[0]?.map((s) => s?.[0] ?? '').join('') || '';

        if (translated && translated !== text) {
            setCache(targetLang, text, translated);
            return translated;
        }
        return text; // Google returned original, treat as unsupported
    } catch {
        return text; // Network error or timeout, show original
    }
}

/**
 * Split long text into chunks no larger than `maxLen` characters,
 * splitting on paragraph boundaries where possible.
 */
function splitIntoChunks(text, maxLen = 4000) {
    if (text.length <= maxLen) return [text];

    const paragraphs = text.split(/\n{2,}/);
    const chunks = [];
    let current = '';

    for (const para of paragraphs) {
        if (current.length + para.length + 2 > maxLen) {
            if (current) chunks.push(current.trim());
            current = para;
        } else {
            current += (current ? '\n\n' : '') + para;
        }
    }
    if (current) chunks.push(current.trim());
    return chunks.length ? chunks : [text];
}

/**
 * Translate a long body text (markdown safe) by chunking into paragraphs.
 */
async function translateBody(body, targetLang) {
    if (!body || targetLang === SOURCE_LANG) return body;

    // Try full-body cache first
    const cached = getCache(targetLang, body);
    if (cached) return cached;

    const chunks = splitIntoChunks(body, 4000);
    const translated = await Promise.all(chunks.map((c) => translateText(c, targetLang)));
    const result = translated.join('\n\n');

    if (result && result !== body) setCache(targetLang, body, result);
    return result || body;
}

// ─── Article helpers ──────────────────────────────────────────────────────────

/**
 * Translate the visible preview fields of a news article (title + summary).
 * Returns a NEW object, the original is never mutated.
 *
 * @param {object} article
 * @param {string} targetLang
 * @returns {Promise<object>}
 */
export async function translateArticle(article, targetLang) {
    if (!article || targetLang === SOURCE_LANG) return article;

    const summarySource = article.summary || (article.body ? article.body.slice(0, 300) : '');

    const [title, summary] = await Promise.all([
        translateText(article.title || '', targetLang),
        translateText(summarySource, targetLang),
    ]);

    return { ...article, title, summary, _translated: targetLang };
}

/**
 * Translate all visible fields of a news article including the full body.
 * Use this on detail pages where the full content is shown.
 *
 * @param {object} article
 * @param {string} targetLang
 * @returns {Promise<object>}
 */
export async function translateArticleFull(article, targetLang) {
    if (!article || targetLang === SOURCE_LANG) return article;

    const [title, summary, body] = await Promise.all([
        translateText(article.title || '', targetLang),
        translateText(article.summary || '', targetLang),
        translateBody(article.body || '', targetLang),
    ]);

    return { ...article, title, summary, body, _translated: targetLang };
}

/**
 * Returns true when the given language code requires translation
 * (i.e. it is non-English and has a Google Translate mapping).
 *
 * @param {string} lang
 * @returns {boolean}
 */
export function needsTranslation(lang) {
    return Boolean(lang && lang !== SOURCE_LANG && LANG_MAP[lang]);
}

/**
 * Clear all cached translations from localStorage.
 * Useful when new article versions are published.
 */
export function clearTranslationCache() {
    try {
        Object.keys(localStorage)
            .filter((k) => k.startsWith(CACHE_PREFIX))
            .forEach((k) => localStorage.removeItem(k));
    } catch { /* noop */ }
}
