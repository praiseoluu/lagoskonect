/**
 * Lagos Konect - Shared Community Chat (base class v3)
 * ============================================================
 * All three regional Chat pages import and extend this class.
 *
 * v3 upgrades:
 *  ✅ Emoji bug fixed — direct listener; no stopPropagation conflict
 *  ✅ Tabbed picker: Emoji (8 categories + search) · Stickers · GIFs
 *  ✅ Images render inline with tap-to-zoom lightbox
 *  ✅ GIFs render inline (animated) via mediaUrl
 *  ✅ Videos render inline with controls
 *  ✅ Edit own messages wired to PATCH /chat/messages/:id
 *  ✅ Delete with smooth slide-out animation
 *  ✅ Hover action-bar quick reactions on every message
 *  ✅ Scroll-to-bottom FAB
 *  ✅ Message grouping (avatar shown once per sender run)
 *  ✅ Message enter animation
 *  ✅ Attach menu separates Photo/Video from other files
 *  ✅ Single-emoji text rendered as large sticker
 */

import { WebLayout }                        from '../../../components/layout/BaseLayout.js?v=20260806f';
import { Avatar }                           from '../../../components/base/UI.js?v=20260806f';
import { store, showToast, setPageLoading } from '../../../core/store.js?v=20260806f';
import { api }                              from '../../../api/client.js?v=20260806f';
import { sseClient }                        from '../../../core/sseClient.js?v=20260806f';
import { t }                                from '../../../core/i18n.js?v=20260806f';

// ══════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const EMOJI_CATEGORIES = [
    { id: 'people',   icon: '😊', name: 'Smileys',   emojis: ['😀','😂','😍','😎','🥺','🤔','😅','😊','🥳','😤','🤩','🥰','😔','😴','🤒','🤧','😷','🤯','🤠','😈','👿','💀','☠️','💩','🤡','👻','😭','😡','😱','🤣','😑','😏','🙄','😬','😌','😪','😵','😇','🥸','😶','😒','🫥','🥲','🤑','🤗','🤭','🤫','😝','😜','🤪','😛','😋'] },
    { id: 'hand',     icon: '👋', name: 'Hands',     emojis: ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🖖','👌','🤌','🤏','🤝','🙌','👏','🙏','🫶','💪','🤳','💅','✍️','🫰','🫵','🫱','🫲','🤲','👐'] },
    { id: 'nature',   icon: '🌿', name: 'Nature',    emojis: ['🌿','🌺','🌸','🌼','🌻','🌹','🌷','🌱','🌲','🌳','🌴','🌵','🍀','🍁','🍂','🍃','🌾','🍄','🌊','💦','🔥','⭐','🌟','✨','⚡','🌈','☀️','🌙','🪐','💫','☄️','🌍','🌎','🌏','🌬','💨','🌀','❄️','☃️','⛄','🦁','🐅','🦅','🦋','🐝','🐬','🌋','🏔'] },
    { id: 'food',     icon: '🍕', name: 'Food',      emojis: ['🍕','🍔','🍟','🌮','🌯','🥗','🥩','🍗','🍖','🌭','🍳','🥞','🧇','🍿','🎂','🍰','🧁','🍩','🍪','🍫','🍬','🍭','🍎','🍊','🍋','🍇','🍓','🫐','🍒','🍑','🥝','☕','🧃','🥤','🍺','🍻','🥂','🍷','🧋','🥐','🫔','🥙','🫕','🍱','🍜','🥟','🦴'] },
    { id: 'activity', icon: '⚽', name: 'Activity',  emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏆','🥇','🥈','🥉','🎮','🕹','🎲','♟','🎯','🎳','🎨','🎭','🎪','🤹','🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🎻','🎸','🥁','🎹','🎺','🎷','🎵','🎶','🎤','🎧','🎼','🪗','🪘','🪕'] },
    { id: 'travel',   icon: '✈️', name: 'Travel',    emojis: ['✈️','🚀','🛸','🚁','🚗','🚕','🚌','🚑','🚒','🚓','🚲','🛴','🛵','🏍','⛽','🗺','🌐','🗽','🗼','🏰','🏯','🏟','🎡','🎢','🎠','🏖','🏜','🏔','⛰','🌋','🗻','🏕','🛤','🏛','⛪','🕌','🕍','🛕','🗿','🏗','🌁'] },
    { id: 'objects',  icon: '💡', name: 'Objects',   emojis: ['💡','💎','🔑','🗝','🔒','🔓','🔨','⚒','🛠','🔧','🔩','⚙','🔗','🧲','🔦','💰','💵','💳','🪙','💹','📱','💻','🖥','📷','📹','🎥','📺','📻','⌚','🕹','📚','🔬','🔭','🧪','🧬','💊','🩺','🩹','🌡','🛒','📦','✉️','📧'] },
    { id: 'symbols',  icon: '❤️', name: 'Symbols',   emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💯','✅','❌','☑️','✔️','❎','⚠️','🚫','🛑','❓','❗','💢','♨️','🔞','🔰','♻️','✴️','🆚','🆕','🆓','🆒','🆗','🆙','🅰','🅱','🅾','🆘','🏳','🏴','🚩','🏁'] },
];

const STICKER_PACKS = [
    { emoji: '🎉', label: 'Party'      }, { emoji: '🔥', label: 'Fire'       },
    { emoji: '💯', label: '100%'       }, { emoji: '🙏', label: 'Thanks'     },
    { emoji: '👑', label: 'King'       }, { emoji: '💪', label: 'Strong'     },
    { emoji: '🚀', label: 'Rocket'     }, { emoji: '❤️', label: 'Love'       },
    { emoji: '😍', label: 'Amazed'     }, { emoji: '🤝', label: 'Deal'       },
    { emoji: '👀', label: 'Watching'   }, { emoji: '💀', label: 'Dead 💀'    },
    { emoji: '🫶', label: 'Hearts'     }, { emoji: '🫡', label: 'Salute'     },
    { emoji: '🏆', label: 'Trophy'     }, { emoji: '⚡', label: 'Lightning'  },
    { emoji: '🌍', label: 'Nigeria'    }, { emoji: '🦅', label: 'Eagle'      },
    { emoji: '🌟', label: 'Star'       }, { emoji: '💎', label: 'Diamond'    },
];

// GIF emoji tiles rendered as SVG data URIs — fully CSP-compliant (data: is
// allowed in img-src) and requires no hosted GIF files.
function _makeSvgGif(emoji, label, bg) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" rx="10" fill="${bg}"/><text x="120" y="78" font-size="58" text-anchor="middle" dominant-baseline="middle">${emoji}</text><text x="120" y="136" font-size="13" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="#444" font-family="system-ui,sans-serif">${label}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const _GIF_DEFS = [
    { key: 'laughing', emoji: '😂', label: 'Laughing',  bg: '#FFF9C4', giphy: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif' },
    { key: 'yes',      emoji: '✅', label: 'Yes!',      bg: '#C8E6C9', giphy: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
    { key: 'no-way',   emoji: '🙅', label: 'No Way',    bg: '#FFCDD2', giphy: 'https://media.giphy.com/media/l0ErFafpUCQTQFMSk/giphy.gif' },
    { key: 'dancing',  emoji: '💃', label: 'Dancing',   bg: '#E1BEE7', giphy: 'https://media.giphy.com/media/7GcdjWkek7Apq/giphy.gif' },
    { key: 'fire',     emoji: '🔥', label: 'Fire!',     bg: '#FFE0B2', giphy: 'https://media.giphy.com/media/3oz8xUK8V7suY7W9SE/giphy.gif' },
    { key: 'awesome',  emoji: '🤩', label: 'Awesome',   bg: '#BBDEFB', giphy: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif' },
    { key: 'wow',      emoji: '🤯', label: 'Wow!',      bg: '#FCE4EC', giphy: 'https://media.giphy.com/media/wH4rY2nPnEnp6/giphy.gif' },
    { key: 'shocked',  emoji: '😱', label: 'Shocked',   bg: '#E0F2F1', giphy: 'https://media.giphy.com/media/xT5LMzIK1AdZJ4cYW4/giphy.gif' },
    { key: 'party',    emoji: '🎉', label: 'Party!',    bg: '#FFF8E1', giphy: 'https://media.giphy.com/media/DYH297XiCS2Ck/giphy.gif' },
    { key: 'wave',     emoji: '👋', label: 'Wave',      bg: '#E3F2FD', giphy: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif' },
    { key: 'ok',       emoji: '👍', label: 'OK!',       bg: '#F1F8E9', giphy: 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif' },
];

const CURATED_GIFS = _GIF_DEFS.map(g => ({
    url:   _makeSvgGif(g.emoji, g.label, g.bg),
    label: `${g.label} ${g.emoji}`,
    emoji: g.emoji,
}));

// Maps both legacy Giphy URLs and old local paths to the new SVG data URIs.
const LEGACY_GIF_URLS = new Map(
    _GIF_DEFS.flatMap(g => {
        const dataUrl = _makeSvgGif(g.emoji, g.label, g.bg);
        return [
            [g.giphy,                     dataUrl],
            [`/assets/gifs/${g.key}.gif`, dataUrl],
        ];
    })
);

const localizeGifUrl = (url) => {
    if (!url) return url;
    return LEGACY_GIF_URLS.get(url) || url;
};

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function _relativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

function isToday(iso) {
    return new Date(iso).toDateString() === new Date().toDateString();
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|bmp|avif|gif|svg)$/i;
const AUDIO_EXTS = /\.(webm|ogg|mp3|m4a|wav)$/i;
const VIDEO_EXTS = /\.(mp4|mov|avi|mkv|ogv|webm)$/i;

function _isImageFile(url = '', name = '') {
    return IMAGE_EXTS.test(name) || IMAGE_EXTS.test(url.split('?')[0]);
}
function _isAudioFile(url = '', name = '') {
    return AUDIO_EXTS.test(name) || AUDIO_EXTS.test(url.split('?')[0]);
}
function _isVideoFile(url = '', name = '') {
    return VIDEO_EXTS.test(name) || VIDEO_EXTS.test(url.split('?')[0]);
}

/** True when text is composed entirely of emoji characters (no letters/numbers). */
function isStickerText(text) {
    if (!text) return false;
    const t = text.trim();
    if (!t || t.length > 10) return false;
    try {
        const stripped = t.replace(/[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\uFE0F\u200D\s]/gu, '');
        return stripped.length === 0;
    } catch {
        return /^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\s]+$/u.test(t);
    }
}

function fileExtBadge(name = '') {
    const parts = (name || '').split('.');
    return parts.length > 1 ? parts.pop().toUpperCase().slice(0, 4) : 'FILE';
}

// ══════════════════════════════════════════════════════════════════════════
// SharedChatPage
// ══════════════════════════════════════════════════════════════════════════

export default class SharedChatPage extends WebLayout {
    static styles = '/pages/web/app/Chat.css?v=20260806f';

    /** Override in subclasses: return the profile URL for a given username. */
    _profileUrl(username) { return `/u/${encodeURIComponent(username)}`; }

    /** Override to true in subclasses that need voice-note recording. */
    get _hasVoiceNotes() { return false; }

    constructor(props) {
        super({ title: t('chat.title'), ...props });

        // Chat state
        this._messages          = [];
        this._replyTo           = null;
        this._editingMsgId      = null;
        this._editingOrigText   = null;

        // Search state
        this._searchActive      = false;
        this._searchQuery       = '';
        this._searchMatches     = [];
        this._searchIdx         = 0;

        // UI state
        this._contextTarget     = null;
        this._emojiPanelOpen    = false;
        this._activeEmojiTab    = 'emoji';
        this._emojiCategory     = 'people';
        this._emojiSearchQuery  = '';
        this._gifSearchQuery    = '';
        this._sending           = false;
        this._attachMenuOpen    = false;
        this._notifsMuted       = false; // tracks local mute-toggle state

        // Message list state
        this._lastRenderedDate  = null;
        this._objectURLs        = new Set();
        this._lastReadId        = 0;
        this._unreadSeparatorId = null;

        // Report modal state
        this._reportMsgId       = null;
        this._reportReason      = null;

        // LGA / sidebar state
        this._activeLgaId       = store.currentUser?.lgaId ?? null;
        this._allPreviews       = [];

        // Voice note state (used only when _hasVoiceNotes = true)
        this._isRecording       = false;
        this._mediaRecorder     = null;
        this._recordingChunks   = [];
        this._recordingSeconds  = 0;
        this._recordingTimer    = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // HTML Template
    // ══════════════════════════════════════════════════════════════════════

    getContent() {
        const lgaName = store.currentLGA?.name || 'your LGA';
        return `
      <div class="chat-shell" id="chat-shell">

        <!-- ── Left sidebar: LGA community list ────────────────────── -->
        <aside class="chat-list-sidebar" id="chat-list-sidebar" aria-label="LGA Communities">
          <div class="chat-list-sidebar__header">
            <span class="chat-list-sidebar__title">Communities</span>
          </div>
          <div class="chat-list-sidebar__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="chat-list-sidebar__search-input" id="lga-search-input" placeholder="Search…" autocomplete="off" aria-label="Search communities" />
          </div>
          <div class="chat-list-sidebar__unread-label">
            Unread Messages
            <span class="chat-list-sidebar__unread-badge" id="unread-badge" aria-hidden="true" style="display:none"></span>
          </div>
          <nav class="chat-list-sidebar__list" id="lga-list" aria-label="LGA list">
            ${Array.from({ length: 5 }).map(() => `
              <div class="chat-list-item chat-list-item--skeleton">
                <div class="chat-list-item__avatar skeleton-pulse"></div>
                <div class="chat-list-item__body">
                  <div class="chat-list-item__skel-name skeleton-pulse"></div>
                  <div class="chat-list-item__skel-preview skeleton-pulse"></div>
                </div>
              </div>`).join('')}
          </nav>
        </aside>

        <!-- ── Centre: chat panel ───────────────────────────────────── -->
        <div class="chat-page" id="chat-page">

          <!-- Header -->
          <div class="chat-header" id="chat-header">
            <div class="chat-header__left">
              <!-- Mobile: tap to open community list -->
              <button class="chat-header__back-btn" id="mobile-communities-btn" type="button" aria-label="Switch community">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div class="chat-header__avatar" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div class="chat-header__info">
                <h1 class="chat-header__name" id="chat-header-name">${this.esc(lgaName)} Community</h1>
                <p class="chat-header__members" id="online-count">
                  <span class="chat-header__online-dot" aria-hidden="true"></span>
                  Loading members…
                </p>
              </div>
            </div>
            <div class="chat-header__actions">
              <button class="chat-header__icon-btn" id="search-toggle-btn" type="button" aria-label="Search messages">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button class="chat-header__icon-btn" id="kebab-btn" type="button" aria-label="More options" aria-haspopup="menu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </button>
              <button class="chat-header__invite-btn" id="invite-btn" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                <span>Invite</span>
              </button>
            </div>
          </div>

          <!-- Search bar -->
          <div class="chat-search-bar" id="chat-search-bar" aria-hidden="true">
            <input type="text" class="chat-search-bar__input" id="search-input" placeholder="Search messages…" autocomplete="off" aria-label="Search messages" />
            <span class="chat-search-bar__nav" id="search-nav" aria-live="polite"></span>
            <button class="chat-search-bar__arrow" id="search-prev" type="button" aria-label="Previous result" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="chat-search-bar__arrow" id="search-next" type="button" aria-label="Next result" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="chat-search-bar__close" id="search-close" type="button" aria-label="Close search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Message body -->
          <div class="chat-body" id="chat-body" role="log" aria-live="polite" aria-label="Chat messages">
            <div class="chat-body__skeleton" id="chat-skeleton" aria-hidden="true">
              ${[1,2,3,4,5].map(i => `
                <div class="chat-skeleton-row ${i % 3 === 0 ? 'chat-skeleton-row--right' : ''}">
                  ${i % 3 !== 0 ? '<div class="chat-skeleton-avatar skeleton-pulse"></div>' : ''}
                  <div class="chat-skeleton-bubble skeleton-pulse ${i % 3 === 0 ? 'chat-skeleton-bubble--right' : ''}"></div>
                </div>`).join('')}
            </div>
          </div>

          <!-- Scroll-to-bottom FAB -->
          <button class="chat-scroll-btn" id="scroll-btn" type="button" aria-label="Scroll to latest messages">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <!-- Reply / Edit indicator bar -->
          <div class="chat-reply-bar" id="chat-reply-bar" aria-hidden="true">
            <div class="chat-reply-bar__content" id="reply-bar-content"></div>
            <button class="chat-reply-bar__close" id="reply-bar-close" type="button" aria-label="Cancel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Input bar -->
          <div class="chat-input-bar" id="chat-input-bar">

            <!-- Attach button + popup menu -->
            <div class="chat-attach-wrap" id="attach-wrap">
              <button class="chat-input-bar__icon-btn" id="attach-btn" type="button" aria-label="Attach file" aria-haspopup="menu" aria-expanded="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <div class="chat-attach-menu" id="attach-menu" role="menu" aria-hidden="true">
                <button class="chat-attach-menu__item" data-attach="image" type="button" role="menuitem">
                  <span class="chat-attach-menu__icon">🖼️</span> Photo / Video
                </button>
                <button class="chat-attach-menu__item" data-attach="file" type="button" role="menuitem">
                  <span class="chat-attach-menu__icon">📎</span> File
                </button>
              </div>
              <input type="file" id="image-input" class="chat-input-bar__file-input" accept="image/*,video/*" aria-hidden="true" tabindex="-1" />
              <input type="file" id="file-input"  class="chat-input-bar__file-input" aria-hidden="true" tabindex="-1" />
            </div>

            <!-- Textarea -->
            <div class="chat-input-bar__input-wrap">
              <textarea class="chat-input-bar__textarea" id="chat-textarea"
                placeholder="Message…"
                rows="1" aria-label="Type a message" autocomplete="off"></textarea>
            </div>

            <!-- Emoji / Sticker / GIF button -->
            <button class="chat-input-bar__icon-btn" id="emoji-btn" type="button" aria-label="Emoji, stickers and GIFs" aria-haspopup="dialog" aria-expanded="false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>

            <!-- Voice note (only rendered if _hasVoiceNotes = true) -->
            ${this._hasVoiceNotes ? `
              <button class="chat-input-bar__icon-btn" id="voice-btn" type="button" aria-label="Record voice note">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>` : ''}

            <!-- Send -->
            <button class="chat-input-bar__send-btn" id="send-btn" type="button" aria-label="Send message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>

          <!-- Voice recorder UI (only rendered if _hasVoiceNotes = true) -->
          ${this._hasVoiceNotes ? `
            <div class="chat-voice-recorder" id="voice-recorder" aria-hidden="true">
              <button class="chat-voice-recorder__cancel" id="voice-cancel" type="button" aria-label="Cancel recording">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div class="chat-voice-recorder__pulse" aria-hidden="true"></div>
              <span class="chat-voice-recorder__label">Recording…</span>
              <span class="chat-voice-recorder__timer" id="voice-timer">0:00</span>
              <button class="chat-voice-recorder__send" id="voice-send" type="button" aria-label="Send voice note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>` : ''}

          <p class="chat-input-hint">ENTER TO SEND &nbsp;·&nbsp; SHIFT + ENTER FOR NEW LINE</p>

          <!-- Context menu (right-click on messages) -->
          <div class="chat-context-menu" id="chat-context-menu" role="menu" inert>
            <div class="chat-context-menu__reactions" id="context-reactions">
              ${DEFAULT_REACTIONS.map(e => `<button class="chat-context-menu__emoji" data-emoji="${e}" type="button" aria-label="React with ${e}">${e}</button>`).join('')}
              <button class="chat-context-menu__emoji chat-context-menu__emoji--more" id="context-emoji-more" type="button" aria-label="More reactions" aria-expanded="false">+</button>
            </div>
            <div class="chat-context-menu__emoji-grid" id="context-emoji-grid" inert>
              ${EMOJI_CATEGORIES.flatMap(c => c.emojis).slice(0, 40).map(e => `<button class="chat-context-menu__emoji chat-context-menu__emoji--grid" data-emoji="${e}" type="button" aria-label="${e}">${e}</button>`).join('')}
            </div>
            <div class="chat-context-menu__divider"></div>
            <button class="chat-context-menu__item" data-action="copy" type="button" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
            <button class="chat-context-menu__item" data-action="reply" type="button" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
              Reply
            </button>
            <button class="chat-context-menu__item" id="ctx-edit-btn" data-action="edit" type="button" role="menuitem" style="display:none">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <div class="chat-context-menu__divider"></div>
            <button class="chat-context-menu__item chat-context-menu__item--danger" id="ctx-danger-btn" data-action="report" type="button" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Report
            </button>
          </div>

          <!-- ── Tabbed Emoji / Sticker / GIF Panel ─────────────────── -->
          <div class="chat-emoji-panel" id="chat-emoji-panel" aria-hidden="true" role="dialog" aria-label="Emoji and sticker picker">

            <!-- Tab bar -->
            <div class="chat-emoji-panel__tabs" role="tablist">
              <button class="chat-emoji-panel__tab chat-emoji-panel__tab--active" data-tab="emoji"   type="button" role="tab" aria-selected="true">😊 Emoji</button>
              <button class="chat-emoji-panel__tab"                               data-tab="sticker" type="button" role="tab" aria-selected="false">🎭 Stickers</button>
              <button class="chat-emoji-panel__tab"                               data-tab="gif"     type="button" role="tab" aria-selected="false">🎬 GIF</button>
            </div>

            <!-- ── Emoji section ──────────────────────────────────────── -->
            <div class="chat-emoji-panel__section" id="ep-emoji" role="tabpanel">
              <div class="chat-emoji-panel__search-wrap">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" class="chat-emoji-panel__search" id="emoji-panel-search" placeholder="Search by category (food, nature…)" autocomplete="off" />
              </div>
              <div class="chat-emoji-panel__categories" id="ep-categories" role="toolbar" aria-label="Emoji categories">
                ${EMOJI_CATEGORIES.map(c => `<button class="chat-emoji-panel__cat-btn${c.id === this._emojiCategory ? ' chat-emoji-panel__cat-btn--active' : ''}" data-cat="${c.id}" type="button" title="${c.name}" aria-label="${c.name}">${c.icon}</button>`).join('')}
              </div>
              <p class="chat-emoji-panel__section-label" id="ep-cat-label">${EMOJI_CATEGORIES[0].name}</p>
              <div class="chat-emoji-panel__grid" id="ep-grid">
                ${this._renderEmojiButtons(EMOJI_CATEGORIES[0].emojis)}
              </div>
            </div>

            <!-- ── Sticker section ────────────────────────────────────── -->
            <div class="chat-emoji-panel__section chat-emoji-panel__section--hidden" id="ep-sticker" role="tabpanel">
              <p class="chat-emoji-panel__section-label">Tap a sticker to send it</p>
              <div class="chat-sticker-grid">
                ${STICKER_PACKS.map(s => `
                  <button class="chat-sticker-item" data-sticker="${s.emoji}" type="button" aria-label="Send ${s.label} sticker">
                    <span class="chat-sticker-item__emoji">${s.emoji}</span>
                    <span class="chat-sticker-item__label">${s.label}</span>
                  </button>`).join('')}
              </div>
            </div>

            <!-- ── GIF section ────────────────────────────────────────── -->
            <div class="chat-emoji-panel__section chat-emoji-panel__section--hidden" id="ep-gif" role="tabpanel">
              <div class="chat-gif-toolbar">
                <p class="chat-emoji-panel__section-label">GIFs — tap to send</p>
                <input type="search" class="chat-emoji-panel__search chat-gif-search" id="gif-panel-search"
                  placeholder="Search GIFs…" autocomplete="off" aria-label="Search GIFs" />
              </div>
              <div class="chat-gif-grid" id="chat-gif-grid">
                ${CURATED_GIFS.map(g => `
                  <button class="chat-gif-item" data-gif-url="${g.url}" data-gif-label="${this.esc(g.label)}" type="button" aria-label="${this.esc(g.label)}">
                    <img src="${g.url}" alt="${this.esc(g.emoji)}" loading="lazy" />
                    <span class="chat-gif-item__label">${this.esc(g.label)}</span>
                  </button>`).join('')}
              </div>
            </div>

          </div><!-- end .chat-emoji-panel -->

          <!-- Kebab menu -->
          <div class="chat-kebab-menu" id="chat-kebab-menu" role="menu" aria-hidden="true">
            <button class="chat-kebab-menu__item" data-kebab="mute" type="button" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              <span id="chat-mute-label">${t('chat.muteNotifications')}</span>
            </button>
            <button class="chat-kebab-menu__item" data-kebab="members" type="button" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              View members
            </button>
            <button class="chat-kebab-menu__item" data-kebab="clear" type="button" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              Clear chat
            </button>
          </div>

          <!-- Modals: Invite, Report, Members -->
          <div class="chat-modal-backdrop" id="invite-backdrop" aria-hidden="true">
            <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
              <div class="chat-modal__header">
                <h2 class="chat-modal__title" id="invite-modal-title">Invite to Community</h2>
                <button class="chat-modal__close" id="invite-close" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <p class="chat-modal__desc">Enter the phone number of the person you'd like to invite to the <strong>${this.esc(lgaName)} Community</strong> chat.</p>
              <input type="tel" class="chat-modal__input" id="invite-phone" placeholder="+234 801 234 5678" autocomplete="tel" />
              <p class="chat-modal__error" id="invite-error"></p>
              <div class="chat-modal__actions">
                <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="invite-cancel" type="button">Cancel</button>
                <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="invite-send" type="button">Send Invite</button>
              </div>
            </div>
          </div>

          <div class="chat-modal-backdrop" id="report-backdrop" aria-hidden="true">
            <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
              <div class="chat-modal__header">
                <h2 class="chat-modal__title" id="report-modal-title">Report Message</h2>
                <button class="chat-modal__close" id="report-close" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <p class="chat-modal__desc">Why are you reporting this message?</p>
              <div class="chat-report-reasons" id="report-reasons">
                ${['Spam','Harassment','Misinformation','Inappropriate content','Other'].map(r => `<button class="chat-report-reason" data-reason="${r}" type="button">${r}</button>`).join('')}
              </div>
              <p class="chat-modal__error" id="report-error"></p>
              <div class="chat-modal__actions">
                <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="report-cancel" type="button">Cancel</button>
                <button class="ktg-btn ktg-btn--danger ktg-btn--md" id="report-submit" type="button" disabled>Submit Report</button>
              </div>
            </div>
          </div>

          <div class="chat-modal-backdrop" id="members-backdrop" aria-hidden="true">
            <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="members-modal-title">
              <div class="chat-modal__header">
                <h2 class="chat-modal__title" id="members-modal-title">Community Members</h2>
                <button class="chat-modal__close" id="members-close" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <div class="chat-modal__members-list" id="members-list">
                <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>
              </div>
            </div>
          </div>

          <!-- Image Lightbox -->
          <div class="chat-lightbox" id="chat-lightbox" aria-hidden="true" role="dialog" aria-label="Image viewer">
            <button class="chat-lightbox__close" id="lightbox-close" type="button" aria-label="Close image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <img class="chat-lightbox__img" id="lightbox-img" src="" alt="" />
          </div>

        </div><!-- end .chat-page -->

        <!-- ── Right sidebar: ads ────────────────────────────────────── -->
        <aside class="chat-ads-sidebar" id="chat-ads-sidebar" aria-label="Advertisements">
          <div id="chat-ads-mount"></div>
        </aside>

      </div><!-- end .chat-shell -->
    `;
    }

    /** Helper: render emoji buttons for the emoji grid. */
    _renderEmojiButtons(emojis) {
        return emojis.map(e => `<button class="chat-emoji-panel__item" data-emoji="${e}" type="button" aria-label="${e}">${e}</button>`).join('');
    }

    // ══════════════════════════════════════════════════════════════════════
    // Init
    // ══════════════════════════════════════════════════════════════════════

    async onContentReady() {
        setPageLoading(true);
        await Promise.all([this._loadMessages(), this._loadPreviews(), this._loadSidebarAds()]);
        this._loadOnlineCount();
        this._bindEvents();
        this._bindEmojiPanel();
        this._bindLgaSearch();
        this._connectSSE();
        this._updateChatHeader();
        this._bindMobileSidebar();
        setPageLoading(false);
    }

    _bindMobileSidebar() {
        const el = this.getContentEl();
        const shell = el?.querySelector('#chat-shell');
        const btn = el?.querySelector('#mobile-communities-btn');
        if (!btn || !shell) return;
        btn.addEventListener('click', () => shell.classList.toggle('chat-shell--sidebar-open'));
        // Tap the backdrop area to close
        shell.addEventListener('click', (e) => {
            if (shell.classList.contains('chat-shell--sidebar-open') && e.target === shell) {
                shell.classList.remove('chat-shell--sidebar-open');
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // LGA Sidebar
    // ══════════════════════════════════════════════════════════════════════

    async _loadPreviews() {
        const res = await api.chat.getPreviews();
        if (res.error) {
            const lgaRes = await api.lgas.getAll();
            this._allPreviews = (lgaRes.data || []).map(l => ({ ...l, lastMessage: null, unreadCount: 0 }));
        } else {
            this._allPreviews = res.data || [];
        }
        this._renderLgaList(this._allPreviews);
    }

    _renderLgaList(previews) {
        const el    = this.getContentEl();
        const list  = el?.querySelector('#lga-list');
        const badge = el?.querySelector('#unread-badge');
        if (!list) return;

        const totalUnread = previews.reduce((s, p) => s + (p.unreadCount || 0), 0);
        if (badge) { badge.textContent = totalUnread > 0 ? totalUnread : ''; badge.style.display = totalUnread > 0 ? '' : 'none'; }

        if (!previews.length) { list.innerHTML = `<p class="chat-list-sidebar__empty">No communities found.</p>`; return; }

        const userRegion = store.currentUser?.region || null;
        const userLgaId  = store.currentUser?.lgaId  || null;

        const REGION_LABELS = { west: 'Lagos West', central: 'Lagos Central', east: 'Lagos East' };
        // User's own region floats to the top; the other two follow alphabetically
        const REGION_ORDER  = ['west', 'central', 'east'].sort((a, b) =>
            a === userRegion ? -1 : b === userRegion ? 1 : 0
        );

        // Group previews by region
        const groups = {};
        for (const p of previews) {
            const r = p.region || 'west';
            if (!groups[r]) groups[r] = [];
            groups[r].push(p);
        }

        // Within a region, the community talked in most recently rises to the
        // top, the way every messenger orders a conversation list — so a room
        // with a new message is where you expect it rather than buried in a
        // fixed alphabetical list. Unread rooms outrank read ones; rooms with
        // no messages yet settle to the bottom, ordered by name so the list is
        // still stable and scannable.
        const activityRank = (p) => {
            const t = p.lastMessage?.createdAt ? new Date(p.lastMessage.createdAt).getTime() : 0;
            return { unread: (p.unreadCount || 0) > 0 ? 1 : 0, t };
        };
        for (const r of Object.keys(groups)) {
            groups[r].sort((a, b) => {
                const ra = activityRank(a), rb = activityRank(b);
                if (ra.unread !== rb.unread) return rb.unread - ra.unread;   // unread first
                if (rb.t !== ra.t)           return rb.t - ra.t;             // newest activity first
                return a.name.localeCompare(b.name);                        // then alphabetical
            });
        }

        const html = REGION_ORDER
            .filter(r => groups[r]?.length)
            .map(region => {
                const isUserRegion = region === userRegion;
                const items = groups[region].map(lga => {
                    const isActive    = lga.id === this._activeLgaId;
                    const isHome      = lga.id === userLgaId;
                    const initials    = lga.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
                    const last        = lga.lastMessage;
                    const previewText = last ? `${last.isMe ? 'You' : last.sender}: ${last.text || 'Sent a file'}` : '';
                    const timeText    = last ? _relativeTime(last.createdAt) : '';
                    const unread      = lga.unreadCount || 0;
                    return `
        <button class="chat-list-item${isActive ? ' chat-list-item--active' : ''}"
          data-lga-id="${lga.id}" data-lga-name="${this.esc(lga.name)}" type="button" role="listitem">
          <div class="chat-list-item__avatar" aria-hidden="true">${initials}</div>
          <div class="chat-list-item__body">
            <span class="chat-list-item__name">${this.esc(lga.name)} LGA${isHome ? ` <span class="chat-list-item__home-tag">Home</span>` : ''}</span>
            <span class="chat-list-item__preview">${this.esc(previewText)}</span>
          </div>
          <div class="chat-list-item__meta">
            ${timeText  ? `<span class="chat-list-item__time">${this.esc(timeText)}</span>` : ''}
            ${unread > 0 ? `<span class="chat-list-item__unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          </div>
        </button>`;
                }).join('');

                return `
        <div class="chat-region-group" data-region="${region}">
          <div class="chat-region-group__header">
            <span class="chat-region-group__label">${this.esc(REGION_LABELS[region] || region)}</span>
            ${isUserRegion ? '<span class="chat-region-group__yours">Your region</span>' : ''}
          </div>
          ${items}
        </div>`;
            }).join('');

        list.innerHTML = html;

        list.querySelectorAll('.chat-list-item[data-lga-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.lgaId, 10);
                if (id === this._activeLgaId) return;
                this._switchLga(id, btn.dataset.lgaName);
                // Close mobile sidebar overlay after picking a community
                this.getContentEl()?.querySelector('#chat-shell')?.classList.remove('chat-shell--sidebar-open');
            });
        });
    }

    _switchLga(lgaId, lgaName) {
        this._activeLgaId       = lgaId;
        this._messages          = [];
        this._lastRenderedDate  = null;
        this._unreadSeparatorId = null;
        this._replyTo           = null;
        this._cancelEdit();
        this._clearReply();
        const q = this.getContentEl()?.querySelector('#lga-search-input')?.value.trim().toLowerCase() || '';
        this._renderLgaList(q ? this._allPreviews.filter(l => l.name.toLowerCase().includes(q)) : this._allPreviews);
        this._updateChatHeader(lgaName);
        const ta = this.getContentEl()?.querySelector('#chat-textarea');
        if (ta) ta.placeholder = `Message ${lgaName} Community…`;
        this._loadMessages();
        this._loadOnlineCount();
    }

    _updateChatHeader(lgaName) {
        const name = lgaName || this._allPreviews.find(p => p.id === this._activeLgaId)?.name || store.currentLGA?.name || 'Community';
        const h = this.getContentEl()?.querySelector('#chat-header-name');
        if (h) h.textContent = `${name} Community`;
    }

    _bindLgaSearch() {
        const input = this.getContentEl()?.querySelector('#lga-search-input');
        if (!input) return;
        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            this._renderLgaList(q ? this._allPreviews.filter(l => l.name.toLowerCase().includes(q)) : this._allPreviews);
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // Ads sidebar
    // ══════════════════════════════════════════════════════════════════════

    async _loadSidebarAds() {
        const res = await api.adverts.getForLGA('banner');
        const ads = (!res.error && res.data?.length) ? res.data.slice(0, 5) : [];
        const mount = this.getContentEl()?.querySelector('#chat-ads-mount');
        if (!mount) return;

        const placeholder = `<div class="chat-ad-card chat-ad-card--placeholder" aria-hidden="true"><div class="chat-ad-card__img-placeholder skeleton-pulse"></div><div class="chat-ad-card__body"><div class="chat-ad-card__skel-label skeleton-pulse"></div><div class="chat-ad-card__skel-title skeleton-pulse"></div></div></div>`;

        const adCards = ads.map(ad => `
      <a class="chat-ad-card${ad.imageUrl ? '' : ' chat-ad-card--no-img'}" href="${this.esc(ad.ctaUrl || '#')}" target="_blank" rel="noopener noreferrer" data-ad-id="${ad.id}" aria-label="Sponsored: ${this.esc(ad.title)}">
        ${ad.imageUrl ? `<img class="chat-ad-card__img" src="${this.esc(ad.imageUrl)}" alt="${this.esc(ad.title)}" loading="lazy" />` : `<div class="chat-ad-card__img-placeholder" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".4"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>`}
        <div class="chat-ad-card__body"><span class="chat-ad-card__label">Sponsored</span>${ad.advertiser ? `<span class="chat-ad-card__advertiser">${this.esc(ad.advertiser)}</span>` : ''}<p class="chat-ad-card__title">${this.esc(ad.title)}</p>${ad.ctaLabel ? `<span class="chat-ad-card__cta">${this.esc(ad.ctaLabel)}</span>` : ''}</div>
      </a>`);

        mount.innerHTML = `<div class="chat-ads-stack">${[...adCards, ...Array.from({ length: Math.max(0, 3 - ads.length) }, () => placeholder)].join('')}</div>`;
        mount.addEventListener('click', e => {
            const el = e.target.closest('[data-ad-id]');
            if (el) api.adverts.recordClick(parseInt(el.dataset.adId, 10));
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // SSE
    // ══════════════════════════════════════════════════════════════════════

    _connectSSE() {
        sseClient.onMessage(rawMsg => {
            const msg = this._normalizeMessage(rawMsg);
            if (msg.userId === store.currentUser?.id) return;
            if (this._messages.some(m => m.id === msg.id)) return;

            // Update sidebar preview
            const preview = this._allPreviews.find(p => p.id === msg.lgaId);
            if (preview) {
                preview.lastMessage = { text: msg.text || msg.fileName || '', sender: msg.userName, isMe: false, createdAt: msg.createdAt };
                if (msg.lgaId !== this._activeLgaId) preview.unreadCount = (preview.unreadCount || 0) + 1;
                const q = this.getContentEl()?.querySelector('#lga-search-input')?.value.trim().toLowerCase() || '';
                this._renderLgaList(q ? this._allPreviews.filter(l => l.name.toLowerCase().includes(q)) : this._allPreviews);
            }

            if (msg.lgaId !== this._activeLgaId) return;

            this._messages.push(msg);
            this._appendMessage(msg);
            api.chat.markRead({ lgaId: this._activeLgaId });
            store.unreadChatCount = 0;
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // Data
    // ══════════════════════════════════════════════════════════════════════

    async _loadMessages() {
        const lgaId = this._activeLgaId;
        const [unreadRes, res] = await Promise.all([
            api.chat.getUnreadCount({ lgaId }),
            api.chat.getMessages({ lgaId, perPage: 100 }),
        ]);

        this.getContentEl()?.querySelector('#chat-skeleton')?.remove();
        if (res.error) {
            const body = this.getContentEl()?.querySelector('#chat-body');
            if (body) body.innerHTML = `<div class="chat-empty-state"><span class="chat-empty-state__icon">⚠️</span><p class="chat-empty-state__title">Could not load messages</p><p class="chat-empty-state__sub">Check your connection and try again.</p></div>`;
            return;
        }

        this._lastReadId = unreadRes.data?.lastReadId ?? 0;
        const unreadCount = unreadRes.data?.count ?? 0;
        this._messages = (res.data || []).map(m => this._normalizeMessage(m));

        const userId = store.currentUser?.id;
        if (unreadCount > 0 && this._lastReadId > 0) {
            const firstUnread = this._messages.find(m => m.id > this._lastReadId && m.userId !== userId);
            this._unreadSeparatorId = firstUnread?.id ?? null;
        } else if (unreadCount > 0) {
            const firstOther = this._messages.find(m => m.userId !== userId);
            this._unreadSeparatorId = firstOther?.id ?? null;
        }

        this._renderAllMessages(unreadCount);

        // Show friendly empty state when the chat has no messages yet
        if (this._messages.length === 0) {
            const lgaLabel = this._allPreviews.find(p => p.id === lgaId)?.name || store.currentLGA?.name || 'community';
            const body = this.getContentEl()?.querySelector('#chat-body');
            if (body) body.innerHTML = `<div class="chat-empty-state"><span class="chat-empty-state__icon">💬</span><p class="chat-empty-state__title">No messages yet</p><p class="chat-empty-state__sub">Be the first to say hello to the ${this.esc(lgaLabel)} community!</p></div>`;
        }

        if (this._unreadSeparatorId) {
            requestAnimationFrame(() => {
                const sep = this.getContentEl()?.querySelector('#unread-separator');
                sep ? sep.scrollIntoView({ behavior: 'smooth', block: 'start' }) : this._scrollToBottom(false);
            });
        } else {
            this._scrollToBottom(false);
        }

        await this._markAllRead();
    }

    async _markAllRead() {
        const res = await api.chat.markRead({ lgaId: this._activeLgaId });
        if (res.data) {
            store.unreadChatCount = 0;
            const preview = this._allPreviews.find(p => p.id === this._activeLgaId);
            if (preview) preview.unreadCount = 0;
            this.getContentEl()?.querySelector(`.chat-list-item[data-lga-id="${this._activeLgaId}"] .chat-list-item__unread-badge`)?.remove();
        }
    }

    _normalizeMessage(msg) {
        const mediaUrl = localizeGifUrl(msg.mediaUrl);
        const fileUrl = localizeGifUrl(msg.fileUrl);
        if (mediaUrl === msg.mediaUrl && fileUrl === msg.fileUrl) return msg;
        return { ...msg, mediaUrl, fileUrl };
    }

    async _loadOnlineCount() {
        const res = await api.chat.getOnlineCount({ lgaId: this._activeLgaId });
        const el = this.getContentEl()?.querySelector('#online-count');
        if (el && res.data) el.innerHTML = `<span class="chat-header__online-dot" aria-hidden="true"></span>${res.data.count} active members`;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════════

    _renderAllMessages(unreadCount = 0) {
        const body = this.getContentEl()?.querySelector('#chat-body');
        if (!body) return;
        body.innerHTML     = '';
        this._lastRenderedDate = null;

        for (let i = 0; i < this._messages.length; i++) {
            const msg     = this._messages[i];
            const prevMsg = i > 0 ? this._messages[i - 1] : null;

            const msgDate = new Date(msg.createdAt).toDateString();
            if (msgDate !== this._lastRenderedDate) {
                const sep = document.createElement('div');
                sep.className = 'chat-date-sep';
                sep.innerHTML = `<span>${isToday(msg.createdAt) ? 'TODAY, ' : ''}${new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}</span>`;
                body.appendChild(sep);
                this._lastRenderedDate = msgDate;
            }

            if (msg.id === this._unreadSeparatorId) {
                const usep = document.createElement('div');
                usep.className = 'chat-unread-sep';
                usep.id        = 'unread-separator';
                usep.innerHTML = `<span>${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}</span>`;
                body.appendChild(usep);
            }

            body.appendChild(this._createMessageEl(msg, prevMsg));
        }
    }

    /** Two consecutive messages are grouped if same sender, same day, within 5 min, no quoted reply. */
    _isGrouped(msg, prev) {
        if (!prev) return false;
        if (prev.userId !== msg.userId) return false;
        if (msg.replyTo) return false;
        if (new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString()) return false;
        return (new Date(msg.createdAt) - new Date(prev.createdAt)) < 5 * 60 * 1000;
    }

    _createMessageEl(msg, prevMsg = null) {
        const isOwn    = msg.userId === store.currentUser?.id;
        const grouped  = this._isGrouped(msg, prevMsg);
        const wrapper  = document.createElement('div');
        wrapper.className  = `chat-msg${isOwn ? ' chat-msg--own' : ''}${grouped ? ' chat-msg--grouped' : ''}`;
        wrapper.dataset.msgId = msg.id;

        const avatarHtml = Avatar.html({ name: msg.userName, imageUrl: msg.avatarUrl, size: 'sm' });
        const profileUrl = this._profileUrl(msg.userName);

        // Quoted reply snippet
        const replyHtml = msg.replyTo ? `
      <div class="chat-msg__reply" data-reply-id="${msg.replyTo.id}">
        <span class="chat-msg__reply-name">${this.esc(msg.replyTo.userName)}</span>
        <span class="chat-msg__reply-text">${this.esc((msg.replyTo.text || msg.replyTo.fileName || '').slice(0, 60))}${(msg.replyTo.text?.length > 60) ? '…' : ''}</span>
      </div>` : '';

        // Hover quick-react action bar (CSS positions it above the bubble on hover)
        const actionBar = `
      <div class="chat-msg__action-bar" role="toolbar" aria-label="Message actions">
        ${DEFAULT_REACTIONS.slice(0, 4).map(e => `<button class="chat-msg__action-emoji-btn" data-msg-id="${msg.id}" data-emoji="${e}" type="button" aria-label="React ${e}">${e}</button>`).join('')}
        <button class="chat-msg__action-more-btn" data-ctx-msg-id="${msg.id}" type="button" aria-label="More options">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>`;

        const avatarSlot = grouped
            ? `<div class="chat-msg__avatar--spacer"></div>`
            : `<div class="chat-msg__avatar">${!isOwn ? `<a href="${this.esc(profileUrl)}">${avatarHtml}</a>` : avatarHtml}</div>`;

        const nameSlot = (!isOwn && !grouped) ? `<a class="chat-msg__name" href="${this.esc(profileUrl)}">${this.esc(msg.userName)}</a>` : '';

        // Is this an emoji-only sticker?
        const isSticker = !msg.fileUrl && !msg.mediaUrl && isStickerText(msg.text);

        if (isSticker) {
            const timeHtml = `<span class="chat-msg__time--nobubble">${formatTime(msg.createdAt)}${isOwn ? ` <span class="chat-msg__you--dark">YOU</span>` : ''}</span>`;
            wrapper.innerHTML = `
        ${avatarSlot}
        <div class="chat-msg__content">
          ${nameSlot}
          <div class="chat-msg__nobubble">
            <span class="chat-msg__sticker">${this.esc(msg.text)}</span>
            ${timeHtml}
          </div>
          ${this._renderReactions(msg)}
          ${actionBar}
        </div>`;
        } else {
            const editedHtml = msg.edited ? ` <span class="chat-msg__edited">(edited)</span>` : '';
            const timeHtml   = `<span class="chat-msg__time">${formatTime(msg.createdAt)}${isOwn ? ` <span class="chat-msg__you">YOU</span>` : ''}${editedHtml}</span>`;
            wrapper.innerHTML = `
        ${avatarSlot}
        <div class="chat-msg__content">
          ${nameSlot}
          <div class="chat-msg__bubble${isOwn ? ' chat-msg__bubble--own' : ''}">
            ${replyHtml}
            ${this._renderMsgBody(msg, isOwn)}
            ${timeHtml}
          </div>
          ${this._renderReactions(msg)}
          ${actionBar}
        </div>`;
        }

        return wrapper;
    }

    /** Determine the best HTML representation for a message's payload. */
    _renderMsgBody(msg, isOwn) {
        const url  = msg.fileUrl || msg.mediaUrl || '';
        const name = msg.fileName || '';

        if (_isAudioFile(url, name)) {
            return `<div class="chat-msg__audio">
        <audio controls preload="none" class="chat-msg__audio-player"><source src="${this.esc(url)}" /></audio>
        <p class="chat-msg__audio-label">Voice note</p>
      </div>`;
        }

        if (_isVideoFile(url, name) && !_isAudioFile(url, name)) {
            return `<div class="chat-msg__video-wrap">
        <video class="chat-msg__video" controls preload="none" src="${this.esc(url)}"></video>
      </div>`;
        }

        // Images — also handles GIFs (they are animated images)
        const isImage = (msg.mediaUrl && !_isAudioFile(url, name) && !_isVideoFile(url, name)) ||
            (msg.fileUrl  && _isImageFile(url, name)   && !_isAudioFile(url, name) && !_isVideoFile(url, name));
        if (isImage) {
            const src       = msg.mediaUrl || msg.fileUrl;
            const isAnimGif = /\.gif($|\?)/i.test(src || '');
            return `<div class="${isAnimGif ? 'chat-msg__gif-wrap' : 'chat-msg__image-wrap'}">
        <img class="${isAnimGif ? 'chat-msg__gif' : 'chat-msg__image'}"
             src="${this.esc(src)}"
             alt="${this.esc(name || 'Image')}"
             loading="lazy"
             data-lightbox-src="${this.esc(src)}"
             data-lightbox-alt="${this.esc(name || 'Image')}" />
      </div>`;
        }

        if (url) {
            const ext = fileExtBadge(name);
            return `<a href="${this.esc(url)}" class="chat-msg__file" target="_blank" rel="noopener noreferrer" aria-label="Open ${this.esc(name || 'file')}">
        <div class="chat-msg__file-icon" aria-hidden="true">
          <span class="chat-msg__file-ext">${ext}</span>
        </div>
        <div class="chat-msg__file-info">
          <span class="chat-msg__file-name">${this.esc(name || 'File')}</span>
          ${msg.fileSize ? `<span class="chat-msg__file-size">${this.esc(msg.fileSize)}</span>` : ''}
        </div>
        ${!isOwn ? `<span class="chat-msg__file-download" data-download-url="${this.esc(url)}" data-download-name="${this.esc(name || 'file')}" role="button" tabindex="0" aria-label="Download"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>` : ''}
      </a>`;
        }

        if (msg.text) {
            return `<p class="chat-msg__text">${this.esc(msg.text)}</p>`;
        }

        return '';
    }

    _renderReactions(msg) {
        if (!msg.reactions || !Object.keys(msg.reactions).length) return '';
        const userId = store.currentUser?.id;
        const chips  = Object.entries(msg.reactions).map(([emoji, users]) => {
            const reacted = Array.isArray(users) && users.includes(userId);
            const count   = Array.isArray(users) ? users.length : 0;
            return `<button class="chat-reaction${reacted ? ' chat-reaction--active' : ''}" data-msg-id="${msg.id}" data-emoji="${emoji}" type="button" aria-label="React ${emoji}: ${count}">${emoji} <span class="chat-reaction__count">${count}</span></button>`;
        }).join('');
        return `<div class="chat-reactions-row">${chips}</div>`;
    }

    _appendMessage(msg) {
        const body    = this.getContentEl()?.querySelector('#chat-body');
        if (!body) return;
        const prevMsg = this._messages.length > 1 ? this._messages[this._messages.length - 2] : null;
        const msgDate = new Date(msg.createdAt).toDateString();

        if (msgDate !== this._lastRenderedDate) {
            const sep = document.createElement('div');
            sep.className = 'chat-date-sep';
            sep.innerHTML = `<span>${isToday(msg.createdAt) ? 'TODAY, ' : ''}${new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}</span>`;
            body.appendChild(sep);
            this._lastRenderedDate = msgDate;
        }

        const el = this._createMessageEl(msg, prevMsg);
        el.classList.add('chat-msg--entering');
        body.appendChild(el);
        this._scrollToBottom(true);
        this._updateScrollFab();
    }

    _scrollToBottom(smooth = true) {
        const body = this.getContentEl()?.querySelector('#chat-body');
        if (body) body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }

    _updateScrollFab() {
        const body = this.getContentEl()?.querySelector('#chat-body');
        const btn  = this.getContentEl()?.querySelector('#scroll-btn');
        if (!body || !btn) return;
        const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 100;
        btn.classList.toggle('chat-scroll-btn--visible', !atBottom);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Event Binding
    // ══════════════════════════════════════════════════════════════════════

    _bindEvents() {
        const el = this.getContentEl();
        if (!el) return;

        // ── Textarea ──────────────────────────────────────────────────────
        const textarea = el.querySelector('#chat-textarea');
        if (textarea) {
            this.on(textarea, 'input',   () => this._autoResizeTextarea(textarea));
            this.on(textarea, 'keydown', e  => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleSend(); }
                if (e.key === 'Escape' && this._editingMsgId) { e.preventDefault(); this._cancelEdit(); }
            });
        }

        // ── Send button ───────────────────────────────────────────────────
        const sendBtn = el.querySelector('#send-btn');
        if (sendBtn) this.on(sendBtn, 'click', () => this._handleSend());

        // ── Attach menu ───────────────────────────────────────────────────
        const attachBtn  = el.querySelector('#attach-btn');
        const attachMenu = el.querySelector('#attach-menu');
        const imageInput = el.querySelector('#image-input');
        const fileInput  = el.querySelector('#file-input');

        if (attachBtn && attachMenu) {
            this.on(attachBtn, 'click', e => {
                e.stopPropagation();
                this._attachMenuOpen = !this._attachMenuOpen;
                attachMenu.classList.toggle('chat-attach-menu--open', this._attachMenuOpen);
                attachMenu.setAttribute('aria-hidden', String(!this._attachMenuOpen));
                attachBtn.setAttribute('aria-expanded', String(this._attachMenuOpen));
            });
            attachMenu.addEventListener('click', e => {
                const item = e.target.closest('[data-attach]');
                if (!item) return;
                e.stopPropagation();
                attachMenu.classList.remove('chat-attach-menu--open');
                this._attachMenuOpen = false;
                attachBtn.setAttribute('aria-expanded', 'false');
                if (item.dataset.attach === 'image' && imageInput) imageInput.click();
                else if (item.dataset.attach === 'file' && fileInput) fileInput.click();
            });
        }
        if (imageInput) this.on(imageInput, 'change', e => this._handleFileAttach(e, true));
        if (fileInput)  this.on(fileInput,  'change', e => this._handleFileAttach(e, false));

        // ── File download ─────────────────────────────────────────────────
        this.delegate('.chat-msg__file-download', 'click', (e, span) => {
            e.preventDefault(); e.stopPropagation();
            const a = document.createElement('a');
            a.href = span.dataset.downloadUrl; a.download = span.dataset.downloadName; a.click();
        });

        // ── Image lightbox ────────────────────────────────────────────────
        this.delegate('[data-lightbox-src]', 'click', (e, img) => {
            this._openLightbox(img.dataset.lightboxSrc, img.dataset.lightboxAlt || '');
        });
        const lightbox      = el.querySelector('#chat-lightbox');
        const lightboxClose = el.querySelector('#lightbox-close');
        if (lightbox)      this.on(lightbox, 'click', e => { if (e.target === lightbox) this._closeLightbox(); });
        if (lightboxClose) this.on(lightboxClose, 'click', () => this._closeLightbox());

        // ── Scroll FAB ────────────────────────────────────────────────────
        const scrollBtn = el.querySelector('#scroll-btn');
        if (scrollBtn) this.on(scrollBtn, 'click', () => this._scrollToBottom(true));
        const chatBody = el.querySelector('#chat-body');
        if (chatBody)  this.on(chatBody, 'scroll', () => this._updateScrollFab());

        // ── Context menu (right-click) ────────────────────────────────────
        this.on(chatBody || el, 'contextmenu', e => {
            const msgEl = e.target.closest('.chat-msg');
            if (!msgEl) return;
            e.preventDefault();
            this._openContextMenu(msgEl.dataset.msgId, e.clientX, e.clientY);
        });

        if (chatBody) this._bindSwipeToReply(chatBody);

        // Hover action bar "more" button → context menu
        this.delegate('[data-ctx-msg-id]', 'click', (e, btn) => {
            e.stopPropagation();
            const rect = btn.getBoundingClientRect();
            this._openContextMenu(btn.dataset.ctxMsgId, rect.right, rect.bottom + 4);
        });

        // Hover action bar quick-react buttons
        this.delegate('.chat-msg__action-emoji-btn', 'click', (e, btn) => {
            this._handleReaction(btn.dataset.msgId, btn.dataset.emoji);
        });

        // Context menu items (copy / reply / edit / report / delete)
        this.delegate('.chat-context-menu__item', 'click', (e, btn) => this._handleContextAction(btn.dataset.action));

        // Context menu quick-react row
        this.delegate('.chat-context-menu__emoji:not(.chat-context-menu__emoji--more)', 'click', (e, btn) => {
            if (this._contextTarget) { this._handleReaction(this._contextTarget, btn.dataset.emoji); this._closeContextMenu(); }
        });

        // "+" expander on context menu
        const ctxMore = el.querySelector('#context-emoji-more');
        if (ctxMore) {
            this.on(ctxMore, 'click', e => {
                e.stopPropagation();
                const grid     = el.querySelector('#context-emoji-grid');
                const expanded = grid && !grid.hasAttribute('inert');
                if (grid) {
                    if (expanded) { grid.setAttribute('inert', ''); grid.classList.remove('chat-context-menu__emoji-grid--open'); ctxMore.setAttribute('aria-expanded', 'false'); }
                    else          { grid.removeAttribute('inert');  grid.classList.add('chat-context-menu__emoji-grid--open');    ctxMore.setAttribute('aria-expanded', 'true');  }
                }
            });
        }
        this.delegate('.chat-context-menu__emoji--grid', 'click', (e, btn) => {
            if (this._contextTarget) { this._handleReaction(this._contextTarget, btn.dataset.emoji); this._closeContextMenu(); }
        });

        // Reaction chips on messages
        this.delegate('.chat-reaction', 'click', (e, btn) => this._handleReaction(btn.dataset.msgId, btn.dataset.emoji));

        // Reply/edit bar close button
        const replyClose = el.querySelector('#reply-bar-close');
        if (replyClose) this.on(replyClose, 'click', () => { if (this._editingMsgId) this._cancelEdit(); else this._clearReply(); });

        // Click quoted reply → scroll to original message
        this.delegate('.chat-msg__reply', 'click', (e, div) => { if (div.dataset.replyId) this._scrollToMessage(div.dataset.replyId); });

        // ── Message search ────────────────────────────────────────────────
        const searchToggle = el.querySelector('#search-toggle-btn');
        const searchInput  = el.querySelector('#search-input');
        const searchClose  = el.querySelector('#search-close');
        const searchPrev   = el.querySelector('#search-prev');
        const searchNext   = el.querySelector('#search-next');
        if (searchToggle) this.on(searchToggle, 'click', () => this._openSearch());
        if (searchClose)  this.on(searchClose,  'click', () => this._closeSearch());
        if (searchInput) {
            this.on(searchInput, 'input',   () => this._runSearch(searchInput.value));
            this.on(searchInput, 'keydown', e  => {
                if (e.key === 'Enter')  { e.shiftKey ? this._searchStep(-1) : this._searchStep(1); }
                if (e.key === 'Escape') this._closeSearch();
            });
        }
        if (searchPrev) this.on(searchPrev, 'click', () => this._searchStep(-1));
        if (searchNext) this.on(searchNext, 'click', () => this._searchStep(1));

        // ── Kebab menu ────────────────────────────────────────────────────
        const kebabBtn  = el.querySelector('#kebab-btn');
        const kebabMenu = el.querySelector('#chat-kebab-menu');
        if (kebabBtn && kebabMenu) {
            this.on(kebabBtn, 'click', e => {
                e.stopPropagation();
                const open = kebabMenu.classList.toggle('chat-kebab-menu--open');
                kebabMenu.setAttribute('aria-hidden', String(!open));
                kebabBtn.setAttribute('aria-expanded', String(open));
            });
            this.delegate('.chat-kebab-menu__item', 'click', (e, btn) => {
                this._handleKebab(btn.dataset.kebab);
                kebabMenu.classList.remove('chat-kebab-menu--open');
                kebabMenu.setAttribute('aria-hidden', 'true');
            });
        }

        // ── Invite modal ──────────────────────────────────────────────────
        const inviteBtn     = el.querySelector('#invite-btn');
        const inviteBackdrop = el.querySelector('#invite-backdrop');
        const inviteClose   = el.querySelector('#invite-close');
        const inviteCancel  = el.querySelector('#invite-cancel');
        const inviteSend    = el.querySelector('#invite-send');
        const invitePhone   = el.querySelector('#invite-phone');
        if (inviteBtn)      this.on(inviteBtn,      'click',   () => this._openInviteModal());
        if (inviteClose)    this.on(inviteClose,    'click',   () => this._closeInviteModal());
        if (inviteCancel)   this.on(inviteCancel,   'click',   () => this._closeInviteModal());
        if (inviteBackdrop) this.on(inviteBackdrop, 'click',   e  => { if (e.target === inviteBackdrop) this._closeInviteModal(); });
        if (inviteSend)     this.on(inviteSend,     'click',   () => this._handleInvite());
        if (invitePhone)    this.on(invitePhone,    'keydown', e  => { if (e.key === 'Enter') this._handleInvite(); });

        // ── Report modal ──────────────────────────────────────────────────
        const reportClose    = el.querySelector('#report-close');
        const reportCancel   = el.querySelector('#report-cancel');
        const reportBackdrop = el.querySelector('#report-backdrop');
        const reportSubmit   = el.querySelector('#report-submit');
        if (reportClose)    this.on(reportClose,    'click', () => this._closeReportModal());
        if (reportCancel)   this.on(reportCancel,   'click', () => this._closeReportModal());
        if (reportBackdrop) this.on(reportBackdrop, 'click', e  => { if (e.target === reportBackdrop) this._closeReportModal(); });
        if (reportSubmit)   this.on(reportSubmit,   'click', () => this._handleReport());
        this.delegate('.chat-report-reason', 'click', (e, btn) => {
            this._reportReason = btn.dataset.reason;
            el.querySelectorAll('.chat-report-reason').forEach(b => b.classList.remove('chat-report-reason--active'));
            btn.classList.add('chat-report-reason--active');
            const sub = el.querySelector('#report-submit');
            if (sub) sub.disabled = false;
        });

        // ── Members modal ─────────────────────────────────────────────────
        const membersClose    = el.querySelector('#members-close');
        const membersBackdrop = el.querySelector('#members-backdrop');
        if (membersClose)    this.on(membersClose,    'click', () => this._closeMembersModal());
        if (membersBackdrop) this.on(membersBackdrop, 'click', e  => { if (e.target === membersBackdrop) this._closeMembersModal(); });

        // ── Voice notes ───────────────────────────────────────────────────
        if (this._hasVoiceNotes) {
            const voiceBtn    = el.querySelector('#voice-btn');
            const voiceCancel = el.querySelector('#voice-cancel');
            const voiceSend   = el.querySelector('#voice-send');
            if (voiceBtn)    this.on(voiceBtn,    'click', () => this._startVoiceNote());
            if (voiceCancel) this.on(voiceCancel, 'click', () => this._cancelVoiceNote());
            if (voiceSend)   this.on(voiceSend,   'click', () => this._stopVoiceNote(true));
        }

        // ── Global click — close all floating menus ───────────────────────
        this.on(document, 'click', () => {
            this._closeContextMenu();
            this._closeEmojiPanel();
            if (attachMenu) { attachMenu.classList.remove('chat-attach-menu--open'); attachMenu.setAttribute('aria-hidden', 'true'); attachBtn?.setAttribute('aria-expanded', 'false'); this._attachMenuOpen = false; }
            if (kebabMenu)  { kebabMenu.classList.remove('chat-kebab-menu--open');   kebabMenu.setAttribute('aria-hidden', 'true');  kebabBtn?.setAttribute('aria-expanded', 'false'); }
        });

        // ── ESC key ───────────────────────────────────────────────────────
        this.on(document, 'keydown', e => {
            if (e.key !== 'Escape') return;
            if (this.getContentEl()?.querySelector('#chat-lightbox.chat-lightbox--open')) { this._closeLightbox(); return; }
            if (this._emojiPanelOpen) this._closeEmojiPanel();
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // Emoji Panel — Fixed (direct listener, avoids stopPropagation issue)
    // ══════════════════════════════════════════════════════════════════════

    _bindEmojiPanel() {
        const el       = this.getContentEl();
        if (!el) return;
        const emojiBtn = el.querySelector('#emoji-btn');
        const panel    = el.querySelector('#chat-emoji-panel');
        const textarea = el.querySelector('#chat-textarea');
        if (!emojiBtn || !panel) return;

        // Toggle open/close
        emojiBtn.addEventListener('click', e => {
            e.stopPropagation();
            this._emojiPanelOpen = !this._emojiPanelOpen;
            if (this._emojiPanelOpen) {
                const rect = emojiBtn.getBoundingClientRect();
                panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
                panel.style.right  = `${window.innerWidth  - rect.right}px`;
                panel.style.left   = 'auto';
            }
            panel.classList.toggle('chat-emoji-panel--open', this._emojiPanelOpen);
            panel.setAttribute('aria-hidden', String(!this._emojiPanelOpen));
            emojiBtn.setAttribute('aria-expanded', String(this._emojiPanelOpen));
            if (this._emojiPanelOpen) setTimeout(() => el.querySelector('#emoji-panel-search')?.focus(), 60);
        });

        // *** Single listener on the panel handles ALL internal clicks ***
        // This avoids the stopPropagation/delegate conflict that broke emoji insertion.
        panel.addEventListener('click', e => {
            e.stopPropagation(); // keep panel open on internal clicks

            // Tab switch
            const tab = e.target.closest('[data-tab]');
            if (tab) { this._switchEmojiTab(tab.dataset.tab, el, panel); return; }

            // Category button
            const catBtn = e.target.closest('[data-cat]');
            if (catBtn) { this._switchEmojiCategory(catBtn.dataset.cat, el); return; }

            // Emoji item → insert into textarea
            const emojiItem = e.target.closest('[data-emoji]:not(.chat-context-menu__emoji)');
            if (emojiItem) {
                const emoji = emojiItem.dataset.emoji;
                if (textarea) {
                    const start = textarea.selectionStart ?? textarea.value.length;
                    const end   = textarea.selectionEnd   ?? start;
                    const val   = textarea.value;
                    textarea.value = val.slice(0, start) + emoji + val.slice(end);
                    const newPos   = start + [...emoji].length;
                    textarea.selectionStart = textarea.selectionEnd = newPos;
                    textarea.focus();
                    this._autoResizeTextarea(textarea);
                }
                this._closeEmojiPanel();
                return;
            }

            // Sticker item → send as a text message (renders large)
            const stickerItem = e.target.closest('[data-sticker]');
            if (stickerItem) { this._sendSticker(stickerItem.dataset.sticker); this._closeEmojiPanel(); return; }

            // GIF item → send as media message
            const gifItem = e.target.closest('[data-gif-url]');
            if (gifItem && !gifItem.classList.contains('chat-gif-item--unavailable')) {
                this._sendGif(gifItem.dataset.gifUrl, gifItem.dataset.gifLabel || 'GIF');
                this._closeEmojiPanel();
                return;
            }
        });
        this._bindGifImageErrors(el.querySelector('#chat-gif-grid'));

        // Emoji search
        const searchInput = el.querySelector('#emoji-panel-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._emojiSearchQuery = searchInput.value.trim().toLowerCase();
                this._updateEmojiGrid(el);
            });
            // prevent Enter in search from accidentally sending the chat message
            searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') e.stopPropagation(); });
        }

        const gifSearch = el.querySelector('#gif-panel-search');
        if (gifSearch) {
            gifSearch.addEventListener('input', () => {
                this._gifSearchQuery = gifSearch.value.trim().toLowerCase();
                this._updateGifGrid(el);
            });
            gifSearch.addEventListener('keydown', e => { if (e.key === 'Enter') e.stopPropagation(); });
        }
    }

    _switchEmojiTab(tabId, el, panel) {
        this._activeEmojiTab = tabId;
        const p = panel || el?.querySelector('#chat-emoji-panel');
        if (!p) return;
        p.querySelectorAll('[data-tab]').forEach(t => {
            const active = t.dataset.tab === tabId;
            t.classList.toggle('chat-emoji-panel__tab--active', active);
            t.setAttribute('aria-selected', String(active));
        });
        const sectionMap = { emoji: '#ep-emoji', sticker: '#ep-sticker', gif: '#ep-gif' };
        Object.entries(sectionMap).forEach(([id, sel]) => {
            p.querySelector(sel)?.classList.toggle('chat-emoji-panel__section--hidden', id !== tabId);
        });
    }

    _switchEmojiCategory(catId, el) {
        this._emojiCategory    = catId;
        this._emojiSearchQuery = '';
        const searchInput = el?.querySelector('#emoji-panel-search');
        if (searchInput) searchInput.value = '';
        el?.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('chat-emoji-panel__cat-btn--active', b.dataset.cat === catId));
        const cat   = EMOJI_CATEGORIES.find(c => c.id === catId);
        const label = el?.querySelector('#ep-cat-label');
        if (cat && label) label.textContent = cat.name;
        this._updateEmojiGrid(el);
    }

    _updateEmojiGrid(el) {
        const grid = el?.querySelector('#ep-grid');
        if (!grid) return;
        const cat   = EMOJI_CATEGORIES.find(c => c.id === this._emojiCategory) || EMOJI_CATEGORIES[0];
        let emojis;
        if (this._emojiSearchQuery) {
            const q = this._emojiSearchQuery;
            const matchCats = EMOJI_CATEGORIES.filter(c => c.name.toLowerCase().includes(q));
            emojis = matchCats.length ? matchCats.flatMap(c => c.emojis) : EMOJI_CATEGORIES.flatMap(c => c.emojis);
        } else {
            emojis = cat.emojis;
        }
        grid.innerHTML = this._renderEmojiButtons(emojis.slice(0, 80));
        const label = el?.querySelector('#ep-cat-label');
        if (label) label.textContent = this._emojiSearchQuery ? `Results for "${this._emojiSearchQuery}"` : cat.name;
    }

    _updateGifGrid(el) {
        const grid = el?.querySelector('#chat-gif-grid');
        if (!grid) return;
        const query = this._gifSearchQuery;
        const gifs = query
            ? CURATED_GIFS.filter(g => `${g.alt} ${g.label}`.toLowerCase().includes(query))
            : CURATED_GIFS;
        grid.innerHTML = gifs.length
            ? gifs.map(g => `
                <button class="chat-gif-item" data-gif-url="${g.url}" data-gif-label="${this.esc(g.label)}"
                  type="button" aria-label="${this.esc(g.label)}">
                  <img src="${g.url}" alt="${this.esc(g.emoji)}" loading="lazy" />
                  <span class="chat-gif-item__label">${this.esc(g.label)}</span>
                </button>`).join('')
            : '<p class="chat-gif-empty">No matching GIFs. Try “laugh”, “party”, or “wow”.</p>';
        this._bindGifImageErrors(grid);
    }

    _bindGifImageErrors(grid) {
        if (!grid) return;
        grid.querySelectorAll('.chat-gif-item img').forEach((image) => {
            image.addEventListener('error', () => {
                const item = image.closest('.chat-gif-item');
                item?.classList.add('chat-gif-item--unavailable');
                image.style.display = 'none';
                image.nextElementSibling?.style.setProperty('display', 'flex');
            }, { once: true });
        });
    }

    _closeEmojiPanel() {
        const el       = this.getContentEl();
        const panel    = el?.querySelector('#chat-emoji-panel');
        const emojiBtn = el?.querySelector('#emoji-btn');
        if (panel)    { panel.classList.remove('chat-emoji-panel--open'); panel.setAttribute('aria-hidden', 'true'); }
        if (emojiBtn) emojiBtn.setAttribute('aria-expanded', 'false');
        this._emojiPanelOpen = false;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Send / Edit
    // ══════════════════════════════════════════════════════════════════════

    async _handleSend() {
        const el       = this.getContentEl();
        const textarea = el?.querySelector('#chat-textarea');
        const text     = textarea?.value.trim();
        if (!text || this._sending) return;

        // Edit mode: update existing message instead of posting a new one
        if (this._editingMsgId) { await this._doEditMessage(text); return; }

        this._sending = true;
        try {
            const replyTo    = this._replyTo;
            const optimistic = {
                id:         Date.now(),
                lgaId:      this._activeLgaId,
                userId:     store.currentUser?.id,
                userName:   store.currentUser?.username || store.currentUser?.name,
                avatarUrl:  store.currentUser?.avatarUrl,
                text, mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
                reactions: {}, replyTo, createdAt: new Date().toISOString(), _pending: true,
            };
            textarea.value = '';
            this._autoResizeTextarea(textarea);
            this._clearReply();
            this._appendMessage(optimistic);
            this._messages.push(optimistic);

            const res       = await api.chat.sendMessage({ lgaId: this._activeLgaId, text, replyTo });
            const pendingEl = el?.querySelector(`.chat-msg[data-msg-id="${optimistic.id}"]`);

            if (res.error) {
                pendingEl?.classList.add('chat-msg--failed');
                const msg = res.error.code === 'FEATURE_DISABLED' ? 'Community chat has been disabled by the administrator.'
                    : res.error.code === 'PROFANITY' ? res.error.message : 'Message failed to send.';
                showToast('error', msg);
                return;
            }

            if (pendingEl) {
                const prevIdx = this._messages.findIndex(m => m.id === optimistic.id);
                pendingEl.replaceWith(this._createMessageEl(res.data, prevIdx > 0 ? this._messages[prevIdx - 1] : null));
            }
            const idx = this._messages.findIndex(m => m.id === optimistic.id);
            if (idx > -1) this._messages[idx] = res.data;
        } finally {
            this._sending = false;
        }
    }

    /** Enter edit mode for a message. Populates the textarea and shows the edit indicator. */
    _startEdit(msgId) {
        const msg = this._messages.find(m => String(m.id) === String(msgId));
        if (!msg || !msg.text) return;
        this._editingMsgId    = msgId;
        this._editingOrigText = msg.text;

        const el       = this.getContentEl();
        const textarea = el?.querySelector('#chat-textarea');
        const bar      = el?.querySelector('#chat-reply-bar');
        const content  = el?.querySelector('#reply-bar-content');

        if (textarea) {
            textarea.value = msg.text;
            this._autoResizeTextarea(textarea);
            setTimeout(() => { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = textarea.value.length; }, 50);
        }
        if (bar && content) {
            bar.classList.add('chat-reply-bar--open', 'chat-reply-bar--editing');
            bar.setAttribute('aria-hidden', 'false');
            content.innerHTML = `<span class="chat-reply-bar__name">✏️ Editing</span><span class="chat-reply-bar__text">${this.esc(msg.text.slice(0, 80))}</span>`;
        }
    }

    /** Cancel edit mode and restore the input bar. */
    _cancelEdit() {
        this._editingMsgId    = null;
        this._editingOrigText = null;
        const el       = this.getContentEl();
        const textarea = el?.querySelector('#chat-textarea');
        const bar      = el?.querySelector('#chat-reply-bar');
        if (textarea) { textarea.value = ''; this._autoResizeTextarea(textarea); }
        if (bar) { bar.classList.remove('chat-reply-bar--open', 'chat-reply-bar--editing'); bar.setAttribute('aria-hidden', 'true'); }
    }

    /** Commit an edit via PATCH /chat/messages/:id. */
    async _doEditMessage(text) {
        const msgId   = this._editingMsgId;
        this._sending = true;
        try {
            const res = await api.chat.editMessage(msgId, text);
            if (res.error) { showToast('error', res.error.message || 'Could not edit message.'); return; }

            const msg = this._messages.find(m => String(m.id) === String(msgId));
            if (msg) { msg.text = text; msg.edited = true; }

            const el     = this.getContentEl();
            const msgEl  = el?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
            if (msgEl && msg) {
                const prevIdx = this._messages.findIndex(m => String(m.id) === String(msgId));
                msgEl.replaceWith(this._createMessageEl(msg, prevIdx > 0 ? this._messages[prevIdx - 1] : null));
            }
            this._cancelEdit();
            showToast('success', 'Message updated.');
        } finally {
            this._sending = false;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // File Upload
    // ══════════════════════════════════════════════════════════════════════

    async _handleFileAttach(e, isImageUpload = false) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (file.size > 20 * 1024 * 1024) { showToast('error', 'File must be under 20 MB.'); return; }

        const sizeMB   = (file.size / 1024 / 1024).toFixed(1);
        const blobUrl  = URL.createObjectURL(file);
        this._objectURLs.add(blobUrl);

        const isImg     = isImageUpload || _isImageFile(blobUrl, file.name);
        const optimistic = {
            id: Date.now(), lgaId: this._activeLgaId,
            userId: store.currentUser?.id,
            userName: store.currentUser?.username || store.currentUser?.name,
            avatarUrl: store.currentUser?.avatarUrl,
            text: null, mediaUrl: isImg ? blobUrl : null, fileUrl: blobUrl,
            fileName: file.name, fileSize: `${sizeMB} MB`,
            reactions: {}, replyTo: null, createdAt: new Date().toISOString(), _pending: true,
        };
        this._appendMessage(optimistic);
        this._messages.push(optimistic);

        const uploadRes = await api.chat.uploadFile(file);
        const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimistic.id}"]`);
        URL.revokeObjectURL(blobUrl);
        this._objectURLs.delete(blobUrl);

        if (uploadRes.error) {
            pendingEl?.classList.add('chat-msg--failed');
            showToast('error', 'File upload failed.'); return;
        }

        const { url, fileName: uploadedName, isImage: serverIsImage } = uploadRes.data;
        const useAsImage = serverIsImage || isImg;

        const msgRes = await api.chat.sendMessage({
            lgaId:    this._activeLgaId,
            fileUrl:  url,
            fileName: uploadedName || file.name,
            fileSize: `${sizeMB} MB`,
            mediaUrl: useAsImage ? url : null,
        });

        if (msgRes.error) { pendingEl?.classList.add('chat-msg--failed'); showToast('error', 'Failed to send file.'); return; }

        if (pendingEl) {
            const prevIdx = this._messages.findIndex(m => m.id === optimistic.id);
            pendingEl.replaceWith(this._createMessageEl(msgRes.data, prevIdx > 0 ? this._messages[prevIdx - 1] : null));
        }
        const idx = this._messages.findIndex(m => m.id === optimistic.id);
        if (idx > -1) this._messages[idx] = msgRes.data;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Sticker & GIF
    // ══════════════════════════════════════════════════════════════════════

    /** Send a sticker emoji as a regular text message (renderer detects it and shows it large). */
    async _sendSticker(emoji) {
        if (this._sending) return;
        this._sending = true;
        try {
            const optimistic = {
                id: Date.now(), lgaId: this._activeLgaId,
                userId: store.currentUser?.id, userName: store.currentUser?.username || store.currentUser?.name,
                avatarUrl: store.currentUser?.avatarUrl, text: emoji,
                mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
                reactions: {}, replyTo: this._replyTo, createdAt: new Date().toISOString(), _pending: true,
            };
            this._clearReply();
            this._appendMessage(optimistic);
            this._messages.push(optimistic);

            const res       = await api.chat.sendMessage({ lgaId: this._activeLgaId, text: emoji, replyTo: optimistic.replyTo });
            const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimistic.id}"]`);
            if (res.error) { pendingEl?.classList.add('chat-msg--failed'); showToast('error', 'Failed to send.'); return; }
            if (pendingEl) {
                const prevIdx = this._messages.findIndex(m => m.id === optimistic.id);
                pendingEl.replaceWith(this._createMessageEl(res.data, prevIdx > 0 ? this._messages[prevIdx - 1] : null));
            }
            const idx = this._messages.findIndex(m => m.id === optimistic.id);
            if (idx > -1) this._messages[idx] = res.data;
        } finally { this._sending = false; }
    }

    /** Send a curated GIF — stored as a mediaUrl so it renders inline and animated. */
    async _sendGif(gifUrl, gifAlt) {
        if (this._sending) return;
        this._sending = true;
        try {
            const optimistic = {
                id: Date.now(), lgaId: this._activeLgaId,
                userId: store.currentUser?.id, userName: store.currentUser?.username || store.currentUser?.name,
                avatarUrl: store.currentUser?.avatarUrl, text: null,
                mediaUrl: gifUrl, fileUrl: gifUrl, fileName: `${gifAlt || 'gif'}.gif`, fileSize: null,
                reactions: {}, replyTo: this._replyTo, createdAt: new Date().toISOString(), _pending: true,
            };
            this._clearReply();
            this._appendMessage(optimistic);
            this._messages.push(optimistic);

            const res       = await api.chat.sendMessage({ lgaId: this._activeLgaId, mediaUrl: gifUrl, fileUrl: gifUrl, fileName: optimistic.fileName, replyTo: optimistic.replyTo });
            const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimistic.id}"]`);
            if (res.error) { pendingEl?.classList.add('chat-msg--failed'); showToast('error', 'Failed to send GIF.'); return; }
            if (pendingEl) {
                const prevIdx = this._messages.findIndex(m => m.id === optimistic.id);
                pendingEl.replaceWith(this._createMessageEl(res.data, prevIdx > 0 ? this._messages[prevIdx - 1] : null));
            }
            const idx = this._messages.findIndex(m => m.id === optimistic.id);
            if (idx > -1) this._messages[idx] = res.data;
        } finally { this._sending = false; }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Reactions
    // ══════════════════════════════════════════════════════════════════════

    async _handleReaction(msgId, emoji) {
        const res = await api.chat.toggleReaction(msgId, emoji);
        if (res.error) { showToast('error', 'Could not add reaction.'); return; }

        const msg = this._messages.find(m => String(m.id) === String(msgId));
        if (msg) msg.reactions = res.data.reactions;

        const msgEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
        if (msgEl) {
            const existing = msgEl.querySelector('.chat-reactions-row');
            const updated  = this._messages.find(m => String(m.id) === String(msgId));
            const newHtml  = this._renderReactions(updated);
            if (existing) existing.outerHTML = newHtml || '';
            else if (newHtml) msgEl.querySelector('.chat-msg__content')?.insertAdjacentHTML('beforeend', newHtml);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Context Menu
    // ══════════════════════════════════════════════════════════════════════

    _openContextMenu(msgId, x, y) {
        this._contextTarget = msgId;
        const el   = this.getContentEl();
        const menu = el?.querySelector('#chat-context-menu');
        if (!menu) return;

        const msg   = this._messages.find(m => String(m.id) === String(msgId));
        const isOwn = msg && msg.userId === store.currentUser?.id;

        // Toggle danger button: Report ↔ Delete
        const dangerBtn = menu.querySelector('#ctx-danger-btn');
        if (dangerBtn) {
            if (isOwn) {
                dangerBtn.dataset.action = 'delete';
                dangerBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete`;
            } else {
                dangerBtn.dataset.action = 'report';
                dangerBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Report`;
            }
        }

        // Show Edit only for own plain-text messages
        const editBtn  = menu.querySelector('#ctx-edit-btn');
        if (editBtn) {
            const canEdit = isOwn && msg.text && !msg.fileUrl && !msg.mediaUrl;
            editBtn.style.display = canEdit ? '' : 'none';
        }

        menu.classList.add('chat-context-menu--open');
        menu.removeAttribute('inert');
        const vw = window.innerWidth, vh = window.innerHeight;
        menu.style.setProperty('--ctx-x', `${Math.min(x, vw - 220)}px`);
        menu.style.setProperty('--ctx-y', `${Math.min(y, vh - 280)}px`);
    }

    _closeContextMenu() {
        const el   = this.getContentEl();
        const menu = el?.querySelector('#chat-context-menu');
        if (menu) { menu.classList.remove('chat-context-menu--open'); menu.setAttribute('inert', ''); }
        const grid    = el?.querySelector('#context-emoji-grid');
        const ctxMore = el?.querySelector('#context-emoji-more');
        if (grid)    { grid.setAttribute('inert', ''); grid.classList.remove('chat-context-menu__emoji-grid--open'); }
        if (ctxMore) ctxMore.setAttribute('aria-expanded', 'false');
        this._contextTarget = null;
    }

    /**
     * Swipe a message to the right to reply to it.
     *
     * On a phone the only way to reply was a long press to open the context
     * menu and then a tap — two deliberate steps for the single most common
     * action in a group chat. Swiping is what people already try, because it
     * is what every other messaging app does.
     *
     * Bound once to the scroll container rather than to each message: the list
     * repaints on every incoming message, and per-message listeners would be
     * re-attached constantly and leak.
     *
     * The hard part is not stealing vertical scrolling. A gesture only becomes
     * a swipe once it has travelled further horizontally than vertically and
     * cleared a small deadzone; until then the browser keeps the touch and
     * scrolling behaves normally. Once claimed, it stays claimed for that
     * gesture, so a slightly diagonal drag does not flip back and forth.
     */
    _bindSwipeToReply(chatBody) {
        const DEADZONE  = 12;    // px before a gesture is judged at all
        const THRESHOLD = 64;    // px of travel that commits to a reply
        const MAX_PULL  = 88;    // px the bubble can move, for resistance

        let msgEl = null, startX = 0, startY = 0, dx = 0;
        let claimed = false, rejected = false;

        const reset = (animate) => {
            if (msgEl) {
                if (animate) msgEl.classList.add('chat-msg--swipe-return');
                msgEl.style.removeProperty('transform');
                msgEl.classList.remove('chat-msg--swiping', 'chat-msg--swipe-ready');
                const el = msgEl;
                if (animate) setTimeout(() => el.classList.remove('chat-msg--swipe-return'), 200);
            }
            msgEl = null; claimed = false; rejected = false; dx = 0;
        };

        this.on(chatBody, 'touchstart', (e) => {
            if (e.touches.length !== 1) return;
            reset(false);

            const target = e.target.closest('.chat-msg');
            // Not on a message, or on something the touch belongs to already.
            if (!target || e.target.closest('a, button, input, textarea, video, audio')) return;

            msgEl  = target;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        this.on(chatBody, 'touchmove', (e) => {
            if (!msgEl || rejected || e.touches.length !== 1) return;

            dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;

            if (!claimed) {
                if (Math.abs(dx) < DEADZONE && Math.abs(dy) < DEADZONE) return;

                // Mostly vertical, or a leftward drag: this is a scroll, not a
                // reply. Bow out for the rest of the gesture.
                if (Math.abs(dy) >= Math.abs(dx) || dx <= 0) { rejected = true; return; }

                claimed = true;
                msgEl.classList.add('chat-msg--swiping');
            }

            // Resistance past the commit point, so the bubble cannot be
            // dragged across the screen and the threshold is felt.
            const pull = dx > THRESHOLD
                ? THRESHOLD + Math.min((dx - THRESHOLD) * 0.35, MAX_PULL - THRESHOLD)
                : dx;

            msgEl.style.transform = `translateX(${pull}px)`;
            msgEl.classList.toggle('chat-msg--swipe-ready', dx >= THRESHOLD);

            // Only now stop the page scrolling — never before the gesture is
            // known to be horizontal.
            if (e.cancelable) e.preventDefault();
        }, { passive: false });

        const finish = () => {
            if (msgEl && claimed && dx >= THRESHOLD) {
                const msg = this._messages.find(m => String(m.id) === String(msgEl.dataset.msgId));
                if (msg) {
                    this._setReply(msg);
                    // A short tick confirms the gesture landed without the
                    // person having to look away from where their thumb is.
                    navigator.vibrate?.(12);
                }
            }
            reset(true);
        };

        this.on(chatBody, 'touchend',    finish, { passive: true });
        this.on(chatBody, 'touchcancel', () => reset(true), { passive: true });
    }

    _handleContextAction(action) {
        const msg = this._messages.find(m => String(m.id) === String(this._contextTarget));
        this._closeContextMenu();
        if (!msg) return;
        if      (action === 'copy')   navigator.clipboard?.writeText(msg.text || msg.fileName || '').then(() => showToast('success', 'Copied to clipboard.'));
        else if (action === 'reply')  this._setReply(msg);
        else if (action === 'edit')   this._startEdit(msg.id);
        else if (action === 'report') this._openReportModal(msg.id);
        else if (action === 'delete') this._deleteMessage(msg.id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Delete
    // ══════════════════════════════════════════════════════════════════════

    async _deleteMessage(msgId) {
        const msgEl = this.getContentEl()?.querySelector(`[data-msg-id="${msgId}"]`);
        if (msgEl) {
            msgEl.classList.add('chat-msg--deleting');
            await new Promise(r => setTimeout(r, 230));
        }
        const res = await api.chat.deleteMessage(msgId);
        if (res.error) {
            msgEl?.classList.remove('chat-msg--deleting');
            showToast('error', res.error.message || 'Could not delete message.'); return;
        }
        this._messages = this._messages.filter(m => String(m.id) !== String(msgId));
        msgEl?.remove();
        showToast('success', 'Message deleted.');
    }

    // ══════════════════════════════════════════════════════════════════════
    // Report modal
    // ══════════════════════════════════════════════════════════════════════

    _openReportModal(msgId) {
        this._reportMsgId = msgId; this._reportReason = null;
        const el = this.getContentEl();
        el?.querySelectorAll('.chat-report-reason').forEach(b => b.classList.remove('chat-report-reason--active'));
        const sub = el?.querySelector('#report-submit'); if (sub) sub.disabled = true;
        const err = el?.querySelector('#report-error');  if (err) err.textContent = '';
        const bd  = el?.querySelector('#report-backdrop');
        if (bd) { bd.classList.add('chat-modal-backdrop--open'); bd.setAttribute('aria-hidden', 'false'); }
    }

    _closeReportModal() {
        this._reportMsgId = null; this._reportReason = null;
        const bd = this.getContentEl()?.querySelector('#report-backdrop');
        if (bd) { bd.classList.remove('chat-modal-backdrop--open'); bd.setAttribute('aria-hidden', 'true'); }
    }

    async _handleReport() {
        if (!this._reportMsgId || !this._reportReason) return;
        const el       = this.getContentEl();
        const submitBtn = el?.querySelector('#report-submit');
        const errEl    = el?.querySelector('#report-error');
        if (submitBtn) submitBtn.textContent = 'Submitting…';
        const res = await api.chat.reportMessage(this._reportMsgId, this._reportReason);
        if (submitBtn) submitBtn.textContent = 'Submit Report';
        if (res.error) { if (errEl) errEl.textContent = res.error.message || 'Could not submit report.'; return; }
        this._closeReportModal();
        showToast('success', 'Message reported. Thank you.');
    }

    // ══════════════════════════════════════════════════════════════════════
    // Reply bar
    // ══════════════════════════════════════════════════════════════════════

    _setReply(msg) {
        if (this._editingMsgId) return; // don't enter reply during edit
        this._replyTo = { id: msg.id, userName: msg.userName, text: msg.text || msg.fileName || '' };
        const el      = this.getContentEl();
        const bar     = el?.querySelector('#chat-reply-bar');
        const content = el?.querySelector('#reply-bar-content');
        if (bar && content) {
            bar.classList.remove('chat-reply-bar--editing');
            bar.classList.add('chat-reply-bar--open');
            bar.setAttribute('aria-hidden', 'false');
            content.innerHTML = `<span class="chat-reply-bar__name">${this.esc(msg.userName)}</span><span class="chat-reply-bar__text">${this.esc((msg.text || msg.fileName || '').slice(0, 80))}</span>`;
        }
        el?.querySelector('#chat-textarea')?.focus();
    }

    _clearReply() {
        this._replyTo = null;
        const bar = this.getContentEl()?.querySelector('#chat-reply-bar');
        if (bar && !this._editingMsgId) { bar.classList.remove('chat-reply-bar--open'); bar.setAttribute('aria-hidden', 'true'); }
    }

    _scrollToMessage(msgId) {
        const el = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('chat-msg--highlight'); setTimeout(() => el.classList.remove('chat-msg--highlight'), 1500); }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Lightbox
    // ══════════════════════════════════════════════════════════════════════

    _openLightbox(src, alt) {
        const el  = this.getContentEl();
        const lb  = el?.querySelector('#chat-lightbox');
        const img = el?.querySelector('#lightbox-img');
        if (!lb || !img) return;
        img.src = src; img.alt = alt || '';
        lb.classList.add('chat-lightbox--open');
        lb.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    _closeLightbox() {
        const lb = this.getContentEl()?.querySelector('#chat-lightbox');
        if (!lb) return;
        lb.classList.remove('chat-lightbox--open');
        lb.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        setTimeout(() => { const img = lb.querySelector('#lightbox-img'); if (img) img.src = ''; }, 300);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Search
    // ══════════════════════════════════════════════════════════════════════

    _openSearch() {
        this._searchActive = true;
        const el  = this.getContentEl();
        const bar = el?.querySelector('#chat-search-bar');
        if (bar) { bar.classList.add('chat-search-bar--open'); bar.setAttribute('aria-hidden', 'false'); }
        setTimeout(() => el?.querySelector('#search-input')?.focus(), 100);
    }

    _closeSearch() {
        this._searchActive = false;
        this._clearSearchHighlights();
        const el    = this.getContentEl();
        const bar   = el?.querySelector('#chat-search-bar');
        const input = el?.querySelector('#search-input');
        if (bar)   { bar.classList.remove('chat-search-bar--open'); bar.setAttribute('aria-hidden', 'true'); }
        if (input) input.value = '';
        this._searchMatches = []; this._searchQuery = '';
        this._updateSearchNav();
    }

    _runSearch(query) {
        this._clearSearchHighlights();
        this._searchQuery   = query.trim().toLowerCase();
        this._searchMatches = []; this._searchIdx = 0;
        if (!this._searchQuery) { this._updateSearchNav(); return; }
        this.getContentEl()?.querySelector('#chat-body')?.querySelectorAll('.chat-msg').forEach(msgEl => {
            const text = msgEl.querySelector('.chat-msg__text')?.textContent.toLowerCase() || '';
            if (text.includes(this._searchQuery)) { msgEl.classList.add('chat-msg--search-match'); this._searchMatches.push(Number(msgEl.dataset.msgId)); }
        });
        if (this._searchMatches.length) this._searchStep(0, true);
        this._updateSearchNav();
    }

    _searchStep(delta, init = false) {
        if (!this._searchMatches.length) return;
        if (!init) this._searchIdx = (this._searchIdx + delta + this._searchMatches.length) % this._searchMatches.length;
        this._scrollToMessage(this._searchMatches[this._searchIdx]);
        this._updateSearchNav();
    }

    _clearSearchHighlights() {
        this.getContentEl()?.querySelectorAll('.chat-msg--search-match').forEach(el => el.classList.remove('chat-msg--search-match'));
    }

    _updateSearchNav() {
        const el    = this.getContentEl();
        const nav   = el?.querySelector('#search-nav');
        const prev  = el?.querySelector('#search-prev');
        const next  = el?.querySelector('#search-next');
        const total = this._searchMatches.length;
        if (nav)  nav.textContent = total ? `${this._searchIdx + 1} / ${total}` : (this._searchQuery ? '0 results' : '');
        if (prev) prev.disabled = total < 2;
        if (next) next.disabled = total < 2;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Kebab
    // ══════════════════════════════════════════════════════════════════════

    _handleKebab(action) {
        if (action === 'mute') {
            this._notifsMuted = !this._notifsMuted;
            const muteLabel = this.getContentEl()?.querySelector('#chat-mute-label');
            if (muteLabel) muteLabel.textContent = this._notifsMuted ? t('chat.unmuteNotifications') : t('chat.muteNotifications');
            showToast('success', this._notifsMuted ? t('chat.notifsMuted') : t('chat.notifsUnmuted'));
        }
        else if (action === 'members') this._openMembersModal();
        else if (action === 'clear') {
            const body = this.getContentEl()?.querySelector('#chat-body');
            if (body) body.innerHTML = '';
            this._messages = []; this._lastRenderedDate = null;
            for (const url of this._objectURLs) URL.revokeObjectURL(url);
            this._objectURLs.clear();
            showToast('success', t('chat.chatCleared'));
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Invite modal
    // ══════════════════════════════════════════════════════════════════════

    _openInviteModal() {
        const bd = this.getContentEl()?.querySelector('#invite-backdrop');
        if (bd) { bd.classList.add('chat-modal-backdrop--open'); bd.setAttribute('aria-hidden', 'false'); }
        setTimeout(() => this.getContentEl()?.querySelector('#invite-phone')?.focus(), 100);
    }

    _closeInviteModal() {
        const el = this.getContentEl();
        const bd = el?.querySelector('#invite-backdrop');
        if (bd)  { bd.classList.remove('chat-modal-backdrop--open'); bd.setAttribute('aria-hidden', 'true'); }
        const ph = el?.querySelector('#invite-phone'); if (ph) ph.value = '';
        const er = el?.querySelector('#invite-error'); if (er) er.textContent = '';
    }

    async _handleInvite() {
        const el      = this.getContentEl();
        const phoneEl = el?.querySelector('#invite-phone');
        const errEl   = el?.querySelector('#invite-error');
        const sendBtn = el?.querySelector('#invite-send');
        const phone   = phoneEl?.value.trim();
        if (!phone) { if (errEl) errEl.textContent = 'Please enter a phone number.'; return; }
        if (errEl)  errEl.textContent = '';
        if (sendBtn) sendBtn.textContent = 'Sending…';
        const res = await api.chat.inviteMember(phone);
        if (sendBtn) sendBtn.textContent = 'Send Invite';
        if (res.error) { if (errEl) errEl.textContent = res.error.message; return; }
        this._closeInviteModal();
        showToast('success', 'Invite sent!');
    }

    // ══════════════════════════════════════════════════════════════════════
    // Members modal
    // ══════════════════════════════════════════════════════════════════════

    async _openMembersModal() {
        const el = this.getContentEl();
        const bd = el?.querySelector('#members-backdrop');
        if (bd) { bd.classList.add('chat-modal-backdrop--open'); bd.setAttribute('aria-hidden', 'false'); }
        const list = el?.querySelector('#members-list');
        if (list) list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>';
        const res = await api.chat.getMembers();
        if (!list) return;
        if (res.error) { list.innerHTML = '<p style="color:var(--color-error);">Failed to load members.</p>'; return; }
        const members = res.data || [];
        if (!members.length) { list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">No members found.</p>'; return; }
        list.innerHTML = members.map(m => `
      <div class="chat-member-row">
        <div class="chat-member-row__avatar">${m.avatarUrl ? `<img src="${this.esc(m.avatarUrl)}" alt="" width="36" height="36" style="border-radius:50%;object-fit:cover;" />` : `<div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary-15);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--color-primary);">${this.esc(m.name?.charAt(0)?.toUpperCase() || '?')}</div>`}</div>
        <div class="chat-member-row__info"><p class="chat-member-row__name">${this.esc(m.name)}</p><p class="chat-member-row__status">${m.status === 'active' ? 'Active' : 'Inactive'}</p></div>
      </div>`).join('');
    }

    _closeMembersModal() {
        const bd = this.getContentEl()?.querySelector('#members-backdrop');
        if (bd) { bd.classList.remove('chat-modal-backdrop--open'); bd.setAttribute('aria-hidden', 'true'); }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Voice Notes (enabled via _hasVoiceNotes = true in subclass)
    // ══════════════════════════════════════════════════════════════════════

    async _startVoiceNote() {
        if (this._isRecording) return;
        if (!navigator.mediaDevices?.getUserMedia) { showToast('error', 'Voice notes not supported in this browser.'); return; }
        try {
            const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._recordingChunks = []; this._recordingSeconds = 0;
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
            this._mediaRecorder = new MediaRecorder(stream, { mimeType });
            this._mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this._recordingChunks.push(e.data); };
            this._mediaRecorder.start(100);
            this._isRecording = true;
            const el = this.getContentEl();
            el?.querySelector('#chat-input-bar')?.classList.add('chat-input-bar--hidden');
            const recorder = el?.querySelector('#voice-recorder');
            if (recorder) { recorder.classList.add('chat-voice-recorder--active'); recorder.setAttribute('aria-hidden', 'false'); }
            this._recordingTimer = setInterval(() => {
                this._recordingSeconds++;
                const timerEl = this.getContentEl()?.querySelector('#voice-timer');
                if (timerEl) { const m = Math.floor(this._recordingSeconds / 60); const s = this._recordingSeconds % 60; timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`; }
                if (this._recordingSeconds >= 120) this._stopVoiceNote(true);
            }, 1000);
        } catch { showToast('error', 'Microphone access denied. Please allow microphone in your browser settings.'); }
    }

    async _stopVoiceNote(send = true) {
        if (!this._isRecording || !this._mediaRecorder) return;
        clearInterval(this._recordingTimer);
        this._isRecording = false;
        this._hideRecorderUI();
        const chunks   = this._recordingChunks;
        const recorder = this._mediaRecorder;
        const stream   = recorder.stream;
        this._recordingChunks = []; this._mediaRecorder = null;
        await new Promise(r => { recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); r(); }; try { recorder.stop(); } catch { r(); } });
        if (send && chunks.length > 0) {
            const mimeType = chunks[0].type || 'audio/webm';
            const ext      = mimeType.includes('ogg') ? 'ogg' : 'webm';
            const blob     = new Blob(chunks, { type: mimeType });
            const file     = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
            await this._uploadVoiceNote(file);
        }
    }

    _cancelVoiceNote() {
        if (!this._isRecording) return;
        clearInterval(this._recordingTimer);
        this._isRecording = false;
        this._hideRecorderUI();
        const recorder = this._mediaRecorder;
        this._mediaRecorder = null; this._recordingChunks = [];
        if (recorder) { recorder.onstop = () => recorder.stream?.getTracks().forEach(t => t.stop()); try { recorder.stop(); } catch {} }
    }

    _hideRecorderUI() {
        const el = this.getContentEl();
        el?.querySelector('#chat-input-bar')?.classList.remove('chat-input-bar--hidden');
        const recorder = el?.querySelector('#voice-recorder');
        if (recorder) { recorder.classList.remove('chat-voice-recorder--active'); recorder.setAttribute('aria-hidden', 'true'); }
        const timerEl = el?.querySelector('#voice-timer');
        if (timerEl) timerEl.textContent = '0:00';
    }

    async _uploadVoiceNote(file) {
        const blobUrl = URL.createObjectURL(file);
        this._objectURLs.add(blobUrl);
        const optimistic = {
            id: Date.now(), lgaId: this._activeLgaId,
            userId: store.currentUser?.id, userName: store.currentUser?.username || store.currentUser?.name,
            avatarUrl: store.currentUser?.avatarUrl, text: null, mediaUrl: null,
            fileUrl: blobUrl, fileName: file.name, fileSize: null,
            reactions: {}, replyTo: null, createdAt: new Date().toISOString(), _pending: true,
        };
        this._appendMessage(optimistic);
        this._messages.push(optimistic);
        const uploadRes = await api.chat.uploadFile(file);
        const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimistic.id}"]`);
        URL.revokeObjectURL(blobUrl); this._objectURLs.delete(blobUrl);
        if (uploadRes.error) { pendingEl?.classList.add('chat-msg--failed'); showToast('error', 'Failed to upload voice note.'); return; }
        const { url, fileName } = uploadRes.data;
        const msgRes = await api.chat.sendMessage({ lgaId: this._activeLgaId, fileUrl: url, fileName: fileName || file.name, fileSize: null, mediaUrl: null });
        if (msgRes.error) { pendingEl?.classList.add('chat-msg--failed'); showToast('error', 'Failed to send voice note.'); return; }
        if (pendingEl) {
            const prevIdx = this._messages.findIndex(m => m.id === optimistic.id);
            pendingEl.replaceWith(this._createMessageEl(msgRes.data, prevIdx > 0 ? this._messages[prevIdx - 1] : null));
        }
        const idx = this._messages.findIndex(m => m.id === optimistic.id);
        if (idx > -1) this._messages[idx] = msgRes.data;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Utilities
    // ══════════════════════════════════════════════════════════════════════

    _autoResizeTextarea(el) {
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Cleanup
    // ══════════════════════════════════════════════════════════════════════

    beforeUnmount() {
        sseClient.onMessage(null);
        document.body.style.overflow = '';
        for (const url of this._objectURLs) URL.revokeObjectURL(url);
        this._objectURLs.clear();
        if (this._recordingTimer) clearInterval(this._recordingTimer);
        if (this._isRecording && this._mediaRecorder) {
            try { this._mediaRecorder.stop(); } catch {}
            this._mediaRecorder?.stream?.getTracks().forEach(t => t.stop());
        }
    }
}
