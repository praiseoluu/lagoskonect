/**
 * Lagos Konect — Region Landing Page
 * ============================================================
 * Shared landing page used by all three region routes:
 *   /north   → Lagos West Connect
 *   /central → Lagos Central Connect
 *   /south   → Lagos East Connect
 *
 * The component detects which zone it is from the URL path,
 * stamps sessionStorage, and personalises the heading.
 * Structure and behaviour are identical across all three zones —
 * content can be differentiated later per region.
 */

import { Component } from '../../../core/component.js';
import { PublicLayout } from './_PublicLayout.js';
import { api } from '../../../api/client.js';
import { t } from '../../../core/i18n.js';
import { showToast } from '../../../core/store.js';

/* ── Region config map ──────────────────────────────────────────────────── */
const REGION_CONFIG = {
    north: {
        id:       'west',
        title:    'Lagos West Connect',
        tagline:  'Your community platform for the northern senatorial zone.',
    },
    central: {
        id:       'central',
        title:    'Lagos Central Connect',
        tagline:  'Your community platform for the central senatorial zone.',
    },
    south: {
        id:       'east',
        title:    'Lagos East Connect',
        tagline:  'Your community platform for the southern senatorial zone.',
    },
};

/** Derive region key from the current pathname (/north → 'north', etc.) */
function getRegionFromPath() {
    const slug = window.location.pathname.replace(/^\//, '').split('/')[0];
    return REGION_CONFIG[slug] ? slug : null;
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default class RegionLandingPage extends Component {
    static styles       = '/pages/web/auth/_PublicLayout.css';
    static dependencies = ['/pages/web/auth/Landing.css', '/components/base/Button.css'];

    constructor(props) {
        super(props);
        const regionId   = getRegionFromPath();
        this._region     = regionId ? REGION_CONFIG[regionId] : null;
    }

    render() {
        const region = this._region;

        return PublicLayout.wrap({
            content: `
        <div id="landing-ads-mount"></div>

        <section class="landing__hero" aria-labelledby="rl-hero-heading">
          <div class="landing__hero-inner">
            <div class="landing__hero-content">
              <h1 class="landing__hero-heading" id="rl-hero-heading">
                ${region ? region.title : 'Lagos Konect'}
              </h1>
              ${region ? `<p class="rl-tagline">${region.tagline}</p>` : ''}
            </div>
          </div>
        </section>
      `,
        });
    }

    afterMount() {
        const regionId = getRegionFromPath();

        // If we can't detect a valid region from the URL, send back to selector
        if (!regionId) {
            window.location.href = '/select-region';
            return;
        }

        // Keep sessionStorage in sync with whichever zone URL the user is on
        sessionStorage.setItem('lagosRegion', regionId);

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

    /* ── Ad carousel (identical to Landing.js) ────────────────────────────── */

    async _loadAds() {
        const res   = await api.adverts.getPublic();
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

        const vwRaw = viewport.offsetWidth
            || mount.querySelector('#landing-carousel')?.offsetWidth
            || 0;
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
