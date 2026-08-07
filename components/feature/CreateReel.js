/**
 * Lagos Konect — Create Reel Modal
 * ============================================================
 * Citizen reel upload modal. Opens from the sidebar "Create" item.
 *
 * Capabilities:
 *   - Upload a video (max 60s / 150MB) or image
 *   - Drag-and-drop or file picker
 *   - Optional caption with emoji picker
 *   - Optional hashtags (up to 10)
 *   - Real-time upload progress bar
 *   - Auto-generated video thumbnail
 *
 * Architecture:
 *   Direct DOM mutation — no setState/re-render so this.el is never
 *   replaced. Safe to cache as a body-level singleton.
 *
 * Mount once in BaseLayout (WebLayout.afterMount):
 *   window._createReelModal = new CreateReelModal();
 *   await window._createReelModal.mount(document.body, { append: true });
 *
 * Open from anywhere:
 *   window._createReelModal.open();
 *
 * @module  CreateReelModal
 * @version 2.0.0
 */

import { Component }              from '../../core/component.js?v=20260806h';
import { Avatar }                 from '../base/UI.js?v=20260806h';
import { store, showToast }       from '../../core/store.js?v=20260806h';
import { api }                    from '../../api/client.js?v=20260806h';
import { extractVideoThumbnail }  from '../../utils/thumbnail.js?v=20260806h';

/* ── Constants ──────────────────────────────────────────────────────────── */
const MAX_CAPTION   = 2200;
const MAX_BYTES     = 150 * 1024 * 1024;   // 150 MB
const MAX_HASHTAGS  = 10;
const ACCEPTED_MIME = 'image/*,video/*';

const EMOJI_LIST = Object.freeze([
  '😀','😂','😍','😎','😭','😡','👍','👎','❤️','🔥',
  '🎉','💯','🙏','👏','🤔','😅','😊','🥺','😱','🤣',
  '💪','🌿','🌟','⚡','📢','🗣️','🫶','🤝','👀','✅',
]);

/* ── SVG icons ──────────────────────────────────────────────────────────── */
const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

const ICON_VIDEO = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`;

const ICON_SMILE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`;

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */
export class CreateReelModal extends Component {
  static styles = '/components/feature/CreatePost.css?v=20260806h';

  constructor(props = {}) {
    super(props);

    /** @type {File|null} */
    this._file        = null;
    this._preview     = null;
    this._isVideo     = false;
    this._caption     = '';
    this._hashtags    = [];
    this._emojiOpen   = false;
    this._submitting  = false;
    this._isOpen      = false;
    /** @type {Element|null} Focus target before the modal opened */
    this._prevFocus   = null;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const user      = store.currentUser;
    const avatarHtml = Avatar.html({
      name:     user?.name || '',
      imageUrl: user?.avatarUrl ?? null,
      size:     'sm',
    });

    const emojiButtons = EMOJI_LIST.map((e) =>
      `<button class="cp-emoji-item" type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`
    ).join('');

    return `
      <div
        class="cp-overlay"
        id="cr-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cr-title"
        aria-hidden="true"
      >
        <div class="cp-modal" id="cr-modal">

          <!-- ── Header ──────────────────────────────────────────────── -->
          <div class="cp-modal__header">
            <h2 class="cp-modal__title" id="cr-title">Create Reel</h2>
            <button
              class="cp-modal__close"
              id="cr-close"
              type="button"
              aria-label="Close create reel modal"
            >
              ${ICON_CLOSE}
            </button>
          </div>

          <!-- ── Body ────────────────────────────────────────────────── -->
          <div class="cp-modal__body">
            <div class="cp-layout">

              <!-- Left: media upload zone -->
              <section
                class="cp-media"
                id="cr-media-zone"
                aria-label="Media upload area"
              >
                <div class="cp-media__inner">

                  <!-- Placeholder (shown when no file is selected) -->
                  <div class="cp-media__placeholder" id="cr-placeholder">
                    <div class="cp-media__icon">${ICON_VIDEO}</div>
                    <p class="cp-media__hint">Drag video or image here</p>
                    <p class="cp-media__hint cp-media__hint--small">Max 60s · 150 MB</p>
                    <input
                      type="file"
                      id="cr-file-input"
                      class="cp-media__file-input"
                      accept="${ACCEPTED_MIME}"
                      aria-label="Select a video or image file"
                    />
                    <button
                      class="ktg-btn ktg-btn--primary ktg-btn--sm"
                      id="cr-select-btn"
                      type="button"
                    >
                      Select file
                    </button>
                  </div>

                  <!-- Preview (shown after file selection) -->
                  <div
                    class="cp-media__preview"
                    id="cr-preview"
                    aria-label="Media preview"
                    aria-hidden="true"
                  ></div>

                  <!-- Remove media -->
                  <button
                    class="cp-media__remove"
                    id="cr-remove"
                    type="button"
                    aria-label="Remove selected media"
                    aria-hidden="true"
                  >
                    ${ICON_CLOSE}
                  </button>

                </div>
              </section>

              <!-- Right: caption + hashtags -->
              <div class="cp-right">

                <!-- Author row -->
                <div class="cp-user" aria-hidden="true">
                  ${avatarHtml}
                  <span class="cp-user__name">${this.esc(user?.name || '')}</span>
                </div>

                <!-- Caption -->
                <div class="cp-caption-wrap">
                  <label for="cr-caption" class="sr-only">Reel caption</label>
                  <textarea
                    class="cp-caption"
                    id="cr-caption"
                    placeholder="Write a caption…"
                    maxlength="${MAX_CAPTION}"
                    rows="5"
                    aria-label="Reel caption"
                    aria-describedby="cr-count"
                  ></textarea>

                  <div class="cp-caption-bar">
                    <button
                      class="cp-emoji-btn"
                      id="cr-emoji-btn"
                      type="button"
                      aria-label="Insert emoji"
                      aria-haspopup="true"
                      aria-expanded="false"
                      aria-controls="cr-emoji-panel"
                    >
                      ${ICON_SMILE}
                    </button>
                    <span
                      class="cp-caption-count"
                      id="cr-count"
                      aria-live="polite"
                      aria-atomic="true"
                    >0 / ${MAX_CAPTION}</span>
                  </div>

                  <div
                    class="cp-emoji-panel"
                    id="cr-emoji-panel"
                    role="listbox"
                    aria-label="Emoji picker"
                    inert
                  >
                    ${emojiButtons}
                  </div>
                </div>

                <!-- Hashtags -->
                <div class="cr-hashtags" id="cr-hashtags-wrap">
                  <div
                    class="cr-hashtags__chips"
                    id="cr-chips"
                    role="list"
                    aria-label="Added hashtags"
                  ></div>
                  <div class="cr-hashtags__input-row">
                    <label for="cr-hashtag-input" class="sr-only">Add hashtag</label>
                    <input
                      type="text"
                      class="cr-hashtags__input"
                      id="cr-hashtag-input"
                      placeholder="Add hashtag (press Enter)"
                      autocomplete="off"
                      maxlength="40"
                      aria-describedby="cr-hashtag-hint"
                    />
                  </div>
                  <p class="sr-only" id="cr-hashtag-hint">
                    Press Enter or comma to add a hashtag. Maximum ${MAX_HASHTAGS} hashtags.
                  </p>
                </div>

                <!-- Upload progress -->
                <div
                  class="cr-progress"
                  id="cr-progress"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="0"
                  aria-label="Upload progress"
                  aria-hidden="true"
                >
                  <div class="cr-progress__bar-track">
                    <div class="cr-progress__bar" id="cr-progress-bar"></div>
                  </div>
                  <span class="cr-progress__label" id="cr-progress-label" aria-live="polite">
                    Uploading… 0%
                  </span>
                </div>

              </div>
            </div>
          </div>

          <!-- ── Footer ──────────────────────────────────────────────── -->
          <div class="cp-modal__footer">
            <span class="cp-footer__hint">Reels are posted immediately to your LGA.</span>
            <button
              class="cp-share-btn"
              id="cr-share-btn"
              type="button"
              disabled
              aria-disabled="true"
            >
              Share
            </button>
          </div>

        </div>
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    this._bindEvents();
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  open() {
    if (this._isOpen) return;
    this._isOpen    = true;
    this._prevFocus = document.activeElement;

    this.el.removeAttribute('aria-hidden');
    this.el.classList.add('cp-overlay--visible');
    document.body.style.overflow = 'hidden';

    // Move focus into the modal after the transition starts
    setTimeout(() => this._el('cr-caption')?.focus(), 100);
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;

    this.el.setAttribute('aria-hidden', 'true');
    this.el.classList.remove('cp-overlay--visible');
    document.body.style.overflow = '';

    // Restore focus to the element that opened the modal
    this._prevFocus?.focus();
    this._reset();
  }

  /* ── Event binding ────────────────────────────────────────────────────── */

  /** @private */
  _bindEvents() {
    // ── Close ──────────────────────────────────────────────────────────
    this._el('cr-close')?.addEventListener('click', () => this.close());

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) this.close();
    });

    // ── File picker ────────────────────────────────────────────────────
    const fileInput = this._el('cr-file-input');
    this._el('cr-select-btn')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this._handleFile(file);
      // Reset so selecting the same file again fires change
      e.target.value = '';
    });

    // ── Drag and drop ──────────────────────────────────────────────────
    const zone = this._el('cr-media-zone');
    if (zone) {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('cp-media--dragging');
      });

      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('cp-media--dragging');
        }
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('cp-media--dragging');
        const file = e.dataTransfer?.files?.[0];
        if (file) this._handleFile(file);
      });
    }

    // ── Remove media ───────────────────────────────────────────────────
    this._el('cr-remove')?.addEventListener('click', () => this._clearMedia());

    // ── Caption ────────────────────────────────────────────────────────
    const captionEl = this._el('cr-caption');
    captionEl?.addEventListener('input', () => {
      this._caption = captionEl.value;
      const count = this._el('cr-count');
      if (count) count.textContent = `${this._caption.length} / ${MAX_CAPTION}`;
    });

    // ── Emoji picker ───────────────────────────────────────────────────
    const emojiBtn   = this._el('cr-emoji-btn');
    const emojiPanel = this._el('cr-emoji-panel');

    emojiBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._setEmojiPanel(!this._emojiOpen);
    });

    emojiPanel?.addEventListener('click', (e) => {
      const btn = e.target.closest('.cp-emoji-item');
      if (!btn) return;

      const emoji = btn.dataset.emoji;
      const ta    = this._el('cr-caption');
      if (ta && emoji) {
        const pos   = ta.selectionStart ?? ta.value.length;
        ta.value    = ta.value.slice(0, pos) + emoji + ta.value.slice(pos);
        ta.selectionStart = ta.selectionEnd = pos + emoji.length;
        this._caption = ta.value;

        const count = this._el('cr-count');
        if (count) count.textContent = `${this._caption.length} / ${MAX_CAPTION}`;
        ta.focus();
      }

      this._setEmojiPanel(false);
    });

    // Close emoji panel on outside click
    document.addEventListener('click', () => {
      if (this._emojiOpen) this._setEmojiPanel(false);
    });

    // Trap Escape inside emoji panel
    emojiPanel?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._setEmojiPanel(false);
        emojiBtn?.focus();
      }
    });

    // ── Hashtags ───────────────────────────────────────────────────────
    const hashInput = this._el('cr-hashtag-input');

    hashInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this._addHashtag(hashInput.value.trim());
        hashInput.value = '';
      }
      // Backspace on empty input removes last tag
      if (e.key === 'Backspace' && !hashInput.value && this._hashtags.length) {
        this._removeHashtag(this._hashtags[this._hashtags.length - 1]);
      }
    });

    hashInput?.addEventListener('blur', () => {
      if (hashInput.value.trim()) {
        this._addHashtag(hashInput.value.trim());
        hashInput.value = '';
      }
    });

    // ── Share ──────────────────────────────────────────────────────────
    this._el('cr-share-btn')?.addEventListener('click', () => this._handleShare());
  }

  /* ── File handling ────────────────────────────────────────────────────── */

  /** @private */
  _handleFile(file) {
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      showToast('error', 'Only video and image files are supported.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast('error', 'File must not exceed 150 MB.');
      return;
    }

    this._file    = file;
    this._isVideo = file.type.startsWith('video/');

    const reader  = new FileReader();
    reader.onload = (e) => {
      this._preview = e.target.result;
      this._showPreview(this._isVideo, e.target.result);
      this._updateShareBtn();
    };
    reader.onerror = () => {
      showToast('error', 'Could not read the selected file.');
    };
    reader.readAsDataURL(file);
  }

  /** @private */
  _showPreview(isVideo, src) {
    const placeholder = this._el('cr-placeholder');
    const preview     = this._el('cr-preview');
    const removeBtn   = this._el('cr-remove');

    if (!preview) return;

    preview.innerHTML = isVideo
      ? `<video
           class="cp-media__video"
           src="${src}"
           controls
           muted
           playsinline
           aria-label="Video preview"
         ></video>`
      : `<img
           class="cp-media__img"
           src="${src}"
           alt="Selected image preview"
         />`;

    placeholder?.classList.add('cp-media__placeholder--hidden');
    preview.classList.add('cp-media__preview--visible');
    preview.setAttribute('aria-hidden', 'false');

    if (removeBtn) {
      removeBtn.classList.add('cp-media__remove--visible');
      removeBtn.setAttribute('aria-hidden', 'false');
    }
  }

  /** @private */
  _clearMedia() {
    this._file    = null;
    this._preview = null;
    this._isVideo = false;

    const placeholder = this._el('cr-placeholder');
    const preview     = this._el('cr-preview');
    const removeBtn   = this._el('cr-remove');

    placeholder?.classList.remove('cp-media__placeholder--hidden');

    if (preview) {
      preview.innerHTML = '';
      preview.classList.remove('cp-media__preview--visible');
      preview.setAttribute('aria-hidden', 'true');
    }

    if (removeBtn) {
      removeBtn.classList.remove('cp-media__remove--visible');
      removeBtn.setAttribute('aria-hidden', 'true');
    }

    this._updateShareBtn();
  }

  /* ── Hashtags ─────────────────────────────────────────────────────────── */

  /** @private */
  _addHashtag(raw) {
    if (!raw) return;
    if (this._hashtags.length >= MAX_HASHTAGS) {
      showToast('info', `Maximum ${MAX_HASHTAGS} hashtags allowed.`);
      return;
    }
    const tag = raw.startsWith('#') ? raw.toLowerCase() : `#${raw.toLowerCase()}`;
    if (this._hashtags.includes(tag)) return;
    this._hashtags.push(tag);
    this._renderChips();
  }

  /** @private */
  _removeHashtag(tag) {
    this._hashtags = this._hashtags.filter((t) => t !== tag);
    this._renderChips();
  }

  /** @private */
  _renderChips() {
    const chips = this._el('cr-chips');
    if (!chips) return;

    chips.innerHTML = this._hashtags.map((tag) => `
      <span class="cr-hashtags__chip" role="listitem">
        <span>${this.esc(tag)}</span>
        <button
          class="cr-hashtags__chip-remove"
          type="button"
          data-tag="${this.esc(tag)}"
          aria-label="Remove hashtag ${this.esc(tag)}"
        >×</button>
      </span>
    `).join('');

    chips.querySelectorAll('.cr-hashtags__chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => this._removeHashtag(btn.dataset.tag));
    });
  }

  /* ── Upload progress ──────────────────────────────────────────────────── */

  /** @private */
  _showProgress(pct) {
    const wrap  = this._el('cr-progress');
    const bar   = this._el('cr-progress-bar');
    const label = this._el('cr-progress-label');

    if (wrap) {
      wrap.removeAttribute('aria-hidden');
      wrap.classList.add('cr-progress--visible');
      wrap.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    if (bar)   bar.style.width = `${pct}%`;
    if (label) label.textContent = pct < 100 ? `Uploading… ${Math.round(pct)}%` : 'Processing…';
  }

  /** @private */
  _hideProgress() {
    const wrap = this._el('cr-progress');
    if (wrap) {
      wrap.setAttribute('aria-hidden', 'true');
      wrap.classList.remove('cr-progress--visible');
      wrap.setAttribute('aria-valuenow', '0');
    }
    const bar = this._el('cr-progress-bar');
    if (bar) bar.style.width = '0%';
  }

  /* ── Share / upload ───────────────────────────────────────────────────── */

  /** @private */
  async _handleShare() {
    if (!this._file || this._submitting) return;
    this._submitting = true;

    const shareBtn = this._el('cr-share-btn');
    this._setShareBtn(shareBtn, true, 'Uploading…');

    try {
      const thumbnailBlob = this._isVideo
        ? await extractVideoThumbnail(this._file).catch(() => null)
        : null;

      const res = await api.reels.upload(
        this._file,
        this._caption.trim(),
        this._hashtags,
        (pct) => this._showProgress(pct),
        thumbnailBlob,
      );

      if (res.error) {
        showToast('error', res.error.message || 'Upload failed. Please try again.');
        return;
      }

      showToast('success', 'Reel posted! 🎉');
      this._hideProgress();
      this.close();

    } catch (err) {
      console.error('[CreateReelModal] upload error:', err);
      showToast('error', 'Something went wrong during upload.');
    } finally {
      this._submitting = false;
      this._setShareBtn(shareBtn, !this._file, 'Share');
    }
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  /**
   * Shorthand for querying elements within this component.
   * @private
   * @param {string} id
   * @returns {Element|null}
   */
  _el(id) {
    return this.el?.querySelector(`#${id}`) ?? null;
  }

  /** @private */
  _updateShareBtn() {
    const btn = this._el('cr-share-btn');
    if (!btn) return;
    this._setShareBtn(btn, !this._file, 'Share');
  }

  /**
   * @private
   * @param {Element|null} btn
   * @param {boolean}      disabled
   * @param {string}       label
   */
  _setShareBtn(btn, disabled, label) {
    if (!btn) return;
    btn.disabled = disabled;
    btn.setAttribute('aria-disabled', String(disabled));
    btn.textContent = label;
  }

  /** @private */
  _setEmojiPanel(open) {
    const panel = this._el('cr-emoji-panel');
    const btn   = this._el('cr-emoji-btn');

    this._emojiOpen = open;

    if (panel) {
      if (open) {
        panel.removeAttribute('inert');
        panel.classList.add('cp-emoji-panel--open');
      } else {
        panel.setAttribute('inert', '');
        panel.classList.remove('cp-emoji-panel--open');
      }
    }

    btn?.setAttribute('aria-expanded', String(open));
  }

  /** @private — resets all state and DOM after close */
  _reset() {
    this._file       = null;
    this._preview    = null;
    this._isVideo    = false;
    this._caption    = '';
    this._hashtags   = [];
    this._emojiOpen  = false;
    this._submitting = false;

    const ta = this._el('cr-caption');
    if (ta) ta.value = '';

    const count = this._el('cr-count');
    if (count) count.textContent = `0 / ${MAX_CAPTION}`;

    const hashInput = this._el('cr-hashtag-input');
    if (hashInput) hashInput.value = '';

    this._renderChips();
    this._clearMedia();
    this._hideProgress();
    this._setEmojiPanel(false);
    this._updateShareBtn();
  }
}