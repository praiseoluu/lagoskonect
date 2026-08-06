/**
 * Lagos Konnect — Home Feed Page
 * Route: /home
 * Guards: requireAuth + requireCitizen
 * ============================================================
 * Sections:
 *   1. Hero carousel   — top 3 news articles, auto-advances every 5s,
 *                        manual prev/next, click → /news/:slug
 *      Ad sidebar      — up to 2 ad cards beside the carousel
 *   2. Reels row       — horizontal scroll, prev/next arrows, ReelCard components
 *   3. Recent News     — 3 latest published news, NewsCard horizontal layout
 *      Community Chat  — online count, top contributors, Open Community Chat btn
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260806c';
import { NewsCard } from '../../../components/base/Card.js?v=20260806c';
import { ReelCard } from '../../../components/base/Card.js?v=20260806c';
import { Avatar } from '../../../components/base/UI.js?v=20260806c';
import { store, showToast, setPageLoading } from '../../../core/store.js?v=20260806c';
import { router } from '../../../core/router.js?v=20260806c';
import { api } from '../../../api/client.js?v=20260806c';
import { timeAgo } from '../../../utils/date.js?v=20260806c';
import { t, getLanguage } from '../../../core/i18n.js?v=20260806c';
import { translateArticle, needsTranslation } from '../../../utils/translator.js?v=20260806c';

export default class HomePage extends WebLayout {
  static styles = '/pages/web/app/Home.css?v=20260806c';

  constructor(props) {
    super({ title: t('home.title'), ...props });
    this._news = [];
    this._reels = [];
    this._adverts = [];
    this._interstitials = [];
    this._contributors = [];
    this._onlineCount = 0;
    this._carouselIdx = 0;
    this._carouselTimer = null;
    this._interstitialTimer = null;
    this._destroyed = false; // guard for async mount operations
  }

  getContent() {
    return `<div class="home-page" id="home-root">${this._skeletonHtml()}</div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    // Fire all requests in parallel
    const [newsRes, reelsRes, advertsRes, interstitialsRes, onlineRes] = await Promise.all([
      api.news.getForLGA({ perPage: 6 }),
      api.reels.getForLGA({ perPage: 8 }),
      api.adverts.getForLGA('banner'),
      api.adverts.getForLGA('interstitial'),
      api.chat.getOnlineCount(),
    ]);

    const rawNews = newsRes.data || [];
    this._reels = reelsRes.data || [];

    // Translate carousel + recent-news titles/summaries when user switched language
    const lang = getLanguage();
    this._news = needsTranslation(lang)
      ? await Promise.all(rawNews.map((a) => translateArticle(a, lang)))
      : rawNews;
    this._adverts = advertsRes.data || [];
    this._interstitials = interstitialsRes.data || [];
    this._onlineCount = onlineRes.data?.count || 0;

    // Top contributors: approved posts sorted by likes desc, unique users, top 3
    // const allPosts = postsRes.data || [];
    // const byUser = {};
    // for (const p of allPosts) {
    //   if (p.status !== 'approved') continue;
    //   if (!byUser[p.userId]) byUser[p.userId] = { userId: p.userId, userName: p.userName, avatarUrl: p.avatarUrl || null, likes: 0, posts: 0 };
    //   byUser[p.userId].likes += p.likes || 0;
    //   byUser[p.userId].posts += 1;
    // }
    // this._contributors = Object.values(byUser)
    //   .sort((a, b) => b.likes - a.likes)
    //   .slice(0, 3);

    this._render();
    setPageLoading(false);
  }

  // ── Main render ───────────────────────────────────────────────────────

  _render() {
    const root = this.getContentEl()?.querySelector('#home-root');
    if (!root) return;

    const carouselNews = this._news.slice(0, 3);
    const recentNews = this._news.slice(0, 3);
    const user = store.currentUser;
    const lga = store.currentLGA;

    const greeting  = this._getGreeting();
    const firstName = (user?.name || '').split(' ')[0];
    const dateStr   = this._getDateStr();

    root.innerHTML = `

      <!-- ── Greeting ── -->
      <div class="home-greeting">
        <div class="home-greeting__text">
          <h1 class="home-greeting__title">${greeting}, ${this.esc(firstName)}!</h1>
          <p class="home-greeting__sub">${lga?.name ? `${this.esc(lga.name)} · ` : ''}${dateStr}</p>
        </div>
        ${lga?.name ? `<div class="home-greeting__lga-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${this.esc(lga.name)}</div>` : ''}
      </div>

      <!-- ── Row 1: Carousel + Ads ── -->
      <div class="home-top-row${this._adverts.length === 0 ? ' home-top-row--no-ads' : ''}">

        <!-- Carousel -->
        <div class="home-carousel" id="home-carousel" aria-label="${this.esc(t('home.carouselLabel'))}" aria-roledescription="carousel">
          <div class="home-carousel__track" id="carousel-track">
            ${carouselNews.length ? carouselNews.map((item, i) => `
              <div class="home-carousel__slide ${i === 0 ? 'home-carousel__slide--active' : ''}"
                role="group" aria-roledescription="slide"
                aria-label="${this.esc(t('home.slideCounter', { current: i + 1, total: carouselNews.length }))}: ${this.esc(item.title)}"
                data-slide="${i}" data-slug="${this.esc(item.slug || item.id)}">
                ${item.imageUrl
        ? `<img class="home-carousel__img" src="${this.esc(item.imageUrl)}"
                      alt="${this.esc(item.title)}" loading="${i === 0 ? 'eager' : 'lazy'}" />`
        : `<div class="home-carousel__img-placeholder" aria-hidden="true"></div>`
    }
                <div class="home-carousel__overlay">
                  <div class="home-carousel__caption">
                    ${item.breaking ? `<span class="home-carousel__breaking">${this.esc(t('home.breaking'))}</span>` : ''}
                    <h2 class="home-carousel__title">${this.esc(item.title)}</h2>
                    <p class="home-carousel__meta">
                      ${this.esc(item.lgaName || lga?.name || '')}
                      · ${timeAgo(item.publishedAt)}
                    </p>
                  </div>
                </div>
              </div>
            `).join('') : `<div class="home-carousel__empty"><p>${this.esc(t('home.noNewsAvailable'))}</p></div>`}
          </div>

          <!-- Controls -->
          ${carouselNews.length > 1 ? `
            <button class="home-carousel__btn home-carousel__btn--prev" id="carousel-prev"
              type="button" aria-label="${this.esc(t('home.prevSlide'))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button class="home-carousel__btn home-carousel__btn--next" id="carousel-next"
              type="button" aria-label="${this.esc(t('home.nextSlide'))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <div class="home-carousel__dots" role="tablist" aria-label="${this.esc(t('home.slideNav'))}">
              ${carouselNews.map((_, i) => `
                <button class="home-carousel__dot ${i === 0 ? 'home-carousel__dot--active' : ''}"
                  role="tab" aria-selected="${i === 0}" aria-label="${this.esc(t('home.slide', { n: i + 1 }))}"
                  data-dot="${i}" type="button"></button>
              `).join('')}
            </div>
          ` : ''}
          <div class="home-carousel__progress" aria-hidden="true">
            <div class="home-carousel__progress-fill"></div>
          </div>
        </div>

        <!-- Ad sidebar -->
          ${this._adverts.length > 0 ? `
        <div class="home-ads">
          ${this._adverts.slice(0, 2).map((ad) => `
            <div class="home-ad-card">
              ${ad.imageUrl
        ? `<img class="home-ad-card__img" src="${this.esc(ad.imageUrl)}"
                    alt="${this.esc(ad.title)}" loading="lazy" />`
        : `<div class="home-ad-card__img-placeholder" aria-hidden="true"></div>`
    }
              <div class="home-ad-card__body">
                <span class="home-ad-card__label">${this.esc(t('home.advertisement'))}</span>
                <p class="home-ad-card__title">${this.esc(ad.title)}</p>
                ${ad.description ? `<p class="home-ad-card__desc">${this.esc(ad.description)}</p>` : ''}
                ${ad.ctaLabel ? `
                  <a href="${this.esc(ad.ctaUrl || '#')}"
                    class="home-ad-card__cta" target="_blank" rel="noopener noreferrer"
                    data-ad-id="${ad.id}">
                    ${this.esc(ad.ctaLabel)}
                  </a>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
          ` : ''}

      </div>

      <section class="home-quick-actions" aria-labelledby="quick-actions-heading">
        <div class="home-section__header">
          <h2 class="home-section__title" id="quick-actions-heading">Quick actions</h2>
          <span class="home-quick-actions__hint">Stay connected to your community</span>
        </div>
        <div class="home-quick-actions__grid">
          <a class="home-quick-action" href="/${user.region}/news">
            <span class="home-quick-action__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/></svg>
            </span>
            <span><strong>Read local news</strong><small>What's happening near you</small></span>
            <span class="home-quick-action__arrow" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          </a>
          <a class="home-quick-action" href="/referrals">
            <span class="home-quick-action__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
            </span>
            <span><strong>Earn ₦250 per referral</strong><small>Invite friends to Lagos Konect</small></span>
            <span class="home-quick-action__arrow" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          </a>
          <a class="home-quick-action" href="/${user.region}/chat">
            <span class="home-quick-action__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </span>
            <span><strong>Join community chat</strong><small>Talk with your neighbours</small></span>
            <span class="home-quick-action__arrow" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          </a>
        </div>
      </section>

      <!-- ── Row 2: Reels ── -->
      ${this._reels.length ? `
        <section class="home-section" aria-labelledby="reels-heading">
          <div class="home-section__header">
            <h2 class="home-section__title" id="reels-heading">${this.esc(t('home.reels'))}</h2>
            <a href="/${user.region}/reels" class="home-section__link">${this.esc(t('home.seeAll'))}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></a>
          </div>
          <div class="home-reels-wrap">
            <button class="home-reels__arrow home-reels__arrow--prev" id="reels-prev"
              type="button" aria-label="${this.esc(t('home.scrollReelsLeft'))}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div class="home-reels-scroll" id="reels-scroll" role="list"
              aria-label="${this.esc(t('home.reels'))}">
              <div class="home-reels-track" id="reels-track"></div>
            </div>
            <button class="home-reels__arrow home-reels__arrow--next" id="reels-next"
              type="button" aria-label="${this.esc(t('home.scrollReelsRight'))}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </section>
      ` : ''}

      <!-- ── Row 3: Recent News + Community Chat ── -->
      <div class="home-bottom-row">

        <!-- Recent News -->
        <section class="home-section home-section--news" aria-labelledby="news-heading">
          <div class="home-section__header">
            <h2 class="home-section__title" id="news-heading">${this.esc(t('home.recentNews'))}</h2>
            <a href="/${user.region}/news" class="home-section__link">${this.esc(t('home.seeAll'))}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></a>
          </div>
          <div class="home-news-stack" id="news-stack">
            ${recentNews.length === 0
        ? `<div class="home-empty"><p>${this.esc(t('home.noNewsForLga', { lga: lga?.name || t('home.yourLga') }))}</p></div>`
        : ''
    }
          </div>
        </section>

        <!-- Community Chat -->
        <section class="home-section home-section--community" aria-labelledby="community-heading">
          <div class="home-section__header">
            <h2 class="home-section__title" id="community-heading">${this.esc(t('home.communityChat'))}</h2>
          </div>
          <div class="home-community-card">
            <div class="home-community__header">
              <div class="home-community__avatar-stack" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="var(--color-primary)" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div>
                <p class="home-community__title">${this.esc(t('home.activeCommunity'))}</p>
                <p class="home-community__subtitle">
                  <span class="home-community__dot" aria-hidden="true"></span>
                  ${this.esc(t('home.membersOnline', { count: this._onlineCount }))}
                </p>
              </div>
            </div>

            <button class="home-community__cta" id="open-chat-btn" type="button">
              ${this.esc(t('home.openChat'))}
            </button>

            ${this._contributors.length ? `
              <div class="home-community__contributors">
                <p class="home-community__contributors-label">${this.esc(t('home.topContributors'))}</p>
                ${this._contributors.map((c) => `
                  <div class="home-community__contributor">
                    ${Avatar.html({ name: c.userName, imageUrl: c.avatarUrl, size: 'sm' })}
                    <span class="home-community__contributor-name">${this.esc(c.userName)}</span>
                    <span class="home-community__contributor-stat">${this.esc(t('home.likes', { count: c.likes }))}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </section>

      </div>
    `;

    this._mountReelCards();
    this._mountNewsCards(recentNews);
    this._swapBrokenCarouselImages();
    this._bindCarousel(carouselNews.length);
    this._bindReelsScroll();
    this._bindChatBtn();
    this._bindAdClicks();
    this._scheduleInterstitial();
  }

  // ── Carousel ──────────────────────────────────────────────────────────

  /**
   * Falls back to the gradient placeholder when a slide's picture fails.
   *
   * The caption sits on a dark gradient over the image. With a broken image the
   * browser draws its own glyph plus the alt text, so the headline appeared
   * twice — once as alt text and once as the caption. The placeholder keeps the
   * slide looking deliberate.
   */
  _swapBrokenCarouselImages() {
    this.getContentEl()?.querySelectorAll('.home-carousel__img').forEach((img) => {
      const fail = () => {
        img.outerHTML = '<div class="home-carousel__img-placeholder" aria-hidden="true"></div>';
      };
      // May already have failed: loading starts at parse time, this runs later.
      if (img.complete && img.naturalWidth === 0) fail();
      else this.on(img, 'error', fail);
    });
  }

  _bindCarousel(total) {
    if (total < 2) return;
    const root = this.getContentEl();

    // Click on slide → navigate to article
    this.delegate('.home-carousel__slide', 'click', (e, slide) => {
      const slug = slide.dataset.slug;
      if (slug) router.push(`/news/${slug}`);
    });

    // Prev / Next buttons
    const prev = root?.querySelector('#carousel-prev');
    const next = root?.querySelector('#carousel-next');
    if (prev) this.on(prev, 'click', () => this._carouselStep(-1, total));
    if (next) this.on(next, 'click', () => this._carouselStep(1, total));

    // Dot navigation
    this.delegate('.home-carousel__dot', 'click', (e, dot) => {
      this._carouselGo(Number(dot.dataset.dot), total);
    });

    // Pause on hover
    const carousel = root?.querySelector('#home-carousel');
    if (carousel) {
      this.on(carousel, 'mouseenter', () => this._stopAutoplay());
      this.on(carousel, 'mouseleave', () => this._startAutoplay(total));
    }

    this._startAutoplay(total);
  }

  _startAutoplay(total) {
    this._stopAutoplay();
    this._carouselTimer = setInterval(() => this._carouselStep(1, total), 5000);
    this._resetProgressBar();
  }

  _stopAutoplay() {
    if (this._carouselTimer) { clearInterval(this._carouselTimer); this._carouselTimer = null; }
  }

  _carouselStep(dir, total) {
    this._carouselGo((this._carouselIdx + dir + total) % total, total);
  }

  _carouselGo(idx, total) {
    const root = this.getContentEl();
    const slides = root?.querySelectorAll('.home-carousel__slide');
    const dots = root?.querySelectorAll('.home-carousel__dot');
    if (!slides?.length) return;

    slides[this._carouselIdx]?.classList.remove('home-carousel__slide--active');
    dots?.[this._carouselIdx]?.classList.remove('home-carousel__dot--active');
    dots?.[this._carouselIdx]?.setAttribute('aria-selected', 'false');

    this._carouselIdx = idx;

    slides[idx]?.classList.add('home-carousel__slide--active');
    dots?.[idx]?.classList.add('home-carousel__dot--active');
    dots?.[idx]?.setAttribute('aria-selected', 'true');
    this._resetProgressBar();
  }

  // ── Reels ─────────────────────────────────────────────────────────────

  async _mountReelCards() {
    const track = this.getContentEl()?.querySelector('#reels-track');
    if (!track) return;
    for (const reel of this._reels) {
      if (this._destroyed) break; // navigated away — stop mounting orphaned children
      const wrap = document.createElement('div');
      wrap.className = 'home-reel-wrap';
      track.appendChild(wrap);
      const card = this.addChild(new ReelCard({
        ...reel,
        onClick: () => router.push(`/reels/${reel.reelId}`),
      }));
      await card.mount(wrap);
    }
  }

  _bindReelsScroll() {
    const scroll = this.getContentEl()?.querySelector('#reels-scroll');
    const prev = this.getContentEl()?.querySelector('#reels-prev');
    const next = this.getContentEl()?.querySelector('#reels-next');
    const step = 300;
    if (prev && scroll) this.on(prev, 'click', () => scroll.scrollBy({ left: -step, behavior: 'smooth' }));
    if (next && scroll) this.on(next, 'click', () => scroll.scrollBy({ left: step, behavior: 'smooth' }));
  }

  // ── Recent News ───────────────────────────────────────────────────────

  async _mountNewsCards(items) {
    const stack = this.getContentEl()?.querySelector('#news-stack');
    if (!stack || !items.length) return;
    for (const item of items) {
      if (this._destroyed) break; // navigated away — stop mounting orphaned children
      const wrap = document.createElement('div');
      stack.appendChild(wrap);
      const card = this.addChild(new NewsCard({
        ...item,
        layout: 'horizontal',
        onClick: () => router.push(`/news/${item.slug || item.id}`),
      }));
      await card.mount(wrap);
    }
  }

  // ── Community chat ────────────────────────────────────────────────────

  _bindChatBtn() {
    const btn = this.getContentEl()?.querySelector('#open-chat-btn');
    if (btn) {
      const region = store.currentUser?.region || 'central';
      this.on(btn, 'click', () => router.push(`/${region}/chat`));
    }
  }

  _bindAdClicks() {
    this.delegate('.home-ad-card__cta', 'click', (e, link) => {
      const adId = link.dataset.adId;
      if (adId) api.adverts.recordClick(Number(adId));
    });
  }

  // ── Interstitial ad ───────────────────────────────────────────────────

  _scheduleInterstitial() {
    if (!this._interstitials.length) return;
    // Show the first interstitial 3 s after the page finishes rendering.
    this._interstitialTimer = setTimeout(() => {
      if (!this._destroyed) this._showInterstitial(this._interstitials[0]);
    }, 3000);
  }

  _showInterstitial(ad) {
    const backdrop = document.createElement('div');
    backdrop.className = 'home-interstitial-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', ad.title || 'Advertisement');

    backdrop.innerHTML = `
      <div class="home-interstitial">
        <button class="home-interstitial__close" aria-label="Close advertisement" id="interstitial-close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        ${ad.imageUrl
          ? `<img class="home-interstitial__img" src="${this.esc(ad.imageUrl)}" alt="${this.esc(ad.title)}" loading="lazy" />`
          : `<div class="home-interstitial__img-placeholder" aria-hidden="true"></div>`}
        <div class="home-interstitial__body">
          <p class="home-interstitial__label">${this.esc(t('home.advertisement'))}</p>
          <h2 class="home-interstitial__title">${this.esc(ad.title)}</h2>
          ${ad.description ? `<p class="home-interstitial__desc">${this.esc(ad.description)}</p>` : ''}
          ${ad.ctaLabel
            ? `<a href="${this.esc(ad.ctaUrl || '#')}" class="home-interstitial__cta"
                 target="_blank" rel="noopener noreferrer"
                 id="interstitial-cta" data-ad-id="${ad.id}">
                 ${this.esc(ad.ctaLabel)}
               </a>`
            : ''}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const close = () => {
      backdrop.remove();
    };

    backdrop.querySelector('#interstitial-close')?.addEventListener('click', close);

    // Close when clicking the backdrop itself (outside the modal card)
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    // Close on Escape key
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKeyDown); }
    };
    document.addEventListener('keydown', onKeyDown);

    // Track CTA click
    const ctaEl = backdrop.querySelector('#interstitial-cta');
    if (ctaEl) {
      ctaEl.addEventListener('click', () => {
        api.adverts.recordClick(Number(ad.id));
        close();
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  _getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  _getDateStr() {
    return new Date().toLocaleDateString('en-NG', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  /** Restarts the carousel progress bar animation on slide change. */
  _resetProgressBar() {
    const fill = this.getContentEl()?.querySelector('.home-carousel__progress-fill');
    if (!fill) return;
    fill.style.animation = 'none';
    void fill.offsetWidth; // force reflow to restart CSS animation
    fill.style.animation  = '';
  }

  _skeletonHtml() {
    return `
      <div class="home-skeleton" aria-hidden="true">
        <div class="home-skeleton__greeting"></div>
        <div class="home-top-row">
          <div class="home-skeleton__carousel"></div>
          <div class="home-skeleton__ads">
            <div class="home-skeleton__ad"></div>
            <div class="home-skeleton__ad"></div>
          </div>
        </div>
        <div class="home-skeleton__section-title"></div>
        <div class="home-skeleton__reels">
          ${Array.from({ length: 4 }).map(() => `<div class="home-skeleton__reel"></div>`).join('')}
        </div>
        <div class="home-skeleton__section-title"></div>
        ${Array.from({ length: 3 }).map(() => `<div class="home-skeleton__news"></div>`).join('')}
      </div>
    `;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  beforeUnmount() {
    this._destroyed = true;
    this._stopAutoplay();
    if (this._interstitialTimer) {
      clearTimeout(this._interstitialTimer);
      this._interstitialTimer = null;
    }
    // Remove any open interstitial overlay when navigating away
    document.querySelector('.home-interstitial-backdrop')?.remove();
  }
}
