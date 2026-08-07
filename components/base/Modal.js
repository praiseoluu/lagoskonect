/**
 * Lagos Konect — Modal Component
 * ============================================================
 * Full-featured dialog with overlay, focus trap, inert-sibling
 * management and configurable header / body / footer slots.
 *
 * Sizes:
 *   sm (480px) | md (600px) | lg (800px) | xl (1000px) | full
 *
 * Accessibility:
 *   • role="dialog" + aria-modal on the overlay
 *   • Focus is trapped inside the panel while open
 *   • Sibling DOM nodes receive [inert] so screen readers
 *     cannot escape the dialog
 *   • Focus is restored to the previously active element on close
 *   • Escape key and overlay-click close are both configurable
 *
 * Usage:
 *   const modal = new Modal({
 *     title:  'Edit User',
 *     size:   'md',
 *     body:   '<p>Content here</p>',
 *     footer: `
 *       <button class="adm-btn adm-btn--ghost adm-btn--md"
 *               data-modal-close>Cancel</button>
 *       <button class="adm-btn adm-btn--primary adm-btn--md">Save</button>
 *     `,
 *     onClose: () => console.log('closed'),
 *   });
 *   modal.mount(document.body, { append: true });
 *   modal.open();
 *
 *   // Programmatic control
 *   modal.close();
 *   modal.setBody('<p>Updated content</p>');
 *   modal.setFooter('…');
 *
 * @module  Modal
 * @version 2.0.0
 */

import { Component } from '../../core/component.js?v=20260806h';

/* ── Icons ──────────────────────────────────────────────────────────────── */

const ICON = Object.freeze({
  close: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <line x1="18" y1="6"  x2="6"  y2="18"/>
      <line x1="6"  y1="6"  x2="18" y2="18"/>
    </svg>`,
});

/* ── Focusable element selector ─────────────────────────────────────────── */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/* ── Valid sizes ────────────────────────────────────────────────────────── */

const VALID_SIZES = Object.freeze(['sm', 'md', 'lg', 'xl', 'full']);

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export class Modal extends Component {
  static styles = '/components/base/Modal.css?v=20260806h';

  constructor(props = {}) {
    super({
      title:          '',
      size:           'md',   // sm | md | lg | xl | full
      body:           '',     // Raw HTML string
      footer:         '',     // Raw HTML string
      showClose:      true,
      closeOnOverlay: true,
      closeOnEsc:     true,
      onClose:        null,
      onOpen:         null,
      ...props,
    });

    this._state             = { isOpen: false };
    this._focusTrapHandler  = null;
    this._escHandler        = null;
    this._previousFocus     = null;
    this._inertedSiblings   = [];
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { title, size, body, footer, showClose } = this.props;
    const { isOpen } = this._state;

    const safeSize   = VALID_SIZES.includes(size) ? size : 'md';
    const overlayId  = `adm-modal-${this._id}`;

    const headerHtml = title || showClose ? `
      <div class="adm-modal__header">
        ${title
          ? `<h2 class="adm-modal__title" id="${overlayId}-title">
               ${this.esc(title)}
             </h2>`
          : ''}
        ${showClose
          ? `<button
               class="adm-modal__close"
               type="button"
               aria-label="Close dialog"
               data-modal-close>
               ${ICON.close}
             </button>`
          : ''}
      </div>` : '';

    return `
      <div
        class="adm-modal-overlay${isOpen ? ' adm-modal-overlay--visible' : ''}"
        id="${overlayId}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${title ? `${overlayId}-title` : ''}"
        aria-label="${title ? '' : 'Dialog'}"
        tabindex="-1"
      >
        <div class="adm-modal adm-modal--${safeSize}" role="document">

          ${headerHtml}

          <div class="adm-modal__body">
            ${body}
          </div>

          ${footer
            ? `<div class="adm-modal__footer">${footer}</div>`
            : ''}

        </div>
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    /* ── Close button (any element with [data-modal-close]) ───────────── */
    this.delegate('[data-modal-close]', 'click', () => this.close());

    /* ── Overlay backdrop click ───────────────────────────────────────── */
    if (this.props.closeOnOverlay) {
      this.on(this.el, 'click', (e) => {
        if (e.target === this.el) this.close();
      });
    }

    /* ── Escape key ───────────────────────────────────────────────────── */
    if (this.props.closeOnEsc) {
      this._escHandler = (e) => {
        if (e.key === 'Escape' && this._state.isOpen) this.close();
      };
      this.on(document, 'keydown', this._escHandler);
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /** Opens the modal, locks scroll and traps focus. */
  open() {
    this._previousFocus = document.activeElement;
    this._state.isOpen  = true;

    document.body.style.overflow = 'hidden';
    this.el.classList.add('adm-modal-overlay--visible');

    // Mark all sibling nodes inert so assistive tech cannot reach them
    this._inertedSiblings = [];
    for (const child of document.body.children) {
      if (child !== this.el && !child.hasAttribute('inert')) {
        child.setAttribute('inert', '');
        this._inertedSiblings.push(child);
      }
    }

    requestAnimationFrame(() => {
      this.el?.focus();
      this._trapFocus();
    });

    this.props.onOpen?.();
  }

  /** Closes the modal, restores scroll and releases focus. */
  close() {
    this._state.isOpen = false;

    document.body.style.overflow = '';
    this.el.classList.remove('adm-modal-overlay--visible');

    this._releaseInert();
    this._releaseFocus();

    this.props.onClose?.();
  }

  /**
   * Replaces the modal body without a full re-render.
   * Falls back to a full re-render if the body element is not in the DOM.
   *
   * @param {string} html  Raw HTML string
   */
  setBody(html) {
    const bodyEl = this.$('.adm-modal__body');
    if (bodyEl) {
      bodyEl.innerHTML = html;
    } else {
      this.props.body = html;
      this._rerender();
    }
  }

  /**
   * Replaces the modal footer without a full re-render.
   * Falls back to a full re-render if the footer element is not in the DOM.
   *
   * @param {string} html  Raw HTML string
   */
  setFooter(html) {
    const footerEl = this.$('.adm-modal__footer');
    if (footerEl) {
      footerEl.innerHTML = html;
    } else {
      this.props.footer = html;
      this._rerender();
    }
  }

  /**
   * Replaces the modal title without a full re-render.
   * Falls back to a full re-render if the title element is not in the DOM.
   *
   * @param {string} title  Title text
   */
  setTitle(title) {
    const titleEl = this.$('.adm-modal__title');
    if (titleEl) {
      titleEl.textContent = title;
    } else {
      this.props.title = title;
      this._rerender();
    }
  }

  /* ── Focus management ─────────────────────────────────────────────────── */

  /**
   * Installs a keydown handler on the overlay that cycles Tab focus
   * between the first and last focusable elements inside the panel.
   */
  _trapFocus() {
    const focusable = Array.from(this.el.querySelectorAll(FOCUSABLE));
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    // Remove any previously installed handler before adding a new one
    if (this._focusTrapHandler) {
      this.el.removeEventListener('keydown', this._focusTrapHandler);
    }

    this._focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    this.el.addEventListener('keydown', this._focusTrapHandler);
    first.focus();
  }

  /** Restores focus to the element that was active before the modal opened. */
  _releaseFocus() {
    if (this._focusTrapHandler) {
      this.el.removeEventListener('keydown', this._focusTrapHandler);
      this._focusTrapHandler = null;
    }
    this._previousFocus?.focus();
    this._previousFocus = null;
  }

  /** Removes [inert] from all siblings that were marked during open(). */
  _releaseInert() {
    for (const child of this._inertedSiblings) {
      child.removeAttribute('inert');
    }
    this._inertedSiblings = [];
  }

  /* ── Unmount cleanup ──────────────────────────────────────────────────── */

  unmount() {
    document.body.style.overflow = '';
    this._releaseInert();
    this._releaseFocus();
    super.unmount();
  }
}