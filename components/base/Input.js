/**
 * Lagos Konect — Input Component
 * ============================================================
 * Single-field text input covering every common input type used
 * across the LagKonnect platform.
 *
 * Supported types:
 *   text | password | email | number | phone | search | textarea
 *
 * Features:
 *   • Password visibility toggle
 *   • Phone prefix (+234) with divider
 *   • Search field with one-click clear button
 *   • Custom prefix / suffix slots
 *   • Inline validation error with entrance animation
 *   • Hint text (hidden when error is shown)
 *   • Full ARIA wiring (aria-invalid, aria-describedby)
 *   • onEnter callback (respects Shift+Enter in textarea)
 *
 * Usage:
 *   const input = new Input({
 *     type:        'phone',
 *     label:       'Phone Number',
 *     placeholder: '0801 234 5678',
 *     required:    true,
 *     onChange:    (value) => console.log(value),
 *   });
 *   input.mount(container);
 *
 *   input.getValue();
 *   input.setValue('08012345678');
 *   input.setError('Invalid phone number');
 *   input.clearError();
 *   input.focus();
 *
 * @module  Input
 * @version 2.0.0
 */

import { Component } from '../../core/component.js';

/* ── Inline SVG icons ───────────────────────────────────────────────────── */

const ICON = Object.freeze({
  eyeOpen: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,

  eyeClosed: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8
               a18.45 18.45 0 015.06-5.94
               M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8
               a18.5 18.5 0 01-2.16 3.19
               m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`,

  search: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>`,

  clear: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <line x1="18" y1="6" x2="6"  y2="18"/>
      <line x1="6"  y1="6" x2="18" y2="18"/>
    </svg>`,
});

/* ── Type → native HTML type mapping ───────────────────────────────────── */

const TYPE_MAP = Object.freeze({
  text:     'text',
  password: 'password',
  email:    'email',
  number:   'number',
  phone:    'tel',
  search:   'search',
  textarea: null,   // not an <input>
});

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export class Input extends Component {
  static styles = '/components/base/Input.css';

  constructor(props = {}) {
    super({
      type:         'text',
      label:        '',
      placeholder:  '',
      value:        '',
      name:         '',
      id:           '',
      disabled:     false,
      readonly:     false,
      required:     false,
      error:        '',
      hint:         '',
      prefix:       null,    // Text or symbol rendered left of the field
      suffix:       null,    // Text or symbol rendered right of the field
      maxLength:    null,
      rows:         4,       // textarea only
      autocomplete: 'off',
      onChange:     null,    // (value: string) => void
      onBlur:       null,    // (value: string) => void
      onFocus:      null,    // (event: FocusEvent) => void
      onEnter:      null,    // (value: string) => void  — Shift+Enter ignored in textarea
      ...props,
    });

    this._state = {
      value:        props.value ?? '',
      showPassword: false,
      isFocused:    false,
    };

    // Stable ID — used to associate <label> with the field element
    this._inputId = props.id || `adm-input-${this._id}`;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const {
      type, label, placeholder, name, disabled, readonly,
      required, error, hint, prefix, suffix,
      maxLength, rows, autocomplete,
    } = this.props;
    const { value, showPassword, isFocused } = this._state;

    const isPassword = type === 'password';
    const isSearch   = type === 'search';
    const isPhone    = type === 'phone';
    const isTextarea = type === 'textarea';

    /* Resolve the native HTML type attribute */
    const nativeType = isPassword
      ? (showPassword ? 'text' : 'password')
      : (TYPE_MAP[type] ?? 'text');

    /* ── Class strings ──────────────────────────────────────────────────── */

    const wrapperClasses = [
      'adm-input-wrapper',
      error     ? 'adm-input-wrapper--error'    : '',
      isFocused ? 'adm-input-wrapper--focused'  : '',
      disabled  ? 'adm-input-wrapper--disabled' : '',
    ].filter(Boolean).join(' ');

    const fieldClasses = [
      'adm-input-field',
      (prefix || isSearch || isPhone) ? 'adm-input-field--has-prefix' : '',
      (suffix || isPassword || (isSearch && value)) ? 'adm-input-field--has-suffix' : '',
    ].filter(Boolean).join(' ');

    /* ── Slots ──────────────────────────────────────────────────────────── */

    const labelHtml = label ? `
      <label class="adm-input-label" for="${this._inputId}">
        ${this.esc(label)}
        ${required
          ? `<span class="adm-input-required" aria-hidden="true">*</span>`
          : ''}
      </label>` : '';

    const prefixHtml = isSearch
      ? `<span class="adm-input-prefix adm-input-prefix--icon">${ICON.search}</span>`
      : isPhone
        ? `<span class="adm-input-prefix">+234</span>`
        : prefix
          ? `<span class="adm-input-prefix">${this.esc(prefix)}</span>`
          : '';

    const suffixHtml = isPassword
      ? `<button
           type="button"
           class="adm-input-suffix adm-input-suffix--toggle"
           aria-label="${showPassword ? 'Hide password' : 'Show password'}"
           tabindex="-1">
           ${showPassword ? ICON.eyeClosed : ICON.eyeOpen}
         </button>`
      : isSearch && value
        ? `<button
             type="button"
             class="adm-input-suffix adm-input-suffix--clear"
             aria-label="Clear search">
             ${ICON.clear}
           </button>`
        : suffix
          ? `<span class="adm-input-suffix adm-input-suffix--text">${this.esc(suffix)}</span>`
          : '';

    /* ── Shared attribute string ────────────────────────────────────────── */

    const describedBy = error  ? `${this._inputId}-error`
                      : hint   ? `${this._inputId}-hint`
                      : '';

    const commonAttrs = `
      id="${this._inputId}"
      name="${this.esc(name || this._inputId)}"
      ${disabled   ? 'disabled'  : ''}
      ${readonly   ? 'readonly'  : ''}
      ${required   ? 'required'  : ''}
      ${maxLength  ? `maxlength="${maxLength}"` : ''}
      autocomplete="${autocomplete}"
      aria-invalid="${Boolean(error)}"
      ${describedBy ? `aria-describedby="${describedBy}"` : ''}
    `;

    /* ── Field element ──────────────────────────────────────────────────── */

    const fieldHtml = isTextarea
      ? `<textarea
           class="${fieldClasses}"
           placeholder="${this.esc(placeholder)}"
           rows="${rows}"
           ${commonAttrs}
         >${this.esc(value)}</textarea>`
      : `<input
           class="${fieldClasses}"
           type="${nativeType}"
           value="${this.esc(value)}"
           placeholder="${this.esc(placeholder)}"
           ${commonAttrs}
         />`;

    return `
      <div class="${wrapperClasses}">
        ${labelHtml}
        <div class="adm-input-control">
          ${prefixHtml}
          ${fieldHtml}
          ${suffixHtml}
        </div>
        ${error
          ? `<span class="adm-input-error"
                   id="${this._inputId}-error"
                   role="alert">${this.esc(error)}</span>`
          : ''}
        ${hint && !error
          ? `<span class="adm-input-hint"
                   id="${this._inputId}-hint">${this.esc(hint)}</span>`
          : ''}
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    const field   = this.$('.adm-input-field');
    const control = this.$('.adm-input-control');
    if (!field) return;

    /* ── Value changes ────────────────────────────────────────────────── */
    this.on(field, 'input', (e) => {
      const val          = e.target.value;
      this._state.value  = val;
      this.props.onChange?.(val);

      // Patch the clear button visibility without re-rendering
      const clear = this.$('.adm-input-suffix--clear');
      if (clear) clear.style.display = val ? '' : 'none';
    });

    /* ── Focus / blur ─────────────────────────────────────────────────── */
    this.on(field, 'focus', (e) => {
      this._state.isFocused = true;
      control?.classList.add('adm-input-control--focused');
      this.props.onFocus?.(e);
    });

    this.on(field, 'blur', (e) => {
      this._state.isFocused = false;
      control?.classList.remove('adm-input-control--focused');
      this.props.onBlur?.(e.target.value);
    });

    /* ── Enter key ────────────────────────────────────────────────────── */
    if (typeof this.props.onEnter === 'function') {
      this.on(field, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.props.onEnter(this._state.value);
        }
      });
    }

    /* ── Password toggle ──────────────────────────────────────────────── */
    const toggle = this.$('.adm-input-suffix--toggle');
    if (toggle) {
      this.on(toggle, 'click', () => {
        this._state.showPassword = !this._state.showPassword;
        this.setState({});
      });
    }

    /* ── Search clear ─────────────────────────────────────────────────── */
    const clear = this.$('.adm-input-suffix--clear');
    if (clear) {
      this.on(clear, 'click', () => {
        this._state.value = '';
        this.setState({});
        this.props.onChange?.('');
        this.$('.adm-input-field')?.focus();
      });
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /** Returns the current field value. */
  getValue() { return this._state.value; }

  /**
   * Sets the field value programmatically.
   * @param {string} value
   */
  setValue(value) {
    this._state.value = String(value);
    this.setState({});
  }

  /**
   * Displays a validation error below the field.
   * @param {string} message
   */
  setError(message) {
    this.props.error = message;
    this._rerender();
  }

  /** Removes the current validation error. */
  clearError() {
    this.props.error = '';
    this._rerender();
  }

  /** Programmatically focuses the underlying field element. */
  focus() {
    this.$('.adm-input-field')?.focus();
  }
}