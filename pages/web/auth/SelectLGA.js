/**
 * KTG Connect — LGA Selection Page
 * Route: /select-lga
 * ============================================================
 * Shown after first login if user has no LGA set.
 * Also accessible from Settings to change LGA.
 * Guards: requireAuth + requireCitizen
 */

import { Component } from '../../../core/component.js?v=20260806b';
import { Button } from '../../../components/base/Button.js?v=20260806b';
import { store, showToast } from '../../../core/store.js?v=20260806b';
import { router } from '../../../core/router.js?v=20260806b';
import { api } from '../../../api/client.js?v=20260806b';

export default class SelectLGAPage extends Component {
  static styles = '/pages/web/auth/SelectLGA.css?v=20260806b';
  constructor(props) {
    super(props);
    this.state = {
      lgas: [],
      selectedLGA: store.currentLGA || null,
      loading: true,
      search: '',
      saving: false,
    };
  }

  render() {
    const { lgas, selectedLGA, loading, search, saving } = this.state;

    const filtered = search
      ? lgas.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
      : lgas;

    return `
      <div class="lga-select-shell">
        <div class="lga-select-card">

          <!-- Logo -->
          <div class="lga-select__logo" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#068927"/>
              <path d="M8 20l6-8 4 5 3-4 5 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <!-- Heading -->
          <div class="lga-select__heading">
            <h1 class="lga-select__title">Select your LGA</h1>
            <p class="lga-select__subtitle">
              Choose your Local Government Area. All content will be tailored to your LGA.
              You can change this later in Settings.
            </p>
          </div>

          <!-- Search -->
          <div class="lga-select__search-wrap">
            <span class="lga-select__search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              type="text"
              class="lga-select__search"
              placeholder="Search LGAs…"
              value="${this.esc(search)}"
              aria-label="Search LGAs"
              autocomplete="off"
            />
          </div>

          <!-- Grid -->
          <div
            class="lga-select__grid"
            role="listbox"
            aria-label="Available LGAs"
            aria-multiselectable="false"
          >
            ${loading
              ? Array.from({ length: 12 }).map(() => `
                  <div class="lga-select__skeleton" aria-hidden="true"></div>
                `).join('')
              : filtered.length === 0
                ? `<div class="lga-select__empty">No LGAs match your search.</div>`
                : filtered.map((lga) => {
                    const isSelected = selectedLGA?.id === lga.id;
                    return `
                      <button
                        class="lga-select__option ${isSelected ? 'lga-select__option--selected' : ''}"
                        role="option"
                        aria-selected="${isSelected}"
                        data-lga-id="${lga.id}"
                        data-lga-name="${this.esc(lga.name)}"
                        data-lga-state="${this.esc(lga.state)}"
                        type="button"
                      >
                        <span class="lga-select__option-name">${this.esc(lga.name)}</span>
                        <span class="lga-select__option-state">${this.esc(lga.state)}</span>
                        ${isSelected ? `
                          <span class="lga-select__option-check" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </span>
                        ` : ''}
                      </button>
                    `;
                  }).join('')
            }
          </div>

          <!-- Selection summary + CTA -->
          <div class="lga-select__footer">
            ${selectedLGA
              ? `<p class="lga-select__selected-label">
                   Selected: <strong>${this.esc(selectedLGA.name)}</strong>
                 </p>`
              : `<p class="lga-select__selected-label lga-select__selected-label--empty">
                   No LGA selected yet
                 </p>`
            }
            <div id="confirm-btn-mount"></div>
          </div>

        </div>
      </div>
    `;
  }

  afterMount() {
    this._loadLGAs();
    this._mountConfirmButton();
    this._bindEvents();
  }

  async _loadLGAs() {
    // Use cached list from store if available
    if (store.lgaList?.length) {
      this.setState({ lgas: store.lgaList, loading: false });
      return;
    }
    const res = await api.lgas.getAll();
    if (res.data) {
      store.lgaList = res.data;
      this.setState({ lgas: res.data, loading: false });
    } else {
      showToast('error', 'Failed to load LGAs. Please refresh.');
      this.setState({ loading: false });
    }
  }

  _mountConfirmButton() {
    const mount = this.$('#confirm-btn-mount');
    if (!mount) return;

    this._confirmBtn = this.addChild(new Button({
      label: 'Confirm LGA',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      disabled: !this.state.selectedLGA,
      onClick: () => this._handleConfirm(),
    }));
    this._confirmBtn.mount(mount);
  }

  _bindEvents() {
    // LGA option selection
    this.delegate('[data-lga-id]', 'click', (e, btn) => {
      const lga = {
        id:    parseInt(btn.dataset.lgaId, 10),
        name:  btn.dataset.lgaName,
        state: btn.dataset.lgaState,
      };
      this.setState({ selectedLGA: lga });
      this._confirmBtn?.setDisabled(false);
    });

    // Search input
    this.delegate('.lga-select__search', 'input', (e, input) => {
      this.setState({ search: input.value });
    });
  }

  async _handleConfirm() {
    const { selectedLGA } = this.state;
    if (!selectedLGA) return;

    this._confirmBtn.setLoading(true);
    this.setState({ saving: true });

    const res = await api.users.updateProfile({
      lgaId:   selectedLGA.id,
      lgaName: selectedLGA.name,
    });

    this._confirmBtn.setLoading(false);
    this.setState({ saving: false });

    if (res.error) {
      showToast('error', 'Failed to save LGA. Please try again.');
      return;
    }

    // Update store
    store.currentLGA  = selectedLGA;
    store.currentUser = { ...store.currentUser, lgaId: selectedLGA.id, lgaName: selectedLGA.name };

    const region = sessionStorage.getItem('lagosRegion') || 'west';
    router.replace(`/${region}/welcome`);
  }
}
