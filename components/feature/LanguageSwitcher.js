/**
 * Lagos Konect — Language Switcher
 * ============================================================
 * A self-contained, reusable dropdown for changing the active UI language.
 * Can be dropped into any surface: public nav, in-app topbar, footer,
 * or the settings page — without any extra wiring.
 *
 * On selection, calls i18n.setLanguage() which persists the choice and
 * triggers a router reload, remounting the current page in the new
 * dictionary. No manual re-render is needed.
 *
 * Props (all optional):
 *   compact    {boolean}          Show only the short code badge (e.g. "EN").
 *                                 Good for tight navbars. Default: false.
 *   align      {'start'|'end'}    Horizontal edge the menu snaps to.
 *                                 Default: 'end' (right-aligned).
 *   direction  {'down'|'up'}      Whether the menu opens below or above.
 *                                 Use 'up' inside a footer. Default: 'down'.
 *   variant    {'default'|'ghost'} 'ghost' removes the trigger border/bg for
 *                                 use on tinted or coloured surfaces.
 *                                 Default: 'default'.
 *
 * Usage:
 *   import { LanguageSwitcher } from './LanguageSwitcher.js?v=20260806e';
 *
 *   const switcher = new LanguageSwitcher({ compact: true, align: 'end' });
 *   this.addChild(switcher);
 *   switcher.mount(this.$('#lang-slot'));
 *
 * @module  LanguageSwitcher
 * @version 2.0.0
 */

import { Component } from '../../core/component.js?v=20260806e';
import { store }     from '../../core/store.js?v=20260806e';
import {
  LANGUAGES,
  getLanguage,
  getLanguageMeta,
  setLanguage,
  t,
} from '../../core/i18n.js?v=20260806e';

/* ── Inline SVG icons ───────────────────────────────────────────────────── */
const ICON_GLOBE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="10"/>
  <line x1="2" y1="12" x2="22" y2="12"/>
  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
</svg>`;

const ICON_CHEVRON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

const ICON_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

/* ── Valid prop values ──────────────────────────────────────────────────── */
const VALID_ALIGN     = Object.freeze(['start', 'end']);
const VALID_DIRECTION = Object.freeze(['down', 'up']);
const VALID_VARIANT   = Object.freeze(['default', 'ghost']);

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */
export class LanguageSwitcher extends Component {
  static styles = '/components/feature/LanguageSwitcher.css?v=20260806e';

  constructor(props = {}) {
    super(props);
    /** @type {boolean} Whether the dropdown menu is currently open */
    this._open = false;
  }

  /* ── Derived props ────────────────────────────────────────────────────── */

  /** @private @returns {boolean} */
  get _compact() {
    return !!this.props.compact;
  }

  /** @private @returns {'start'|'end'} */
  get _align() {
    return VALID_ALIGN.includes(this.props.align) ? this.props.align : 'end';
  }

  /** @private @returns {'down'|'up'} */
  get _direction() {
    return VALID_DIRECTION.includes(this.props.direction) ? this.props.direction : 'down';
  }

  /** @private @returns {'default'|'ghost'} */
  get _variant() {
    return VALID_VARIANT.includes(this.props.variant) ? this.props.variant : 'default';
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const current = getLanguageMeta(getLanguage());

    const rootClasses = [
      'lang-switcher',
      this._compact             ? 'lang-switcher--compact'             : '',
      `lang-switcher--align-${this._align}`,
      `lang-switcher--${this._direction}`,
      this._variant !== 'default' ? `lang-switcher--${this._variant}` : '',
    ].filter(Boolean).join(' ');

    return `
      <div
        class="${rootClasses}"
        data-lang-switcher
      >
        ${this._renderTrigger(current)}
        ${this._renderMenu(current.code)}
      </div>
    `;
  }

  /* ── Section renderers ────────────────────────────────────────────────── */

  /** @private */
  _renderTrigger(current) {
    const label = t('switcher.choose') || 'Choose language';

    return `
      <button
        class="lang-switcher__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="lang-switcher-menu"
        aria-label="${this.esc(label)}"
        title="${this.esc(label)}"
      >
        <span class="lang-switcher__globe">${ICON_GLOBE}</span>

        <!-- Full name — shown in default mode, hidden in compact -->
        <span class="lang-switcher__current" aria-hidden="true">
          ${this.esc(current.native)}
        </span>

        <!-- Short code badge — shown in compact mode -->
        <span class="lang-switcher__badge" aria-hidden="true">
          ${this.esc(current.short)}
        </span>

        <span class="lang-switcher__chevron">${ICON_CHEVRON}</span>
      </button>
    `;
  }

  /** @private */
  _renderMenu(activeCode) {
    const options = LANGUAGES.map((lang) => this._renderOption(lang, activeCode)).join('');
    const label   = t('switcher.label') || 'Language';

    return `
      <div
        class="lang-switcher__menu"
        id="lang-switcher-menu"
        role="listbox"
        tabindex="-1"
        aria-label="${this.esc(label)}"
        aria-hidden="true"
      >
        <div class="lang-switcher__menu-head" aria-hidden="true">
          ${this.esc(label)}
        </div>
        <div class="lang-switcher__options" role="presentation">
          ${options}
        </div>
      </div>
    `;
  }

  /**
   * Renders a single language option row.
   * @private
   * @param {{ code: string, short: string, native: string, name: string }} lang
   * @param {string} activeCode
   */
  _renderOption(lang, activeCode) {
    const isActive = lang.code === activeCode;

    return `
      <button
        class="lang-switcher__option${isActive ? ' is-active' : ''}"
        type="button"
        role="option"
        aria-selected="${isActive}"
        data-lang="${this.esc(lang.code)}"
      >
        <span class="lang-switcher__opt-badge" aria-hidden="true">
          ${this.esc(lang.short)}
        </span>
        <span class="lang-switcher__opt-text">
          <span class="lang-switcher__opt-native">${this.esc(lang.native)}</span>
          <span class="lang-switcher__opt-name">${this.esc(lang.name)}</span>
        </span>
        <span class="lang-switcher__opt-check" aria-hidden="true">
          ${isActive ? ICON_CHECK : ''}
        </span>
      </button>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    const trigger = this.$('.lang-switcher__trigger');

    // Toggle the menu from the trigger
    if (trigger) {
      this.on(trigger, 'click', (e) => {
        e.stopPropagation();
        this._toggle();
      });
    }

    // Select a language (delegated so it survives option re-renders)
    this.delegate('.lang-switcher__option', 'click', (e, btn) => {
      e.stopPropagation();
      this._select(btn.dataset.lang);
    });

    // Keyboard navigation within the open menu
    this.on(document, 'keydown', (e) => {
      if (!this._open) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          this._closeMenu();
          this.$('.lang-switcher__trigger')?.focus();
          break;

        case 'ArrowDown': {
          e.preventDefault();
          this._moveFocus(1);
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          this._moveFocus(-1);
          break;
        }

        case 'Home': {
          e.preventDefault();
          const options = [...this.$$('.lang-switcher__option')];
          options[0]?.focus();
          break;
        }

        case 'End': {
          e.preventDefault();
          const options = [...this.$$('.lang-switcher__option')];
          options[options.length - 1]?.focus();
          break;
        }
      }
    });

    // Close on outside click
    this.on(document, 'click', (e) => {
      if (this._open && this.el && !this.el.contains(e.target)) {
        this._closeMenu();
      }
    });

    // Close on outside focus (tab away)
    this.on(document, 'focusin', (e) => {
      if (this._open && this.el && !this.el.contains(e.target)) {
        this._closeMenu();
      }
    });

    // Reflect language changes made elsewhere (Settings page, another switcher
    // instance, etc.) without requiring a full re-render.
    // A router.reload() will rebuild this component anyway, but this keeps
    // long-lived instances (public nav, footer) in sync during the same session.
    this.subscribe(store, 'language', () => this._syncActiveState());
  }

  /* ── Behaviour ────────────────────────────────────────────────────────── */

  /** @private */
  _toggle() {
    this._open ? this._closeMenu() : this._openMenu();
  }

  /** @private */
  _openMenu() {
    if (!this.el) return;
    this._open = true;

    this.el.classList.add('lang-switcher--open');

    const trigger = this.$('.lang-switcher__trigger');
    trigger?.setAttribute('aria-expanded', 'true');

    const menu = this.$('.lang-switcher__menu');
    menu?.setAttribute('aria-hidden', 'false');

    // Move focus to the active option (or first option) for keyboard users
    const active = this.$('.lang-switcher__option.is-active')
      ?? this.$('.lang-switcher__option');
    active?.focus();
  }

  /** @private */
  _closeMenu() {
    if (!this.el) return;
    this._open = false;

    this.el.classList.remove('lang-switcher--open');

    const trigger = this.$('.lang-switcher__trigger');
    trigger?.setAttribute('aria-expanded', 'false');

    const menu = this.$('.lang-switcher__menu');
    menu?.setAttribute('aria-hidden', 'true');
  }

  /**
   * Moves focus between option rows by step (+1 down, -1 up).
   * @private
   * @param {1|-1} step
   */
  _moveFocus(step) {
    const options = [...this.$$('.lang-switcher__option')];
    const current = document.activeElement;
    const idx     = options.indexOf(current);

    let next = -1;
    if (idx === -1) {
      next = step > 0 ? 0 : options.length - 1;
    } else {
      next = (idx + step + options.length) % options.length;
    }

    options[next]?.focus();
  }

  /**
   * Applies the chosen language.
   * setLanguage() persists the choice and triggers router.reload(),
   * which remounts the current page in the new dictionary.
   * @private
   * @param {string} code
   */
  _select(code) {
    this._closeMenu();

    // Return focus to the trigger so the user isn't stranded
    this.$('.lang-switcher__trigger')?.focus();

    if (!code || code === getLanguage()) return;

    // Fire and forget — router reload will rebuild the UI in the new language
    setLanguage(code);
  }

  /**
   * Patches the trigger label and option active markers in-place.
   * Called when another part of the app changes the language.
   * @private
   */
  _syncActiveState() {
    if (!this.el) return;

    const code = getLanguage();
    const meta = getLanguageMeta(code);

    // Update trigger labels
    const nativeEl = this.$('.lang-switcher__current');
    if (nativeEl) nativeEl.textContent = meta.native;

    const badgeEl = this.$('.lang-switcher__badge');
    if (badgeEl) badgeEl.textContent = meta.short;

    // Update option active states
    this.$$('.lang-switcher__option').forEach((btn) => {
      const isActive = btn.dataset.lang === code;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));

      const check = btn.querySelector('.lang-switcher__opt-check');
      if (check) check.innerHTML = isActive ? ICON_CHECK : '';

      const badge = btn.querySelector('.lang-switcher__opt-badge');
      if (badge) {
        badge.style.background = isActive ? 'var(--color-primary)' : '';
        badge.style.color      = isActive ? '#fff'                  : '';
      }
    });
  }
}