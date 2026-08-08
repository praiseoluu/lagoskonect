/**
 * Lagos Konect - Landing Page Base Class
 * ============================================================
 * Abstract base that owns every behaviour shared between the
 * region landing pages (WestLanding, CentralLanding,
 * EastLanding):
 *
 *   • Public ad-carousel rendering & pagination
 *   • Auto-advance timer with hover-pause
 *   • Resize handling with rAF debounce
 *   • Smooth-scroll for in-page anchor links
 *   • Language-switcher, mobile-menu and scroll-shadow bootstrap
 *
 * Subclasses provide only their render() output and (optionally)
 * an onLandingReady() hook for region-specific behaviour.
 *
 * Subclass contract:
 *   class WestLandingPage extends LandingBase {
 *     get region() { return 'west'; }
 *
 *     renderContent() {
 *       return `<section class="landing__hero">…</section>`;
 *     }
 *   }
 *
 * @module  LandingBase
 * @version 2.0.0
 */

import { Component }   from '../../../core/component.js?v=20260807a';
import { PublicLayout } from './_PublicLayout.js?v=20260807a';
import { api }         from '../../../api/client.js?v=20260807a';
import { showToast }   from '../../../core/store.js?v=20260807a';

/* ── Marquee constants ──────────────────────────────────────────────────── */

const CAROUSEL_GAP    = 12;
const PLACEHOLDER_COUNT = 4;

/** Scroll speed in pixels per second — lower is slower. */
const MARQUEE_SPEED = 45;

/**
 * Minimum cards per repeated set. The set is repeated until it reaches this
 * many cards so the track always overflows the viewport at every breakpoint,
 * which is what keeps the loop seamless with only a handful of ads.
 */
const MIN_SET_SIZE = 8;

/** Slides per view at each breakpoint. */
const SPV_BREAKPOINTS = Object.freeze([
    { max: 640,  spv: 1 },
    { max: 1024, spv: 2 },
    { max: Infinity, spv: 4 },
]);

/**
 * Hover-zoom factor per breakpoint. A card that is already full-width has
 * nothing to gain from scaling, so the smallest breakpoint opts out.
 */
const ZOOM_BREAKPOINTS = Object.freeze([
    { max: 640,  zoom: 1 },
    { max: 1024, zoom: 1.2 },
    { max: Infinity, zoom: 1.3 },
]);

/** Breathing room kept between a zoomed card and the strip's clip edge. */
const ZOOM_EDGE_MARGIN = 8;

/* ══════════════════════════════════════════════════════════════════════════
   LandingBase  (abstract)
   ══════════════════════════════════════════════════════════════════════════ */

export class LandingBase extends Component {
    static styles       = '/pages/web/auth/_PublicLayout.css?v=20260807a';
    // ?v= must match the version used to import this module — Landing.css and
    // this file are a matched pair and assets carry a one-year max-age.
    static dependencies = ['/pages/web/auth/Landing.css?v=20260721b'];

    constructor(props) {
        super(props);

        /* Marquee state */
        this._lcMount         = null;
        this._lcTotal         = 0;
        this._lcSetSize       = 0;
        this._lcZoomed        = null;
        this._lcResizeHandler = null;
    }

    /* ── Subclass contract ────────────────────────────────────────────────── */

    /**
     * @returns {'west'|'central'|'east'|null}
     *   The region this landing page represents.
     *   Returns null on the neutral root landing.
     */
    get region() {
        return null;
    }

    /**
     * Subclasses MUST override this to return their hero / content markup.
     * @returns {string}
     */
    renderContent() {
        throw new Error(
            'LandingBase subclass must implement renderContent() — ' +
            'return the hero section HTML string.'
        );
    }

    /**
     * Optional hook fired after mount/load. Override to add page-specific
     * behaviour without duplicating the bootstrap dance.
     */
    onLandingReady() {
        /* no-op — subclasses may override */
    }

    /* ── Render ───────────────────────────────────────────────────────────── */

    render() {
        return PublicLayout.wrap({
            region: this.region,
            content: `
        <div id="landing-ads-mount"></div>
        ${this.renderContent()}
      `,
        });
    }

    /* ── Lifecycle ────────────────────────────────────────────────────────── */

    afterMount() {
        // Persist the region (if any) so the rest of the app personalises content
        if (this.region) {
            sessionStorage.setItem('lagosRegion', this.region);
        }

        // Public layout bootstrap
        PublicLayout.mountLanguageSwitcher(this);
        PublicLayout.bindMobileMenu(this);
        PublicLayout.bindScroll(this);
        PublicLayout.bindNewsletter(this, async (email) => {
            const res = await api.newsletter.subscribe(email);
            if (res.error) {
                showToast('error', res.error.message || 'Could not subscribe. Please try again.');
            } else {
                showToast('success', 'You\'re subscribed! Check your inbox for a confirmation email.');
            }
        });

        // Smooth-scroll for in-page anchors
        this.delegate('a[href^="#"]', 'click', (e, link) => {
            const id = link.getAttribute('href');
            if (id === '#') return;
            const target = this.$(id);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        });

        this._loadAds();
        this.onLandingReady();
    }

    beforeUnmount() {
        if (this._lcResizeHandler) {
            window.removeEventListener('resize', this._lcResizeHandler);
            this._lcResizeHandler = null;
        }
    }

    /* ── Ads loading ──────────────────────────────────────────────────────── */

    async _loadAds() {
        const res   = await api.adverts.getPublic();
        const mount = document.getElementById('landing-ads-mount');
        if (!mount) return;

        const ads = (!res.error && res.data?.length) ? res.data : [];

        if (!ads.length) {
            mount.innerHTML = `
        <div class="landing-carousel__static">
          ${Array.from({ length: PLACEHOLDER_COUNT }, () =>
                `<div class="landing-billboard landing-billboard--placeholder" aria-hidden="true"></div>`
            ).join('')}
        </div>
      `;
            return;
        }

        mount.innerHTML = this._buildCarouselHtml(ads);

        // Defer until the browser has painted and laid out the injected DOM
        requestAnimationFrame(() => requestAnimationFrame(() => {
            this._initCarousel(mount, ads);
        }));
    }

    /* ── Carousel — markup ────────────────────────────────────────────────── */

    _buildCarouselHtml(ads) {
        // Repeat the ads until the set is wide enough to overflow the viewport,
        // then lay two identical sets end to end. The CSS animation travels
        // exactly one set-width, so the second set is in the first set's
        // starting position when the keyframe wraps — no visible seam.
        const repeat = Math.max(1, Math.ceil(MIN_SET_SIZE / ads.length));
        const set    = Array.from({ length: repeat }, () => ads).flat();

        this._lcSetSize = set.length;

        const setHtml   = set.map((ad) => this._buildBillboardCard(ad)).join('');
        const cloneHtml = set.map((ad) => this._buildBillboardCard(ad, true)).join('');

        return `
      <div class="landing-carousel" id="landing-carousel">
        <div class="landing-carousel__wrap">
          <div class="landing-carousel__viewport" id="lc-viewport">
            <div class="landing-carousel__track" id="lc-track">${setHtml}${cloneHtml}</div>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Renders one billboard. Deliberately NOT an anchor — the billboards are
     * display-only, so clicking one must never navigate the user away.
     *
     * @param {object}  ad
     * @param {boolean} isClone  Marks the duplicated set used for the seamless
     *                           loop; clones are hidden from assistive tech so
     *                           each ad is announced only once.
     */
    _buildBillboardCard(ad, isClone = false) {
        const hasOverlay = !ad.imageUrl || Boolean(ad.advertiser || ad.ctaLabel);
        const styleAttr  = ad.imageUrl
            ? ` style="--billboard-bg: url('${this.esc(ad.imageUrl)}')"`
            : '';
        const cls = `landing-billboard${ad.imageUrl ? '' : ' landing-billboard--no-img'}`;

        let inner = '';
        if (hasOverlay) {
            inner += `<div class="landing-billboard__overlay"></div>`;
            inner += `<div class="landing-billboard__content">`;
            if (ad.advertiser) {
                inner += `<span class="landing-billboard__advertiser">${this.esc(ad.advertiser)}</span>`;
            }
            inner += `<p class="landing-billboard__title">${this.esc(ad.title)}</p>`;
            if (ad.ctaLabel) {
                inner += `<span class="landing-billboard__cta">${this.esc(ad.ctaLabel)}</span>`;
            }
            inner += `</div>`;
        }

        const a11y = isClone
            ? ' aria-hidden="true"'
            : ` role="group" aria-label="${this.esc(ad.title)}"`;

        return `
      <div class="${cls}"
           data-ad-id="${ad.id}"${a11y}${styleAttr}>${inner}</div>
    `;
    }

    /* ── Marquee — behaviour ──────────────────────────────────────────────── */

    _initCarousel(mount, ads) {
        this._lcMount = mount;
        this._lcTotal = ads.length;

        this._lcSetLayout();

        // Billboards no longer navigate, but a click is still a signal worth
        // recording for the advertiser's analytics.
        this.on(mount, 'click', (e) => {
            const adEl = e.target.closest('[data-ad-id]');
            if (adEl) api.adverts.recordClick(parseInt(adEl.dataset.adId, 10));
        });

        // Hover zoom. mouseover/mouseout rather than mouseenter/mouseleave so
        // a single delegated pair covers every card, clones included.
        this.on(mount, 'mouseover', (e) => {
            const card = e.target.closest('.landing-billboard');
            if (card && card !== this._lcZoomed) this._lcApplyZoom(card);
        });

        this.on(mount, 'mouseout', (e) => {
            const card = e.target.closest('.landing-billboard');
            // Ignore moves between descendants of the same card
            if (card && !card.contains(e.relatedTarget)) this._lcClearZoom(card);
        });

        // Debounced resize — card widths track the breakpoint, and the
        // animation duration is recomputed so the speed stays constant.
        let resizeRaf = null;
        this._lcResizeHandler = () => {
            if (resizeRaf) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(() => {
                // A stale transform would be measured against the old layout
                this._lcClearZoom(this._lcZoomed);
                this._lcSetLayout();
            });
        };
        window.addEventListener('resize', this._lcResizeHandler);
    }

    /** Returns slides-per-view based on the current viewport width. */
    _lcGetSpv() {
        const width = window.innerWidth;
        return SPV_BREAKPOINTS.find((bp) => width < bp.max).spv;
    }

    /** Returns the hover-zoom factor, or 1 when zooming should be skipped. */
    _lcGetZoom() {
        // Touch devices have no true hover — :hover-style state would stick
        // after a tap, leaving a card enlarged with no way to dismiss it.
        if (window.matchMedia('(hover: none)').matches) return 1;
        const width = window.innerWidth;
        return ZOOM_BREAKPOINTS.find((bp) => width < bp.max).zoom;
    }

    /**
     * Zooms one billboard, nudging it inward so it never grows past the
     * strip's clip boundary.
     *
     * Scaling alone is not enough: transform-origin is the card's own centre,
     * so a card sitting at the edge of the viewport expands straight into the
     * clip and is served back sliced. Measuring where the scaled box *would*
     * land lets the overflow be cancelled out with a translation.
     */
    _lcApplyZoom(card) {
        const zoom = this._lcGetZoom();
        if (zoom <= 1) return;

        const viewport = this._lcMount?.querySelector('#lc-viewport');
        if (!viewport) return;

        this._lcClearZoom(this._lcZoomed);

        const vp = viewport.getBoundingClientRect();
        const r  = card.getBoundingClientRect();   // still unscaled
        if (!r.width) return;

        const grownW  = r.width * zoom;
        const centreX = r.left + r.width / 2;      // transform-origin
        const left    = centreX - grownW / 2;
        const right   = centreX + grownW / 2;

        const limitL = vp.left  + ZOOM_EDGE_MARGIN;
        const limitR = vp.right - ZOOM_EDGE_MARGIN;

        let dx = 0;
        if (grownW >= limitR - limitL) {
            // Too wide to fit at all — centre it and accept even clipping
            dx = (vp.left + vp.width / 2) - centreX;
        } else if (left < limitL) {
            dx = limitL - left;                    // push right, off the left edge
        } else if (right > limitR) {
            dx = limitR - right;                   // pull left, off the right edge
        }

        card.style.transform = `translateX(${dx.toFixed(2)}px) scale(${zoom})`;
        card.classList.add('landing-billboard--zoomed');
        this._lcZoomed = card;
    }

    _lcClearZoom(card) {
        if (!card) return;
        card.style.transform = '';
        card.classList.remove('landing-billboard--zoomed');
        if (this._lcZoomed === card) this._lcZoomed = null;
    }

    /**
     * Sizes the cards for the current breakpoint and derives the animation
     * duration from the resulting track width, so the marquee travels at a
     * constant MARQUEE_SPEED regardless of how many ads are in rotation.
     */
    _lcSetLayout() {
        const mount    = this._lcMount;
        const viewport = mount?.querySelector('#lc-viewport');
        const track    = mount?.querySelector('#lc-track');
        if (!viewport || !track) return;

        // Fall back to carousel width if viewport hasn't laid out yet
        const vwRaw = viewport.offsetWidth
            || mount.querySelector('#landing-carousel')?.offsetWidth
            || 0;
        if (vwRaw === 0) return;

        const spv   = this._lcGetSpv();
        const cardW = Math.floor((vwRaw - CAROUSEL_GAP * (spv - 1)) / spv);

        this._lcCardW = cardW;
        this._lcSpv   = spv;

        track.querySelectorAll('.landing-billboard').forEach((c) => {
            c.style.width      = `${cardW}px`;
            c.style.flexShrink = '0';
        });

        // One keyframe cycle scrolls exactly one set — the distance the clone
        // needs to travel to land where the original started.
        const setWidth = this._lcSetSize * (cardW + CAROUSEL_GAP);
        track.style.setProperty('--lc-duration', `${(setWidth / MARQUEE_SPEED).toFixed(2)}s`);
    }
}