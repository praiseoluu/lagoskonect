/**
 * LagKonnect Admin — Governance Analytics
 * Route: /admin/analytics
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260807a';
import { Button } from '../../../components/base/Button.js?v=20260807a';
import { Modal } from '../../../components/base/Modal.js?v=20260807a';
import { store, showToast, setPageLoading } from '../../../core/store.js?v=20260807a';
import { api } from '../../../api/client.js?v=20260807a';
import { BarChart, TopicsChart, HeatmapChart, TrendCard } from '../../../components/charts/Charts.js?v=20260807a';

const CAL_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const EXPORT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const INFO_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

const REGION_LABELS = { west: 'Lagos West', central: 'Lagos Central', east: 'Lagos East' };

export default class AnalyticsPage extends AdminLayout {
  static styles = '/pages/admin/app/Analytics.css?v=20260807a';

  constructor(props) {
    super({
      title: 'Governance Analytics',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Analytics' },
      ],
      ...props,
    });
    this._metrics = null;
    this._weekly = [];
    this._topics = [];
    this._heatmap = [];
    this._exportModal = null;
    this._range = '30d';
  }

  getContent() {
    return '<div id="analytics-root" class="admin-analytics-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderShell();
    await this._fetchAndRender();
    setPageLoading(false);

    this.subscribe(store, 'adminRegion', async () => {
      setPageLoading(true);
      this._updateRegionBanner();
      await this._fetchAndRender();
      setPageLoading(false);
    });
  }

  async _fetchAndRender() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const [metricsRes, weeklyRes, topicsRes, heatmapRes] = await Promise.all([
      api.analytics.getOverview(region, this._range),
      api.analytics.getWeekly(region, this._range),
      api.analytics.getTopics(region, this._range),
      api.analytics.getLgaHeatmap(region, this._range),
    ]);

    this._metrics = metricsRes.data || {};
    this._weekly = weeklyRes.data || [];
    this._topics = topicsRes.data || [];
    this._heatmap = heatmapRes.data || [];

    this._renderContent();
  }

  _updateRegionBanner() {
    const region = sessionStorage.getItem('adminRegion') || 'west';
    const bannerEl = document.getElementById('an-region-banner');
    if (bannerEl) bannerEl.textContent = REGION_LABELS[region] || region;
  }

  _renderShell() {
    const root = document.getElementById('analytics-root');
    if (!root) return;

    const region = sessionStorage.getItem('adminRegion') || 'west';
    const regionLabel = REGION_LABELS[region] || region;

    root.innerHTML =
      '<div class="an-page-header">' +
      '<div>' +
      '<h1 class="an-page-header__title">Governance Analytics</h1>' +
      '<p class="an-page-header__sub">Platform health, civic participation &amp; moderation — <strong id="an-region-banner">' + regionLabel + '</strong></p>' +
      '</div>' +
      '<div class="an-page-header__actions">' +
      '<label class="an-range-control">Period <select id="an-range" aria-label="Analytics period">' +
      '<option value="7d">Last 7 days</option>' +
      '<option value="30d" selected>Last 30 days</option>' +
      '<option value="90d">Last 90 days</option>' +
      '<option value="365d">Last 12 months</option>' +
      '</select></label>' +
      '<a class="an-traffic-link" href="/admin/traffic">Site traffic</a>' +
      '<div id="export-btn-mount"></div>' +
      '</div>' +
      '</div>' +
      '<div id="an-kpi-row" class="an-kpi-row"></div>' +
      '<div id="an-charts-row" class="an-charts-row"></div>' +
      '<div id="an-heatmap-section" class="an-section"></div>' +
      '<div id="an-topics-row" class="an-topics-row"></div>';

    // Export button
    this.addChild(new Button({
      label: 'Export Report', icon: EXPORT_ICON, iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => this._openExportModal(),
    })).mount(root.querySelector('#export-btn-mount'));

    // Export modal
    this._exportModal = this.addChild(new Modal({
      title: 'Export Analytics Report',
      size: 'sm',
      body:
        '<p class="an-export-desc">Choose your preferred export format. The report includes platform metrics and a full LGA breakdown.</p>' +
        '<div class="an-export-btns">' +
        '<button class="an-export-option" id="export-csv-btn">' +
        '<span class="an-export-option__icon">📄</span>' +
        '<strong>CSV</strong>' +
        '<span>Spreadsheet format</span>' +
        '</button>' +
        '<button class="an-export-option" id="export-pdf-btn">' +
        '<span class="an-export-option__icon">📑</span>' +
        '<strong>PDF</strong>' +
        '<span>Print-ready report</span>' +
        '</button>' +
        '</div>',
      footer: '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>',
    }));
    this._exportModal.mount(document.body, { append: true });

    this.on(document, 'click', (e) => {
      if (e.target && e.target.id === 'export-csv-btn') this._doExport('csv');
      if (e.target && e.target.id === 'export-pdf-btn') this._doExport('pdf');
    });

    const rangeSelect = root.querySelector('#an-range');
    if (rangeSelect) this.on(rangeSelect, 'change', async () => {
      this._range = rangeSelect.value;
      setPageLoading(true);
      await this._fetchAndRender();
      setPageLoading(false);
    });
  }

  _renderContent() {
    const m = this._metrics;
    this._renderKpis(m);
    this._renderChartsRow();
    this._renderHeatmap();
  }

  _renderKpis(m) {
    const row = document.getElementById('an-kpi-row');
    if (!row) return;
    row.innerHTML = '';

    const periodLabel = this._range === '7d' ? 'last 7 days' : this._range === '90d' ? 'last 90 days' : this._range === '365d' ? 'last 12 months' : 'last 30 days';
    const kpis = [
      {
        label: 'Active Users', value: this._fmt(m.activeUsers),
         trend: m.activeUsersTrend, trendLabel: 'vs previous period', trendUp: m.activeUsersTrend >= 0,
      },
      {
         label: 'New Citizens', value: this._fmt(m.newUsers),
         trend: m.newUsersTrend, trendLabel: 'vs previous period', trendUp: m.newUsersTrend >= 0,
       },
       {
         label: 'Page Views', value: this._fmt(m.pageViews),
         trend: null, trendLabel: periodLabel,
       },
       {
         label: 'Chat Messages', value: this._fmt(m.chatMessages),
         trend: null, trendLabel: periodLabel,
       },
       {
         label: 'Content Interactions', value: this._fmt(m.contentInteractions),
         trend: null, trendLabel: periodLabel,
       },
       {
         label: 'Open Moderation', value: this._fmt(m.moderationOpen),
         trend: null,
       },
       {
         label: 'Published Content', value: this._fmt(m.publishedContent),
         trend: null,
       },
       {
         label: "Active LGAs", value: this._fmt(m.totalLgas),
        trend: null,
      },
    ];

    kpis.forEach(kpi => {
      const wrap = document.createElement('div');
      wrap.className = 'an-kpi-wrap';
      row.appendChild(wrap);
      this.addChild(new TrendCard(kpi)).mount(wrap);
    });
  }

  _renderChartsRow() {
    const row = document.getElementById('an-charts-row');
    if (!row) return;
    row.innerHTML = '';

    // Left: Weekly content activity bar chart
    const leftCard = document.createElement('div');
    leftCard.className = 'an-chart-card';
    leftCard.innerHTML =
      '<div class="an-chart-card__header">' +
      '<div>' +
      '<h3 class="an-chart-card__title">Platform Activity</h3>' +
       '<p class="an-chart-card__sub">Published news and reels by period</p>' +
      '</div>' +
      '</div>' +
      '<div id="bar-chart-mount" class="an-chart-body"></div>';
    row.appendChild(leftCard);

    const barData = this._weekly.map(w => ({
      label: w.label,
      value: w.news,
      value2: w.reels,
    }));
    this.addChild(new BarChart({
      data: barData,
      color: 'var(--color-primary)',
      color2: 'var(--color-primary-40)',
      legend: ['News', 'Reels'],
    })).mount(leftCard.querySelector('#bar-chart-mount'));

    // Right: Top discussed topics
    const rightCard = document.createElement('div');
    rightCard.className = 'an-chart-card';
    rightCard.innerHTML =
      '<div class="an-chart-card__header">' +
      '<div>' +
      '<h3 class="an-chart-card__title">Top Discussed Topics</h3>' +
      '<p class="an-chart-card__sub">Based on news categories &amp; reel hashtags</p>' +
      '</div>' +
      '<span class="an-chart-card__info" title="Derived from published news categories and reel hashtags">' + INFO_SVG + '</span>' +
      '</div>' +
      '<div id="topics-chart-mount" class="an-chart-body"></div>';
    row.appendChild(rightCard);

    this.addChild(new TopicsChart({ data: this._topics }))
      .mount(rightCard.querySelector('#topics-chart-mount'));
  }

  _renderHeatmap() {
    const section = document.getElementById('an-heatmap-section');
    if (!section) return;

    section.innerHTML =
      '<div class="an-section-header">' +
      '<div>' +
      '<h2 class="an-section-title">LGA Engagement Heatmap</h2>' +
      '<p class="an-section-sub">Activity distribution across Local Government Areas (last 30 days)</p>' +
      '</div>' +
      '</div>' +
      '<div id="heatmap-mount"></div>';

    this.addChild(new HeatmapChart({ data: this._heatmap }))
      .mount(section.querySelector('#heatmap-mount'));
  }

  _openExportModal() {
    this._exportModal.open();
  }

  async _doExport(format) {
    this._exportModal.close();
    showToast('success', 'Preparing ' + format.toUpperCase() + ' report...');
    const res = await api.analytics.exportReport(format);
    if (res.error) showToast('error', 'Export failed. Try again.');
  }

  _fmt(n) {
    if (n == null) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  }
}