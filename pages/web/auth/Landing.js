/**
 * Lagos Konnect — Landing Page
 * ============================================================
 * Public-facing. Shown at / for unauthenticated visitors.
 * redirectIfAuthenticated guard sends logged-in users to /home.
 *
 * Nav and footer are provided by PublicLayout.
 * This file owns the ad billboard and hero section.
 */

import { Component } from '../../../core/component.js';
import { PublicLayout } from './_PublicLayout.js';
import { api } from '../../../api/client.js';
import { t } from '../../../core/i18n.js';
import { showToast } from '../../../core/store.js';

export default class LandingPage extends Component {
  static styles = '/pages/web/auth/_PublicLayout.css';
  static dependencies = ['/pages/web/auth/Landing.css', '/components/base/Button.css'];

  render() {
    return PublicLayout.wrap({
      content: `
        <div id="landing-ads-mount"></div>
        <section class="landing__hero" aria-labelledby="hero-heading">
          <div class="landing__hero-inner">
            <div class="landing__hero-content">
              <h1 class="landing__hero-heading" id="hero-heading">
                ${t('landing.heroLine1')}<br>${t('landing.heroLine2')}
              </h1>
            </div>
          </div>
        </section>
      `,
    });
  }

  afterMount() {
    // Check if user has selected a region
    const selectedRegion = sessionStorage.getItem('lagosRegion');
    if (!selectedRegion) {
      // Redirect to region selection page
      window.location.href = '/select-region';
      return;
    }

    PublicLayout.mountLanguageSwitcher(this);
    PublicLayout.bindMobileMenu(this);
    PublicLayout.bindScroll(this);
    PublicLayout.bindNewsletter(this, async (email) => {
      const res = await api.newsletter.subscribe(email);
      if (res.error) {
        showToast('error', res.error.message || 'Could not subscribe. Please try again.');
      } else {
        showToast('success', "You're subscribed! Check your inbox for a confirmation email.");
      }
    });

    this.delegate('a[href^="#"]', 'click', (e, link) => {
      e.preventDefault();
      const target = this.$(link.getAttribute('href'));
      target?.scrollIntoView({ behavior: 'smooth' });
    });

    this._loadAds();
  }

  async _loadAds() {
    const res = await api.adverts.getPublic();
    const mount = document.getElementById('landing-ads-mount');
    if (!mount) return;

    const ads = (!res.error && res.data?.length) ? res.data : [];

    if (!ads.length) {
      const ph = Array.from({ length: 4 }, () =>
          '<div class="landing-billboard landing-billboard--placeholder" aria-hidden="true"></div>'
      ).join('');
      mount.innerHTML = '<div class="landing-carousel__static">' + ph + '</div>';
      return;
    }

    mount.innerHTML = this._buildCarouselHtml(ads);

    // Defer until the browser has painted and laid out the injected DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._initCarousel(mount, ads);
      });
    });
  }

  _buildCarouselHtml(ads) {
    const PREV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    const NEXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    const cards = ads.map(ad => this._buildBillboardCard(ad)).join('');
    return (
        '<div class="landing-carousel" id="landing-carousel">' +
        '<div class="landing-carousel__wrap">' +
        '<div class="landing-carousel__viewport" id="lc-viewport">' +
        '<div class="landing-carousel__track" id="lc-track">' + cards + '</div>' +
        '</div>' +
        '<button class="landing-carousel__btn landing-carousel__btn--prev" id="lc-prev" aria-label="Previous ads">' + PREV + '</button>' +
        '<button class="landing-carousel__btn landing-carousel__btn--next" id="lc-next" aria-label="Next ads">' + NEXT + '</button>' +
        '</div>' +
        '<div class="landing-carousel__dots" id="lc-dots"></div>' +
        '</div>'
    );
  }

  _buildBillboardCard(ad) {
    const hasOverlay = !ad.imageUrl || !!(ad.advertiser || ad.ctaLabel);
    const styleAttr  = ad.imageUrl ? ' style="--billboard-bg: url(\'' + this.esc(ad.imageUrl) + '\')"' : '';
    const cls        = 'landing-billboard' + (ad.imageUrl ? '' : ' landing-billboard--no-img');
    let inner = '';
    if (hasOverlay) {
      inner += '<div class="landing-billboard__overlay"></div>';
      inner += '<div class="landing-billboard__content">';
      if (ad.advertiser) inner += '<span class="landing-billboard__advertiser">' + this.esc(ad.advertiser) + '</span>';
      inner += '<p class="landing-billboard__title">' + this.esc(ad.title) + '</p>';
      if (ad.ctaLabel && ad.ctaUrl) inner += '<span class="landing-billboard__cta">' + this.esc(ad.ctaLabel) + '</span>';
      inner += '</div>';
    }
    return (
        '<a class="' + cls + '" href="' + this.esc(ad.ctaUrl || '#') + '"' +
        ' target="_blank" rel="noopener noreferrer"' +
        ' data-ad-id="' + ad.id + '" aria-label="' + this.esc(ad.title) + '"' +
        styleAttr + '>' +
        inner +
        '</a>'
    );
  }

  _initCarousel(mount, ads) {
    this._lcMount = mount;
    this._lcTotal = ads.length;
    this._lcPage  = 0;
    this._lcTimer = null;

    this._lcSetLayout();
    this._lcRender();

    const prev     = mount.querySelector('#lc-prev');
    const next     = mount.querySelector('#lc-next');
    const carousel = mount.querySelector('#landing-carousel');

    if (prev) this.on(prev, 'click', () => { this._lcNav(-1); this._lcResetTimer(); });
    if (next) this.on(next, 'click', () => { this._lcNav(1);  this._lcResetTimer(); });

    if (carousel) {
      this.on(carousel, 'mouseenter', () => this._lcStopTimer());
      this.on(carousel, 'mouseleave', () => this._lcStartTimer());
    }

    this.on(mount, 'click', (e) => {
      const dot = e.target.closest('.lc-dot');
      if (dot) {
        this._lcPage = parseInt(dot.dataset.lcPage, 10);
        this._lcRender();
        this._lcResetTimer();
      }
      const adEl = e.target.closest('[data-ad-id]');
      if (adEl) api.adverts.recordClick(parseInt(adEl.dataset.adId, 10));
    });

    // Debounced resize handler so offsetWidth is stable when we read it
    let resizeRaf = null;
    this._lcResizeHandler = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        this._lcSetLayout();
        this._lcPage = Math.min(this._lcPage, this._lcPageCount - 1);
        this._lcRender();
      });
    };
    window.addEventListener('resize', this._lcResizeHandler);

    this._lcStartTimer();
  }

  _lcGetSpv() {
    return window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 4;
  }

  _lcSetLayout() {
    const mount    = this._lcMount;
    const viewport = mount?.querySelector('#lc-viewport');
    const track    = mount?.querySelector('#lc-track');
    if (!viewport || !track) return;

    // Fall back to the carousel container width if viewport hasn't laid out yet
    const vwRaw = viewport.offsetWidth
        || mount.querySelector('#landing-carousel')?.offsetWidth
        || 0;

    // Nothing we can do yet — will be called again on resize
    if (vwRaw === 0) return;

    const spv   = this._lcGetSpv();
    const gap   = 12;
    const cardW = Math.floor((vwRaw - gap * (spv - 1)) / spv);

    this._lcCardW     = cardW;
    this._lcGap       = gap;
    this._lcSpv       = spv;
    this._lcPageCount = Math.ceil(this._lcTotal / spv);

    track.querySelectorAll('.landing-billboard').forEach(c => {
      c.style.width      = cardW + 'px';
      c.style.flexShrink = '0';
    });

    // Stamp the track's total width so the wrap inherits a real height
    track.style.width = ((cardW + gap) * this._lcTotal - gap) + 'px';

    const dotsEl = mount.querySelector('#lc-dots');
    if (dotsEl) {
      dotsEl.innerHTML = this._lcPageCount > 1
          ? Array.from({ length: this._lcPageCount }, (_, i) =>
              '<button class="lc-dot' + (i === this._lcPage ? ' lc-dot--active' : '') +
              '" data-lc-page="' + i + '" aria-label="Page ' + (i + 1) + '"></button>'
          ).join('')
          : '';
    }

    const prev = mount.querySelector('#lc-prev');
    const next = mount.querySelector('#lc-next');
    if (prev) prev.style.display = this._lcPageCount > 1 ? '' : 'none';
    if (next) next.style.display = this._lcPageCount > 1 ? '' : 'none';
  }

  _lcRender() {
    const track = this._lcMount?.querySelector('#lc-track');
    if (!track) return;
    this._lcPage = Math.max(0, Math.min(this._lcPage, this._lcPageCount - 1));
    const offset = this._lcPage * this._lcSpv * (this._lcCardW + this._lcGap);
    track.style.transform = 'translateX(-' + offset + 'px)';
    this._lcMount?.querySelectorAll('.lc-dot').forEach((d, i) =>
        d.classList.toggle('lc-dot--active', i === this._lcPage)
    );
  }

  _lcNav(dir) {
    this._lcPage = (this._lcPage + dir + this._lcPageCount) % this._lcPageCount;
    this._lcRender();
  }

  _lcStartTimer() {
    if (this._lcPageCount <= 1) return;
    this._lcTimer = setInterval(() => this._lcNav(1), 5000);
  }

  _lcStopTimer() {
    if (this._lcTimer) { clearInterval(this._lcTimer); this._lcTimer = null; }
  }

  _lcResetTimer() { this._lcStopTimer(); this._lcStartTimer(); }

  beforeUnmount() {
    this._lcStopTimer();
    if (this._lcResizeHandler) {
      window.removeEventListener('resize', this._lcResizeHandler);
      this._lcResizeHandler = null;
    }
  }
}