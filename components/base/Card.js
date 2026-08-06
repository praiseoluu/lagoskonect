/**
 * Lagos Konect — Card Components
 * ============================================================
 * A family of content-container primitives covering the four
 * main display contexts used across the LagKonnect platform.
 *
 * Exports:
 *   Card      — General-purpose surface container.
 *               Supports optional header, body and footer slots.
 *
 *   StatCard  — Dashboard KPI tile.
 *               Displays a metric value with an optional trend
 *               indicator and a colour-coded icon badge.
 *
 *   NewsCard  — News article preview.
 *               Supports vertical (grid) and horizontal (list)
 *               layout modes with lazy-loaded imagery.
 *
 *   ReelCard  — Short-video thumbnail tile.
 *               9:16 aspect-ratio media with a hover play overlay
 *               and an inline duration badge.
 *
 * All components are self-contained: they register their own
 * click and keyboard handlers and expose an onClick prop.
 *
 * @module  Card
 * @version 2.0.0
 */

import { Component } from '../../core/component.js?v=20260806b';
import { timeAgo }   from '../../utils/date.js?v=20260806b';

/* ── Shared SVG icon constants ──────────────────────────────────────────── */

const ICON = Object.freeze({
  trendUp: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>`,

  trendDown: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
      <polyline points="17 18 23 18 23 12"/>
    </svg>`,

  play: `
    <svg width="28" height="28" viewBox="0 0 24 24"
         fill="white" stroke="white" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>`,

  eye: `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,

  clock: `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`,

  imagePlaceholder: `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round"
         opacity="0.3" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <path d="m21 15-5-5L5 21"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
    </svg>`,
});

/* ── Shared keyboard-activation handler factory ─────────────────────────── */

/**
 * Returns a keydown handler that fires `callback` on Enter or Space,
 * matching the native button activation model for role="button" elements.
 *
 * @param {Function} callback
 * @returns {Function}
 */
function onActivationKey(callback) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback(e);
    }
  };
}

/* ── Image failure ──────────────────────────────────────────────────────── */

/**
 * Replaces an <img> with the card's own placeholder markup if it fails to load.
 *
 * Without this the browser draws its broken-image glyph and the alt text, which
 * looks like a defect rather than a missing picture — and on a card whose alt
 * is the headline, it renders the title twice.
 *
 * Bound as a listener rather than an inline onerror attribute: the site's CSP
 * sets script-src without 'unsafe-inline', so inline handlers never run.
 *
 * @param {object} cmp           the component instance (for this.$ and this.on)
 * @param {string} imgSelector   selector for the image inside the card
 * @param {string} placeholder   HTML to put in its place
 */
function swapInPlaceholderOnError(cmp, imgSelector, placeholder) {
  const img = cmp.$(imgSelector);
  if (!img) return;

  const fail = () => img.outerHTML = placeholder;

  // A broken image may already have failed before this runs — the load starts
  // as soon as the markup is parsed, and afterMount comes later. `complete`
  // with a zero natural width is how that state reads back.
  if (img.complete && img.naturalWidth === 0) { fail(); return; }

  cmp.on(img, 'error', fail);
}

/* ══════════════════════════════════════════════════════════════════════════
   Card — base surface container
   ══════════════════════════════════════════════════════════════════════════ */

export class Card extends Component {
  static styles = '/components/base/Card.css?v=20260806b';

  constructor(props = {}) {
    super({
      title:     '',
      body:      '',        // Raw HTML string inserted into the body slot
      footer:    '',        // Raw HTML string inserted into the footer slot
      padding:   'md',      // sm | md | lg | none
      shadow:    'sm',      // none | sm | md
      border:    true,
      clickable: false,
      onClick:   null,
      ...props,
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { title, body, footer, padding, shadow, border, clickable } = this.props;

    const classes = [
      'adm-card',
      `adm-card--pad-${padding}`,
      shadow !== 'none' ? `adm-card--shadow-${shadow}` : '',
      border    ? 'adm-card--border'    : '',
      clickable ? 'adm-card--clickable' : '',
    ].filter(Boolean).join(' ');

    const interactiveAttrs = clickable
      ? `role="button" tabindex="0"`
      : '';

    return `
      <div class="${classes}" ${interactiveAttrs}>
        ${title  ? `<div class="adm-card__header">
                      <h3 class="adm-card__title">${this.esc(title)}</h3>
                    </div>` : ''}
        ${body   ? `<div class="adm-card__body">${body}</div>` : ''}
        ${footer ? `<div class="adm-card__footer">${footer}</div>` : ''}
      </div>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    const { clickable, onClick } = this.props;
    if (!clickable || typeof onClick !== 'function') return;

    this.on(this.el, 'click',   onClick);
    this.on(this.el, 'keydown', onActivationKey(onClick));
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   StatCard — dashboard KPI tile
   ══════════════════════════════════════════════════════════════════════════ */

export class StatCard extends Component {
  static styles = '/components/base/Card.css?v=20260806b';

  constructor(props = {}) {
    super({
      label:     '',        // Metric label, e.g. "Total Users"
      value:     '',        // Formatted value, e.g. "84,203"
      trend:     null,      // { direction: 'up'|'down', value: '12%', label?: 'vs last week' }
      icon:      null,      // SVG string
      iconColor: 'primary', // primary | success | warning | error | info
      ...props,
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { label, value, trend, icon, iconColor } = this.props;

    const trendHtml = trend ? `
      <div class="adm-stat-card__trend adm-stat-card__trend--${trend.direction}">
        ${trend.direction === 'up' ? ICON.trendUp : ICON.trendDown}
        <span>${this.esc(String(trend.value))}</span>
        ${trend.label
          ? `<span class="adm-stat-card__trend-label">${this.esc(trend.label)}</span>`
          : ''}
      </div>` : '';

    const iconHtml = icon ? `
      <div class="adm-stat-card__icon adm-stat-card__icon--${iconColor}"
           aria-hidden="true">
        ${icon}
      </div>` : '';

    return `
      <div class="adm-stat-card">
        <div class="adm-stat-card__content">
          <p class="adm-stat-card__label">${this.esc(label)}</p>
          <p class="adm-stat-card__value">${this.esc(String(value))}</p>
          ${trendHtml}
        </div>
        ${iconHtml}
      </div>
    `;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   NewsCard — news article preview tile
   ══════════════════════════════════════════════════════════════════════════ */

export class NewsCard extends Component {
  static styles = '/components/base/Card.css?v=20260806b';

  constructor(props = {}) {
    super({
      id:          null,
      title:       '',
      summary:     '',
      category:    '',
      imageUrl:    null,
      publishedAt: null,
      views:       0,
      lgaName:     '',
      layout:      'vertical', // vertical | horizontal
      onClick:     null,
      ...props,
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const {
      id, title, summary, category,
      imageUrl, publishedAt, views, lgaName, layout,
    } = this.props;

    const imageHtml = imageUrl
      ? `<img
           class="adm-news-card__img"
           src="${this.esc(imageUrl)}"
           alt="${this.esc(title)}"
           loading="lazy"
         />`
      : `<div class="adm-news-card__img-placeholder" aria-hidden="true">
           ${ICON.imagePlaceholder}
         </div>`;

    const metaItems = [
      publishedAt != null && `
        <span class="adm-news-card__meta-item">
          ${ICON.clock}${this.esc(timeAgo(publishedAt))}
        </span>`,
      views != null && `
        <span class="adm-news-card__meta-item">
          ${ICON.eye}${Number(views).toLocaleString()}
        </span>`,
      lgaName && `
        <span class="adm-news-card__lga">${this.esc(lgaName)}</span>`,
    ].filter(Boolean).join('');

    return `
      <article
        class="adm-news-card adm-news-card--${layout}"
        role="button"
        tabindex="0"
        aria-label="${this.esc(title)}"
        data-id="${id ?? ''}"
      >
        <div class="adm-news-card__media">${imageHtml}</div>

        <div class="adm-news-card__content">
          ${category
            ? `<span class="adm-news-card__category">${this.esc(category)}</span>`
            : ''}
          <h3 class="adm-news-card__title">${this.esc(title)}</h3>
          ${summary
            ? `<p class="adm-news-card__summary">${this.esc(summary)}</p>`
            : ''}
          <div class="adm-news-card__meta">${metaItems}</div>
        </div>
      </article>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    const handler = () => this.props.onClick?.(this.props);
    this.on(this.el, 'click',   handler);
    this.on(this.el, 'keydown', onActivationKey(handler));

    swapInPlaceholderOnError(
      this,
      '.adm-news-card__img',
      `<div class="adm-news-card__img-placeholder" aria-hidden="true">${ICON.imagePlaceholder}</div>`
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   ReelCard — short-video thumbnail tile
   ══════════════════════════════════════════════════════════════════════════ */

export class ReelCard extends Component {
  static styles = '/components/base/Card.css?v=20260806b';

  constructor(props = {}) {
    super({
      id:           null,
      title:        '',
      thumbnailUrl: null,
      duration:     0,    // seconds
      views:        0,
      publishedAt:  null,
      lgaName:      '',
      onClick:      null,
      ...props,
    });
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  /**
   * Formats a duration in seconds to m:ss display string.
   * @param {number} seconds
   * @returns {string}
   */
  static _formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { id, title, thumbnailUrl, duration, views, publishedAt } = this.props;

    const thumbHtml = thumbnailUrl
      ? `<img
           class="adm-reel-card__thumb"
           src="${this.esc(thumbnailUrl)}"
           alt="${this.esc(title)}"
           loading="lazy"
         />`
      : `<div class="adm-reel-card__thumb-placeholder" aria-hidden="true"></div>`;

    const metaItems = [
      views != null && `
        <span class="adm-reel-card__views">
          ${ICON.eye}${Number(views).toLocaleString()}
        </span>`,
      publishedAt != null && `
        <span>${this.esc(timeAgo(publishedAt))}</span>`,
    ].filter(Boolean).join('');

    return `
      <article
        class="adm-reel-card"
        role="button"
        tabindex="0"
        aria-label="Play: ${this.esc(title)}"
        data-id="${id ?? ''}"
      >
        <div class="adm-reel-card__media">
          ${thumbHtml}
          <div class="adm-reel-card__overlay" aria-hidden="true">
            <div class="adm-reel-card__play">${ICON.play}</div>
          </div>
          <span class="adm-reel-card__duration" aria-label="Duration: ${ReelCard._formatDuration(duration)}">
            ${this.esc(ReelCard._formatDuration(duration))}
          </span>
        </div>

        <div class="adm-reel-card__info">
          <p class="adm-reel-card__title">${this.esc(title)}</p>
          <div class="adm-reel-card__meta">${metaItems}</div>
        </div>
      </article>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    const handler = () => this.props.onClick?.(this.props);
    this.on(this.el, 'click',   handler);
    this.on(this.el, 'keydown', onActivationKey(handler));

    swapInPlaceholderOnError(
      this,
      '.adm-reel-card__thumb',
      '<div class="adm-reel-card__thumb-placeholder" aria-hidden="true"></div>'
    );
  }
}