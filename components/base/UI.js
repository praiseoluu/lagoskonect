/**
 * Lagos Konect — UI Components
 * ============================================================
 * Lightweight, single-responsibility UI primitives used across
 * every page of the LagKonnect platform.
 *
 * Exports:
 *   ToastContainer — Fixed notification stack.
 *                    Mount once at app root; subscribes to the
 *                    global store and auto-manages toast lifecycle.
 *
 *   Avatar         — User avatar with image or initials fallback,
 *                    five size tiers and an optional online dot.
 *                    Available as a mounted Component or a static
 *                    HTML helper for use inside list renders.
 *
 *   Tabs           — Horizontal tab-strip with icon support,
 *                    keyboard activation and an onChange callback.
 *
 *   Toggle         — Accessible checkbox-backed toggle switch
 *                    with optional label and description text.
 *
 * @module  UI
 * @version 2.0.0
 */

import { Component }              from '../../core/component.js?v=20260806e';
import { store, dismissToast }    from '../../core/store.js?v=20260806e';

/* ── Shared SVG icon constants ──────────────────────────────────────────── */

const ICON = Object.freeze({
  success: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,

  error: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8"  x2="12"    y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`,

  warning: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94
               a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9"  x2="12"    y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,

  info: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12"    y2="12"/>
      <line x1="12" y1="8"  x2="12.01" y2="8"/>
    </svg>`,

  close: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <line x1="18" y1="6" x2="6"  y2="18"/>
      <line x1="6"  y1="6" x2="18" y2="18"/>
    </svg>`,
});

/* ── Valid sizes ────────────────────────────────────────────────────────── */

const VALID_AVATAR_SIZES = Object.freeze(['xs', 'sm', 'md', 'lg', 'xl']);

/* ══════════════════════════════════════════════════════════════════════════
   ToastContainer — global notification stack
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Mounts once at app root level.
 * Subscribes to `store.toasts`, imperatively creates and removes
 * individual toast elements so new notifications animate in without
 * a full re-render of the container.
 *
 * Each toast object in the store must conform to:
 *   { id: string, type: 'success'|'error'|'warning'|'info',
 *     message: string, duration?: number }
 *
 * Usage:
 *   const toasts = new ToastContainer();
 *   toasts.mount(document.body, { append: true });
 */
export class ToastContainer extends Component {
  static styles = '/components/base/UI.css?v=20260806e';

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return `
      <div class="adm-toast-container"
           aria-live="polite"
           aria-atomic="false"
           aria-label="Notifications"></div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    this.subscribe(store, 'toasts', (toasts) => this._syncToasts(toasts));
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  /**
   * Reconciles the DOM against the current toasts array.
   * Only adds toasts that are not already in the DOM.
   *
   * @param {object[]} toasts
   */
  _syncToasts(toasts) {
    const container = this.el;
    if (!container) return;

    toasts.forEach((toast) => {
      // Skip if this toast is already rendered
      if (container.querySelector(`[data-toast-id="${toast.id}"]`)) return;

      const el       = document.createElement('div');
      el.className   = `adm-toast adm-toast--${toast.type}`;
      el.dataset.toastId = toast.id;
      el.setAttribute('role', 'alert');
      el.innerHTML   = `
        <span class="adm-toast__icon">${ICON[toast.type] ?? ''}</span>
        <span class="adm-toast__message">${Component.escape(toast.message)}</span>
        <button class="adm-toast__close"
                type="button"
                aria-label="Dismiss notification">
          ${ICON.close}
        </button>
      `;

      el.querySelector('.adm-toast__close')
        .addEventListener('click', () => this._dismiss(el, toast.id));

      container.appendChild(el);

      // Defer one frame so the browser paints the initial state before
      // adding the visible class — this ensures the CSS transition fires
      requestAnimationFrame(() => el.classList.add('adm-toast--visible'));

      // Auto-dismiss after the configured duration
      setTimeout(
        () => this._dismiss(el, toast.id),
        toast.duration ?? 4000
      );
    });
  }

  /**
   * Animates a toast out, then removes it from the DOM and the store.
   *
   * @param {HTMLElement} el
   * @param {string}      id
   */
  _dismiss(el, id) {
    if (!el.isConnected) return;
    el.classList.remove('adm-toast--visible');
    el.addEventListener('transitionend', () => {
      el.remove();
      dismissToast(id);
    }, { once: true });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Avatar — user avatar with initials fallback
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Renders a circular avatar with an image or generated initials.
 * Available as a mounted Component or as Avatar.html() for inline use.
 *
 * Sizes: xs | sm | md | lg | xl
 *
 * Usage:
 *   new Avatar({ name: 'Aisha Musa', imageUrl: '/photo.jpg', size: 'lg' })
 *     .mount(container);
 *
 *   // Static HTML string
 *   Avatar.html({ name: 'Aisha Musa', size: 'md', online: true });
 */
export class Avatar extends Component {
  static styles = '/components/base/UI.css?v=20260806e';

  constructor(props = {}) {
    super({
      name:     '',
      imageUrl: null,
      size:     'md',   // xs | sm | md | lg | xl
      online:   false,
      ...props,
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return Avatar.html(this.props);
  }

  /* ── Static helper ────────────────────────────────────────────────────── */

  /**
   * Returns an avatar HTML string for use inside another component.
   *
   * @param {object}          options
   * @param {string}          [options.name='']
   * @param {string|null}     [options.imageUrl=null]
   * @param {'xs'|'sm'|'md'|'lg'|'xl'} [options.size='md']
   * @param {boolean}         [options.online=false]
   * @returns {string}
   */
  static html({ name = '', imageUrl = null, size = 'md', online = false } = {}) {
    const safeSize = VALID_AVATAR_SIZES.includes(size) ? size : 'md';

    const initials = name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('');

    const contentHtml = imageUrl
      ? `<img
           class="adm-avatar__img"
           src="${Component.escape(imageUrl)}"
           alt="${Component.escape(name)}"
           loading="lazy"
         />`
      : `<span class="adm-avatar__initials" aria-hidden="true">${initials}</span>`;

    const onlineHtml = online
      ? `<span class="adm-avatar__online" aria-label="Online"></span>`
      : '';

    return `
      <div
        class="adm-avatar adm-avatar--${safeSize}"
        role="img"
        aria-label="${Component.escape(name)}"
        title="${Component.escape(name)}"
      >
        ${contentHtml}
        ${onlineHtml}
      </div>
    `;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Tabs — horizontal tab strip
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Horizontal tab-strip component.
 * Each tab supports an optional icon slot left of the label.
 *
 * Usage:
 *   const tabs = new Tabs({
 *     tabs: [
 *       { key: 'overview', label: 'Overview' },
 *       { key: 'activity', label: 'Activity', icon: ACTIVITY_SVG },
 *     ],
 *     activeKey: 'overview',
 *     onChange:  (key) => showPanel(key),
 *   });
 *   tabs.mount(container);
 *
 *   tabs.setActive('activity');
 *   tabs.getActive();
 */
export class Tabs extends Component {
  static styles = '/components/base/UI.css?v=20260806e';

  constructor(props = {}) {
    super({
      tabs:      [],    // Array<{ key: string, label: string, icon?: string }>
      activeKey: null,
      onChange:  null,  // (key: string) => void
      ...props,
    });

    this._state = {
      activeKey: props.activeKey ?? props.tabs?.[0]?.key ?? null,
    };
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { tabs }      = this.props;
    const { activeKey } = this._state;

    return `
      <div class="adm-tabs" role="tablist">
        ${tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return `
            <button
              class="adm-tab${isActive ? ' adm-tab--active' : ''}"
              type="button"
              role="tab"
              aria-selected="${isActive}"
              data-tab-key="${Component.escape(tab.key)}"
            >
              ${tab.icon
                ? `<span class="adm-tab__icon" aria-hidden="true">${tab.icon}</span>`
                : ''}
              <span>${Component.escape(tab.label)}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    this.delegate('[data-tab-key]', 'click', (_, btn) => {
      const key = btn.dataset.tabKey;
      if (key === this._state.activeKey) return;
      this._state.activeKey = key;
      this.setState({});
      this.props.onChange?.(key);
    });
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /**
   * Programmatically activates a tab by key.
   * @param {string} key
   */
  setActive(key) {
    this._state.activeKey = key;
    this.setState({});
  }

  /** Returns the key of the currently active tab. */
  getActive() { return this._state.activeKey; }
}

/* ══════════════════════════════════════════════════════════════════════════
   Toggle — accessible on/off switch
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Checkbox-backed toggle switch.
 * The native <input type="checkbox"> handles all keyboard and
 * screen-reader behaviour; the visual track and thumb are CSS only.
 *
 * Usage:
 *   const toggle = new Toggle({
 *     label:       'Email Notifications',
 *     description: 'Receive updates via email',
 *     checked:     true,
 *     onChange:    (checked) => savePreference(checked),
 *   });
 *   toggle.mount(container);
 *
 *   toggle.getValue();
 *   toggle.setValue(false);
 */
export class Toggle extends Component {
  static styles = '/components/base/UI.css?v=20260806e';

  constructor(props = {}) {
    super({
      label:       '',
      description: '',
      checked:     false,
      disabled:    false,
      name:        '',
      onChange:    null,   // (checked: boolean) => void
      ...props,
    });

    this._state = { checked: Boolean(props.checked) };

    // Stable ID for <label> ↔ <input> association
    this._inputId = `adm-toggle-${this._id}`;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { label, description, disabled, name } = this.props;
    const { checked } = this._state;

    return `
      <div class="adm-toggle-wrapper${disabled ? ' adm-toggle-wrapper--disabled' : ''}">
        <div class="adm-toggle-control">
          <input
            type="checkbox"
            class="adm-toggle-input"
            id="${this._inputId}"
            name="${Component.escape(name || this._inputId)}"
            ${checked  ? 'checked'  : ''}
            ${disabled ? 'disabled' : ''}
            aria-checked="${checked}"
          />
          <label class="adm-toggle-track" for="${this._inputId}" aria-hidden="true">
            <span class="adm-toggle-thumb"></span>
          </label>
        </div>

        ${label ? `
          <div class="adm-toggle-labels">
            <label class="adm-toggle-label" for="${this._inputId}">
              ${Component.escape(label)}
            </label>
            ${description
              ? `<p class="adm-toggle-desc">${Component.escape(description)}</p>`
              : ''}
          </div>` : ''}
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    const input = this.$('.adm-toggle-input');
    if (!input) return;

    this.on(input, 'change', (e) => {
      const checked       = e.target.checked;
      this._state.checked = checked;
      this.props.onChange?.(checked);
    });
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /** Returns the current checked state. */
  getValue() { return this._state.checked; }

  /**
   * Sets the toggle state programmatically.
   * @param {boolean} checked
   */
  setValue(checked) {
    this._state.checked = Boolean(checked);
    this.setState({});
  }
}