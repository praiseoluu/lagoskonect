/**
 * Lagos Konect — Public Layout
 * ============================================================
 * Shared shell for all public-facing pages (landing, forgot
 * password, verify identity, reset credentials, etc.).
 *
 * Renders the premium dark-green sticky nav and full footer
 * around a content slot. Mirrors the pattern used by AuthLayout
 * for the auth card pages.
 *
 * Usage (inside a page's render()):
 *   return PublicLayout.wrap({
 *     content: `<section class="my-page__section">…</section>`,
 *   });
 *
 *   // In afterMount():
 *   PublicLayout.mountLanguageSwitcher(this);
 *   PublicLayout.bindMobileMenu(this);
 *   PublicLayout.bindNewsletter(this, (email) => apiSubscribe(email));
 *   PublicLayout.bindScroll(this);   // adds shadow on scroll
 *
 * @module  PublicLayout
 * @version 2.0.0
 */

import { LanguageSwitcher } from '../../../components/feature/LanguageSwitcher.js?v=20260805c';
import { t }                from '../../../core/i18n.js?v=20260805c';

/* ── Region constants ───────────────────────────────────────────────────── */

const VALID_REGIONS  = Object.freeze(['west', 'central', 'east']);
const DEFAULT_REGION = 'west';
const STORAGE_KEY    = 'lagosRegion';

/** Display name shown in the nav, keyed by region. */
const BRAND_MAP = Object.freeze({
  west:    'Lagos Konect - West',
  central: 'Lagos Konect - Central',
  east:    'Lagos Konect - East',
});

/* ── Social links ───────────────────────────────────────────────────────── */

const SOCIAL_LINKS = Object.freeze([
  {
    label: 'LinkedIn',
    href:  '#',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>`,
  },
  {
    label: 'Facebook',
    href:  '#',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
    </svg>`,
  },
  {
    label: 'Instagram',
    href:  '#',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="20" height="20" rx="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>`,
  },
]);

/* ── Inline SVG icons ───────────────────────────────────────────────────── */

const ICON = Object.freeze({
  phone: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8
               A19.79 19.79 0 01.21 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72
               c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91
               a16 16 0 006.16 6.16l1.27-1.27a2 2 0 012.11-.45
               c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>`,

  mail: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>`,

  arrow: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>`,

  menu: `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
         aria-hidden="true" focusable="false">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>`,

  /**
   * Premium "LK" monogram logo mark.
   * Forest-green rounded square with a gold accent corner and
   * sharp white "LK" initials. Sits flush against the dark nav bar.
   */
  brandMark: `
    <svg width="38" height="38" viewBox="0 0 40 40" fill="none"
         xmlns="http://www.w3.org/2000/svg"
         aria-hidden="true" focusable="false">
      <!-- Green plate -->
      <rect width="40" height="40" rx="10"
            fill="url(#admBrandGradient)"/>

      <!-- Gold accent corner -->
      <path d="M40 0 H30 A10 10 0 0 1 40 10 Z"
            fill="#E5B23A"/>

      <!-- LK initials -->
      <text x="50%" y="56%"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="Inter, system-ui, sans-serif"
            font-weight="800"
            font-size="15"
            letter-spacing="-0.5"
            fill="#ffffff">LK</text>

      <defs>
        <linearGradient id="admBrandGradient" x1="0" y1="0" x2="40" y2="40"
                        gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stop-color="#0d4724"/>
          <stop offset="100%" stop-color="#068927"/>
        </linearGradient>
      </defs>
    </svg>`,
});

/* ══════════════════════════════════════════════════════════════════════════
   PublicLayout
   ══════════════════════════════════════════════════════════════════════════ */

export class PublicLayout {

  /* ── Region helpers ───────────────────────────────────────────────────── */

  /** @returns {'west'|'central'|'east'} */
  static _getRegion() {
    try {
      const r = sessionStorage.getItem(STORAGE_KEY);
      return VALID_REGIONS.includes(r) ? r : DEFAULT_REGION;
    } catch {
      return DEFAULT_REGION;
    }
  }

  /** @returns {string} */
  static _getBrandName() {
    return BRAND_MAP[PublicLayout._getRegion()] ?? 'Lagos Konect';
  }

  /* ── Main wrapper ─────────────────────────────────────────────────────── */

  /**
   * @param {{ content: string, region?: 'west'|'central'|'east' }} opts
   *   `region`, when provided (e.g. by a region-specific landing page),
   *   takes precedence over whatever is currently in sessionStorage so the
   *   nav/footer reflect the page actually being rendered instead of a
   *   stale region left over from a previous visit.
   * @returns {string}
   */
  static wrap({ content, region: regionOverride } = {}) {
    const region    = VALID_REGIONS.includes(regionOverride) ? regionOverride : PublicLayout._getRegion();
    const brandName = BRAND_MAP[region] ?? 'Lagos Konect';
    const year      = new Date().getFullYear();

    return `
      <div class="landing">

        ${PublicLayout._renderNav(brandName)}

        <main role="main">
          ${content}

          ${PublicLayout._renderAdvertiseCTA()}
        </main>

        ${PublicLayout._renderFooter(brandName, region, year)}

      </div>
    `;
  }

  /* ── Nav ───────────────────────────────────────────────────────────────── */

  /** @private */
  static _renderNav(brandName) {
    return `
      <nav class="landing__nav"
           id="landing-nav"
           role="navigation"
           aria-label="${t('landing.mainNav') || 'Main navigation'}">
        <div class="landing__nav-inner">

          <!-- Brand -->
          <a href="/" class="landing__nav-brand" aria-label="${brandName} — home">
            <span class="landing__nav-logo">${ICON.brandMark}</span>
            <span class="landing__nav-name">${brandName}</span>
          </a>

          <!-- Desktop actions -->
          <div class="landing__nav-actions">
            <div class="landing__nav-lang" id="public-lang-slot"></div>
            <a href="/signup"
               class="landing__nav-btn landing__nav-btn--join">
              ${t('landing.join') || 'Join'}
            </a>
            <a href="/login"
               class="landing__nav-btn landing__nav-btn--login">
              ${t('landing.login') || 'Login'}
            </a>
          </div>

          <!-- Mobile hamburger -->
          <button
            class="landing__nav-toggle"
            type="button"
            aria-label="${t('landing.openMenu') || 'Open menu'}"
            aria-expanded="false"
            aria-controls="landing-mobile-menu"
          >${ICON.menu}</button>

        </div>

        <!-- Mobile menu -->
        <div
          class="landing__mobile-menu"
          id="landing-mobile-menu"
          role="navigation"
          aria-label="${t('landing.mobileNav') || 'Mobile navigation'}"
          aria-hidden="true"
        >
          <div class="landing__mobile-menu-inner">
            <div class="landing__mobile-menu-lang" id="public-lang-slot-mobile"></div>
            <a href="/signup"
               class="landing__nav-btn landing__nav-btn--join landing__mobile-menu-btn">
              ${t('landing.join') || 'Join'}
            </a>
            <a href="/login"
               class="landing__nav-btn landing__nav-btn--login landing__mobile-menu-btn">
              ${t('landing.login') || 'Login'}
            </a>
          </div>
        </div>
      </nav>
    `;
  }

  /* ── Advertise CTA ────────────────────────────────────────────────────── */

  /** @private */
  static _renderAdvertiseCTA() {
    return `
      <section class="landing-advertise-cta" aria-labelledby="advertise-heading">
        <div class="landing-advertise-cta__inner">
          <div class="landing-advertise-cta__text">
            <h2 class="landing-advertise-cta__heading" id="advertise-heading">
              ${t('landing.advertiseHeading')}
            </h2>
            <p class="landing-advertise-cta__sub">${t('landing.advertiseSub')}</p>
          </div>
          <a
            href="mailto:support@lagkonnect.com?subject=Advertising%20Enquiry"
            class="landing-advertise-cta__btn"
          >${t('landing.advertiseBtn')}</a>
        </div>
      </section>
    `;
  }

  /* ── Footer ───────────────────────────────────────────────────────────── */

  /** @private */
  static _renderFooter(brandName, region, year) {
    return `
      <footer class="landing__footer" role="contentinfo">
        <div class="landing__footer-inner">

          ${PublicLayout._renderFooterBrand(brandName)}
          ${PublicLayout._renderFooterQuickLinks(region)}
          ${PublicLayout._renderFooterResources()}
          ${PublicLayout._renderFooterSubscribe()}

        </div>

        <!-- Bottom bar -->
        <div class="landing__footer-bottom">
          <p class="landing__footer-copy">
            &copy; ${year} ${t('footer.copyright')}
          </p>
          <div class="landing__footer-legal">
            <a href="https://gn128.com"
               target="_blank"
               rel="noopener noreferrer"
               data-external>
              ${t('footer.builtBy')}
            </a>
          </div>
        </div>
      </footer>
    `;
  }

  /** @private */
  static _renderFooterBrand(brandName) {
    return `
      <div class="landing__footer-brand-col">
        <div class="landing__footer-brand">
          <span class="landing__footer-brand-mark">${ICON.brandMark}</span>
          <span>${brandName}</span>
        </div>

        <address class="landing__footer-address">
          ${t('footer.addressLine1')}<br>
          ${t('footer.addressLine2')}
        </address>

        <p class="landing__footer-contact">
          ${ICON.phone}
          <a href="tel:+2349032140000"
             class="landing__footer-contact-link">+234 903-214-0000</a>
        </p>

        <p class="landing__footer-contact">
          ${ICON.mail}
          <a href="mailto:support@lagkonnect.com"
             class="landing__footer-contact-link">support@lagkonnect.com</a>
        </p>
      </div>
    `;
  }

  /** @private */
  static _renderFooterQuickLinks(region) {
    const links = [
      { href: `/${region}/home`,  label: t('footer.home')     },
      { href: `/${region}/chat`,  label: t('footer.chat')     },
      { href: `/${region}/reels`, label: t('footer.reels')    },
      { href: `/${region}/news`,  label: t('footer.trending') },
    ];

    return `
      <nav class="landing__footer-nav-col"
           aria-label="${t('footer.quickLinks')}">
        <h3 class="landing__footer-col-heading">${t('footer.quickLinks')}</h3>
        <ul class="landing__footer-nav-list">
          ${links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}
        </ul>
      </nav>
    `;
  }

  /** @private */
  static _renderFooterResources() {
    const links = [
      { href: '#',      label: t('footer.events')    },
      { href: '#',      label: t('footer.community') },
      { href: '/terms', label: t('footer.terms')     },
      { href: '#',      label: t('footer.privacy')   },
    ];

    return `
      <nav class="landing__footer-nav-col"
           aria-label="${t('footer.resources')}">
        <h3 class="landing__footer-col-heading">${t('footer.resources')}</h3>
        <ul class="landing__footer-nav-list">
          ${links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}
        </ul>
      </nav>
    `;
  }

  /** @private */
  static _renderFooterSubscribe() {
    const socialIcons = SOCIAL_LINKS.map((s) => `
      <a
        href="${s.href}"
        class="landing__footer-social-link"
        aria-label="${s.label}"
      >${s.icon}</a>
    `).join('');

    return `
      <div class="landing__footer-subscribe-col">
        <h3 class="landing__footer-col-heading">${t('footer.newsletter')}</h3>

        <form
          class="landing__footer-newsletter"
          aria-label="${t('footer.newsletter')}"
        >
          <label for="footer-email" class="sr-only">
            ${t('footer.emailPlaceholder')}
          </label>
          <input
            id="footer-email"
            type="email"
            class="landing__footer-email-input"
            placeholder="${t('footer.emailPlaceholder')}"
            autocomplete="email"
            required
          />
          <button
            type="submit"
            class="landing__footer-email-btn"
            aria-label="${t('footer.subscribe') || 'Subscribe'}"
          >${ICON.arrow}</button>
        </form>

        <div class="landing__footer-social">
          <h4 class="landing__footer-social-label">${t('footer.followUs')}</h4>
          <div class="landing__footer-social-icons"
               role="list"
               aria-label="${t('footer.followUs')}">
            ${socialIcons}
          </div>
        </div>
      </div>
    `;
  }

  /* ── Post-mount helpers ───────────────────────────────────────────────── */

  /**
   * Mounts the language switcher into the already-rendered layout.
   * @param {import('../../../core/component.js?v=20260805c').Component} host
   * @returns {LanguageSwitcher|null}
   */
  static mountLanguageSwitcher(host) {
    const slot = host?.$('#public-lang-slot');
    if (!slot) return null;

    const switcher = host.addChild(
      new LanguageSwitcher({ compact: true, align: 'end' }),
    );
    switcher.mount(slot);
    return switcher;
  }

  /**
   * Wires the mobile hamburger toggle.
   * @param {import('../../../core/component.js?v=20260805c').Component} host
   */
  static bindMobileMenu(host) {
    const toggle = host?.$('.landing__nav-toggle');
    const menu   = host?.$('#landing-mobile-menu');
    if (!toggle || !menu) return;

    const open = () => {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', t('landing.closeMenu') || 'Close menu');
      menu.setAttribute('aria-hidden', 'false');
      menu.classList.add('landing__mobile-menu--open');
    };

    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', t('landing.openMenu') || 'Open menu');
      menu.setAttribute('aria-hidden', 'true');
      menu.classList.remove('landing__mobile-menu--open');
    };

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      isOpen ? close() : open();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /**
   * Adds a stronger shadow to the nav once the page is scrolled.
   * Provides extra depth when a hero image sits directly below.
   *
   * @param {import('../../../core/component.js?v=20260805c').Component} host
   */
  static bindScroll(host) {
    const nav = host?.$('#landing-nav');
    if (!nav) return;

    const onScroll = () => {
      nav.classList.toggle('landing__nav--scrolled', window.scrollY > 8);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /**
   * Binds the footer newsletter form.
   * @param {import('../../../core/component.js?v=20260805c').Component} host
   * @param {(email: string) => void}                        onSubscribe
   */
  static bindNewsletter(host, onSubscribe) {
    const form = host?.$('.landing__footer-newsletter');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('.landing__footer-email-input');
      const email = input?.value?.trim();
      if (!email) return;

      onSubscribe?.(email);

      const btn = form.querySelector('.landing__footer-email-btn');
      btn?.classList.add('landing__footer-email-btn--sent');
      if (input) input.value = '';

      setTimeout(() => {
        btn?.classList.remove('landing__footer-email-btn--sent');
      }, 2200);
    });
  }
}