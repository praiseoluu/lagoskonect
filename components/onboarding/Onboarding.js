/**
 * Lagos Konect — Onboarding Component
 * ============================================================
 * Shared multi-step hybrid onboarding used by all region Welcome pages.
 * Renders inside WebLayout (sidebar + topbar shell).
 *
 * Steps:
 *   0 — Welcome         (personalised greeting + LGA)
 *   1 — Stay Informed   (feature slide)
 *   2 — Participate     (feature slide)
 *   3 — Short bio       (optional setup, skippable)
 *   4 — Notifications   (optional setup, skippable)
 *
 * Usage (region Welcome page):
 *   export default class WelcomePage extends Onboarding {
 *     constructor(props) {
 *       super({ homeRoute: '/east/home', regionBrand: 'LagKonnect - East', ...props });
 *     }
 *   }
 *
 * @module  Onboarding
 * @version 1.0.0
 */

import { WebLayout }                        from '../layout/BaseLayout.js?v=20260806e';
import { router }                           from '../../core/router.js?v=20260806e';
import { store, setPageLoading }            from '../../core/store.js?v=20260806e';
import { api }                              from '../../api/client.js?v=20260806e';
import { t }                                from '../../core/i18n.js?v=20260806e';

/* ── Constants ───────────────────────────────────────────────────────────── */

const TOTAL_STEPS  = 5;
const SLIDE_STEPS  = 3;   // steps 0–2 are informational slides
const BIO_MAX      = 160;
const ANIM_MS      = 220; // slide transition duration (must match CSS)

/* ── SVG icons ───────────────────────────────────────────────────────────── */

const IC_CHECK = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const IC_CHECK_SM = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const IC_ARROW_R = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
const IC_ARROW_L = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
const IC_BELL = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;
const IC_CHAT = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
const IC_USER = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const IC_BELL_SM = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export default class Onboarding extends WebLayout {
  static styles = '/pages/web/app/Welcome.css?v=20260806e';

  /**
   * @param {{ homeRoute?: string, regionBrand?: string }} props
   */
  constructor(props) {
    super({ title: 'Welcome', ...props });
    this._homeRoute     = props.homeRoute   ?? '/home';
    this._regionBrand   = props.regionBrand ?? 'Lagos Konect';
    this._user          = store.currentUser;
    this._step          = 0;
    this._bio           = '';
    this._notifEnabled  = false;
    this._transitioning = false;
  }

  /* ── Derived data ─────────────────────────────────────────────────────── */

  get _firstName() { return this._user?.name?.split(' ')[0] || 'there'; }
  get _lgaName()   { return this._user?.lgaName || store.currentLGA?.name || 'your LGA'; }

  /* ── Render ───────────────────────────────────────────────────────────── */

  getContent() {
    return `
      <div class="ob-page">
        <div class="ob-card" role="main" aria-label="Onboarding">

          <div class="ob-card__corner" aria-hidden="true"></div>

          <!-- Step indicator -->
          <div class="ob-dots" id="ob-dots">
            ${this._renderDots(0)}
          </div>

          <!-- Animated step content -->
          <div class="ob-step-content" id="ob-step-content" aria-live="polite" aria-atomic="true">
            ${this._renderStepContent(0)}
          </div>

          <!-- Navigation bar -->
          <div class="ob-nav" id="ob-nav">
            ${this._renderNav(0)}
          </div>

        </div>
      </div>
    `;
  }

  /* ── Step content ─────────────────────────────────────────────────────── */

  _renderStepContent(step) {
    switch (step) {
      case 0: return this._renderSlide0();
      case 1: return this._renderSlide1();
      case 2: return this._renderSlide2();
      case 3: return this._renderBioStep();
      case 4: return this._renderNotifStep();
      default: return '';
    }
  }

  /** Step 0 — personalised welcome */
  _renderSlide0() {
    return `
      <div class="ob-step" data-step="0">
        <div class="ob-step__check-icon" aria-hidden="true">${IC_CHECK}</div>
        <span class="ob-step__lga-pill">
          ${this.esc(this._lgaName.toUpperCase())} ${this.esc(t('welcome.communitySuffix'))}
        </span>
        <div class="ob-step__text">
          <h1 class="ob-step__title" id="ob-heading">
            ${this.esc(t('onboarding.slide1TitlePre'))}
            <span class="ob-step__brand">${this.esc(this._regionBrand)}</span>${this.esc(t('onboarding.slide1TitlePost', { name: this._firstName }))}
          </h1>
          <p class="ob-step__subtitle">
            ${this.esc(t('onboarding.slide1Subtitle', { lga: this._lgaName }))}
          </p>
        </div>
        <p class="ob-step__lga-change">
          ${this.esc(t('welcome.notIn', { lga: this._lgaName }))}
          <button class="ob-step__lga-change-btn" id="change-lga-btn" type="button">
            ${this.esc(t('welcome.changeLGA'))}
          </button>
        </p>
      </div>
    `;
  }

  /** Step 1 — Stay Informed */
  _renderSlide1() {
    return `
      <div class="ob-step ob-step--feature" data-step="1">
        <div class="ob-step__feature-icon" aria-hidden="true">${IC_BELL}</div>
        <div class="ob-step__text">
          <h2 class="ob-step__title">${this.esc(t('onboarding.slide2Title'))}</h2>
          <p class="ob-step__subtitle">${this.esc(t('onboarding.slide2Desc'))}</p>
        </div>
        <ul class="ob-bullets" aria-label="${this.esc(t('onboarding.slide2Title'))}">
          <li class="ob-bullet"><span class="ob-bullet__dot" aria-hidden="true"></span><span>${this.esc(t('onboarding.slide2Bullet1'))}</span></li>
          <li class="ob-bullet"><span class="ob-bullet__dot" aria-hidden="true"></span><span>${this.esc(t('onboarding.slide2Bullet2'))}</span></li>
          <li class="ob-bullet"><span class="ob-bullet__dot" aria-hidden="true"></span><span>${this.esc(t('onboarding.slide2Bullet3'))}</span></li>
        </ul>
      </div>
    `;
  }

  /** Step 2 — Participate & Connect */
  _renderSlide2() {
    return `
      <div class="ob-step ob-step--feature" data-step="2">
        <div class="ob-step__feature-icon" aria-hidden="true">${IC_CHAT}</div>
        <div class="ob-step__text">
          <h2 class="ob-step__title">${this.esc(t('onboarding.slide3Title'))}</h2>
          <p class="ob-step__subtitle">${this.esc(t('onboarding.slide3Desc'))}</p>
        </div>
        <ul class="ob-bullets" aria-label="${this.esc(t('onboarding.slide3Title'))}">
          <li class="ob-bullet"><span class="ob-bullet__dot" aria-hidden="true"></span><span>${this.esc(t('onboarding.slide3Bullet1'))}</span></li>
          <li class="ob-bullet"><span class="ob-bullet__dot" aria-hidden="true"></span><span>${this.esc(t('onboarding.slide3Bullet2'))}</span></li>
          <li class="ob-bullet"><span class="ob-bullet__dot" aria-hidden="true"></span><span>${this.esc(t('onboarding.slide3Bullet3'))}</span></li>
        </ul>
      </div>
    `;
  }

  /** Step 3 — Short bio (optional) */
  _renderBioStep() {
    const charsLeft = BIO_MAX - this._bio.length;
    return `
      <div class="ob-step ob-step--setup" data-step="3">
        <div class="ob-step__setup-icon" aria-hidden="true">${IC_USER}</div>
        <div class="ob-step__text">
          <h2 class="ob-step__title">${this.esc(t('onboarding.bioTitle'))}</h2>
          <p class="ob-step__subtitle">${this.esc(t('onboarding.bioSubtitle'))}</p>
        </div>
        <div class="ob-bio-field">
          <label class="ob-bio-label" for="ob-bio-input">${this.esc(t('onboarding.bioLabel'))}</label>
          <textarea
            id="ob-bio-input"
            class="ob-bio-textarea"
            maxlength="${BIO_MAX}"
            placeholder="${this.esc(t('onboarding.bioPlaceholder'))}"
            rows="3"
            aria-describedby="ob-bio-chars ob-bio-error"
          >${this.esc(this._bio)}</textarea>
          <div class="ob-bio-meta">
            <p class="ob-step__error" id="ob-bio-error" role="alert" aria-live="polite"></p>
            <span class="ob-bio-chars" id="ob-bio-chars">
              <span id="ob-chars-num">${charsLeft}</span> ${this.esc(t('onboarding.bioCharsLeft'))}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  /** Step 4 — Notifications (optional) */
  _renderNotifStep() {
    return `
      <div class="ob-step ob-step--setup" data-step="4">
        <div class="ob-step__setup-icon" aria-hidden="true">${IC_BELL_SM}</div>
        <div class="ob-step__text">
          <h2 class="ob-step__title">${this.esc(t('onboarding.notifTitle'))}</h2>
          <p class="ob-step__subtitle">${this.esc(t('onboarding.notifSubtitle', { lga: this._lgaName }))}</p>
        </div>
        <button
          class="ob-notif-toggle${this._notifEnabled ? ' ob-notif-toggle--on' : ''}"
          id="ob-notif-toggle"
          type="button"
          aria-pressed="${this._notifEnabled}"
        >
          ${this._notifEnabled
            ? `${IC_CHECK_SM}<span>${this.esc(t('onboarding.notifEnabled'))}</span>`
            : `<span>${this.esc(t('onboarding.notifEnable'))}</span>`
          }
        </button>
        <p class="ob-step__error" id="ob-notif-error" role="alert" aria-live="polite"></p>
      </div>
    `;
  }

  /* ── Nav / dots renderers ─────────────────────────────────────────────── */

  _renderDots(step) {
    return Array.from({ length: TOTAL_STEPS }, (_, i) => {
      const isSetup = i >= SLIDE_STEPS;
      const cls = [
        'ob-dot',
        isSetup   ? 'ob-dot--setup'  : '',
        i === step ? 'ob-dot--active' : '',
        i < step   ? 'ob-dot--done'   : '',
      ].filter(Boolean).join(' ');
      return `<span class="${cls}" aria-hidden="true"></span>`;
    }).join('');
  }

  _renderNav(step) {
    const isFirst  = step === 0;
    const isLast   = step === TOTAL_STEPS - 1;
    const isSetup  = step >= SLIDE_STEPS;
    const isBio    = step === 3;

    const backBtn = isFirst ? '' : `
      <button class="ob-nav__back" id="ob-back" type="button">
        ${IC_ARROW_L} ${this.esc(t('onboarding.back'))}
      </button>`;

    const nextLabel = isBio ? t('onboarding.bioSave') : isLast ? t('onboarding.goHome') : t('onboarding.next');
    const nextIcon  = isLast ? '' : IC_ARROW_R;

    const nextBtn = `
      <button class="ob-nav__next ktg-btn ktg-btn--primary" id="ob-next" type="button">
        ${this.esc(nextLabel)} ${nextIcon}
      </button>`;

    const skipBtn = isSetup ? `
      <button class="ob-nav__skip" id="ob-skip" type="button">
        ${this.esc(t('onboarding.skip'))}
      </button>` : '';

    return `
      <div class="ob-nav__left">${backBtn}</div>
      <div class="ob-nav__right">${skipBtn}${nextBtn}</div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  onContentReady() {
    setPageLoading(false);
    // Mark welcome seen immediately so re-login always goes to /home
    api.users.markWelcomeSeen().catch(() => {});
    this._wireStep();
  }

  /* ── Event wiring ─────────────────────────────────────────────────────── */

  _wireStep() {
    const root = this.getContentEl();
    if (!root) return;

    const nextBtn = root.querySelector('#ob-next');
    const backBtn = root.querySelector('#ob-back');
    const skipBtn = root.querySelector('#ob-skip');

    if (nextBtn) this.on(nextBtn, 'click', () => this._handleNext());
    if (backBtn) this.on(backBtn, 'click', () => this._goToStep(this._step - 1, 'back'));
    if (skipBtn) this.on(skipBtn, 'click', () => this._handleSkip());

    // Step-specific
    if (this._step === 0) {
      const changeLgaBtn = root.querySelector('#change-lga-btn');
      if (changeLgaBtn) {
        this.on(changeLgaBtn, 'click', () => {
          if (typeof window._selectLGAModal?.open === 'function') {
            window._selectLGAModal.open();
          }
        });
      }
    }

    if (this._step === 3) {
      const textarea = root.querySelector('#ob-bio-input');
      if (textarea) {
        this.on(textarea, 'input', () => {
          this._bio = textarea.value;
          const numEl = root.querySelector('#ob-chars-num');
          if (numEl) numEl.textContent = BIO_MAX - this._bio.length;
          const errEl = root.querySelector('#ob-bio-error');
          if (errEl) errEl.textContent = '';
        });
      }
    }

    if (this._step === 4) {
      const toggleBtn = root.querySelector('#ob-notif-toggle');
      if (toggleBtn) {
        this.on(toggleBtn, 'click', () => this._handleNotifToggle());
      }
    }
  }

  /* ── Navigation actions ───────────────────────────────────────────────── */

  async _handleNext() {
    if (this._transitioning) return;

    if (this._step === TOTAL_STEPS - 1) {
      if (this._notifEnabled) await this._saveNotifPrefs();
      this._finish();
      return;
    }

    if (this._step === 3 && this._bio.trim()) {
      const ok = await this._saveBio();
      if (!ok) return;
    }

    this._goToStep(this._step + 1, 'forward');
  }

  _handleSkip() {
    if (this._transitioning) return;
    if (this._step === TOTAL_STEPS - 1) {
      this._finish();
      return;
    }
    this._goToStep(this._step + 1, 'forward');
  }

  _finish() {
    router.replace(this._homeRoute);
  }

  /* ── Step transitions ─────────────────────────────────────────────────── */

  _goToStep(target, direction = 'forward') {
    if (this._transitioning || target < 0 || target >= TOTAL_STEPS) return;
    this._transitioning = true;

    const root      = this.getContentEl();
    const contentEl = root?.querySelector('#ob-step-content');
    const dotsEl    = root?.querySelector('#ob-dots');
    const navEl     = root?.querySelector('#ob-nav');
    if (!contentEl) { this._transitioning = false; return; }

    const exitCls  = direction === 'forward' ? 'ob--exit-left'  : 'ob--exit-right';
    const enterCls = direction === 'forward' ? 'ob--enter-right' : 'ob--enter-left';

    contentEl.classList.add(exitCls);

    setTimeout(() => {
      this._step = target;
      contentEl.classList.remove(exitCls);
      contentEl.innerHTML = this._renderStepContent(target);
      if (dotsEl) dotsEl.innerHTML = this._renderDots(target);
      if (navEl)  navEl.innerHTML  = this._renderNav(target);

      // Trigger enter animation
      contentEl.classList.add(enterCls);
      this._wireStep();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          contentEl.classList.remove(enterCls);
          this._transitioning = false;
        });
      });
    }, ANIM_MS);
  }

  /* ── API actions ──────────────────────────────────────────────────────── */

  async _saveBio() {
    const root    = this.getContentEl();
    const nextBtn = root?.querySelector('#ob-next');

    if (nextBtn) {
      nextBtn.disabled     = true;
      nextBtn.textContent  = t('onboarding.bioSaving');
    }

    const res = await api.users.updateProfile({ bio: this._bio.trim() });

    if (nextBtn) {
      nextBtn.disabled   = false;
      nextBtn.innerHTML  = `${this.esc(t('onboarding.bioSave'))} ${IC_ARROW_R}`;
    }

    if (res.error) {
      const errEl = root?.querySelector('#ob-bio-error');
      if (errEl) errEl.textContent = res.error.message ?? t('onboarding.bioErrSave');
      return false;
    }

    if (store.currentUser) store.currentUser.bio = this._bio.trim();
    return true;
  }

  async _handleNotifToggle() {
    if (this._transitioning) return;
    this._notifEnabled = !this._notifEnabled;

    const root      = this.getContentEl();
    const toggleBtn = root?.querySelector('#ob-notif-toggle');
    if (!toggleBtn) return;

    toggleBtn.disabled = true;

    if (this._notifEnabled) {
      const ok = await this._saveNotifPrefs();
      toggleBtn.disabled = false;
      if (ok) {
        toggleBtn.classList.add('ob-notif-toggle--on');
        toggleBtn.setAttribute('aria-pressed', 'true');
        toggleBtn.innerHTML = `${IC_CHECK_SM}<span>${this.esc(t('onboarding.notifEnabled'))}</span>`;
      } else {
        this._notifEnabled = false;
      }
    } else {
      toggleBtn.disabled = false;
      toggleBtn.classList.remove('ob-notif-toggle--on');
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.innerHTML = `<span>${this.esc(t('onboarding.notifEnable'))}</span>`;
    }
  }

  async _saveNotifPrefs() {
    const res = await api.users.updateNotifPrefs({
      official:    true,
      breaking:    true,
      lgaAlerts:   true,
      chatReplies: true,
      reelLikes:   true,
    });

    if (res.error) {
      const errEl = this.getContentEl()?.querySelector('#ob-notif-error');
      if (errEl) errEl.textContent = res.error.message ?? t('onboarding.notifErrSave');
      return false;
    }
    return true;
  }
}
