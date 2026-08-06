/**
 * Lagos Konect — Select LGA Modal
 * ============================================================
 * Global singleton modal for selecting or changing the current LGA.
 *
 * Triggered from:
 *   - WebTopbar LGA button
 *   - Welcome page "Change LGA" button
 *   - Settings page LGA field (optional)
 *
 * Architecture:
 *   Direct DOM mutation — no setState/re-render so this.el is never
 *   replaced. Safe to cache as a body-level singleton.
 *
 * On confirm:
 *   1. Calls api.users.updateProfile()
 *   2. Updates store.currentLGA + store.currentUser
 *   3. Persists to sessionStorage
 *   4. Shows success toast
 *   5. Navigates to the configured destination (default: /home)
 *
 * Mount once in BaseLayout (WebLayout.afterMount):
 *   window._selectLGAModal = new SelectLGAModal();
 *   await window._selectLGAModal.mount(document.body, { append: true });
 *
 * Open from anywhere:
 *   window._selectLGAModal.open();
 *   window._selectLGAModal.open({ redirectTo: '/south/profile' });
 *
 * @module  SelectLGAModal
 * @version 2.0.0
 */

import { Component }        from '../../core/component.js?v=20260806c';
import { store, showToast } from '../../core/store.js?v=20260806c';
import { router }           from '../../core/router.js?v=20260806c';
import { api }              from '../../api/client.js?v=20260806c';

/* ── Icons ──────────────────────────────────────────────────────────────── */
const ICON_MAP_PIN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
  <circle cx="12" cy="10" r="3"/>
</svg>`;

const ICON_SEARCH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <circle cx="11" cy="11" r="8"/>
  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
</svg>`;

const ICON_INFO = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="16" x2="12" y2="12"/>
  <line x1="12" y1="8" x2="12.01" y2="8"/>
</svg>`;

const ICON_DOT = `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
  <circle cx="5" cy="5" r="3" fill="white"/>
</svg>`;

/* ── Constants ──────────────────────────────────────────────────────────── */
const SKELETON_COUNT = 12;

/** @typedef {{ id: number, name: string, state: string }} LGA */

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */
export class SelectLGAModal extends Component {
  static styles = '/components/feature/SelectLGAModal.css?v=20260806c';

  constructor(props = {}) {
    super(props);

    this._isOpen      = false;
    /** @type {LGA[]} */
    this._lgas        = [];
    /** @type {LGA[]} */
    this._filtered    = [];
    /** @type {LGA|null} Staged selection — not yet confirmed */
    this._selectedLGA = null;
    this._saving      = false;
    /** @type {Element|null} */
    this._prevFocus   = null;
    /** @type {string|null} Override redirect destination */
    this._redirectAfter = null;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return `
      <div
        class="lga-modal-overlay"
        id="lga-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lga-modal-title"
        aria-describedby="lga-hint-text"
        inert
      >
        <div class="lga-modal" id="lga-modal">

          <!-- ── Header ──────────────────────────────────────────────── -->
          <div class="lga-modal__header">
            <h2 class="lga-modal__title" id="lga-modal-title">Select Your LGA</h2>
            <div
              class="lga-modal__search-wrap"
              role="search"
              aria-label="Search Local Government Areas"
            >
              <span class="lga-modal__search-icon">${ICON_SEARCH}</span>
              <label for="lga-search" class="sr-only">Search LGAs in your state</label>
              <input
                type="search"
                class="lga-modal__search"
                id="lga-search"
                placeholder="Search LGA in My State"
                autocomplete="off"
                aria-label="Search Local Government Areas"
                aria-controls="lga-grid"
                aria-autocomplete="list"
              />
            </div>
          </div>

          <!-- ── Body / Grid ──────────────────────────────────────────── -->
          <div class="lga-modal__body">
            <div
              class="lga-modal__grid"
              id="lga-grid"
              role="listbox"
              aria-label="Available Local Government Areas"
              aria-multiselectable="false"
              aria-live="polite"
              aria-busy="true"
            >
              ${this._skeletonHtml()}
            </div>
          </div>

          <!-- ── Footer ──────────────────────────────────────────────── -->
          <div class="lga-modal__footer" id="lga-footer">
            <div class="lga-modal__hint" id="lga-hint">
              <span class="lga-modal__hint-icon">${ICON_INFO}</span>
              <span
                id="lga-hint-text"
                aria-live="polite"
                aria-atomic="true"
              >
                Select an LGA to get started.
              </span>
            </div>
            <div class="lga-modal__actions">
              <button
                class="lga-modal__cancel-btn"
                id="lga-cancel-btn"
                type="button"
                aria-label="Cancel LGA selection"
              >
                Cancel
              </button>
              <button
                class="lga-modal__confirm-btn"
                id="lga-confirm-btn"
                type="button"
                disabled
                aria-disabled="true"
                aria-describedby="lga-hint-text"
              >
                Confirm Selection
              </button>
            </div>
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

  /**
   * Opens the modal.
   * @param {{ redirectTo?: string }} [opts]
   */
  open(opts = {}) {
    if (this._isOpen || !this.el) return;

    this._isOpen        = true;
    this._redirectAfter = opts.redirectTo ?? null;
    this._prevFocus     = document.activeElement;

    // Stage the current LGA as the pre-selection
    this._selectedLGA = store.currentLGA
      ? {
          id:    store.currentLGA.id,
          name:  store.currentLGA.name,
          state: store.currentLGA.state ?? '',
        }
      : null;

    this.el.removeAttribute('inert');
    this.el.classList.add('lga-modal-overlay--visible');
    document.body.style.overflow = 'hidden';

    // Clear search
    const searchInput = this.$('#lga-search');
    if (searchInput) searchInput.value = '';

    this._loadAndRender();

    // Focus the search input after the CSS transition starts
    requestAnimationFrame(() => this.$('#lga-search')?.focus());
  }

  close() {
    if (!this._isOpen || !this.el) return;
    this._isOpen = false;

    this.el.setAttribute('inert', '');
    this.el.classList.remove('lga-modal-overlay--visible');
    document.body.style.overflow = '';

    this._prevFocus?.focus();
    this._selectedLGA = null;
  }

  /* ── Data ─────────────────────────────────────────────────────────────── */

  /** @private */
  async _loadAndRender() {
    const grid = this.$('#lga-grid');

    // Use cached list if available — skip the network call
    if (store.lgaList?.length) {
      const region = store.currentUser?.region || sessionStorage.getItem('lagosRegion') || '';
      const list = region ? store.lgaList.filter((l) => l.region === region) : store.lgaList;
      this._lgas    = list;
      this._filtered = list;
      this._renderGrid();
      return;
    }

    // Show skeleton while fetching
    if (grid) {
      grid.innerHTML = this._skeletonHtml();
      grid.setAttribute('aria-busy', 'true');
    }

    try {
      const res = await api.lgas.getAll();

      if (res.error || !res.data) {
        showToast('error', 'Failed to load LGAs. Please try again.');
        return;
      }

      store.lgaList  = res.data;
      const region = store.currentUser?.region || sessionStorage.getItem('lagosRegion') || '';
      const list = region ? res.data.filter((l) => l.region === region) : res.data;
      this._lgas     = list;
      this._filtered = list;
      this._renderGrid();

    } catch (err) {
      console.error('[SelectLGAModal] failed to load LGAs:', err);
      showToast('error', 'Failed to load LGAs. Please try again.');
    } finally {
      if (grid) grid.setAttribute('aria-busy', 'false');
    }
  }

  /* ── Rendering ────────────────────────────────────────────────────────── */

  /** @private */
  _renderGrid() {
    const grid = this.$('#lga-grid');
    if (!grid) return;

    if (!this._filtered.length) {
      grid.innerHTML = `
        <div class="lga-modal__empty" role="status" aria-live="polite">
          No LGAs match your search.
        </div>
      `;
      this._updateFooter();
      return;
    }

    grid.innerHTML = this._filtered.map((lga) => {
      const isSelected = this._selectedLGA &&
        String(this._selectedLGA.id) === String(lga.id);

      return `
        <button
          class="lga-card${isSelected ? ' lga-card--selected' : ''}"
          role="option"
          type="button"
          aria-selected="${isSelected}"
          aria-label="${this.esc(lga.name)}${lga.state ? ', ' + this.esc(lga.state) : ''}${lga.isCapital ? ' — State Capital' : ''}"
          data-lga-id="${this.esc(String(lga.id))}"
          data-lga-name="${this.esc(lga.name)}"
          data-lga-state="${this.esc(lga.state ?? '')}"
        >
          <div class="lga-card__top">
            <span class="lga-card__icon${isSelected ? ' lga-card__icon--selected' : ''}">
              ${ICON_MAP_PIN}
            </span>
            <span class="lga-card__radio${isSelected ? ' lga-card__radio--selected' : ''}">
              ${isSelected ? ICON_DOT : ''}
            </span>
          </div>
          <div class="lga-card__body">
            <span class="lga-card__name">${this.esc(lga.name)}</span>
            <span class="lga-card__state">${this.esc(lga.state ?? '')}</span>
            ${lga.isCapital
              ? `<span class="lga-card__capital-badge">State Capital</span>`
              : ''}
          </div>
        </button>
      `;
    }).join('');

    this._updateFooter();
  }

  /** @private */
  _updateFooter() {
    const confirmBtn = this.$('#lga-confirm-btn');
    const hintText   = this.$('#lga-hint-text');
    const hasSelection = !!this._selectedLGA;

    if (confirmBtn) {
      confirmBtn.disabled = !hasSelection;
      confirmBtn.setAttribute('aria-disabled', String(!hasSelection));
    }

    if (hintText) {
      hintText.textContent = hasSelection
        ? `Selecting ${this._selectedLGA.name} will prioritise local news and civic updates for your area.`
        : 'Select an LGA to get started.';
    }
  }

  /** @private */
  _skeletonHtml() {
    return Array.from({ length: SKELETON_COUNT }, () =>
      `<div class="lga-card lga-card--skeleton" aria-hidden="true"></div>`
    ).join('');
  }

  /* ── Events ───────────────────────────────────────────────────────────── */

  /** @private */
  _bindEvents() {
    // Backdrop click — close
    this.on(this.el, 'click', (e) => {
      if (e.target === this.el) this.close();
    });

    // Escape key
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) this.close();
    });

    // Arrow-key navigation within the listbox
    this.on(this.$('#lga-grid'), 'keydown', (e) => {
      const cards = [...this.$$('.lga-card:not(.lga-card--skeleton)')];
      if (!cards.length) return;

      const current = document.activeElement;
      const idx     = cards.indexOf(current);

      const map = {
        ArrowRight: 1, ArrowDown:  1,
        ArrowLeft: -1, ArrowUp:   -1,
      };
      const step = map[e.key];
      if (step === undefined) return;

      e.preventDefault();
      const next = idx === -1
        ? 0
        : (idx + step + cards.length) % cards.length;
      cards[next].focus();
    });

    // Cancel
    this.$('#lga-cancel-btn')?.addEventListener('click', () => this.close());

    // Search with debounce
    const searchInput = this.$('#lga-search');
    if (searchInput) {
      let debounceTimer;
      this.on(searchInput, 'input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const q = searchInput.value.trim().toLowerCase();
          this._filtered = q
            ? this._lgas.filter((l) => l.name.toLowerCase().includes(q))
            : this._lgas;
          this._renderGrid();
        }, 120);
      });
    }

    // LGA card selection — delegated on the grid
    this.delegate('.lga-card:not(.lga-card--skeleton)', 'click', (_e, card) => {
      this._selectedLGA = {
        id:    Number(card.dataset.lgaId),
        name:  card.dataset.lgaName,
        state: card.dataset.lgaState ?? '',
      };
      this._renderGrid();

      // Announce the selection to screen readers
      const liveRegion = this.$('#lga-hint-text');
      if (liveRegion) {
        liveRegion.textContent =
          `${this._selectedLGA.name} selected. Press Confirm Selection to save.`;
      }
    });

    // Confirm
    this.$('#lga-confirm-btn')?.addEventListener('click', () => this._handleConfirm());
  }

  /* ── Confirm / Save ───────────────────────────────────────────────────── */

  /** @private */
  async _handleConfirm() {
    if (!this._selectedLGA || this._saving) return;
    this._saving = true;

    const confirmBtn = this.$('#lga-confirm-btn');
    if (confirmBtn) {
      confirmBtn.textContent = 'Saving…';
      confirmBtn.disabled    = true;
    }

    try {
      const res = await api.users.updateProfile({
        lgaId:   this._selectedLGA.id,
        lgaName: this._selectedLGA.name,
      });

      if (res.error) {
        showToast('error', res.error.message || 'Failed to save LGA. Please try again.');
        return;
      }

      // Update in-memory store
      const updatedUser = {
        ...store.currentUser,
        lgaId:   this._selectedLGA.id,
        lgaName: this._selectedLGA.name,
      };
      store.currentUser = updatedUser;
      store.currentLGA  = {
        id:    this._selectedLGA.id,
        name:  this._selectedLGA.name,
        state: this._selectedLGA.state,
      };

      // Persist to session so the update survives a page refresh
      try {
        const { saveSession } = await import('../../utils/storage.js?v=20260806c');
        const existing = JSON.parse(sessionStorage.getItem('adm_auth') || '{}');
        saveSession({
          token: existing.token,
          role:  store.role,
          user:  updatedUser,
        });
      } catch {
        // Non-critical — store is already updated in memory
      }

      showToast('success', `LGA updated to ${this._selectedLGA.name}.`);

      const dest = this._redirectAfter ?? '/home';
      this._redirectAfter = null;

      this.close();
      router.push(dest);

    } catch (err) {
      console.error('[SelectLGAModal] confirm error:', err);
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      this._saving = false;
      if (confirmBtn) {
        confirmBtn.textContent = 'Confirm Selection';
        confirmBtn.disabled    = !this._selectedLGA;
        confirmBtn.setAttribute('aria-disabled', String(!this._selectedLGA));
      }
    }
  }
}