/**
 * Lagos Konect - Admin Dashboard Page
 * ============================================================
 * Route:  /admin
 * Guard:  requireAdmin
 *
 * The primary governance overview screen for the LagKonnect
 * admin portal. Displays real-time platform metrics, citizen
 * engagement trends, LGA activity and a moderation queue.
 *
 * Architecture:
 *   Extends AdminLayout so the sidebar, topbar and page chrome
 *   are inherited. Content is rendered via getContent() +
 *   onContentReady() rather than the standard Component render()
 *   cycle, allowing the shell to appear instantly while async
 *   data loads in the background.
 *
 * Data sources:
 *   • api.analytics.getMetrics()     — platform-wide KPI counts
 *   • api.analytics.getInsights()    — time-series engagement data
 *   • api.analytics.getTopLGAs()     — top-5 LGAs by active users
 *   • api.analytics.getFlagged()     — pending moderation reports
 *
 * Live updates:
 *   LGA activity is refreshed every 30 seconds via setInterval.
 *   The timer is cleared in beforeUnmount() to prevent leaks.
 *
 * @module  DashboardPage
 * @version 2.0.0
 */

import { AdminLayout }                        from '../../../components/layout/BaseLayout.js?v=20260805c';
import { store, setPageLoading, showToast }   from '../../../core/store.js?v=20260805c';
import { router }                             from '../../../core/router.js?v=20260805c';
import { api }                                from '../../../api/client.js?v=20260805c';
import { timeAgo }                            from '../../../utils/date.js?v=20260805c';
import { ClusterBarChart, SparklineChart }    from '../../../components/charts/Charts.js?v=20260805c';

/* ── Chart series configuration ─────────────────────────────────────────── */

/**
 * Defines the ordered set of data series rendered in the cluster bar chart.
 * Each entry maps an API data key to a display label and a CSS custom
 * property that provides the series colour.
 *
 * @type {ReadonlyArray<{ key: string, label: string, cssVar: string }>}
 */
const SERIES = Object.freeze([
  { key: 'registrations', label: 'Registrations', cssVar: '--dash-c-reg'  },
  { key: 'messages',      label: 'Messages',       cssVar: '--dash-c-msg'  },
  { key: 'reels',         label: 'Reels',          cssVar: '--dash-c-reel' },
  { key: 'activeUsers',   label: 'Active Users',   cssVar: '--dash-c-wau'  },
  { key: 'newsViews',     label: 'News Views',     cssVar: '--dash-c-news' },
]);

/**
 * Time-range options presented in the chart range selector dropdown.
 * @type {ReadonlyArray<{ value: string, label: string }>}
 */
const RANGE_OPTIONS = Object.freeze([
  { value: 'week',    label: 'Past Week'     },
  { value: 'month',   label: 'Past Month'    },
  { value: '3months', label: 'Past 3 Months' },
  { value: '6months', label: 'Past 6 Months' },
  { value: 'ytd',     label: 'Year to Date'  },
  { value: 'year',    label: 'Past Year'     },
  { value: 'all',     label: 'All Time'      },
]);

/** How often (ms) the LGA activity list polls for fresh data. */
const LGA_POLL_INTERVAL = 30_000;

/** Maximum characters shown for a flagged reel caption. */
const CAPTION_MAX_LEN = 35;

/* ── Inline SVG icon constants ──────────────────────────────────────────── */

const ICON = Object.freeze({
  flag: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>`,

  shield: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>`,

  map: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>`,

  trendUp: `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>`,

  chevronDown: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`,

  externalLink: `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>`,
});

/* ── Formatting helper ──────────────────────────────────────────────────── */

/**
 * Formats a raw number into a compact human-readable string.
 * Values ≥ 1 M → "1.2M", values ≥ 1 K → "4.5K", otherwise plain string.
 *
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  const num = n ?? 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1).replace(/\.0$/, '')     + 'K';
  return String(num);
}

/**
 * Returns a formatted region label with appropriate styling.
 * @param {string} region - 'west', 'east', 'central', or null
 * @returns {string}
 */
function formatRegionBadge(region) {
  const regionLabels = {
    west: 'West',
    east: 'East',
    central: 'Central'
  };
  const label = regionLabels[region] || '—';
  return `<span class="dash-region-badge dash-region-badge--${region || 'unknown'}">${label}</span>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════════════════════════════ */

export default class DashboardPage extends AdminLayout {
  static styles = '/pages/admin/app/Dashboard.css?v=20260805c';

  constructor(props) {
    super({ title: 'Dashboard', ...props });

    /** @type {object|null}   Raw KPI counts from the metrics endpoint */
    this._metrics        = null;
    /** @type {object|null}   Time-series data for the cluster chart */
    this._insights       = null;
    /** @type {object[]}      Top LGAs by active-user count */
    this._topLGAs        = [];
    /** @type {object[]}      Pending moderation reports */
    this._flagged        = [];

    /** Currently selected time range key, e.g. 'month' */
    this._range          = 'month';
    /** Whether the range dropdown is currently open */
    this._rangeOpen      = false;

    /** @type {number|null}   setInterval handle for the LGA live-refresh */
    this._lgaTimer       = null;

    /** @type {ClusterBarChart|null} */
    this._clusterChart   = null;
    /** @type {SparklineChart|null} */
    this._sparklineChart = null;
  }

  /* ── Layout slot ──────────────────────────────────────────────────────── */

  /**
   * Returns the root mount-point HTML injected into the AdminLayout shell.
   * Real content is written by _renderShell() once the layout is ready.
   *
   * @returns {string}
   */
  getContent() {
    return `<div id="dash-root" class="admin-dashboard"></div>`;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  /**
   * Called by AdminLayout once the content area is in the DOM.
   * Renders the structural shell immediately, then fires all four
   * data requests in parallel and fills in the content on resolution.
   *
   * @returns {Promise<void>}
   */
  async onContentReady() {
    setPageLoading(true);
    this._renderShell();

    const region = sessionStorage.getItem('adminRegion') || 'west';

    const [metricsRes, insightsRes, lgasRes, flaggedRes] = await Promise.all([
      api.analytics.getMetrics(region),
      api.analytics.getInsights(this._range, region),
      api.analytics.getTopLGAs(region),
      api.analytics.getFlagged(region),
    ]);

    this._metrics  = metricsRes.data          ?? {};
    this._insights = insightsRes.data         ?? {};
    this._topLGAs  = lgasRes.data?.lgas       ?? [];
    this._flagged  = flaggedRes.data?.flagged  ?? [];

    setPageLoading(false);
    this._renderContent();

    // Re-load all stats whenever the admin switches region
    this.subscribe(store, 'adminRegion', () => this._reloadForRegion());

    // Start the live LGA refresh timer
    this._lgaTimer = setInterval(
      () => this._refreshTopLGAs(),
      LGA_POLL_INTERVAL
    );
  }

  /* ── Shell render ─────────────────────────────────────────────────────── */

  /**
   * Writes the full page skeleton (header, stat-card row, chart card,
   * health card, footer) into #dash-root. Called before data is available
   * so the layout is visible immediately with placeholder slots.
   */
  _renderShell() {
    const root = document.getElementById('dash-root');
    if (!root) return;

    const adminName  = this.esc(store.currentAdmin?.name ?? 'Administration');
    const rangeLabel = RANGE_OPTIONS.find((o) => o.value === this._range)?.label ?? '';
    const region     = sessionStorage.getItem('adminRegion') || 'west';
    const regionLabel = { west: 'Lagos West', central: 'Lagos Central', east: 'Lagos East' }[region] || 'Lagos West';

    root.innerHTML = `
      <!-- ══ Page header ══ -->
      <div class="dash-page-header">
        <div>
          <h1 class="dash-page-header__title">Platform Dashboard</h1>
          <p class="dash-page-header__sub">
            High-level governance metrics for ${adminName} — <span class="dash-region-label">${regionLabel}</span>
          </p>
        </div>
      </div>

      <!-- ══ Stat cards ══ -->
      <div class="dash-stat-row" id="dash-stats"></div>

      <!-- ══ Main content row ══ -->
      <div class="dash-main-row">

        <!-- Chart card -->
        <div class="dash-card dash-card--chart">
          <div class="dash-card__header">
            <div>
              <h2 class="dash-card__title">Governance Insights</h2>
              <p class="dash-card__sub">
                Citizen engagement levels over the selected period
              </p>
            </div>

            <!-- Range selector -->
            <div class="dash-range-selector" id="dash-range-selector">
              <button
                class="dash-range-btn"
                id="dash-range-btn"
                type="button"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-label="Select time range"
              >
                <span id="dash-range-label">${this.esc(rangeLabel)}</span>
                ${ICON.chevronDown}
              </button>

              <div
                class="dash-range-dropdown"
                id="dash-range-dropdown"
                role="listbox"
                aria-label="Time range options"
                inert
              >
                ${RANGE_OPTIONS.map((o) => `
                  <button
                    class="dash-range-option${o.value === this._range ? ' dash-range-option--active' : ''}"
                    type="button"
                    role="option"
                    data-range="${o.value}"
                    aria-selected="${o.value === this._range}"
                  >${o.label}</button>`
                ).join('')}
              </div>
            </div>
          </div>

          <!-- Chart legend -->
          <div class="dash-chart-legend" aria-hidden="true">
            ${SERIES.map((s) => `
              <div class="dash-chart-legend__item">
                <span class="dash-chart-legend__dot"
                      style="background:var(${s.cssVar})"></span>
                <span class="dash-chart-legend__label">${s.label}</span>
              </div>`
            ).join('')}
          </div>

          <!-- Chart mount -->
          <div
            class="dash-cluster-chart"
            id="dash-cluster-chart-mount"
            aria-label="Governance insights cluster bar chart"
            role="img"
          ></div>
        </div>

        <!-- System Health card -->
        <div class="dash-card dash-card--dark dash-card--health">
          <div class="dash-health__header">
            <div class="dash-health__icon">${ICON.shield}</div>
            <h2 class="dash-health__title">System Health</h2>
          </div>

          <div class="dash-health__metric">
            <div class="dash-health__metric-top">
              <span class="dash-health__metric-label">Compliance Rate</span>
              <span class="dash-health__metric-value dash-health__metric-value--good">
                99.8%
              </span>
            </div>
            <div class="dash-health__bar-track">
              <div class="dash-health__bar-fill" style="width:99.8%"></div>
            </div>
          </div>

          <div class="dash-health__metric">
            <div class="dash-health__metric-top">
              <span class="dash-health__metric-label">Encryption Status</span>
              <span class="dash-health__enc-badge">AES-256</span>
            </div>
          </div>

          <div class="dash-health__notice" role="note">
            <span class="dash-health__notice-dot" aria-hidden="true"></span>
            <p class="dash-health__notice-text">
              Last audit completed on Oct 20. All citizen data nodes are
              currently synchronised and secured.
            </p>
          </div>

          <div class="dash-health__stat-row">
            <div class="dash-health__stat">
              <span class="dash-health__stat-val"
                    id="dash-content-count"
                    aria-label="Total content items">—</span>
              <span class="dash-health__stat-label">Content Items</span>
            </div>
            <div class="dash-health__stat">
              <span class="dash-health__stat-val"
                    id="dash-wau-count"
                    aria-label="Weekly active users">—</span>
              <span class="dash-health__stat-label">Weekly Active</span>
            </div>
          </div>
        </div>

      </div>

      <!-- ══ Footer ══ -->
      <footer class="dash-footer">
        <span>© 2026 LagKonnect Governance Platform. All Rights Reserved.</span>
        <a href="#" class="dash-footer__link">Privacy Policy</a>
      </footer>
    `;

    this._bindEvents(root);
  }

  /* ── Content fill ─────────────────────────────────────────────────────── */

  /**
   * Populates the placeholder elements inserted by _renderShell() with
   * real data once all API calls have resolved.
   */
  _renderContent() {
    const root = document.getElementById('dash-root');
    if (!root) return;

    const m = this._metrics;

    // ── Health stat counters ─────────────────────────────────────────────
    const contentEl = document.getElementById('dash-content-count');
    const wauEl     = document.getElementById('dash-wau-count');
    if (contentEl) contentEl.textContent = fmt(m.totalContent      ?? 0);
    if (wauEl)     wauEl.textContent     = fmt(m.weeklyActiveUsers ?? 0);

    this._renderStatCards(root.querySelector('#dash-stats'));
    this._mountCharts(root);
  }

  /* ── Charts ───────────────────────────────────────────────────────────── */

  /**
   * Mounts the ClusterBarChart and SparklineChart into their respective
   * DOM slots. Both are registered as child components so they are
   * cleaned up automatically on unmount.
   *
   * @param {HTMLElement} root
   */
  _mountCharts(root) {
    // ── Cluster bar chart ────────────────────────────────────────────────
    const clusterMount = root.querySelector('#dash-cluster-chart-mount');
    if (clusterMount) {
      const seriesConfig = this._insights?.series
        ? this._insights.series.map((s, i) => ({
            key:    s.key,
            label:  s.label,
            cssVar: SERIES[i]?.cssVar ?? '--color-primary',
          }))
        : [...SERIES];

      this._clusterChart = this.addChild(new ClusterBarChart({
        data:   this._insights?.data ?? [],
        series: seriesConfig,
      }));
      this._clusterChart.mount(clusterMount);
    }

    // ── Sparkline (registration trend inside the Total Users stat card) ──
    const sparkMount = root.querySelector('#dash-sparkline-mount');
    if (sparkMount) {
      const values = (this._insights?.data ?? []).map((d) => d.registrations ?? 0);
      this._sparklineChart = this.addChild(new SparklineChart({ values }));
      this._sparklineChart.mount(sparkMount);
    }
  }

  /* ── Stat cards ───────────────────────────────────────────────────────── */

  /**
   * Renders the three KPI stat cards into the provided container.
   * @param {HTMLElement|null} container
   */
  _renderStatCards(container) {
    if (!container) return;
    const m = this._metrics;

    container.innerHTML = `
      <!-- Total Users -->
      <div class="dash-stat-card">
        <div class="dash-stat-card__top">
          <span class="dash-stat-card__label">Total Users</span>
          <span class="dash-stat-card__trend dash-stat-card__trend--up">
            ${ICON.trendUp}
            +${fmt(m.newUsersThisWeek ?? 0)} this week
          </span>
        </div>
        <p class="dash-stat-card__value">
          ${(m.totalUsers ?? 0).toLocaleString()}
        </p>
        <div class="dash-stat-card__sparkline"
             id="dash-sparkline-mount"
             aria-hidden="true"></div>
      </div>

      <!-- Flagged Content -->
      <div class="dash-stat-card">
        <div class="dash-stat-card__top">
          <span class="dash-stat-card__label">Flagged Content</span>
          <span class="dash-stat-card__icon-wrap dash-stat-card__icon-wrap--flag"
                aria-hidden="true">${ICON.flag}</span>
        </div>
        <p class="dash-stat-card__value">${m.flaggedCount ?? 0}</p>
        <div class="dash-stat-card__flagged-list"
             id="dash-flagged-list"
             aria-label="Pending moderation reports">
          ${this._renderFlaggedMini()}
        </div>
      </div>

      <!-- Top LGA Activity -->
      <div class="dash-stat-card">
        <div class="dash-stat-card__top">
          <span class="dash-stat-card__label">Top LGA Activity</span>
          <span class="dash-stat-card__live-badge" aria-label="Live data">
            <span class="dash-stat-card__live-dot" aria-hidden="true"></span>
            LIVE
          </span>
        </div>
        <div class="dash-lga-list"
             id="dash-lga-list"
             aria-label="Top LGAs by active users">
          ${this._renderLGAList()}
        </div>
      </div>
    `;
  }

  /* ── Partial renderers ────────────────────────────────────────────────── */

  /**
   * Returns the inner HTML for the flagged-reports mini list.
   * Shows up to 3 reports with review and dismiss actions.
   *
   * @returns {string}
   */
  _renderFlaggedMini() {
    if (!this._flagged.length) {
      return `<p class="dash-flagged-empty">No pending reports</p>`;
    }

    return this._flagged.slice(0, 3).map((r) => {
      const raw      = r.caption ?? 'Untitled reel';
      const caption  = raw.slice(0, CAPTION_MAX_LEN);
      const ellipsis = raw.length > CAPTION_MAX_LEN ? '…' : '';

      return `
        <div class="dash-flagged-item"
             data-report-id="${r.reportId}"
             data-reel-id="${r.reelId}">
          <div class="dash-flagged-item__info">
            <span class="dash-flagged-item__reel">
              ${this.esc(caption)}${ellipsis}
            </span>
            <span class="dash-flagged-item__reason">
              ${this.esc(r.reason)} · ${timeAgo(r.reportedAt)}
            </span>
          </div>
          <div class="dash-flagged-item__meta">
            ${formatRegionBadge(r.region)}
          </div>
          <div class="dash-flagged-item__actions">
            <button
              class="dash-flagged-btn dash-flagged-btn--review"
              type="button"
              data-reel-id="${r.reelId}"
              title="Review reel"
              aria-label="Review reel: ${this.esc(caption)}"
            >${ICON.externalLink}</button>
            <button
              class="dash-flagged-btn dash-flagged-btn--dismiss"
              type="button"
              data-report-id="${r.reportId}"
              title="Dismiss report"
              aria-label="Dismiss report for: ${this.esc(caption)}"
            >✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Returns the inner HTML for the LGA activity bar list.
   * Bar widths are normalised against the highest activeUsers value.
   *
   * @returns {string}
   */
  _renderLGAList() {
    if (!this._topLGAs.length) {
      return `<p class="dash-flagged-empty">No LGA activity data</p>`;
    }

    const max = Math.max(...this._topLGAs.map((l) => l.activeUsers), 1);

    return this._topLGAs.map((lga) => {
      const pct = Math.round((lga.activeUsers / max) * 100);
      return `
        <div class="dash-lga-item">
          <div class="dash-lga-item__header">
            <span class="dash-lga-item__name">
              ${ICON.map}${this.esc(lga.lgaName)}
            </span>
            ${formatRegionBadge(lga.region)}
          </div>
          <div class="dash-lga-item__bar-wrap"
               role="progressbar"
               aria-valuenow="${pct}"
               aria-valuemin="0"
               aria-valuemax="100"
               aria-label="${this.esc(lga.lgaName)} activity">
            <div class="dash-lga-item__bar" style="width:${pct}%"></div>
          </div>
          <span class="dash-lga-item__count">${fmt(lga.activeUsers)} active</span>
        </div>
      `;
    }).join('');
  }

  /* ── Event binding ────────────────────────────────────────────────────── */

  /**
   * Wires up all interactive elements within the dashboard shell.
   * Called once by _renderShell() after innerHTML is set.
   *
   * @param {HTMLElement} root
   */
  _bindEvents(root) {
    const rangeBtn      = root.querySelector('#dash-range-btn');
    const rangeDropdown = root.querySelector('#dash-range-dropdown');

    if (rangeBtn && rangeDropdown) {
      /* ── Range button: open / close ─────────────────────────────────── */
      this.on(rangeBtn, 'click', (e) => {
        e.stopPropagation();
        this._rangeOpen = !this._rangeOpen;
        rangeDropdown.classList.toggle('dash-range-dropdown--open', this._rangeOpen);
        rangeBtn.setAttribute('aria-expanded', String(this._rangeOpen));

        if (this._rangeOpen) rangeDropdown.removeAttribute('inert');
        else                 rangeDropdown.setAttribute('inert', '');
      });

      /* ── Range option: select ────────────────────────────────────────── */
      this.delegate('.dash-range-option', 'click', (_, btn) => {
        this._range = btn.dataset.range;

        // Update trigger label
        const labelEl = root.querySelector('#dash-range-label');
        if (labelEl) labelEl.textContent = btn.textContent.trim();

        // Update selected state on all options
        rangeDropdown.querySelectorAll('.dash-range-option').forEach((b) => {
          const isActive = b.dataset.range === this._range;
          b.classList.toggle('dash-range-option--active', isActive);
          b.setAttribute('aria-selected', String(isActive));
        });

        this._closeRangeDropdown(rangeBtn, rangeDropdown);
        this._reloadInsights();
      });

      /* ── Outside click: close ────────────────────────────────────────── */
      this.on(document, 'click', () => {
        if (!this._rangeOpen) return;
        this._closeRangeDropdown(rangeBtn, rangeDropdown);
      });

      /* ── Escape key: close ───────────────────────────────────────────── */
      this.on(document, 'keydown', (e) => {
        if (e.key === 'Escape' && this._rangeOpen) {
          this._closeRangeDropdown(rangeBtn, rangeDropdown);
          rangeBtn.focus();
        }
      });
    }

    /* ── Dismiss report ─────────────────────────────────────────────────── */
    this.delegate('.dash-flagged-btn--dismiss', 'click', async (_, btn) => {
      const reportId = parseInt(btn.dataset.reportId, 10);

      // Optimistic UI feedback
      btn.disabled    = true;
      btn.textContent = '…';

      const res = await api.analytics.dismissReport(reportId);

      if (res.error) {
        showToast('error', 'Could not dismiss report.');
        btn.disabled    = false;
        btn.textContent = '✕';
        return;
      }

      // Remove from local state and re-render the mini list
      this._flagged = this._flagged.filter((r) => r.reportId !== reportId);
      this._metrics.flaggedCount = Math.max(
        0, (this._metrics.flaggedCount ?? 1) - 1
      );

      const list = root.querySelector('#dash-flagged-list');
      if (list) list.innerHTML = this._renderFlaggedMini();

      showToast('success', 'Report dismissed.');
    });

    /* ── Review reel ─────────────────────────────────────────────────────── */
    this.delegate('.dash-flagged-btn--review', 'click', (_, btn) => {
      router.push(`/admin/reels?highlight=${btn.dataset.reelId}`);
    });
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  /**
   * Closes the range dropdown and updates all associated ARIA state.
   *
   * @param {HTMLElement} btn
   * @param {HTMLElement} dropdown
   */
  _closeRangeDropdown(btn, dropdown) {
    this._rangeOpen = false;
    dropdown.classList.remove('dash-range-dropdown--open');
    dropdown.setAttribute('inert', '');
    btn.setAttribute('aria-expanded', 'false');
  }

  /* ── Data refresh ─────────────────────────────────────────────────────── */

  /**
   * Re-fetches time-series data for the currently selected range and
   * updates the cluster bar chart in place.
   *
   * @returns {Promise<void>}
   */
  async _reloadInsights() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const res = await api.analytics.getInsights(this._range, region);
    if (!res.data) return;

    this._insights = res.data;

    if (this._clusterChart) {
      const seriesConfig = (res.data.series ?? []).map((s, i) => ({
        key:    s.key,
        label:  s.label,
        cssVar: SERIES[i]?.cssVar ?? '--color-primary',
      }));
      this._clusterChart.setData(res.data.data ?? [], seriesConfig);
    }
  }

  /**
   * Re-fetches LGA activity data and patches the list in the DOM
   * without a full page re-render.
   *
   * @returns {Promise<void>}
   */
  async _refreshTopLGAs() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const res = await api.analytics.getTopLGAs(region);
    if (!res.data) return;

    this._topLGAs     = res.data.lgas ?? [];
    const listEl      = document.getElementById('dash-lga-list');
    if (listEl) listEl.innerHTML = this._renderLGAList();
  }

  /**
   * Called when the admin switches region via the sidebar selector.
   * Re-fetches all four data sources scoped to the new region,
   * then patches the DOM in place (avoids a full shell re-render).
   *
   * @returns {Promise<void>}
   */
  async _reloadForRegion() {
    const region = sessionStorage.getItem('adminRegion') || 'west';

    // Update the region label immediately so the UI is responsive
    const regionLabel = { west: 'Lagos West', central: 'Lagos Central', east: 'Lagos East' }[region] || 'Lagos West';
    const regionEl = document.querySelector('.dash-region-label');
    if (regionEl) regionEl.textContent = regionLabel;

    setPageLoading(true);
    const [m, i, l, f] = await Promise.all([
      api.analytics.getMetrics(region),
      api.analytics.getInsights(this._range, region),
      api.analytics.getTopLGAs(region),
      api.analytics.getFlagged(region),
    ]);
    this._metrics  = m.data          ?? {};
    this._insights = i.data          ?? {};
    this._topLGAs  = l.data?.lgas    ?? [];
    this._flagged  = f.data?.flagged ?? [];
    setPageLoading(false);

    // Unmount old charts before remounting to avoid duplicates
    this._clusterChart?.unmount();   this._clusterChart  = null;
    this._sparklineChart?.unmount(); this._sparklineChart = null;

    this._renderContent();
  }

  /* ── Cleanup ──────────────────────────────────────────────────────────── */

  /**
   * Clears the LGA polling interval before the page is removed from the DOM.
   * Called automatically by the router before navigation away.
   */
  beforeUnmount() {
    if (this._lgaTimer !== null) {
      clearInterval(this._lgaTimer);
      this._lgaTimer = null;
    }
  }
}