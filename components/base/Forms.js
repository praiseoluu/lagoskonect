/**
 * Lagos Konect — Form Components
 * ============================================================
 * A suite of specialised form primitives that complement the
 * base Input component for richer interaction patterns.
 *
 * Exports:
 *   OTPInput     — 4- or 6-digit one-time-password field with
 *                  auto-focus progression, paste support and
 *                  keyboard navigation.
 *
 *   Dropdown     — Single-select listbox with optional live
 *                  search, outside-click dismissal and full
 *                  keyboard accessibility.
 *
 *   FileUpload   — Drag-and-drop file picker with image preview,
 *                  per-file size validation and multi-file support.
 *
 *   ProgressBar  — Determinate progress indicator available as
 *                  a mounted Component or a static HTML helper.
 *                  Supports animated stripe fill and five colour
 *                  variants.
 *
 *   ChatBubble   — Sent / received message bubble used inside
 *                  the citizen-engagement chat interface.
 *                  Available as a mounted Component or a static
 *                  HTML helper for list rendering.
 *
 * @module  Form
 * @version 2.0.0
 */

import { Component } from '../../core/component.js?v=20260806g';
import { timeAgo }   from '../../utils/date.js?v=20260806g';

/* ── Shared SVG constants ───────────────────────────────────────────────── */

const ICON = Object.freeze({
  file: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>`,

  upload: `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
    </svg>`,

  close: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,

  chevronDown: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`,

  check: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,
});

/* ══════════════════════════════════════════════════════════════════════════
   OTPInput — one-time password field
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Renders a row of single-digit inputs for OTP entry.
 * Supports 4- or 6-digit codes, paste, backspace and arrow navigation.
 *
 * Usage:
 *   const otp = new OTPInput({
 *     length:     6,
 *     onComplete: (code) => verifyOtp(code),
 *   });
 *   otp.mount(container);
 *
 *   otp.clear();
 *   otp.setError('Invalid code. Please try again.');
 */
export class OTPInput extends Component {
  static styles = '/components/base/Forms.css?v=20260806g';

  constructor(props = {}) {
    super({
      length:     4,      // 4 | 6
      onComplete: null,   // (code: string) => void
      onChange:   null,   // (code: string) => void
      error:      '',
      disabled:   false,
      ...props,
    });

    this._state = {
      values: Array(props.length ?? 4).fill(''),
      error:  props.error ?? '',
    };
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { length, disabled }   = this.props;
    const { values, error }      = this._state;

    const inputs = Array.from({ length }, (_, i) => `
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="1"
        class="adm-otp__input${values[i] ? ' adm-otp__input--filled' : ''}"
        data-otp-index="${i}"
        value="${values[i] ?? ''}"
        ${disabled ? 'disabled' : ''}
        aria-label="Digit ${i + 1} of ${length}"
        autocomplete="${i === 0 ? 'one-time-code' : 'off'}"
      />
    `).join('');

    return `
      <div class="adm-otp${error ? ' adm-otp--error' : ''}"
           role="group"
           aria-label="One-time password">
        <div class="adm-otp__inputs">${inputs}</div>
        ${error
          ? `<p class="adm-otp__error" role="alert">${Component.escape(error)}</p>`
          : ''}
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    /* ── Keyboard navigation ──────────────────────────────────────────── */
    this.delegate('.adm-otp__input', 'keydown', (e, input) => {
      const idx = parseInt(input.dataset.otpIndex, 10);

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (input.value) {
          this._setValue(idx, '');
        } else if (idx > 0) {
          this._setValue(idx - 1, '');
          this._focus(idx - 1);
        }
        return;
      }

      if (e.key === 'ArrowLeft'  && idx > 0) {
        e.preventDefault(); this._focus(idx - 1); return;
      }
      if (e.key === 'ArrowRight' && idx < this.props.length - 1) {
        e.preventDefault(); this._focus(idx + 1); return;
      }
    });

    /* ── Value entry (includes paste) ────────────────────────────────── */
    this.delegate('.adm-otp__input', 'input', (e, input) => {
      const idx = parseInt(input.dataset.otpIndex, 10);
      const raw = input.value.replace(/\D/g, '');
      if (!raw) return;

      // Multi-character entry = paste
      if (raw.length > 1) {
        const chars   = raw.slice(0, this.props.length - idx).split('');
        chars.forEach((ch, i) => this._setValue(idx + i, ch, false));
        this._notify();
        this._focus(Math.min(idx + chars.length, this.props.length - 1));
        return;
      }

      this._setValue(idx, raw, false);
      this._notify();
      if (idx < this.props.length - 1) this._focus(idx + 1);
    });

    /* ── Select on focus for easy overwrite ──────────────────────────── */
    this.delegate('.adm-otp__input', 'focus', (_, input) => input.select());

    // Auto-focus the first cell on mount
    requestAnimationFrame(() => this._focus(0));
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  /**
   * Updates a single cell's value.
   * When `rerender` is false the DOM is patched directly for
   * performance during rapid entry / paste events.
   *
   * @param {number}  idx
   * @param {string}  value
   * @param {boolean} [rerender=true]
   */
  _setValue(idx, value, rerender = true) {
    const values  = [...this._state.values];
    values[idx]   = value;
    this._state.values = values;

    if (rerender) {
      const input = this.$$('.adm-otp__input')[idx];
      if (input) {
        input.value = value;
        input.classList.toggle('adm-otp__input--filled', Boolean(value));
      }
    }
  }

  /** Moves focus to the cell at `idx`. */
  _focus(idx) {
    this.$$('.adm-otp__input')[idx]?.focus();
  }

  /** Fires onChange and, when complete, onComplete. */
  _notify() {
    const code = this._state.values.join('');
    this.props.onChange?.(code);
    if (code.length === this.props.length && !this._state.values.includes('')) {
      this.props.onComplete?.(code);
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /** Returns the current OTP string. */
  getValue() { return this._state.values.join(''); }

  /** Clears all cells and returns focus to the first. */
  clear() {
    this._state = { values: Array(this.props.length).fill(''), error: '' };
    this.setState({});           // trigger re-render
    requestAnimationFrame(() => this._focus(0));
  }

  /**
   * Displays a validation error below the inputs.
   * @param {string} message
   */
  setError(message) {
    this._state.error = message;
    this.setState({});
    requestAnimationFrame(() => this._focus(0));
  }

  /** Removes the current error message. */
  clearError() {
    this._state.error = '';
    this.setState({});
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Dropdown — single-select listbox
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Accessible single-select dropdown with optional live search.
 *
 * Usage:
 *   const dd = new Dropdown({
 *     label:      'Select LGA',
 *     options:    [{ value: '1', label: 'Ikeja' }, …],
 *     searchable: true,
 *     onChange:   (option) => setLGA(option),
 *   });
 *   dd.mount(container);
 *
 *   dd.getValue();          // currently selected value
 *   dd.setValue('1');       // programmatic selection
 *   dd.setError('Required');
 */
export class Dropdown extends Component {
  static styles = '/components/base/Forms.css?v=20260806g';

  constructor(props = {}) {
    super({
      label:       '',
      placeholder: 'Select an option',
      options:     [],     // Array<{ value, label, disabled? }>
      value:       null,
      searchable:  false,
      disabled:    false,
      error:       '',
      onChange:    null,
      ...props,
    });

    this._state = {
      isOpen: false,
      search: '',
      value:  props.value ?? null,
    };

    // Stable generated ID for label ↔ trigger association
    this._triggerId = `adm-dropdown-${this._id}`;
    // Outside-click cleanup reference
    this._outsideHandler = null;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { label, placeholder, options, searchable, disabled, error } = this.props;
    const { isOpen, search, value } = this._state;

    const selected = options.find((o) => o.value === value) ?? null;
    const filtered = searchable && search
      ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
      : options;

    const rootClasses = [
      'adm-dropdown',
      isOpen    ? 'adm-dropdown--open'     : '',
      disabled  ? 'adm-dropdown--disabled' : '',
      error     ? 'adm-dropdown--error'    : '',
    ].filter(Boolean).join(' ');

    const menuHtml = isOpen ? `
      <div class="adm-dropdown__menu"
           role="listbox"
           aria-label="${Component.escape(label || placeholder)}">
        ${searchable ? `
          <div class="adm-dropdown__search-wrap">
            <input
              type="text"
              class="adm-dropdown__search"
              placeholder="Search…"
              value="${Component.escape(search)}"
              aria-label="Search options"
              autocomplete="off"
            />
          </div>` : ''}
        <div class="adm-dropdown__options">
          ${filtered.length === 0
            ? `<div class="adm-dropdown__empty">No options found</div>`
            : filtered.map((opt) => `
                <div
                  class="adm-dropdown__option${opt.value === value ? ' adm-dropdown__option--selected' : ''}${opt.disabled ? ' adm-dropdown__option--disabled' : ''}"
                  role="option"
                  aria-selected="${opt.value === value}"
                  data-option-value="${Component.escape(String(opt.value))}"
                >
                  <span>${Component.escape(opt.label)}</span>
                  ${opt.value === value ? ICON.check : ''}
                </div>`).join('')}
        </div>
      </div>` : '';

    return `
      <div class="${rootClasses}">
        ${label
          ? `<label class="adm-dropdown__label"
                    for="${this._triggerId}">${Component.escape(label)}</label>`
          : ''}

        <button
          type="button"
          class="adm-dropdown__trigger"
          id="${this._triggerId}"
          aria-haspopup="listbox"
          aria-expanded="${isOpen}"
          ${disabled ? 'disabled' : ''}
        >
          <span class="adm-dropdown__value${!selected ? ' adm-dropdown__value--placeholder' : ''}">
            ${selected
              ? Component.escape(selected.label)
              : Component.escape(placeholder)}
          </span>
          <span class="adm-dropdown__arrow">${ICON.chevronDown}</span>
        </button>

        ${menuHtml}

        ${error
          ? `<span class="adm-dropdown__error" role="alert">${Component.escape(error)}</span>`
          : ''}
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    /* ── Trigger: open / close ────────────────────────────────────────── */
    this.delegate('.adm-dropdown__trigger', 'click', () => {
      if (this._state.isOpen) {
        this._close();
      } else {
        this._open();
      }
    });

    /* ── Option selection ─────────────────────────────────────────────── */
    this.delegate('[data-option-value]', 'click', (_, opt) => {
      const option = this.props.options.find(
        (o) => String(o.value) === opt.dataset.optionValue
      );
      if (!option || option.disabled) return;
      this._state.value  = option.value;
      this._state.isOpen = false;
      this._state.search = '';
      this._removeOutsideHandler();
      this.setState({});
      this.props.onChange?.(option);
    });

    /* ── Live search — patches options list without full re-render ────── */
    this.delegate('.adm-dropdown__search', 'input', (e, input) => {
      this._state.search = input.value;
      const optionsEl    = this.$('.adm-dropdown__options');
      if (!optionsEl) return;

      const filtered = this.props.options.filter((o) =>
        o.label.toLowerCase().includes(input.value.toLowerCase())
      );

      optionsEl.innerHTML = filtered.length === 0
        ? `<div class="adm-dropdown__empty">No options found</div>`
        : filtered.map((opt) => `
            <div
              class="adm-dropdown__option${opt.value === this._state.value ? ' adm-dropdown__option--selected' : ''}"
              role="option"
              aria-selected="${opt.value === this._state.value}"
              data-option-value="${Component.escape(String(opt.value))}">
              <span>${Component.escape(opt.label)}</span>
              ${opt.value === this._state.value ? ICON.check : ''}
            </div>`).join('');
    });

    /* ── Keyboard: Escape closes ──────────────────────────────────────── */
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this._state.isOpen) this._close();
    });
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  _open() {
    this._state.isOpen = true;
    this._state.search = '';
    this.setState({});
    requestAnimationFrame(() => {
      this.$('.adm-dropdown__search')?.focus();
      this._bindOutsideHandler();
    });
  }

  _close() {
    this._state.isOpen = false;
    this._state.search = '';
    this._removeOutsideHandler();
    this.setState({});
  }

  _bindOutsideHandler() {
    this._outsideHandler = (e) => {
      if (!this.el?.contains(e.target)) this._close();
    };
    // Defer one tick so the opening click doesn't immediately retrigger it
    setTimeout(() => document.addEventListener('click', this._outsideHandler), 0);
  }

  _removeOutsideHandler() {
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler);
      this._outsideHandler = null;
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /** Returns the currently selected value. */
  getValue() { return this._state.value; }

  /**
   * Programmatically selects a value.
   * @param {*} value
   */
  setValue(value) {
    this._state.value = value;
    this.setState({});
  }

  /**
   * Displays a validation error below the trigger.
   * @param {string} message
   */
  setError(message) {
    this.props.error = message;
    this._rerender();
  }

  /** Removes the current error message. */
  clearError() {
    this.props.error = '';
    this._rerender();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   FileUpload — drag-and-drop file picker
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Drag-and-drop upload zone with image preview thumbnails,
 * per-file size validation and multi-file accumulation.
 *
 * Usage:
 *   const uploader = new FileUpload({
 *     label:     'Profile Photo',
 *     accept:    'image/*',
 *     maxSizeMB: 5,
 *     onChange:  (files) => handleFiles(files),
 *   });
 *   uploader.mount(container);
 *
 *   uploader.getFiles();   // File[]
 *   uploader.clear();
 */
export class FileUpload extends Component {
  static styles = '/components/base/Forms.css?v=20260806g';

  constructor(props = {}) {
    super({
      label:     'Upload File',
      accept:    '*/*',
      maxSizeMB: 10,
      multiple:  false,
      onChange:  null,   // (files: File[]) => void
      error:     '',
      ...props,
    });

    this._state   = { files: [], dragOver: false, error: props.error ?? '' };
    this._inputId = `adm-file-${this._id}`;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { label, accept, multiple, maxSizeMB } = this.props;
    const { files, dragOver, error }             = this._state;

    const previewHtml = files.length > 0
      ? `<div class="adm-file__previews">${files.map((f) => this._previewItem(f)).join('')}</div>`
      : '';

    const hintParts = [
      `Max ${maxSizeMB}MB`,
      accept !== '*/*' ? accept : null,
    ].filter(Boolean).join(' · ');

    return `
      <div class="adm-file-upload">
        ${label
          ? `<p class="adm-file__label">${Component.escape(label)}</p>`
          : ''}

        <div class="adm-file__zone${dragOver ? ' adm-file__zone--drag' : ''}${files.length > 0 ? ' adm-file__zone--has-files' : ''}">
          <input
            type="file"
            id="${this._inputId}"
            class="adm-file__input"
            accept="${Component.escape(accept)}"
            ${multiple ? 'multiple' : ''}
            aria-label="${Component.escape(label)}"
          />
          <label class="adm-file__zone-content" for="${this._inputId}">
            <div class="adm-file__zone-icon">${ICON.upload}</div>
            <p class="adm-file__zone-text">
              <span class="adm-file__zone-cta">Click to upload</span> or drag and drop
            </p>
            <p class="adm-file__zone-hint">${hintParts}</p>
          </label>
        </div>

        ${previewHtml}

        ${error
          ? `<p class="adm-file__error" role="alert">${Component.escape(error)}</p>`
          : ''}
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    const input = this.$('.adm-file__input');
    const zone  = this.$('.adm-file__zone');

    this.on(input, 'change', (e) =>
      this._handleFiles(Array.from(e.target.files))
    );

    this.on(zone, 'dragover',  (e) => { e.preventDefault(); this._setDrag(true);  });
    this.on(zone, 'dragleave', ()  => this._setDrag(false));
    this.on(zone, 'drop',      (e) => {
      e.preventDefault();
      this._setDrag(false);
      this._handleFiles(Array.from(e.dataTransfer.files));
    });

    // Remove individual file
    this.delegate('[data-file-name]', 'click', (e, btn) => {
      e.preventDefault();
      const name  = btn.dataset.fileName;
      const files = this._state.files.filter((f) => f.name !== name);
      this._state.files = files;
      this.setState({});
      this.props.onChange?.(files);
    });
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  _setDrag(over) {
    this._state.dragOver = over;
    this.setState({});
  }

  /**
   * Builds the preview row HTML for a single enriched File object.
   * @param {File & { dataUrl: string|null }} f
   * @returns {string}
   */
  _previewItem(f) {
    const thumb = f.type.startsWith('image/') && f.dataUrl
      ? `<img src="${f.dataUrl}"
              alt="${Component.escape(f.name)}"
              class="adm-file__preview-img" />`
      : `<div class="adm-file__preview-icon">${ICON.file}</div>`;

    const sizeMB = (f.size / 1024 / 1024).toFixed(2);

    return `
      <div class="adm-file__preview-item">
        ${thumb}
        <div class="adm-file__preview-info">
          <p class="adm-file__preview-name">${Component.escape(f.name)}</p>
          <p class="adm-file__preview-size">${sizeMB} MB</p>
        </div>
        <button
          class="adm-file__preview-remove"
          type="button"
          data-file-name="${Component.escape(f.name)}"
          aria-label="Remove ${Component.escape(f.name)}"
        >${ICON.close}</button>
      </div>
    `;
  }

  /**
   * Validates raw File objects, generates data-URLs for images,
   * then updates state and fires onChange.
   *
   * @param {File[]} rawFiles
   */
  _handleFiles(rawFiles) {
    const maxBytes = this.props.maxSizeMB * 1024 * 1024;
    const valid    = [];
    let   error    = '';

    for (const f of rawFiles) {
      if (f.size > maxBytes) {
        error = `"${f.name}" exceeds the ${this.props.maxSizeMB} MB size limit.`;
        continue;
      }
      valid.push(Object.assign(f, { dataUrl: null }));
    }

    if (error) {
      this._state.error = error;
      this.setState({});
      return;
    }

    // Generate data-URLs for image previews asynchronously
    const readers = valid.map((f) => {
      if (!f.type.startsWith('image/')) return Promise.resolve(f);
      return new Promise((resolve) => {
        const reader    = new FileReader();
        reader.onload   = (e) => { f.dataUrl = e.target.result; resolve(f); };
        reader.readAsDataURL(f);
      });
    });

    Promise.all(readers).then((enriched) => {
      const all          = this.props.multiple
        ? [...this._state.files, ...enriched]
        : enriched;
      this._state.files  = all;
      this._state.error  = '';
      this.setState({});
      this.props.onChange?.(all);
    });
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /** Returns the current array of selected File objects. */
  getFiles() { return this._state.files; }

  /** Clears all selected files and any error message. */
  clear() {
    this._state = { files: [], dragOver: false, error: '' };
    this.setState({});
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   ProgressBar — determinate progress indicator
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Determinate progress indicator.
 * Works as a mounted Component or as a pure static HTML string.
 *
 * Colour variants: primary | success | warning | error | info
 * Sizes:           sm | md | lg
 *
 * Usage:
 *   // Mounted — supports setValue() for live updates
 *   const bar = new ProgressBar({ value: 40, label: 'Uploading…' });
 *   bar.mount(container);
 *   bar.setValue(75);
 *
 *   // Static HTML string
 *   ProgressBar.html({ value: 60, color: 'success', animated: true });
 */
export class ProgressBar extends Component {
  static styles = '/components/base/Forms.css?v=20260806g';

  constructor(props = {}) {
    super({
      value:       0,          // 0 – 100
      max:         100,
      label:       '',
      showPercent: true,
      color:       'primary',  // primary | success | warning | error | info
      size:        'md',       // sm | md | lg
      animated:    false,
      ...props,
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return ProgressBar.html(this.props);
  }

  /* ── Static helper ────────────────────────────────────────────────────── */

  /**
   * Returns a progress-bar HTML string for use inside another component.
   *
   * @param {object}  options
   * @param {number}  [options.value=0]
   * @param {number}  [options.max=100]
   * @param {string}  [options.label='']
   * @param {boolean} [options.showPercent=true]
   * @param {string}  [options.color='primary']
   * @param {string}  [options.size='md']
   * @param {boolean} [options.animated=false]
   * @returns {string}
   */
  static html({
    value       = 0,
    max         = 100,
    label       = '',
    showPercent = true,
    color       = 'primary',
    size        = 'md',
    animated    = false,
  } = {}) {
    const pct = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

    const fillClasses = [
      'adm-progress__fill',
      `adm-progress__fill--${color}`,
      animated ? 'adm-progress__fill--animated' : '',
    ].filter(Boolean).join(' ');

    const headerHtml = label || showPercent ? `
      <div class="adm-progress__header">
        ${label       ? `<span class="adm-progress__label">${Component.escape(label)}</span>` : ''}
        ${showPercent ? `<span class="adm-progress__pct">${pct}%</span>` : ''}
      </div>` : '';

    return `
      <div class="adm-progress adm-progress--${size}">
        ${headerHtml}
        <div class="adm-progress__track"
             role="progressbar"
             aria-valuenow="${pct}"
             aria-valuemin="0"
             aria-valuemax="100"
             aria-label="${Component.escape(label || 'Progress')}">
          <div class="${fillClasses}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /**
   * Updates the fill width without a full re-render.
   * @param {number} value   0 – max
   */
  setValue(value) {
    this.props.value = value;
    const pct        = Math.min(
      Math.max(Math.round((value / this.props.max) * 100), 0), 100
    );

    const fill = this.$('.adm-progress__fill');
    if (fill) fill.style.width = `${pct}%`;

    const pctEl = this.$('.adm-progress__pct');
    if (pctEl) pctEl.textContent = `${pct}%`;

    // Keep ARIA in sync
    this.$('.adm-progress__track')?.setAttribute('aria-valuenow', String(pct));
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   ChatBubble — sent / received message bubble
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Renders a single chat message bubble.
 * Works as a mounted Component or as a pure static HTML string
 * for use inside a chat list render loop.
 *
 * Usage:
 *   // Mounted
 *   new ChatBubble({
 *     message:    'Hello, how can I help?',
 *     senderName: 'Admin',
 *     senderRole: 'admin',
 *     variant:    'received',
 *     timestamp:  '2025-01-15T10:30:00Z',
 *   }).mount(container);
 *
 *   // Static HTML string
 *   ChatBubble.html({ message: 'Thanks!', variant: 'sent', timestamp: Date.now() });
 */
export class ChatBubble extends Component {
  static styles = '/components/base/Forms.css?v=20260806g';

  constructor(props = {}) {
    super({
      message:    '',
      senderName: '',
      senderRole: 'citizen',  // citizen | admin
      variant:    'received', // sent | received
      timestamp:  null,
      ...props,
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return ChatBubble.html(this.props);
  }

  /* ── Static helper ────────────────────────────────────────────────────── */

  /**
   * Returns a chat bubble HTML string.
   *
   * @param {object}  options
   * @param {string}  options.message
   * @param {string}  [options.senderName='']
   * @param {string}  [options.senderRole='citizen']
   * @param {string}  [options.variant='received']   'sent' | 'received'
   * @param {*}       [options.timestamp=null]
   * @returns {string}
   */
  static html({
    message    = '',
    senderName = '',
    senderRole = 'citizen',
    variant    = 'received',
    timestamp  = null,
  } = {}) {
    const isAdmin = senderRole === 'admin';

    const timeStr = timestamp
      ? new Date(timestamp).toLocaleTimeString('en-NG', {
          hour:   'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '';

    const senderHtml = variant === 'received' && senderName ? `
      <p class="adm-chat-bubble__sender${isAdmin ? ' adm-chat-bubble__sender--admin' : ''}">
        ${Component.escape(senderName)}
        ${isAdmin
          ? `<span class="adm-chat-bubble__admin-tag">Official</span>`
          : ''}
      </p>` : '';

    return `
      <div class="adm-chat-bubble adm-chat-bubble--${variant}"
           role="listitem">
        <div class="adm-chat-bubble__content">
          ${senderHtml}
          <p class="adm-chat-bubble__text">${Component.escape(message)}</p>
          ${timeStr
            ? `<time class="adm-chat-bubble__time"
                     datetime="${timestamp}">${timeStr}</time>`
            : ''}
        </div>
      </div>
    `;
  }
}