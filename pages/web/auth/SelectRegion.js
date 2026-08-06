/**
 * Lagos Konect — Region Selection Page
 * ============================================================
 * Route: /
 *
 * Single-screen entry point on a unified dark-green canvas.
 * Two sections on one background:
 *   1. Region picker         — three clickable zone cards
 *   2. Our Responsibility    — commitments block
 *
 * Selecting a region persists the choice in sessionStorage
 * under "lagosRegion" and immediately redirects to that
 * zone's route. No loading overlay — the navigation itself
 * is the user's feedback, and browser Back works normally.
 *
 * @module  SelectRegionPage
 * @version 3.0.0
 */

import { Component } from '../../../core/component.js?v=20260806b';

/* ── Constants ──────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'lagosRegion';

/**
 * Each region maps to a redirect path.
 * @type {ReadonlyArray<{ id: string, num: string, name: string, desc: string, path: string }>}
 */
const REGIONS = Object.freeze([
  {
    id:   'west',
    num:  '01',
    name: 'Lagos West',
    desc: 'Community news, local directories, events and development conversations for the western zone.',
    path: '/west',
  },
  {
    id:   'central',
    num:  '02',
    name: 'Lagos Central',
    desc: 'Public updates, youth initiatives, business links and civic engagement for the central zone.',
    path: '/central',
  },
  {
    id:   'east',
    num:  '03',
    name: 'Lagos East',
    desc: 'Stories, opportunities, cultural highlights and collaborative projects for the eastern zone.',
    path: '/east',
  },
]);

/**
 * @type {ReadonlyArray<{ title: string, body: string }>}
 */
const COMMITMENTS = Object.freeze([
  {
    title: 'Connect People',
    body:  'Bring residents, leaders, youth, businesses and associations closer to the conversations that shape daily life.',
  },
  {
    title: 'Share Opportunities',
    body:  'Highlight community initiatives, local services, events, jobs, skills and development efforts across the state.',
  },
  {
    title: 'Build Together',
    body:  'Encourage practical collaboration between Lagos West, Lagos Central and Lagos East.',
  },
]);

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export default class SelectRegionPage extends Component {
  static styles = '/pages/web/auth/SelectRegion.css?v=20260806b';

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    return `
      <div class="ak-site" role="document">
        ${this._renderNav()}

        <main class="ak-main">
          ${this._renderPicker()}
          ${this._renderResponsibility()}
        </main>

        ${this._renderFooter()}
      </div>
    `;
  }

  /* ── Nav ──────────────────────────────────────────────────────────────── */

  _renderNav() {
    return `
      <header class="ak-nav" role="banner">
        <div class="ak-nav__inner">

          <a class="ak-brand" href="#ak-regions" aria-label="Lagos Konect — back to top">
            <span class="ak-brand__mark" aria-hidden="true">LK</span>
            <span class="ak-brand__name">Lagos Konect</span>
          </a>

          <nav class="ak-nav__links" aria-label="Page sections">
            <a href="#ak-regions">Regions</a>
            <a href="#ak-responsibility">Responsibility</a>
          </nav>

          <button
            class="ak-nav__toggle"
            type="button"
            aria-label="Open navigation menu"
            aria-expanded="false"
            aria-controls="ak-mobile-menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                 aria-hidden="true" focusable="false">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

        </div>

        <div
          class="ak-mobile-menu"
          id="ak-mobile-menu"
          role="navigation"
          aria-label="Mobile navigation"
          aria-hidden="true"
        >
          <a href="#ak-regions">Regions</a>
          <a href="#ak-responsibility">Responsibility</a>
        </div>
      </header>
    `;
  }

  /* ── Region picker ────────────────────────────────────────────────────── */

  _renderPicker() {
    const cards = REGIONS.map((r, i) => `
      <button
        class="ak-zone-card"
        type="button"
        data-region="${r.id}"
        aria-label="Select ${r.name}"
        tabindex="${i === 0 ? '0' : '-1'}"
      >
        <span class="ak-zone-card__num" aria-hidden="true">${r.num}</span>
        <strong class="ak-zone-card__title">${r.name}</strong>
        <p class="ak-zone-card__desc">${r.desc}</p>
        <span class="ak-zone-card__cta" aria-hidden="true">Enter zone →</span>
      </button>
    `).join('');

    return `
      <section class="ak-pick" id="ak-regions" aria-labelledby="ak-pick-heading">
        <div class="ak-container">

          <div class="ak-pick__intro">
            <span class="ak-pick__kicker">Choose Your Zone</span>
            <h1 class="ak-pick__heading" id="ak-pick-heading">
              One platform for the whole state.
            </h1>
            <p class="ak-pick__sub">
              Lagos Konect is organised around the three senatorial zones so each
              community has a clear place while still being part of one Lagos story.
            </p>
          </div>

          <div
            class="ak-zone-grid"
            role="group"
            aria-label="Choose your region"
          >
            ${cards}
          </div>

        </div>
      </section>
    `;
  }

  /* ── Responsibility ───────────────────────────────────────────────────── */

  _renderResponsibility() {
    const cards = COMMITMENTS.map((c) => `
      <article class="ak-resp__card">
        <h3>${c.title}</h3>
        <p>${c.body}</p>
      </article>
    `).join('');

    return `
      <section class="ak-resp" id="ak-responsibility" aria-labelledby="ak-resp-heading">
        <div class="ak-container">

          <div class="ak-resp__top">
            <div class="ak-resp__left">
              <span class="ak-resp__kicker">Our Responsibility</span>
              <h2 class="ak-resp__heading" id="ak-resp-heading">
                Our responsibility is to build our community.
              </h2>
            </div>
            <p class="ak-resp__body">
              Every community grows when its people choose participation over silence,
              service over distance and unity over division. Lagos Konect exists to
              encourage that spirit: to make information easier to find, local voices
              easier to hear and community action easier to start.
            </p>
          </div>

          <div class="ak-resp__cards" role="list">
            ${cards}
          </div>

        </div>
      </section>
    `;
  }

  /* ── Footer ───────────────────────────────────────────────────────────── */

  _renderFooter() {
    const year = new Date().getFullYear();
    return `
      <footer class="ak-footer" role="contentinfo">
        <div class="ak-container ak-footer__inner">
          <span>&copy; ${year} lagoskonect.com</span>
          <span>Built for Lagos West, Lagos Central and Lagos East.</span>
        </div>
      </footer>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    this._bindSmoothScroll();
    this._bindRegionCards();
    this._bindMobileMenu();
    this._bindScrollReveal();
  }

  /* ── Smooth in-page scroll ────────────────────────────────────────────── */

  _bindSmoothScroll() {
    this.delegate('a[href^="#"]', 'click', (e, anchor) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;

      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', id);

      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });

      this._closeMobileMenu();
    });
  }

  /* ── Region card selection ────────────────────────────────────────────── */

  _bindRegionCards() {
    const grid  = this.el.querySelector('.ak-zone-grid');
    const cards = () => [...this.el.querySelectorAll('.ak-zone-card')];

    /* Click / Enter / Space — instant navigation */
    this.delegate('.ak-zone-card', 'click', (_e, card) => {
      const region = card.dataset.region;
      if (!region) return;
      this._selectAndGo(region);
    });

    /* Arrow-key roving focus */
    grid?.addEventListener('keydown', (e) => {
      const all     = cards();
      const current = document.activeElement;
      const idx     = all.indexOf(current);
      if (idx === -1) return;

      const map = {
        ArrowRight:  1, ArrowDown:  1,
        ArrowLeft:  -1, ArrowUp:   -1,
      };
      const step = map[e.key];
      if (step === undefined) return;

      e.preventDefault();
      const next = (idx + step + all.length) % all.length;

      all.forEach((c, i) => c.setAttribute('tabindex', i === next ? '0' : '-1'));
      all[next].focus();
    });
  }

  /**
   * Persists the region choice and navigates immediately.
   * No overlay / spinner — the browser's own navigation indicator
   * (tab spinner, URL change) is the feedback signal, and the
   * back button continues to work as expected.
   *
   * @param {string} regionId
   */
  _selectAndGo(regionId) {
    const regionData = REGIONS.find((r) => r.id === regionId);
    if (!regionData) return;

    try {
      sessionStorage.setItem(STORAGE_KEY, regionData.id);
    } catch {
      /* sessionStorage may be unavailable — non-fatal */
    }

    window.location.href = regionData.path;
  }

  /* ── Mobile menu ──────────────────────────────────────────────────────── */

  _bindMobileMenu() {
    const toggle = this.el.querySelector('.ak-nav__toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      isOpen ? this._closeMobileMenu() : this._openMobileMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeMobileMenu();
    });
  }

  _openMobileMenu() {
    const toggle = this.el.querySelector('.ak-nav__toggle');
    const menu   = this.el.querySelector('.ak-mobile-menu');
    if (!toggle || !menu) return;

    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label',    'Close navigation menu');
    menu.setAttribute('aria-hidden',     'false');
    menu.classList.add('ak-mobile-menu--open');
  }

  _closeMobileMenu() {
    const toggle = this.el.querySelector('.ak-nav__toggle');
    const menu   = this.el.querySelector('.ak-mobile-menu');
    if (!toggle || !menu) return;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label',    'Open navigation menu');
    menu.setAttribute('aria-hidden',     'true');
    menu.classList.remove('ak-mobile-menu--open');
  }

  /* ── Scroll-reveal ────────────────────────────────────────────────────── */

  _bindScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = this.el.querySelectorAll(
      '.ak-zone-card, .ak-resp__card, .ak-pick__intro'
    );
    if (!targets.length) return;

    targets.forEach((el) => el.classList.add('ak-reveal'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('ak-reveal--in');
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
    );

    targets.forEach((el) => io.observe(el));
  }
}