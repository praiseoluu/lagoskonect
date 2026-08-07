/**
 * Lagos Konnect - Community Chat Page
 * Route: /chat
 * Guards: requireAuth + requireCitizen
 * ============================================================
 * Real-time messages via SSE (sseClient).
 * Falls back gracefully if SSE is not connected.
 * Unread separator + mark-as-read on open.
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260806h';
import { Avatar } from '../../../components/base/UI.js?v=20260806h';
import { store, showToast, setPageLoading } from '../../../core/store.js?v=20260806h';
import { api } from '../../../api/client.js?v=20260806h';
import { sseClient } from '../../../core/sseClient.js?v=20260806h';
import { t } from '../../../core/i18n.js?v=20260806h';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|avif|bmp|svg)$/i;
const VIDEO_EXTS = /\.(mp4|mov|avi|mkv|webm|ogg|m4v|3gp)$/i;

const isImageFile = (url, name) => IMAGE_EXTS.test(name || '') || IMAGE_EXTS.test(url || '');
const isVideoFile = (url, name, mimeType) =>
    (mimeType && mimeType.startsWith('video/')) ||
    VIDEO_EXTS.test(name || '') ||
    VIDEO_EXTS.test(url || '');

// Emoji categories
const EMOJI_CATEGORIES = [
  {
    id: 'smileys', label: '😀', name: 'Smileys',
    emojis: ['😀','😂','😍','🥰','😎','😭','😡','😱','🤔','😅','😊','🥺','🤣','😢','😤','🥳','🤗','😏','🙄','😴','🤯','🤩','😋','😜','🤪','😝','🤑','😈','👻','💀','😶','🫠','🥴','🤫','🤭'],
  },
  {
    id: 'people', label: '👋', name: 'Gestures',
    emojis: ['👋','🤝','👍','👎','❤️','🙏','👏','💪','🫡','🫶','🤜','🤛','✌️','🤞','🖐️','👌','🤌','🫰','💅','🫳','🫴','🙌','👐','🤲','🫂','💁','🙋','🤷','🤦','💃','🕺'],
  },
  {
    id: 'nature', label: '🌿', name: 'Nature',
    emojis: ['🌿','🌟','⚡','🔥','💧','🌸','🌺','🍃','🌈','☀️','🌙','⭐','🌊','🏔️','🌴','🍀','🌻','🍁','❄️','🌪️','🦋','🐝','🦁','🐉','🌍','🌎','🌏','🌄','🌅','🌠','🐆'],
  },
  {
    id: 'food', label: '🍕', name: 'Food',
    emojis: ['🍕','🍔','🍟','🌮','🍜','🍚','🍗','🥘','🍲','🍛','🌯','🥗','🍱','🍤','🥩','🍙','🍣','🍦','🎂','🍰','🍫','🍿','🥤','☕','🧃','🍺','🥟','🫕','🍖','🥞','🫔'],
  },
  {
    id: 'activities', label: '🎉', name: 'Fun',
    emojis: ['🎉','🎊','🎈','🎁','🏆','🥇','⚽','🏀','🎮','🎵','🎶','🎸','🎨','📱','💻','📢','🗣️','💯','✨','💫','💥','🎯','🏅','🚀','🛸','👑','💎','🤑','🃏','🎲','🎭'],
  },
];

// Sticker set (large emojis displayed as sticker cards)
const STICKERS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💯', label: '100' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '🙏', label: 'Pray' },
  { emoji: '👑', label: 'Crown' },
  { emoji: '💪', label: 'Strong' },
  { emoji: '🤩', label: 'Starstruck' },
  { emoji: '⚡', label: 'Energy' },
  { emoji: '🫶', label: 'Heart Hands' },
  { emoji: '🌟', label: 'Star' },
  { emoji: '🤣', label: 'ROFL' },
  { emoji: '💀', label: 'Dead' },
  { emoji: '🥳', label: 'Party' },
  { emoji: '😎', label: 'Cool' },
  { emoji: '🤝', label: 'Deal' },
  { emoji: '🏆', label: 'Trophy' },
  { emoji: '💎', label: 'Diamond' },
  { emoji: '🚀', label: 'Rocket' },
  { emoji: '✨', label: 'Sparkle' },
  { emoji: '💥', label: 'Boom' },
  { emoji: '🌈', label: 'Rainbow' },
  { emoji: '🎊', label: 'Congrats' },
  { emoji: '🛸', label: 'UFO' },
  { emoji: '🦁', label: 'Lion' },
  { emoji: '🐉', label: 'Dragon' },
  { emoji: '🌿', label: 'Nature' },
  { emoji: '🇳🇬', label: 'Nigeria' },
  { emoji: '🤯', label: 'Mind Blown' },
  { emoji: '👻', label: 'Ghost' },
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

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function _relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function isToday(iso) {
  const d = new Date(iso);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

function humanSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ──────────────────────────────────────────────────────────────────────────

export default class ChatPage extends WebLayout {
  static styles = '/pages/web/app/Chat.css?v=20260806h';

  constructor(props) {
    super({ title: t('chat.title'), ...props });
    this._messages = [];
    this._replyTo = null;
    this._searchActive = false;
    this._searchQuery = '';
    this._searchMatches = [];
    this._searchIdx = 0;
    this._contextTarget = null;
    this._emojiPanelOpen = false;
    this._emojiTab = 'emoji';        // 'emoji' | 'stickers' | 'gif'
    this._emojiCategory = 'smileys'; // active emoji category
    this._sending = false;
    this._lastRenderedDate = null;
    this._objectURLs = new Set();
    this._lastReadId = 0;
    this._unreadSeparatorId = null;
    this._reportMsgId = null;
    this._reportReason = null;
    this._activeLgaId = store.currentUser?.lgaId ?? null;
    this._allPreviews = [];
    this._editingMsgId = null;
    this._lightboxSrc = null;
    this._attachMenuOpen = false;
    // Emoji cursor save
    this._savedCursorStart = null;
    this._savedCursorEnd = null;
    // Scroll state
    this._atBottom = true;
    // GIF search
    this._gifSearchQuery = '';
    // Mute state for notifications
    this._chatMuted = false;
  }

  getContent() {
    const lgaName = store.currentLGA?.name || 'your LGA';
    return `
      <div class="chat-shell" id="chat-shell">

        <!-- ── Left sidebar: LGA community list ── -->
        <aside class="chat-list-sidebar" id="chat-list-sidebar" aria-label="LGA Communities">
          <div class="chat-list-sidebar__header">
            <span class="chat-list-sidebar__title">Communities</span>
          </div>
          <div class="chat-list-sidebar__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="chat-list-sidebar__search-input" id="lga-search-input" placeholder="Search…" autocomplete="off" aria-label="Search communities" />
          </div>
          <div class="chat-list-sidebar__unread-label" id="unread-label">Unread Messages <span class="chat-list-sidebar__unread-badge" id="unread-badge" aria-hidden="true"></span></div>
          <nav class="chat-list-sidebar__list" id="lga-list" aria-label="LGA list">
            ${[1,2,3,4,5].map(() => `
              <div class="chat-list-item chat-list-item--skeleton">
                <div class="chat-list-item__avatar skeleton-pulse"></div>
                <div class="chat-list-item__body">
                  <div class="chat-list-item__skel-name skeleton-pulse"></div>
                  <div class="chat-list-item__skel-preview skeleton-pulse"></div>
                </div>
              </div>
            `).join('')}
          </nav>
        </aside>

        <!-- ── Centre: chat panel ── -->
        <div class="chat-page" id="chat-page">

          <div class="chat-header" id="chat-header">
            <div class="chat-header__left">
              <!-- Mobile: tap to open community list -->
              <button class="chat-header__back-btn" id="mobile-communities-btn" type="button" aria-label="Switch community">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div class="chat-header__avatar" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div class="chat-header__info">
                <h1 class="chat-header__name">${this.esc(lgaName)} Community</h1>
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

        <div class="chat-body" id="chat-body" role="log" aria-live="polite" aria-label="Chat messages">
          <div class="chat-body__skeleton" id="chat-skeleton" aria-hidden="true">
            ${[1, 2, 3, 4, 5].map((i) => `
              <div class="chat-skeleton-row ${i % 3 === 0 ? 'chat-skeleton-row--right' : ''}">
                ${i % 3 !== 0 ? '<div class="chat-skeleton-avatar skeleton-pulse"></div>' : ''}
                <div class="chat-skeleton-bubble skeleton-pulse ${i % 3 === 0 ? 'chat-skeleton-bubble--right' : ''}"></div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Scroll-to-bottom FAB -->
        <button class="chat-scroll-btn" id="chat-scroll-btn" type="button" aria-label="Scroll to latest messages" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="chat-scroll-btn__badge" id="chat-scroll-badge" aria-hidden="true"></span>
        </button>

        <div class="chat-reply-bar" id="chat-reply-bar" aria-hidden="true">
          <div class="chat-reply-bar__content" id="reply-bar-content"></div>
          <button class="chat-reply-bar__close" id="reply-bar-close" type="button" aria-label="Cancel reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="chat-input-bar" id="chat-input-bar">
          <!-- Attach button with popup menu -->
          <div class="chat-attach-wrap" id="chat-attach-wrap">
            <button class="chat-input-bar__icon-btn" id="attach-btn" type="button" aria-label="Attach" aria-haspopup="true" aria-expanded="false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </button>
            <div class="chat-attach-menu" id="chat-attach-menu" aria-hidden="true">
              <button class="chat-attach-menu__item" id="attach-image-btn" type="button">
                <span class="chat-attach-menu__icon">🖼️</span>
                <span>Photo / Video</span>
              </button>
              <button class="chat-attach-menu__item" id="attach-file-btn" type="button">
                <span class="chat-attach-menu__icon">📎</span>
                <span>Document / File</span>
              </button>
            </div>
          </div>
          <input type="file" id="image-input" class="chat-input-bar__file-input" accept="image/*,video/*" aria-hidden="true" tabindex="-1" />
          <input type="file" id="file-input" class="chat-input-bar__file-input" aria-hidden="true" tabindex="-1" />
          <div class="chat-input-bar__input-wrap">
            <textarea class="chat-input-bar__textarea" id="chat-textarea"
              placeholder="Message ${this.esc(lgaName)} Community…"
              rows="1" aria-label="Type a message" autocomplete="off"></textarea>
          </div>
          <button class="chat-input-bar__icon-btn" id="emoji-btn" type="button" aria-label="Emoji & Stickers" aria-haspopup="true" aria-expanded="false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button class="chat-input-bar__icon-btn" id="voice-btn" type="button" aria-label="Record voice note">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button class="chat-input-bar__send-btn" id="send-btn" type="button" aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>

        <!-- Voice note recording UI -->
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
        </div>

        <p class="chat-input-hint">ENTER TO SEND &nbsp;·&nbsp; SHIFT + ENTER FOR NEW LINE</p>

        <!-- ── Emoji / Sticker / GIF Panel ── -->
        <div class="chat-emoji-panel" id="chat-emoji-panel" aria-hidden="true" role="dialog" aria-label="Emoji picker">
          <!-- Tabs -->
          <div class="chat-emoji-panel__tabs">
            <button class="chat-emoji-panel__tab chat-emoji-panel__tab--active" data-tab="emoji" type="button">😀 Emoji</button>
            <button class="chat-emoji-panel__tab" data-tab="stickers" type="button">🎭 Stickers</button>
            <button class="chat-emoji-panel__tab" data-tab="gif" type="button">GIF</button>
          </div>

          <!-- Emoji tab -->
          <div class="chat-emoji-panel__section" id="emoji-section">
            <div class="chat-emoji-panel__search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" class="chat-emoji-panel__search" id="emoji-search" placeholder="Search emoji…" autocomplete="off" />
            </div>
            <div class="chat-emoji-panel__categories" id="emoji-categories">
              ${EMOJI_CATEGORIES.map((c) => `
                <button class="chat-emoji-panel__cat-btn${c.id === 'smileys' ? ' chat-emoji-panel__cat-btn--active' : ''}"
                  data-category="${c.id}" type="button" title="${c.name}" aria-label="${c.name}">${c.label}</button>
              `).join('')}
            </div>
            <div class="chat-emoji-panel__grid" id="emoji-grid">
              ${EMOJI_CATEGORIES[0].emojis.map((e) => `
                <button class="chat-emoji-panel__item" data-emoji="${e}" type="button" aria-label="${e}">${e}</button>
              `).join('')}
            </div>
          </div>

          <!-- Stickers tab -->
          <div class="chat-emoji-panel__section chat-emoji-panel__section--hidden" id="stickers-section">
            <p class="chat-emoji-panel__section-label">Tap a sticker to send it</p>
            <div class="chat-sticker-grid" id="sticker-grid">
              ${STICKERS.map((s) => `
                <button class="chat-sticker-item" data-sticker="${s.emoji}" data-label="${s.label}" type="button" aria-label="${s.label}">
                  <span class="chat-sticker-item__emoji">${s.emoji}</span>
                  <span class="chat-sticker-item__label">${s.label}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- GIF tab -->
          <div class="chat-emoji-panel__section chat-emoji-panel__section--hidden" id="gif-section">
            <div class="chat-emoji-panel__search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" class="chat-emoji-panel__search" id="gif-search" placeholder="Search GIFs…" autocomplete="off" />
            </div>
            <div class="chat-gif-grid" id="gif-grid">
              ${CURATED_GIFS.map((g) => `
                <button class="chat-gif-item" data-gif-url="${g.url}" data-gif-label="${g.label}" type="button" aria-label="${g.label}">
                  <img src="${g.url}" alt="${g.label}" loading="lazy" />
                  <span class="chat-gif-item__fallback">${g.label}</span>
                  <span class="chat-gif-item__label">${g.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- ── Context menu ── -->
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
          <button class="chat-context-menu__item" id="context-edit-btn" data-action="edit" type="button" role="menuitem" style="display:none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <div class="chat-context-menu__divider"></div>
          <button class="chat-context-menu__item chat-context-menu__item--danger" data-action="report" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Report
          </button>
        </div>

        <div class="chat-kebab-menu" id="chat-kebab-menu" role="menu" aria-hidden="true">
          <button class="chat-kebab-menu__item" data-kebab="mute" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            Mute notifications
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

        <!-- Modals -->
        <div class="chat-modal-backdrop" id="invite-backdrop" aria-hidden="true">
          <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
            <div class="chat-modal__header">
              <h2 class="chat-modal__title" id="invite-modal-title">Invite to Community</h2>
              <button class="chat-modal__close" id="invite-close" type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p class="chat-modal__desc">Enter the phone number of the person you'd like to invite to the ${this.esc(lgaName)} Community chat.</p>
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
              <button class="chat-modal__close" id="report-close" type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p class="chat-modal__desc">Why are you reporting this message?</p>
            <div class="chat-report-reasons" id="report-reasons">
              ${['Spam', 'Harassment', 'Misinformation', 'Inappropriate content', 'Other'].map(r =>
        `<button class="chat-report-reason" data-reason="${r}" type="button">${r}</button>`
    ).join('')}
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
              <button class="chat-modal__close" id="members-close" type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="chat-modal__members-list" id="members-list">
              <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>
            </div>
          </div>
        </div>

        <!-- Image lightbox -->
        <div class="chat-lightbox" id="chat-lightbox" aria-hidden="true" role="dialog" aria-label="Image preview">
          <button class="chat-lightbox__close" id="lightbox-close" type="button" aria-label="Close image">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img class="chat-lightbox__img" id="lightbox-img" src="" alt="Full size image" />
        </div>

        </div> <!-- end .chat-page -->

        <!-- ── Right sidebar: ads ── -->
        <aside class="chat-ads-sidebar" id="chat-ads-sidebar" aria-label="Advertisements">
          <div id="chat-ads-mount"></div>
        </aside>

      </div> <!-- end .chat-shell -->
    `;
  }

  async onContentReady() {
    setPageLoading(true);
    await Promise.all([
      this._loadMessages(),
      this._loadPreviews(),
      this._loadSidebarAds(),
    ]);
    this._loadOnlineCount();
    this._bindEvents();
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
    // Tap the backdrop (::after pseudo-element area) to close
    shell.addEventListener('click', (e) => {
      if (shell.classList.contains('chat-shell--sidebar-open') && e.target === shell) {
        shell.classList.remove('chat-shell--sidebar-open');
      }
    });
  }

  // ── LGA sidebar ───────────────────────────────────────────────────────

  async _loadPreviews() {
    const res = await api.chat.getPreviews();
    if (res.error) {
      const lgaRes = await api.lgas.getAll();
      this._allPreviews = (lgaRes.data || []).map((l) => ({ ...l, lastMessage: null, unreadCount: 0 }));
    } else {
      this._allPreviews = res.data || [];
    }
    this._renderLgaList(this._allPreviews);
  }

  _renderLgaList(previews) {
    const el = this.getContentEl();
    const list = el?.querySelector('#lga-list');
    const badge = el?.querySelector('#unread-badge');
    if (!list) return;

    const totalUnread = previews.reduce((sum, p) => sum + (p.unreadCount || 0), 0);
    if (badge) {
      badge.textContent = totalUnread > 0 ? totalUnread : '';
      badge.style.display = totalUnread > 0 ? '' : 'none';
    }

    if (!previews.length) {
      list.innerHTML = `<p class="chat-list-sidebar__empty">No communities found.</p>`;
      return;
    }

    list.innerHTML = previews.map((lga) => {
      const isActive = lga.id === this._activeLgaId;
      const initials = lga.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
      const last = lga.lastMessage;
      let previewText = '';
      let timeText = '';
      if (last) {
        const prefix = last.isMe ? 'You' : last.sender;
        previewText = `${prefix}: ${last.text || 'Sent a file'}`;
        timeText = _relativeTime(last.createdAt);
      }
      const unread = lga.unreadCount || 0;
      return `
        <button class="chat-list-item${isActive ? ' chat-list-item--active' : ''}"
          data-lga-id="${lga.id}" data-lga-name="${this.esc(lga.name)}" type="button" role="listitem">
          <div class="chat-list-item__avatar" aria-hidden="true">${initials}</div>
          <div class="chat-list-item__body">
            <span class="chat-list-item__name">${this.esc(lga.name)} LGA</span>
            <span class="chat-list-item__preview">${this.esc(previewText)}</span>
          </div>
          <div class="chat-list-item__meta">
            ${timeText ? `<span class="chat-list-item__time">${this.esc(timeText)}</span>` : ''}
            ${unread > 0 ? `<span class="chat-list-item__unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          </div>
        </button>
      `;
    }).join('');

    list.querySelectorAll('.chat-list-item[data-lga-id]').forEach((btn) => {
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
    this._activeLgaId = lgaId;
    this._messages = [];
    this._lastRenderedDate = null;
    this._unreadSeparatorId = null;
    this._replyTo = null;
    this._clearReply();
    const q = this.getContentEl()?.querySelector('#lga-search-input')?.value.trim().toLowerCase() || '';
    const filtered = q ? this._allPreviews.filter((l) => l.name.toLowerCase().includes(q)) : this._allPreviews;
    this._renderLgaList(filtered);
    this._updateChatHeader(lgaName);
    const textarea = this.getContentEl()?.querySelector('#chat-textarea');
    if (textarea) textarea.placeholder = `Message ${lgaName} Community…`;
    this._loadMessages();
    this._loadOnlineCount();
  }

  _updateChatHeader(lgaName) {
    const name = lgaName || this._allPreviews.find((p) => p.id === this._activeLgaId)?.name || store.currentLGA?.name || 'Community';
    const header = this.getContentEl()?.querySelector('.chat-header__name');
    if (header) header.textContent = `${name} Community`;
  }

  _bindLgaSearch() {
    const input = this.getContentEl()?.querySelector('#lga-search-input');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      const filtered = q
          ? this._allPreviews.filter((l) => l.name.toLowerCase().includes(q))
          : this._allPreviews;
      this._renderLgaList(filtered);
    });
  }

  // ── Ad sidebar ────────────────────────────────────────────────────────

  async _loadSidebarAds() {
    const res = await api.adverts.getForLGA('banner');
    const ads = (!res.error && res.data?.length) ? res.data.slice(0, 5) : [];
    const mount = this.getContentEl()?.querySelector('#chat-ads-mount');
    if (!mount) return;

    // Hide the entire ads sidebar when the backend returns no ads
    if (!ads.length) {
      const sidebar = this.getContentEl()?.querySelector('#chat-ads-sidebar');
      if (sidebar) sidebar.style.display = 'none';
      return;
    }

    const placeholder = `
      <div class="chat-ad-card chat-ad-card--placeholder" aria-hidden="true">
        <div class="chat-ad-card__img-placeholder skeleton-pulse"></div>
        <div class="chat-ad-card__body">
          <div class="chat-ad-card__skel-label skeleton-pulse"></div>
          <div class="chat-ad-card__skel-title skeleton-pulse"></div>
        </div>
      </div>`;

    const adCards = ads.map((ad) => `
      <a class="chat-ad-card${ad.imageUrl ? '' : ' chat-ad-card--no-img'}"
        href="${this.esc(ad.ctaUrl || '#')}" target="_blank" rel="noopener noreferrer"
        data-ad-id="${ad.id}" aria-label="Sponsored: ${this.esc(ad.title)}">
        ${ad.imageUrl
        ? `<img class="chat-ad-card__img" src="${this.esc(ad.imageUrl)}" alt="${this.esc(ad.title)}" loading="lazy" />`
        : `<div class="chat-ad-card__img-placeholder" aria-hidden="true">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".4"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
             </div>`}
        <div class="chat-ad-card__body">
          <span class="chat-ad-card__label">Sponsored</span>
          ${ad.advertiser ? `<span class="chat-ad-card__advertiser">${this.esc(ad.advertiser)}</span>` : ''}
          <p class="chat-ad-card__title">${this.esc(ad.title)}</p>
          ${ad.ctaLabel ? `<span class="chat-ad-card__cta">${this.esc(ad.ctaLabel)}</span>` : ''}
        </div>
      </a>`);

    const items = [
      ...adCards,
      ...Array.from({ length: Math.max(0, 3 - ads.length) }, () => placeholder),
    ].join('');

    mount.innerHTML = `<div class="chat-ads-stack">${items}</div>`;

    mount.addEventListener('click', (e) => {
      const el = e.target.closest('[data-ad-id]');
      if (el) api.adverts.recordClick(parseInt(el.dataset.adId, 10));
    });
  }

  // ── Message normalisation ─────────────────────────────────────────────
  //
  // Converts server-stored representations back to the richer client model
  // so that stickers and GIFs render correctly on load, SSE, and refresh —
  // not just for the sender's optimistic update.
  //
  //  • Stickers are stored as plain text "[sticker:emoji:label]".
  //    We parse this token and set stickerEmoji / stickerLabel.
  //  • GIFs are stored with mediaUrl/fileUrl pointing to the .gif file.
  //    We detect the extension and lift the URL into gifUrl so the GIF
  //    wrapper style is applied instead of the generic image style.

  _normalizeMessage(msg) {
    // Already normalised (optimistic or previously patched)
    if (msg.gifUrl) return { ...msg, gifUrl: localizeGifUrl(msg.gifUrl) };
    if (msg.stickerEmoji || msg.videoUrl) return msg;

    // Sticker token: [sticker:<emoji>:<label>]
    const STICKER_RE = /^\[sticker:(.+?):(.+?)\]$/;
    if (msg.text) {
      const m = STICKER_RE.exec(msg.text.trim());
      if (m) {
        return { ...msg, text: null, stickerEmoji: m[1], stickerLabel: m[2] };
      }
    }

    // GIF: mediaUrl or fileUrl ending in .gif (must come before video check)
    const mediaSrc = msg.mediaUrl || msg.fileUrl;
    if (mediaSrc && /\.gif(\?.*)?$/i.test(mediaSrc)) {
      const gifLabel = (msg.fileName || '').replace(/\.gif$/i, '') || 'GIF';
      return { ...msg, gifUrl: localizeGifUrl(mediaSrc), gifLabel, mediaUrl: null, fileUrl: null };
    }

    // Video: fileUrl pointing to a video extension
    if (msg.fileUrl && isVideoFile(msg.fileUrl, msg.fileName, msg.mimeType)) {
      return { ...msg, videoUrl: msg.fileUrl, mediaUrl: null };
    }

    return msg;
  }

  // ── SSE integration ───────────────────────────────────────────────────

  _connectSSE() {
    sseClient.onMessage((rawMsg) => {
      const msg = this._normalizeMessage(rawMsg);
      if (msg.userId === store.currentUser?.id) return;
      if (this._messages.some((m) => m.id === msg.id)) return;

      const preview = this._allPreviews.find((p) => p.id === msg.lgaId);
      if (preview) {
        preview.lastMessage = {
          text: msg.text || msg.fileName || '',
          sender: msg.userName,
          isMe: false,
          createdAt: msg.createdAt,
        };
        if (msg.lgaId !== this._activeLgaId) {
          preview.unreadCount = (preview.unreadCount || 0) + 1;
        }
        const q = this.getContentEl()?.querySelector('#lga-search-input')?.value.trim().toLowerCase() || '';
        const filtered = q ? this._allPreviews.filter((l) => l.name.toLowerCase().includes(q)) : this._allPreviews;
        this._renderLgaList(filtered);
      }

      if (msg.lgaId !== this._activeLgaId) return;

      this._messages.push(msg);
      this._appendMessage(msg);

      api.chat.markRead({ lgaId: this._activeLgaId });
      store.unreadChatCount = 0;
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────

  async _loadMessages() {
    const lgaId = this._activeLgaId;
    const unreadRes = await api.chat.getUnreadCount({ lgaId });
    this._lastReadId = unreadRes.data?.lastReadId ?? 0;
    const unreadCount = unreadRes.data?.count ?? 0;

    const res = await api.chat.getMessages({ lgaId, perPage: 100 });
    const skeleton = this.getContentEl()?.querySelector('#chat-skeleton');
    skeleton?.remove();
    if (res.error) {
      const body = this.getContentEl()?.querySelector('#chat-body');
      if (body) body.innerHTML = `<div class="chat-empty-state"><span class="chat-empty-state__icon">⚠️</span><p class="chat-empty-state__title">Could not load messages</p><p class="chat-empty-state__sub">Check your connection and try again.</p></div>`;
      return;
    }

    this._messages = (res.data || []).map((m) => this._normalizeMessage(m));

    const userId = store.currentUser?.id;
    if (unreadCount > 0 && this._lastReadId > 0) {
      const firstUnread = this._messages.find(
          (m) => m.id > this._lastReadId && m.userId !== userId
      );
      this._unreadSeparatorId = firstUnread?.id ?? null;
    } else if (unreadCount > 0 && this._lastReadId === 0) {
      const firstOther = this._messages.find((m) => m.userId !== userId);
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
        sep ? sep.scrollIntoView({ behavior: 'smooth', block: 'start' })
            : this._scrollToBottom(false);
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
      const preview = this._allPreviews.find((p) => p.id === this._activeLgaId);
      if (preview) preview.unreadCount = 0;
      const activeBtn = this.getContentEl()?.querySelector(`.chat-list-item[data-lga-id="${this._activeLgaId}"] .chat-list-item__unread-badge`);
      if (activeBtn) activeBtn.remove();
    }
  }

  async _loadOnlineCount() {
    const res = await api.chat.getOnlineCount({ lgaId: this._activeLgaId });
    const el = this.getContentEl()?.querySelector('#online-count');
    if (el && res.data) {
      el.innerHTML = `<span class="chat-header__online-dot" aria-hidden="true"></span>${res.data.count} active members`;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  _shouldGroup(msg, prevMsg) {
    if (!prevMsg || msg.userId !== prevMsg.userId) return false;
    if (prevMsg.stickerEmoji || prevMsg.gifUrl || prevMsg.isSticker || prevMsg.isGif) return false;
    if (msg.stickerEmoji || msg.gifUrl) return false;
    return (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) < 3 * 60 * 1000;
  }

  // Reads the last rendered .chat-msg element from the DOM and returns a
  // prevMsg-compatible object for grouping decisions. This is the source of
  // truth used by _appendMessage so the result is correct regardless of
  // whether the calling code pushes to this._messages before or after appending.
  _prevMsgFromDom(body) {
    const els = body?.querySelectorAll('.chat-msg[data-msg-id]');
    if (!els?.length) return null;
    const last = els[els.length - 1];
    return {
      userId:      last.dataset.userId,
      createdAt:   last.dataset.createdAt,
      isSticker:   !!last.dataset.isSticker,
      isGif:       !!last.dataset.isGif,
    };
  }

  // Re-evaluates grouped state for a single message element in place.
  // Call after delete/edit changes what comes before a message.
  _recomputeGrouping(msgEl) {
    if (!msgEl) return;
    const msgId = msgEl.dataset.msgId;
    const msg   = this._messages.find((m) => String(m.id) === String(msgId));
    if (!msg) return;

    // Find the previous .chat-msg sibling by walking backward through DOM
    let prev = msgEl.previousElementSibling;
    while (prev && !prev.classList.contains('chat-msg')) prev = prev.previousElementSibling;
    const prevData = prev ? {
      userId:    prev.dataset.userId,
      createdAt: prev.dataset.createdAt,
      isSticker: !!prev.dataset.isSticker,
      isGif:     !!prev.dataset.isGif,
    } : null;

    const shouldBeGrouped = this._shouldGroup(msg, prevData);
    const isGrouped = msgEl.classList.contains('chat-msg--grouped');
    if (shouldBeGrouped !== isGrouped) {
      msgEl.replaceWith(this._createMessageEl(msg, shouldBeGrouped));
    }
  }

  _renderAllMessages(unreadCount = 0) {
    const body = this.getContentEl()?.querySelector('#chat-body');
    if (!body) return;
    body.innerHTML = '';
    this._lastRenderedDate = null;

    for (let i = 0; i < this._messages.length; i++) {
      const msg = this._messages[i];
      const prevMsg = i > 0 ? this._messages[i - 1] : null;

      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== this._lastRenderedDate) {
        const sep = document.createElement('div');
        sep.className = 'chat-date-sep';
        const sepSpan = document.createElement('span');
        sepSpan.textContent = `${isToday(msg.createdAt) ? 'TODAY, ' : ''}${new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}`;
        sep.setAttribute('aria-label', sepSpan.textContent);
        sep.appendChild(sepSpan);
        body.appendChild(sep);
        this._lastRenderedDate = msgDate;
      }

      if (msg.id === this._unreadSeparatorId) {
        const unreadSep = document.createElement('div');
        unreadSep.className = 'chat-unread-sep';
        unreadSep.id = 'unread-separator';
        unreadSep.innerHTML = `<span>${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}</span>`;
        unreadSep.setAttribute('aria-label', `${unreadCount} unread messages below`);
        body.appendChild(unreadSep);
      }

      const grouped = this._shouldGroup(msg, prevMsg);
      body.appendChild(this._createMessageEl(msg, grouped));
    }
  }

  _createMessageEl(msg, isGrouped = false) {
    const isOwn = msg.userId === store.currentUser?.id;
    const wrapper = document.createElement('div');
    const classes = ['chat-msg'];
    if (isOwn) classes.push('chat-msg--own');
    if (isGrouped) classes.push('chat-msg--grouped');
    wrapper.className = classes.join(' ');
    wrapper.dataset.msgId     = msg.id;
    // Store attributes used for DOM-based grouping lookups
    wrapper.dataset.userId    = msg.userId ?? '';
    wrapper.dataset.createdAt = msg.createdAt ?? '';
    if (msg.stickerEmoji) wrapper.dataset.isSticker = '1';
    if (msg.gifUrl)       wrapper.dataset.isGif     = '1';

    const avatarHtml = Avatar.html({ name: msg.userName, imageUrl: msg.avatarUrl, size: 'sm' });

    const replyHtml = msg.replyTo ? `
      <div class="chat-msg__reply" data-reply-id="${msg.replyTo.id}">
        <span class="chat-msg__reply-name">${this.esc(msg.replyTo.userName)}</span>
        <span class="chat-msg__reply-text">${this.esc(msg.replyTo.text?.slice(0, 60))}${(msg.replyTo.text?.length > 60) ? '…' : ''}</span>
      </div>
    ` : '';

    const isAudio = msg.fileUrl && /\.(webm|ogg|mp3|m4a|wav)$/i.test(msg.fileName || '');
    const isVideo = !isAudio && (msg.videoUrl || isVideoFile(msg.fileUrl, msg.fileName, msg.mimeType));
    const isImage = !isAudio && !isVideo && (msg.mediaUrl || isImageFile(msg.fileUrl, msg.fileName));
    const isGif = msg.gifUrl;
    const isSticker = msg.stickerEmoji;

    let bodyHtml = '';
    if (isSticker) {
      bodyHtml = `<div class="chat-msg__sticker" aria-label="${this.esc(msg.stickerLabel || msg.stickerEmoji)}">${msg.stickerEmoji}</div>`;
    } else if (isGif) {
      bodyHtml = `
        <div class="chat-msg__gif-wrap">
          <img class="chat-msg__gif" src="${this.esc(msg.gifUrl)}" alt="${this.esc(msg.gifLabel || 'GIF')}" loading="lazy" />
        </div>
      `;
    } else if (isAudio) {
      bodyHtml = `
        <div class="chat-msg__audio">
          <audio controls preload="none" class="chat-msg__audio-player"><source src="${this.esc(msg.fileUrl)}" /></audio>
          <p class="chat-msg__audio-label">Voice note</p>
        </div>
      `;
    } else if (isVideo) {
      const videoSrc = msg.videoUrl || msg.fileUrl;
      bodyHtml = `
        <div class="chat-msg__video-wrap">
          <video class="chat-msg__video" controls preload="metadata" playsinline>
            <source src="${this.esc(videoSrc)}" />
            <a href="${this.esc(videoSrc)}" target="_blank" rel="noopener noreferrer">Download video</a>
          </video>
        </div>
        ${msg.text ? `<p class="chat-msg__text">${this.esc(msg.text)}</p>` : ''}
      `;
    } else if (isImage) {
      const imgSrc = msg.mediaUrl || msg.fileUrl;
      bodyHtml = `
        <div class="chat-msg__image-wrap">
          <img class="chat-msg__image" src="${this.esc(imgSrc)}" alt="${this.esc(msg.fileName || 'Image')}"
            loading="lazy" data-lightbox="${this.esc(imgSrc)}" />
        </div>
        ${msg.text ? `<p class="chat-msg__text">${this.esc(msg.text)}</p>` : ''}
      `;
    } else if (msg.fileUrl) {
      const ext = (msg.fileName || '').split('.').pop().toUpperCase() || 'FILE';
      bodyHtml = `
        <a href="${this.esc(msg.fileUrl)}" class="chat-msg__file" target="_blank" rel="noopener noreferrer" aria-label="Open ${this.esc(msg.fileName || 'file')}">
          <div class="chat-msg__file-icon" aria-hidden="true">
            <span class="chat-msg__file-ext">${this.esc(ext.slice(0, 4))}</span>
          </div>
          <div class="chat-msg__file-info">
            <span class="chat-msg__file-name">${this.esc(msg.fileName || 'File')}</span>
            ${msg.fileSize ? `<span class="chat-msg__file-size">${this.esc(msg.fileSize)}</span>` : ''}
          </div>
          ${!isOwn ? `<span class="chat-msg__file-download" data-download-url="${this.esc(msg.fileUrl)}" data-download-name="${this.esc(msg.fileName || 'file')}" role="button" tabindex="0" aria-label="Download ${this.esc(msg.fileName || 'file')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </span>` : ''}
        </a>
      `;
    } else if (msg.text) {
      bodyHtml = `<p class="chat-msg__text">${this.esc(msg.text)}</p>`;
    }

    const quickEmojis = ['👍', '❤️', '😂', '😮', '🙏'];
    const actionBarHtml = `
      <div class="chat-msg__action-bar" aria-hidden="true">
        ${quickEmojis.map(e => `<button class="chat-msg__action-emoji-btn" data-msg-id="${msg.id}" data-emoji="${e}" type="button" aria-label="React ${e}" title="${e}">${e}</button>`).join('')}
        <button class="chat-msg__action-more-btn" data-msg-id="${msg.id}" type="button" aria-label="More options" title="More options">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>`;

    // Sticker/GIF messages render without bubble
    const useNoBubble = isSticker || isGif;

    const avatarSlot = isGrouped
      ? `<div class="chat-msg__avatar chat-msg__avatar--spacer" aria-hidden="true"></div>`
      : `<div class="chat-msg__avatar">${!isOwn ? `<a class="chat-msg__name" href="/u/${this.esc(msg.userName)}">${avatarHtml}</a>` : avatarHtml}</div>`;

    wrapper.innerHTML = `
      ${!isOwn ? actionBarHtml : ''}
      ${avatarSlot}
      <div class="chat-msg__content">
        ${!isOwn && !isGrouped ? `<a class="chat-msg__name" href="/u/${this.esc(msg.userName)}">${this.esc(msg.userName)}</a>` : ''}
        ${useNoBubble ? `
          <div class="chat-msg__nobubble">
            ${bodyHtml}
            <span class="chat-msg__time chat-msg__time--nobubble">${formatTime(msg.createdAt)}${isOwn ? ' <span class="chat-msg__you chat-msg__you--dark">YOU</span>' : ''}</span>
          </div>
        ` : `
          <div class="chat-msg__bubble ${isOwn ? 'chat-msg__bubble--own' : ''} ${isGrouped ? (isOwn ? 'chat-msg__bubble--grouped-own' : 'chat-msg__bubble--grouped') : ''}">
            ${replyHtml}
            ${bodyHtml}
            <span class="chat-msg__time">${formatTime(msg.createdAt)}${msg.editedAt ? ' <span class="chat-msg__edited">edited</span>' : ''}${isOwn ? ' <span class="chat-msg__you">YOU</span>' : ''}</span>
          </div>
        `}
        ${this._renderReactions(msg)}
      </div>
      ${isOwn ? actionBarHtml : ''}
    `;
    return wrapper;
  }

  _renderReactions(msg) {
    if (!msg.reactions || !Object.keys(msg.reactions).length) return '';
    const userId = store.currentUser?.id;
    const chips = Object.entries(msg.reactions).map(([emoji, users]) => {
      const reacted = users.includes(userId);
      return `<button class="chat-reaction ${reacted ? 'chat-reaction--active' : ''}" data-msg-id="${msg.id}" data-emoji="${emoji}" type="button" aria-label="React with ${emoji}: ${users.length}">${emoji} <span class="chat-reaction__count">${users.length}</span></button>`;
    }).join('');
    return `<div class="chat-reactions-row">${chips}</div>`;
  }

  _appendMessage(msg) {
    const body = this.getContentEl()?.querySelector('#chat-body');
    if (!body) return;

    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== this._lastRenderedDate) {
      const sep = document.createElement('div');
      const sepSpan = document.createElement('span');
      sep.className = 'chat-date-sep';
      sepSpan.textContent = `${isToday(msg.createdAt) ? 'TODAY, ' : ''}${new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}`;
      sep.setAttribute('aria-label', sepSpan.textContent);
      sep.appendChild(sepSpan);
      body.appendChild(sep);
      this._lastRenderedDate = msgDate;
    }

    // Use DOM as the source of truth so grouping is correct regardless of
    // whether this._messages.push() was called before or after _appendMessage.
    const prevMsgData = this._prevMsgFromDom(body);
    const grouped = this._shouldGroup(msg, prevMsgData);
    const el = this._createMessageEl(msg, grouped);
    el.classList.add('chat-msg--entering');
    body.appendChild(el);
    requestAnimationFrame(() => el.classList.remove('chat-msg--entering'));

    if (this._atBottom) {
      this._scrollToBottom(true);
    } else {
      this._updateScrollBtn(true);
    }
  }

  _scrollToBottom(smooth = true) {
    const body = this.getContentEl()?.querySelector('#chat-body');
    if (body) body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    this._atBottom = true;
    this._updateScrollBtn(false);
  }

  _updateScrollBtn(show) {
    const btn = this.getContentEl()?.querySelector('#chat-scroll-btn');
    if (!btn) return;
    btn.setAttribute('aria-hidden', String(!show));
    btn.classList.toggle('chat-scroll-btn--visible', show);
  }

  // Replace an existing message element in the DOM, preserving its
  // grouping state so a server round-trip never breaks visual grouping.
  // Also re-evaluates the next sibling in case grouping propagation changed.
  _replaceMessageEl(oldEl, msg) {
    if (!oldEl) return;
    const wasGrouped = oldEl.classList.contains('chat-msg--grouped');
    const newEl = this._createMessageEl(msg, wasGrouped);
    // Find next sibling before replacing (it may need recomputation)
    let nextMsgEl = oldEl.nextElementSibling;
    while (nextMsgEl && !nextMsgEl.classList.contains('chat-msg')) {
      nextMsgEl = nextMsgEl.nextElementSibling;
    }
    oldEl.replaceWith(newEl);
    // If the new message has a different userId than the old one (e.g. after
    // an edit that changes identity — unlikely but safe), recompute neighbor.
    if (nextMsgEl && msg.userId !== oldEl.dataset.userId) {
      this._recomputeGrouping(nextMsgEl);
    }
  }

  // ── Events ────────────────────────────────────────────────────────────

  _bindEvents() {
    const el = this.getContentEl();
    if (!el) return;

    const textarea = el.querySelector('#chat-textarea');
    if (textarea) {
      this.on(textarea, 'input', () => this._autoResizeTextarea(textarea));
      this.on(textarea, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleSend(); }
      });
      // Save cursor position so emoji insertion works after panel opens
      const saveCursor = () => {
        this._savedCursorStart = textarea.selectionStart;
        this._savedCursorEnd   = textarea.selectionEnd;
      };
      this.on(textarea, 'keyup',  saveCursor);
      this.on(textarea, 'click',  saveCursor);
      this.on(textarea, 'blur',   saveCursor);
      // Image paste from clipboard
      this.on(textarea, 'paste', (e) => this._handlePaste(e));
    }

    const sendBtn = el.querySelector('#send-btn');
    if (sendBtn) this.on(sendBtn, 'click', () => this._handleSend());

    // ── Attach menu ───────────────────────────────────────────────────
    const attachBtn   = el.querySelector('#attach-btn');
    const attachMenu  = el.querySelector('#chat-attach-menu');
    const imageInput  = el.querySelector('#image-input');
    const fileInput   = el.querySelector('#file-input');
    const attachImgBtn = el.querySelector('#attach-image-btn');
    const attachFileBtn = el.querySelector('#attach-file-btn');

    if (attachBtn && attachMenu) {
      this.on(attachBtn, 'click', (e) => {
        e.stopPropagation();
        this._attachMenuOpen = !this._attachMenuOpen;
        attachMenu.classList.toggle('chat-attach-menu--open', this._attachMenuOpen);
        attachMenu.setAttribute('aria-hidden', String(!this._attachMenuOpen));
        attachBtn.setAttribute('aria-expanded', String(this._attachMenuOpen));
      });
    }
    if (attachImgBtn && imageInput) {
      this.on(attachImgBtn, 'click', () => { this._closeAttachMenu(); imageInput.click(); });
    }
    if (attachFileBtn && fileInput) {
      this.on(attachFileBtn, 'click', () => { this._closeAttachMenu(); fileInput.click(); });
    }
    if (imageInput) this.on(imageInput, 'change', (e) => this._handleFileAttach(e, true));
    if (fileInput)  this.on(fileInput,  'change', (e) => this._handleFileAttach(e, false));

    this.delegate('.chat-msg__file-download', 'click', (e, span) => {
      e.preventDefault(); e.stopPropagation();
      const a = document.createElement('a');
      a.href = span.dataset.downloadUrl; a.download = span.dataset.downloadName; a.click();
    });

    // Image lightbox
    this.delegate('.chat-msg__image', 'click', (e, img) => {
      this._openLightbox(img.dataset.lightbox);
    });
    const lightbox = el.querySelector('#chat-lightbox');
    const lightboxClose = el.querySelector('#lightbox-close');
    if (lightboxClose) this.on(lightboxClose, 'click', () => this._closeLightbox());
    if (lightbox) this.on(lightbox, 'click', (e) => { if (e.target === lightbox) this._closeLightbox(); });

    // ── Emoji panel ───────────────────────────────────────────────────
    this._bindEmojiPanel(el, textarea);

    // ── Context menu ──────────────────────────────────────────────────
    this.on(el.querySelector('#chat-body'), 'contextmenu', (e) => {
      const msgEl = e.target.closest('.chat-msg');
      if (!msgEl) return;
      e.preventDefault();
      this._openContextMenu(msgEl.dataset.msgId, e.clientX, e.clientY);
    });

    this.delegate('.chat-context-menu__item', 'click', (e, btn) => this._handleContextAction(btn.dataset.action));

    this.delegate('.chat-context-menu__emoji:not(#context-emoji-more)', 'click', (e, btn) => {
      if (this._contextTarget) { this._handleReaction(this._contextTarget, btn.dataset.emoji); this._closeContextMenu(); }
    });

    const ctxMore = el.querySelector('#context-emoji-more');
    if (ctxMore) {
      this.on(ctxMore, 'click', (e) => {
        e.stopPropagation();
        const grid = el.querySelector('#context-emoji-grid');
        const expanded = grid?.hasAttribute('inert') === false;
        if (grid) {
          if (expanded) { grid.setAttribute('inert', ''); grid.classList.remove('chat-context-menu__emoji-grid--open'); ctxMore.setAttribute('aria-expanded', 'false'); }
          else { grid.removeAttribute('inert'); grid.classList.add('chat-context-menu__emoji-grid--open'); ctxMore.setAttribute('aria-expanded', 'true'); }
        }
      });
    }

    this.delegate('.chat-context-menu__emoji--grid', 'click', (e, btn) => {
      if (this._contextTarget) { this._handleReaction(this._contextTarget, btn.dataset.emoji); this._closeContextMenu(); }
    });

    this.delegate('.chat-reaction', 'click', (e, btn) => this._handleReaction(btn.dataset.msgId, btn.dataset.emoji));

    this.delegate('.chat-msg__action-emoji-btn', 'click', (e, btn) => {
      e.stopPropagation();
      this._handleReaction(btn.dataset.msgId, btn.dataset.emoji);
    });

    this.delegate('.chat-msg__action-more-btn', 'click', (e, btn) => {
      e.stopPropagation();
      const rect = btn.getBoundingClientRect();
      this._openContextMenu(btn.dataset.msgId, rect.left, rect.bottom + 4);
    });

    const replyClose = el.querySelector('#reply-bar-close');
    if (replyClose) this.on(replyClose, 'click', () => {
      if (this._editingMsgId) { this._exitEditMode(); } else { this._clearReply(); }
    });

    this.delegate('.chat-msg__reply', 'click', (e, replyEl) => {
      if (replyEl.dataset.replyId) this._scrollToMessage(replyEl.dataset.replyId);
    });

    const searchToggle = el.querySelector('#search-toggle-btn');
    const searchInput = el.querySelector('#search-input');
    const searchClose = el.querySelector('#search-close');
    const searchPrev = el.querySelector('#search-prev');
    const searchNext = el.querySelector('#search-next');
    if (searchToggle) this.on(searchToggle, 'click', () => this._openSearch());
    if (searchClose) this.on(searchClose, 'click', () => this._closeSearch());
    if (searchInput) {
      this.on(searchInput, 'input', () => this._runSearch(searchInput.value));
      this.on(searchInput, 'keydown', (e) => {
        if (e.key === 'Enter') { e.shiftKey ? this._searchStep(-1) : this._searchStep(1); }
        if (e.key === 'Escape') this._closeSearch();
      });
    }
    if (searchPrev) this.on(searchPrev, 'click', () => this._searchStep(-1));
    if (searchNext) this.on(searchNext, 'click', () => this._searchStep(1));

    const kebabBtn = el.querySelector('#kebab-btn');
    const kebabMenu = el.querySelector('#chat-kebab-menu');
    if (kebabBtn && kebabMenu) {
      this.on(kebabBtn, 'click', (e) => {
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

    const inviteBtn = el.querySelector('#invite-btn');
    const inviteBackdrop = el.querySelector('#invite-backdrop');
    const inviteClose = el.querySelector('#invite-close');
    const inviteCancel = el.querySelector('#invite-cancel');
    const inviteSend = el.querySelector('#invite-send');
    if (inviteBtn) this.on(inviteBtn, 'click', () => this._openInviteModal());
    if (inviteClose) this.on(inviteClose, 'click', () => this._closeInviteModal());
    if (inviteCancel) this.on(inviteCancel, 'click', () => this._closeInviteModal());
    if (inviteBackdrop) this.on(inviteBackdrop, 'click', (e) => { if (e.target === inviteBackdrop) this._closeInviteModal(); });
    if (inviteSend) this.on(inviteSend, 'click', () => this._handleInvite());

    const invitePhone = el.querySelector('#invite-phone');
    if (invitePhone) this.on(invitePhone, 'keydown', (e) => { if (e.key === 'Enter') this._handleInvite(); });

    const reportClose = el.querySelector('#report-close');
    const reportCancel = el.querySelector('#report-cancel');
    const reportBackdrop = el.querySelector('#report-backdrop');
    const reportSubmit = el.querySelector('#report-submit');
    if (reportClose) this.on(reportClose, 'click', () => this._closeReportModal());
    if (reportCancel) this.on(reportCancel, 'click', () => this._closeReportModal());
    if (reportBackdrop) this.on(reportBackdrop, 'click', (e) => { if (e.target === reportBackdrop) this._closeReportModal(); });
    if (reportSubmit) this.on(reportSubmit, 'click', () => this._handleReport());
    this.delegate('.chat-report-reason', 'click', (e, btn) => {
      this._reportReason = btn.dataset.reason;
      el.querySelectorAll('.chat-report-reason').forEach(b => b.classList.remove('chat-report-reason--active'));
      btn.classList.add('chat-report-reason--active');
      const sub = el.querySelector('#report-submit');
      if (sub) sub.disabled = false;
    });

    const voiceBtn = el.querySelector('#voice-btn');
    const voiceCancel = el.querySelector('#voice-cancel');
    const voiceSend = el.querySelector('#voice-send');
    if (voiceBtn) this.on(voiceBtn, 'click', () => this._startVoiceNote());
    if (voiceCancel) this.on(voiceCancel, 'click', () => this._cancelVoiceNote());
    if (voiceSend) this.on(voiceSend, 'click', () => this._stopVoiceNote(true));

    const membersClose = el.querySelector('#members-close');
    const membersBackdrop = el.querySelector('#members-backdrop');
    if (membersClose) this.on(membersClose, 'click', () => this._closeMembersModal());
    if (membersBackdrop) this.on(membersBackdrop, 'click', (e) => { if (e.target === membersBackdrop) this._closeMembersModal(); });

    // Scroll-to-bottom button
    const scrollBtn = el.querySelector('#chat-scroll-btn');
    if (scrollBtn) this.on(scrollBtn, 'click', () => this._scrollToBottom(true));

    // Monitor chat body scroll for scroll-to-bottom button
    const chatBody = el.querySelector('#chat-body');
    if (chatBody) {
      this.on(chatBody, 'scroll', () => {
        const threshold = 120;
        const distFromBottom = chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight;
        const wasAtBottom = this._atBottom;
        this._atBottom = distFromBottom < threshold;
        if (this._atBottom !== wasAtBottom) this._updateScrollBtn(!this._atBottom);
      });
    }

    // Global click to close menus/panels
    this.on(document, 'click', () => {
      this._closeContextMenu();
      this._closeAttachMenu();
      const kebab = el.querySelector('#chat-kebab-menu');
      const kBtn = el.querySelector('#kebab-btn');
      if (kebab) { kebab.classList.remove('chat-kebab-menu--open'); kebab.setAttribute('aria-hidden', 'true'); }
      if (kBtn) kBtn.setAttribute('aria-expanded', 'false');
      this._closeEmojiPanel();
    });

    // Escape key closes lightbox and panels
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape') {
        this._closeLightbox();
        this._closeEmojiPanel();
        this._closeContextMenu();
      }
    });
  }

  // ── Emoji panel ───────────────────────────────────────────────────────

  _bindEmojiPanel(el, textarea) {
    const emojiBtn   = el.querySelector('#emoji-btn');
    const emojiPanel = el.querySelector('#chat-emoji-panel');
    if (!emojiBtn || !emojiPanel) return;

    // Toggle panel
    this.on(emojiBtn, 'click', (e) => {
      e.stopPropagation();
      if (this._emojiPanelOpen) {
        this._closeEmojiPanel();
      } else {
        this._openEmojiPanel(emojiBtn, emojiPanel);
      }
    });

    // Stop propagation on panel so global click doesn't close it immediately
    this.on(emojiPanel, 'click', (e) => { e.stopPropagation(); });

    // Tab switching
    emojiPanel.querySelectorAll('.chat-emoji-panel__tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        this._switchEmojiTab(tabId, emojiPanel);
      });
    });

    // Category pills
    emojiPanel.querySelectorAll('.chat-emoji-panel__cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.category;
        this._switchEmojiCategory(catId, emojiPanel);
      });
    });

    // Emoji search
    const emojiSearch = emojiPanel.querySelector('#emoji-search');
    if (emojiSearch) {
      emojiSearch.addEventListener('input', () => {
        this._filterEmojis(emojiSearch.value, emojiPanel);
      });
    }

    // Emoji item clicks — use direct event on the grid
    const emojiGrid = emojiPanel.querySelector('#emoji-grid');
    if (emojiGrid) {
      emojiGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.chat-emoji-panel__item');
        if (!btn) return;
        this._insertEmoji(btn.dataset.emoji, textarea);
        this._closeEmojiPanel();
      });
    }

    // Sticker clicks
    const stickerGrid = emojiPanel.querySelector('#sticker-grid');
    if (stickerGrid) {
      stickerGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.chat-sticker-item');
        if (!btn) return;
        this._sendSticker(btn.dataset.sticker, btn.dataset.label);
        this._closeEmojiPanel();
      });
    }

    // GIF clicks
    const gifGrid = emojiPanel.querySelector('#gif-grid');
    if (gifGrid) {
      gifGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.chat-gif-item');
        if (!btn) return;
        this._sendGif(btn.dataset.gifUrl, btn.dataset.gifLabel);
        this._closeEmojiPanel();
      });
      this._bindGifImageErrors(gifGrid);
    }

    // GIF search
    const gifSearch = emojiPanel.querySelector('#gif-search');
    if (gifSearch) {
      gifSearch.addEventListener('input', () => this._filterGifs(gifSearch.value, gifGrid));
    }
  }

  _filterGifs(query, grid) {
    if (!grid) return;
    const q = query.trim().toLowerCase();
    const shown = q
      ? CURATED_GIFS.filter((g) => g.label.toLowerCase().includes(q))
      : CURATED_GIFS;
    if (!shown.length) {
      grid.innerHTML = `<p class="chat-gif-empty">No GIFs found for "<strong>${this.esc(q)}</strong>"</p>`;
      return;
    }
    grid.innerHTML = shown.map((g) => `
      <button class="chat-gif-item" data-gif-url="${g.url}" data-gif-label="${g.label}" type="button" aria-label="${g.label}">
        <img src="${g.url}" alt="${g.label}" loading="lazy" />
        <span class="chat-gif-item__fallback">${g.label}</span>
        <span class="chat-gif-item__label">${g.label}</span>
      </button>
    `).join('');
    this._bindGifImageErrors(grid);
  }

  _bindGifImageErrors(grid) {
    grid.querySelectorAll('.chat-gif-item img').forEach((image) => {
      image.addEventListener('error', () => {
        const item = image.closest('.chat-gif-item');
        item?.classList.add('chat-gif-item--unavailable');
        image.style.display = 'none';
        image.nextElementSibling?.style.setProperty('display', 'flex');
      }, { once: true });
    });
  }

  _openEmojiPanel(emojiBtn, emojiPanel) {
    // Save textarea cursor position BEFORE anything shifts focus
    const textarea = this.getContentEl()?.querySelector('#chat-textarea');
    if (textarea) {
      this._savedCursorStart = textarea.selectionStart;
      this._savedCursorEnd   = textarea.selectionEnd;
    }

    this._emojiPanelOpen = true;
    // Position above the emoji button
    const rect = emojiBtn.getBoundingClientRect();
    const panelHeight = 400;
    const panelWidth = 320;
    let top = rect.top - panelHeight - 8;
    let left = rect.right - panelWidth;
    // Clamp to viewport
    if (top < 8) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;
    emojiPanel.style.top = `${top}px`;
    emojiPanel.style.left = `${left}px`;
    emojiPanel.classList.add('chat-emoji-panel--open');
    emojiPanel.setAttribute('aria-hidden', 'false');
    emojiBtn.setAttribute('aria-expanded', 'true');
    // Focus the active tab's search if available
    const activeSearch = this._emojiTab === 'gif'
      ? emojiPanel.querySelector('#gif-search')
      : emojiPanel.querySelector('#emoji-search');
    setTimeout(() => activeSearch?.focus(), 50);
  }

  _closeEmojiPanel() {
    if (!this._emojiPanelOpen) return;
    const el = this.getContentEl();
    const panel = el?.querySelector('#chat-emoji-panel');
    const btn   = el?.querySelector('#emoji-btn');
    panel?.classList.remove('chat-emoji-panel--open');
    panel?.setAttribute('aria-hidden', 'true');
    btn?.setAttribute('aria-expanded', 'false');
    this._emojiPanelOpen = false;
  }

  _switchEmojiTab(tabId, panel) {
    this._emojiTab = tabId;
    panel.querySelectorAll('.chat-emoji-panel__tab').forEach((t) => {
      t.classList.toggle('chat-emoji-panel__tab--active', t.dataset.tab === tabId);
    });
    panel.querySelector('#emoji-section').classList.toggle('chat-emoji-panel__section--hidden', tabId !== 'emoji');
    panel.querySelector('#stickers-section').classList.toggle('chat-emoji-panel__section--hidden', tabId !== 'stickers');
    panel.querySelector('#gif-section').classList.toggle('chat-emoji-panel__section--hidden', tabId !== 'gif');
  }

  _switchEmojiCategory(catId, panel) {
    this._emojiCategory = catId;
    panel.querySelectorAll('.chat-emoji-panel__cat-btn').forEach((b) => {
      b.classList.toggle('chat-emoji-panel__cat-btn--active', b.dataset.category === catId);
    });
    const cat = EMOJI_CATEGORIES.find((c) => c.id === catId);
    const grid = panel.querySelector('#emoji-grid');
    const search = panel.querySelector('#emoji-search');
    if (search) search.value = '';
    if (grid && cat) {
      grid.innerHTML = cat.emojis.map((e) =>
          `<button class="chat-emoji-panel__item" data-emoji="${e}" type="button" aria-label="${e}">${e}</button>`
      ).join('');
    }
  }

  _filterEmojis(query, panel) {
    const grid = panel.querySelector('#emoji-grid');
    if (!grid) return;
    const q = query.trim().toLowerCase();
    const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    const shown = q ? allEmojis.filter((e) => e.toLowerCase().includes(q)) : EMOJI_CATEGORIES.find((c) => c.id === this._emojiCategory)?.emojis || EMOJI_CATEGORIES[0].emojis;
    grid.innerHTML = shown.map((e) =>
        `<button class="chat-emoji-panel__item" data-emoji="${e}" type="button" aria-label="${e}">${e}</button>`
    ).join('');
  }

  _insertEmoji(emoji, textarea) {
    if (!textarea) return;
    // Use the saved cursor position (captured before emoji search was focused)
    const start = this._savedCursorStart ?? textarea.value.length;
    const end   = this._savedCursorEnd   ?? start;
    const val   = textarea.value;
    textarea.value = val.slice(0, start) + emoji + val.slice(end);
    const newPos = start + emoji.length;
    // Restore focus and position
    textarea.focus();
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = newPos;
    });
    // Update saved position so multi-emoji inserts work
    this._savedCursorStart = newPos;
    this._savedCursorEnd   = newPos;
    // Dispatch input event so auto-resize and any listeners fire
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ── Attach menu ───────────────────────────────────────────────────────

  _closeAttachMenu() {
    if (!this._attachMenuOpen) return;
    const el = this.getContentEl();
    const menu = el?.querySelector('#chat-attach-menu');
    const btn  = el?.querySelector('#attach-btn');
    menu?.classList.remove('chat-attach-menu--open');
    menu?.setAttribute('aria-hidden', 'true');
    btn?.setAttribute('aria-expanded', 'false');
    this._attachMenuOpen = false;
  }

  // ── Lightbox ──────────────────────────────────────────────────────────

  _openLightbox(src) {
    const lb = this.getContentEl()?.querySelector('#chat-lightbox');
    const img = this.getContentEl()?.querySelector('#lightbox-img');
    if (!lb || !img) return;
    img.src = src;
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
  }

  // ── Send ──────────────────────────────────────────────────────────────

  async _handleSend() {
    const el = this.getContentEl();
    const textarea = el?.querySelector('#chat-textarea');
    const text = textarea?.value.trim();
    if (!text || this._sending) return;

    // Edit mode
    if (this._editingMsgId) {
      this._sending = true;
      try {
        const msgId = this._editingMsgId;
        this._exitEditMode();
        const res = await api.chat.editMessage(msgId, text);
        if (res.error) { showToast('error', res.error.message || 'Could not edit message.'); return; }
        const msg = this._messages.find((m) => String(m.id) === String(msgId));
        if (msg) { msg.text = res.data?.text ?? text; msg.editedAt = res.data?.editedAt ?? new Date().toISOString(); }
        const msgEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
        if (msgEl && msg) msgEl.replaceWith(this._createMessageEl(msg));
        showToast('success', 'Message updated.');
      } finally {
        this._sending = false;
      }
      return;
    }

    this._sending = true;
    try {
      const replyTo = this._replyTo;
      const optimistic = {
        id: Date.now(),
        lgaId: this._activeLgaId,
        userId: store.currentUser?.id,
        userName: store.currentUser?.username || store.currentUser?.name,
        avatarUrl: store.currentUser?.avatarUrl,
        text, mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
        reactions: {}, replyTo, createdAt: new Date().toISOString(), _pending: true,
      };
      textarea.value = '';
      this._autoResizeTextarea(textarea);
      this._clearReply();
      this._appendMessage(optimistic);
      this._messages.push(optimistic);

      const res = await api.chat.sendMessage({ lgaId: this._activeLgaId, text, replyTo });
      const pendingEl = el?.querySelector(`.chat-msg[data-msg-id="${optimistic.id}"]`);

      if (res.error) {
        pendingEl?.classList.add('chat-msg--failed');
        const msg = res.error.code === 'FEATURE_DISABLED'
            ? 'Community chat has been disabled by the administrator.'
            : res.error.code === 'PROFANITY'
                ? res.error.message
                : 'Message failed to send.';
        showToast('error', msg);
        return;
      }

      if (pendingEl) pendingEl.replaceWith(this._createMessageEl(res.data));
      const idx = this._messages.findIndex((m) => m.id === optimistic.id);
      if (idx > -1) this._messages[idx] = res.data;
    } finally {
      this._sending = false;
    }
  }

  // ── Send sticker ──────────────────────────────────────────────────────

  async _sendSticker(emoji, label) {
    const optimisticId = Date.now();
    const optimistic = {
      id: optimisticId, lgaId: this._activeLgaId,
      userId: store.currentUser?.id,
      userName: store.currentUser?.username || store.currentUser?.name,
      avatarUrl: store.currentUser?.avatarUrl,
      text: null, stickerEmoji: emoji, stickerLabel: label,
      mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
      reactions: {}, replyTo: null, createdAt: new Date().toISOString(), _pending: true,
    };
    this._appendMessage(optimistic);
    this._messages.push(optimistic);

    // Send as text representation (server stores as text)
    const res = await api.chat.sendMessage({
      lgaId: this._activeLgaId,
      text: `[sticker:${emoji}:${label}]`,
    });

    const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
    if (res.error) {
      pendingEl?.classList.add('chat-msg--failed');
      showToast('error', 'Failed to send sticker.');
      return;
    }
    // Patch the response to include sticker data for re-render
    const msgData = { ...res.data, stickerEmoji: emoji, stickerLabel: label, text: null };
    if (pendingEl) pendingEl.replaceWith(this._createMessageEl(msgData));
    const idx = this._messages.findIndex((m) => m.id === optimisticId);
    if (idx > -1) this._messages[idx] = msgData;
  }

  // ── Send GIF ──────────────────────────────────────────────────────────

  async _sendGif(gifUrl, gifLabel) {
    const optimisticId = Date.now();
    const optimistic = {
      id: optimisticId, lgaId: this._activeLgaId,
      userId: store.currentUser?.id,
      userName: store.currentUser?.username || store.currentUser?.name,
      avatarUrl: store.currentUser?.avatarUrl,
      text: null, gifUrl, gifLabel,
      mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
      reactions: {}, replyTo: null, createdAt: new Date().toISOString(), _pending: true,
    };
    this._appendMessage(optimistic);
    this._messages.push(optimistic);

    const res = await api.chat.sendMessage({
      lgaId: this._activeLgaId,
      mediaUrl: gifUrl,
      fileUrl: gifUrl,
      fileName: `${gifLabel || 'gif'}.gif`,
    });

    const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
    if (res.error) {
      pendingEl?.classList.add('chat-msg--failed');
      showToast('error', 'Failed to send GIF.');
      return;
    }
    const msgData = { ...res.data, gifUrl, gifLabel, mediaUrl: null, fileUrl: null };
    if (pendingEl) pendingEl.replaceWith(this._createMessageEl(msgData));
    const idx = this._messages.findIndex((m) => m.id === optimisticId);
    if (idx > -1) this._messages[idx] = msgData;
  }

  // ── File attach ───────────────────────────────────────────────────────

  async _handleFileAttach(e, isImage = false) {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (e.target.value !== undefined) e.target.value = '';

    if (file.size > 20 * 1024 * 1024) {
      showToast('error', 'File must be under 20MB.');
      return;
    }

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const blobUrl = URL.createObjectURL(file);
    this._objectURLs.add(blobUrl);
    const optimisticId = Date.now();
    const isActualVideo = isVideoFile(blobUrl, file.name, file.type);
    const isActualImage = !isActualVideo && (isImage || isImageFile(blobUrl, file.name));
    const optimistic = {
      id: optimisticId, lgaId: this._activeLgaId,
      userId: store.currentUser?.id,
      userName: store.currentUser?.username || store.currentUser?.name,
      avatarUrl: store.currentUser?.avatarUrl,
      text: null,
      mediaUrl: isActualImage ? blobUrl : null,
      videoUrl: isActualVideo ? blobUrl : null,
      fileUrl: blobUrl,
      fileName: file.name, fileSize: `${sizeMB} MB`,
      mimeType: file.type,
      reactions: {}, replyTo: null, createdAt: new Date().toISOString(), _pending: true,
    };
    this._appendMessage(optimistic);
    this._messages.push(optimistic);

    const uploadRes = await api.chat.uploadFile(file);
    if (uploadRes.error) {
      const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
      pendingEl?.classList.add('chat-msg--failed');
      URL.revokeObjectURL(blobUrl);
      this._objectURLs.delete(blobUrl);
      showToast('error', 'File upload failed.');
      return;
    }

    const { url, fileName, fileSize, isImage: serverIsImage } = uploadRes.data;
    const finalIsVideo = isActualVideo || isVideoFile(url, fileName);
    const finalIsImage = !finalIsVideo && (isActualImage || serverIsImage || isImageFile(url, fileName));
    const msgRes = await api.chat.sendMessage({
      lgaId: this._activeLgaId,
      fileUrl: url,
      fileName: fileName || file.name,
      fileSize: `${sizeMB} MB`,
      mediaUrl: finalIsImage ? url : null,
      videoUrl: finalIsVideo ? url : null,
    });

    const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
    URL.revokeObjectURL(blobUrl);
    this._objectURLs.delete(blobUrl);

    if (msgRes.error) {
      pendingEl?.classList.add('chat-msg--failed');
      showToast('error', 'Failed to send file.');
      return;
    }
    if (pendingEl) pendingEl.replaceWith(this._createMessageEl(msgRes.data));
    const idx = this._messages.findIndex((m) => m.id === optimisticId);
    if (idx > -1) this._messages[idx] = msgRes.data;
  }


  // ── Voice notes ───────────────────────────────────────────────────────

  async _startVoiceNote() {
    if (this._isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('error', 'Voice notes are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._recordingChunks = [];
      this._recordingSeconds = 0;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._recordingChunks.push(e.data);
      };
      this._mediaRecorder.start(100);
      this._isRecording = true;

      const el = this.getContentEl();
      el?.querySelector('#chat-input-bar')?.classList.add('chat-input-bar--hidden');
      const recorder = el?.querySelector('#voice-recorder');
      if (recorder) { recorder.classList.add('chat-voice-recorder--active'); recorder.setAttribute('aria-hidden', 'false'); }

      this._recordingTimer = setInterval(() => {
        this._recordingSeconds++;
        const timerEl = this.getContentEl()?.querySelector('#voice-timer');
        if (timerEl) {
          const m = Math.floor(this._recordingSeconds / 60);
          const s = this._recordingSeconds % 60;
          timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        }
        if (this._recordingSeconds >= 120) this._stopVoiceNote(true);
      }, 1000);
    } catch {
      showToast('error', 'Microphone access denied. Please allow microphone in your browser settings.');
    }
  }

  async _stopVoiceNote(send = true) {
    if (!this._isRecording || !this._mediaRecorder) return;
    clearInterval(this._recordingTimer);
    this._isRecording = false;
    this._hideRecorderUI();

    const chunks = this._recordingChunks;
    const recorder = this._mediaRecorder;
    const stream = recorder.stream;
    this._recordingChunks = [];
    this._mediaRecorder = null;

    await new Promise((resolve) => {
      recorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); resolve(); };
      try { recorder.stop(); } catch { resolve(); }
    });

    if (send && chunks.length > 0) {
      const mimeType = chunks[0].type || 'audio/webm';
      const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(chunks, { type: mimeType });
      const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
      await this._sendVoiceNote(file);
    }
  }

  _cancelVoiceNote() {
    if (!this._isRecording) return;
    clearInterval(this._recordingTimer);
    this._isRecording = false;
    this._hideRecorderUI();
    const recorder = this._mediaRecorder;
    this._mediaRecorder = null;
    this._recordingChunks = [];
    if (recorder) {
      recorder.onstop = () => recorder.stream?.getTracks().forEach((t) => t.stop());
      try { recorder.stop(); } catch { /* noop */ }
    }
  }

  _hideRecorderUI() {
    const el = this.getContentEl();
    el?.querySelector('#chat-input-bar')?.classList.remove('chat-input-bar--hidden');
    const recorder = el?.querySelector('#voice-recorder');
    if (recorder) { recorder.classList.remove('chat-voice-recorder--active'); recorder.setAttribute('aria-hidden', 'true'); }
    const timerEl = el?.querySelector('#voice-timer');
    if (timerEl) timerEl.textContent = '0:00';
  }

  async _sendVoiceNote(file) {
    const optimisticId = Date.now();
    const blobUrl = URL.createObjectURL(file);
    this._objectURLs.add(blobUrl);
    const optimistic = {
      id: optimisticId, lgaId: this._activeLgaId,
      userId: store.currentUser?.id,
      userName: store.currentUser?.username || store.currentUser?.name,
      avatarUrl: store.currentUser?.avatarUrl,
      text: null, mediaUrl: null, fileUrl: blobUrl,
      fileName: file.name, fileSize: null,
      reactions: {}, replyTo: null, createdAt: new Date().toISOString(), _pending: true,
    };
    this._appendMessage(optimistic);
    this._messages.push(optimistic);

    const uploadRes = await api.chat.uploadFile(file);
    if (uploadRes.error) {
      const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
      pendingEl?.classList.add('chat-msg--failed');
      URL.revokeObjectURL(blobUrl);
      this._objectURLs.delete(blobUrl);
      showToast('error', 'Failed to upload voice note.');
      return;
    }

    const { url, fileName } = uploadRes.data;
    const msgRes = await api.chat.sendMessage({
      lgaId: this._activeLgaId,
      fileUrl: url,
      fileName: fileName || file.name,
      fileSize: null, mediaUrl: null,
    });

    const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
    URL.revokeObjectURL(blobUrl);
    this._objectURLs.delete(blobUrl);

    if (msgRes.error) {
      pendingEl?.classList.add('chat-msg--failed');
      showToast('error', 'Failed to send voice note.');
      return;
    }
    if (pendingEl) pendingEl.replaceWith(this._createMessageEl(msgRes.data));
    const idx = this._messages.findIndex((m) => m.id === optimisticId);
    if (idx > -1) this._messages[idx] = msgRes.data;
  }

  // ── Reactions ─────────────────────────────────────────────────────────

  async _handleReaction(msgId, emoji) {
    const res = await api.chat.toggleReaction(msgId, emoji);
    if (res.error) { showToast('error', 'Could not add reaction.'); return; }

    const msg = this._messages.find((m) => String(m.id) === String(msgId));
    if (msg) msg.reactions = res.data.reactions;

    const msgEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
    if (msgEl) {
      const existing = msgEl.querySelector('.chat-reactions-row');
      const updated = this._messages.find((m) => String(m.id) === String(msgId));
      const newHtml = this._renderReactions(updated);
      if (existing) existing.outerHTML = newHtml || '';
      else if (newHtml) msgEl.querySelector('.chat-msg__content')?.insertAdjacentHTML('beforeend', newHtml);

      // Pop animation on the reacted chip
      const chip = msgEl.querySelector(`.chat-reaction[data-emoji="${emoji}"]`);
      if (chip) {
        chip.classList.remove('chat-reaction--pop');
        void chip.offsetWidth; // reflow to restart animation
        chip.classList.add('chat-reaction--pop');
        chip.addEventListener('animationend', () => chip.classList.remove('chat-reaction--pop'), { once: true });
      }
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────

  _openContextMenu(msgId, x, y) {
    this._contextTarget = msgId;
    const menu = this.getContentEl()?.querySelector('#chat-context-menu');
    if (!menu) return;

    const msg = this._messages.find((m) => String(m.id) === String(msgId));
    const isOwn = msg && msg.userId === store.currentUser?.id;

    const editBtn = menu.querySelector('#context-edit-btn');
    if (editBtn) editBtn.style.display = isOwn && msg?.text ? '' : 'none';

    const actionBtn = menu.querySelector('[data-action="report"], [data-action="delete"]');
    if (actionBtn) {
      if (isOwn) {
        actionBtn.dataset.action = 'delete';
        actionBtn.className = 'chat-context-menu__item chat-context-menu__item--danger';
        actionBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete`;
      } else {
        actionBtn.dataset.action = 'report';
        actionBtn.className = 'chat-context-menu__item chat-context-menu__item--danger';
        actionBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Report`;
      }
    }

    menu.classList.add('chat-context-menu--open');
    menu.removeAttribute('inert');
    const vw = window.innerWidth, vh = window.innerHeight;
    menu.style.setProperty('--ctx-x', `${Math.min(x, vw - 200)}px`);
    menu.style.setProperty('--ctx-y', `${Math.min(y, vh - 260)}px`);
  }

  _closeContextMenu() {
    const el = this.getContentEl();
    const menu = el?.querySelector('#chat-context-menu');
    if (menu) { menu.classList.remove('chat-context-menu--open'); menu.setAttribute('inert', ''); }
    const grid = el?.querySelector('#context-emoji-grid');
    const ctxMore = el?.querySelector('#context-emoji-more');
    if (grid) { grid.setAttribute('inert', ''); grid.classList.remove('chat-context-menu__emoji-grid--open'); }
    if (ctxMore) ctxMore.setAttribute('aria-expanded', 'false');
    this._contextTarget = null;
  }

  _handleContextAction(action) {
    const msg = this._messages.find((m) => String(m.id) === String(this._contextTarget));
    this._closeContextMenu();
    if (!msg) return;
    if (action === 'copy') {
      navigator.clipboard?.writeText(msg.text || msg.fileName || '').then(() => showToast('success', 'Copied to clipboard.'));
    } else if (action === 'reply') {
      this._setReply(msg);
    } else if (action === 'edit') {
      this._editMessage(msg);
    } else if (action === 'report') {
      this._openReportModal(msg.id);
    } else if (action === 'delete') {
      this._deleteMessage(msg.id);
    }
  }

  // ── Edit own message ──────────────────────────────────────────────────

  _editMessage(msg) {
    this._replyTo = null;
    this._editingMsgId = msg.id;
    const el = this.getContentEl();
    const textarea = el?.querySelector('#chat-textarea');
    const bar = el?.querySelector('#chat-reply-bar');
    const barContent = el?.querySelector('#reply-bar-content');

    if (textarea) {
      textarea.value = msg.text || '';
      textarea.focus();
      this._autoResizeTextarea(textarea);
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }
    if (bar && barContent) {
      barContent.innerHTML = `
        <span class="chat-reply-bar__name">✏️ Editing message</span>
        <span class="chat-reply-bar__text">${this.esc((msg.text || '').slice(0, 80))}</span>
      `;
      bar.classList.add('chat-reply-bar--open', 'chat-reply-bar--editing');
      bar.setAttribute('aria-hidden', 'false');
    }
  }

  _exitEditMode() {
    this._editingMsgId = null;
    this._replyTo = null;
    const el = this.getContentEl();
    const textarea = el?.querySelector('#chat-textarea');
    const bar = el?.querySelector('#chat-reply-bar');
    if (textarea) { textarea.value = ''; this._autoResizeTextarea(textarea); }
    if (bar) {
      bar.classList.remove('chat-reply-bar--open', 'chat-reply-bar--editing');
      bar.setAttribute('aria-hidden', 'true');
    }
  }

  // ── Delete own message ────────────────────────────────────────────────

  async _deleteMessage(msgId) {
    // Animate out then delete
    const msgEl = this.getContentEl()?.querySelector(`[data-msg-id="${msgId}"]`);
    if (msgEl) msgEl.classList.add('chat-msg--deleting');

    const res = await api.chat.deleteMessage(msgId);
    if (res.error) {
      if (msgEl) msgEl.classList.remove('chat-msg--deleting');
      showToast('error', res.error.message || 'Could not delete message.');
      return;
    }
    this._messages = this._messages.filter((m) => String(m.id) !== String(msgId));

    // Find next sibling message BEFORE removing the element
    let nextMsgEl = msgEl ? msgEl.nextElementSibling : null;
    while (nextMsgEl && !nextMsgEl.classList.contains('chat-msg')) {
      nextMsgEl = nextMsgEl.nextElementSibling;
    }

    setTimeout(() => {
      msgEl?.remove();
      // Re-evaluate grouping for the message that now follows the deleted one
      this._recomputeGrouping(nextMsgEl);
    }, 220);
    showToast('success', 'Message deleted.');
  }

  // ── Paste image from clipboard ─────────────────────────────────────────

  _handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        // Treat as image file upload
        const syntheticEvent = { target: { files: [file], value: '' } };
        this._handleFileAttach(syntheticEvent, true);
        showToast('success', 'Uploading pasted image…');
        return;
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────

  _openReportModal(msgId) {
    this._reportMsgId = msgId;
    this._reportReason = null;
    const backdrop = this.getContentEl()?.querySelector('#report-backdrop');
    const submit = this.getContentEl()?.querySelector('#report-submit');
    const errEl = this.getContentEl()?.querySelector('#report-error');
    this.getContentEl()?.querySelectorAll('.chat-report-reason').forEach(b => b.classList.remove('chat-report-reason--active'));
    if (submit) submit.disabled = true;
    if (errEl) errEl.textContent = '';
    if (backdrop) { backdrop.classList.add('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'false'); }
  }

  _closeReportModal() {
    this._reportMsgId = null;
    this._reportReason = null;
    const backdrop = this.getContentEl()?.querySelector('#report-backdrop');
    if (backdrop) { backdrop.classList.remove('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'true'); }
  }

  async _handleReport() {
    if (!this._reportMsgId || !this._reportReason) return;
    const submitBtn = this.getContentEl()?.querySelector('#report-submit');
    const errEl = this.getContentEl()?.querySelector('#report-error');
    if (submitBtn) submitBtn.textContent = 'Submitting…';
    const res = await api.chat.reportMessage(this._reportMsgId, this._reportReason);
    if (submitBtn) submitBtn.textContent = 'Submit Report';
    if (res.error) {
      if (errEl) errEl.textContent = res.error.message || 'Could not submit report.';
      return;
    }
    this._closeReportModal();
    showToast('success', 'Message reported. Thank you.');
  }

  // ── Reply ─────────────────────────────────────────────────────────────

  _setReply(msg) {
    this._replyTo = { id: msg.id, userName: msg.userName, text: msg.text || msg.fileName || '' };
    const bar = this.getContentEl()?.querySelector('#chat-reply-bar');
    const content = this.getContentEl()?.querySelector('#reply-bar-content');
    if (bar && content) {
      content.innerHTML = `
        <span class="chat-reply-bar__name">${this.esc(msg.userName)}</span>
        <span class="chat-reply-bar__text">${this.esc((msg.text || msg.fileName || '').slice(0, 80))}</span>
      `;
      bar.classList.add('chat-reply-bar--open');
      bar.setAttribute('aria-hidden', 'false');
    }
    this.getContentEl()?.querySelector('#chat-textarea')?.focus();
  }

  _clearReply() {
    this._replyTo = null;
    const bar = this.getContentEl()?.querySelector('#chat-reply-bar');
    if (bar) { bar.classList.remove('chat-reply-bar--open'); bar.setAttribute('aria-hidden', 'true'); }
  }

  _scrollToMessage(msgId) {
    const el = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('chat-msg--highlight');
      setTimeout(() => el.classList.remove('chat-msg--highlight'), 1500);
    }
  }

  // ── Search ────────────────────────────────────────────────────────────

  _openSearch() {
    this._searchActive = true;
    const bar = this.getContentEl()?.querySelector('#chat-search-bar');
    const input = this.getContentEl()?.querySelector('#search-input');
    if (bar) { bar.classList.add('chat-search-bar--open'); bar.setAttribute('aria-hidden', 'false'); }
    setTimeout(() => input?.focus(), 100);
  }

  _closeSearch() {
    this._searchActive = false;
    this._clearSearchHighlights();
    const bar = this.getContentEl()?.querySelector('#chat-search-bar');
    const input = this.getContentEl()?.querySelector('#search-input');
    if (bar) { bar.classList.remove('chat-search-bar--open'); bar.setAttribute('aria-hidden', 'true'); }
    if (input) input.value = '';
    this._updateSearchNav();
  }

  _runSearch(query) {
    this._clearSearchHighlights();
    this._searchQuery = query.trim().toLowerCase();
    this._searchMatches = [];
    this._searchIdx = 0;
    if (!this._searchQuery) { this._updateSearchNav(); return; }
    this.getContentEl()?.querySelector('#chat-body')?.querySelectorAll('.chat-msg').forEach((msgEl) => {
      const text = msgEl.querySelector('.chat-msg__text')?.textContent.toLowerCase() || '';
      if (text.includes(this._searchQuery)) {
        msgEl.classList.add('chat-msg--search-match');
        this._searchMatches.push(Number(msgEl.dataset.msgId));
      }
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
    this.getContentEl()?.querySelectorAll('.chat-msg--search-match').forEach((el) => el.classList.remove('chat-msg--search-match'));
  }

  _updateSearchNav() {
    const nav = this.getContentEl()?.querySelector('#search-nav');
    const prev = this.getContentEl()?.querySelector('#search-prev');
    const next = this.getContentEl()?.querySelector('#search-next');
    const total = this._searchMatches.length;
    if (nav) nav.textContent = total ? `${this._searchIdx + 1} / ${total}` : (this._searchQuery ? '0 results' : '');
    if (prev) prev.disabled = total < 2;
    if (next) next.disabled = total < 2;
  }

  // ── Kebab ─────────────────────────────────────────────────────────────

  _handleKebab(action) {
    if (action === 'mute') {
      this._chatMuted = !this._chatMuted;
      // Update the button label and icon to reflect the new state
      const muteBtn = this.getContentEl()?.querySelector('[data-kebab="mute"]');
      if (muteBtn) {
        const ICON_BELL_MUTED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
        const ICON_BELL = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;
        muteBtn.innerHTML = `${this._chatMuted ? ICON_BELL_MUTED : ICON_BELL} ${this._chatMuted ? 'Unmute notifications' : 'Mute notifications'}`;
      }
      showToast('success', this._chatMuted ? 'Notifications muted.' : 'Notifications unmuted.');
    }
    else if (action === 'members') this._openMembersModal();
    else if (action === 'clear') {
      const body = this.getContentEl()?.querySelector('#chat-body');
      if (body) body.innerHTML = '';
      this._messages = []; this._lastRenderedDate = null;
      for (const url of this._objectURLs) URL.revokeObjectURL(url);
      this._objectURLs.clear();
      showToast('success', 'Chat cleared locally.');
    }
  }

  // ── Invite ────────────────────────────────────────────────────────────

  _openInviteModal() {
    const backdrop = this.getContentEl()?.querySelector('#invite-backdrop');
    if (backdrop) { backdrop.classList.add('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'false'); }
    setTimeout(() => this.getContentEl()?.querySelector('#invite-phone')?.focus(), 100);
  }

  _closeInviteModal() {
    const backdrop = this.getContentEl()?.querySelector('#invite-backdrop');
    if (backdrop) { backdrop.classList.remove('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'true'); }
    const phone = this.getContentEl()?.querySelector('#invite-phone');
    const err = this.getContentEl()?.querySelector('#invite-error');
    if (phone) phone.value = '';
    if (err) err.textContent = '';
  }

  async _handleInvite() {
    const phoneEl = this.getContentEl()?.querySelector('#invite-phone');
    const errEl = this.getContentEl()?.querySelector('#invite-error');
    const sendBtn = this.getContentEl()?.querySelector('#invite-send');
    const phone = phoneEl?.value.trim();
    if (!phone) { if (errEl) errEl.textContent = 'Please enter a phone number.'; return; }
    if (errEl) errEl.textContent = '';
    if (sendBtn) sendBtn.textContent = 'Sending…';
    const res = await api.chat.inviteMember(phone);
    if (sendBtn) sendBtn.textContent = 'Send Invite';
    if (res.error) { if (errEl) errEl.textContent = res.error.message; return; }
    this._closeInviteModal();
    showToast('success', 'Invite sent!');
  }

  // ── Members ───────────────────────────────────────────────────────────

  async _openMembersModal() {
    const backdrop = this.getContentEl()?.querySelector('#members-backdrop');
    if (backdrop) { backdrop.classList.add('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'false'); }
    const list = this.getContentEl()?.querySelector('#members-list');
    if (list) list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>';

    const res = await api.chat.getMembers();
    if (!list) return;
    if (res.error) { list.innerHTML = '<p style="color:var(--color-error);">Failed to load members.</p>'; return; }

    const members = res.data || [];
    if (!members.length) { list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">No members found.</p>'; return; }

    list.innerHTML = members.map((m) => `
      <div class="chat-member-row">
        <div class="chat-member-row__avatar">
          ${m.avatarUrl
        ? `<img src="${this.esc(m.avatarUrl)}" alt="" width="36" height="36" style="border-radius:50%;object-fit:cover;" />`
        : `<div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--color-primary);">${this.esc(m.name?.charAt(0)?.toUpperCase() || '?')}</div>`
    }
        </div>
        <div class="chat-member-row__info">
          <p class="chat-member-row__name">${this.esc(m.name)}</p>
          <p class="chat-member-row__status">${m.status === 'active' ? 'Active' : 'Inactive'}</p>
        </div>
      </div>
    `).join('');
  }

  _closeMembersModal() {
    const backdrop = this.getContentEl()?.querySelector('#members-backdrop');
    if (backdrop) { backdrop.classList.remove('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'true'); }
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  _autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  beforeUnmount() {
    sseClient.onMessage(null);
    document.body.style.overflow = '';
    for (const url of this._objectURLs) URL.revokeObjectURL(url);
    this._objectURLs.clear();
  }
}
