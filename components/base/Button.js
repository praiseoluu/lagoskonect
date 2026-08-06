/**
 * Lagos Konect — Button Component
 * ============================================================
 * Versatile button primitive covering every interactive state
 * and visual variant used across the LagKonnect platform.
 *
 * Variants:
 *   primary   — filled, high-emphasis action
 *   secondary — outlined, medium-emphasis action
 *   ghost     — text-only, low-emphasis action
 *   danger    — destructive action (outlined by default)
 *   icon      — square icon-only, no visible label
 *
 * Sizes:    sm | md | lg
 * States:   default | loading | disabled
 *
 * Usage:
 *   // Standard button
 *   const btn = new Button({
 *     label:   'Save Changes',
 *     variant: 'primary',
 *     size:    'md',
 *     onClick: () => handleSave(),
 *   });
 *   btn.mount(container);
 *
 *   // Programmatic state control
 *   btn.setLoading(true);
 *   btn.setDisabled(true);
 *   btn.setLabel('Saving…');
 *
 *   // Icon-only button
 *   new Button({
 *     icon:     '<svg>…</svg>',
 *     label:    'Delete',        // used as aria-label
 *     variant:  'icon',
 *     iconOnly: true,
 *   }).mount(container);
 *
 * @module  Button
 * @version 2.0.0
 */

import { Component } from '../../core/component.js?v=20260806b';

/* ── Valid prop values ──────────────────────────────────────────────────── */

const VALID_VARIANTS = Object.freeze(['primary', 'secondary', 'ghost', 'danger', 'icon']);
const VALID_SIZES    = Object.freeze(['sm', 'md', 'lg']);
const VALID_TYPES    = Object.freeze(['button', 'submit', 'reset']);

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export class Button extends Component {
  static styles = '/components/base/Button.css?v=20260806b';

  constructor(props = {}) {
    super({
      label:     '',
      variant:   'primary',
      size:      'md',
      type:      'button',
      disabled:  false,
      loading:   false,
      icon:      null,       // SVG string — rendered left of label
      iconOnly:  false,      // true → square button; label becomes aria-label only
      fullWidth: false,
      onClick:   null,
      ...props,
    });

    // Loading is also tracked in local state so setLoading() triggers a re-render
    // without mutating props directly.
    this._state = { loading: Boolean(props.loading) };
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { variant, size, type, disabled, icon, iconOnly, fullWidth, label } = this.props;
    const { loading } = this._state;

    const safeVariant = VALID_VARIANTS.includes(variant) ? variant : 'primary';
    const safeSize    = VALID_SIZES.includes(size)       ? size    : 'md';
    const safeType    = VALID_TYPES.includes(type)       ? type    : 'button';
    const isDisabled  = disabled || loading;

    const classes = [
      'adm-btn',
      `adm-btn--${safeVariant}`,
      `adm-btn--${safeSize}`,
      loading   ? 'adm-btn--loading'   : '',
      iconOnly  ? 'adm-btn--icon-only' : '',
      fullWidth ? 'adm-btn--full'      : '',
    ].filter(Boolean).join(' ');

    const spinnerHtml = loading
      ? `<span class="adm-btn__spinner" aria-hidden="true"></span>`
      : '';

    const iconHtml = icon
      ? `<span class="adm-btn__icon" aria-hidden="true">${icon}</span>`
      : '';

    const labelHtml = !iconOnly && label
      ? `<span class="adm-btn__label">${this.esc(label)}</span>`
      : '';

    return `
      <button
        class="${classes}"
        type="${safeType}"
        ${isDisabled ? 'disabled' : ''}
        aria-disabled="${isDisabled}"
        aria-label="${iconOnly ? this.esc(label) : ''}"
        aria-busy="${loading}"
      >
        ${spinnerHtml}
        ${iconHtml}
        ${labelHtml}
      </button>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    if (typeof this.props.onClick === 'function') {
      this.on(this.el, 'click', (e) => {
        if (this._state.loading || this.props.disabled) return;
        this.props.onClick(e);
      });
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /**
   * Toggle the loading state.
   * While loading the button is non-interactive and shows a spinner.
   *
   * @param {boolean} loading
   */
  setLoading(loading) {
    this._state = { ...this._state, loading: Boolean(loading) };
    this._rerender();
  }

  /**
   * Toggle the disabled state without affecting loading.
   *
   * @param {boolean} disabled
   */
  setDisabled(disabled) {
    this.props.disabled = Boolean(disabled);
    this._rerender();
  }

  /**
   * Replace the visible button label.
   * Has no effect on icon-only buttons (label still serves as aria-label).
   *
   * @param {string} label
   */
  setLabel(label) {
    this.props.label = String(label);
    this._rerender();
  }
}