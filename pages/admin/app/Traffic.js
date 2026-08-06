/**
 * KTG Connect Admin — Site Traffic Analytics
 * Route: /admin/traffic
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806c';
import { Button } from '../../../components/base/Button.js?v=20260806c';
import { showToast, setPageLoading } from '../../../core/store.js?v=20260806c';
import { api } from '../../../api/client.js?v=20260806c';
import { BarChart } from '../../../components/charts/Charts.js?v=20260806c';

const REFRESH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';
const EXPORT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const FILTER_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
const PREV_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
const NEXT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function defaultFrom() {
  const d = new Date(); d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

function defaultTo() { return new Date().toISOString().slice(0, 10); }

export default class TrafficPage extends AdminLayout {
  static styles = '/pages/admin/app/Traffic.css?v=20260806c';

  constructor(props) {
    super({
      title: 'Site Traffic',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Analytics', path: '/admin/analytics' },
        { label: 'Site Traffic' },
      ],
      ...props,
    });
    this._from = defaultFrom();
    this._to = defaultTo();
    this._lgaId = null;
    this._lgas = [];
    this._metrics = {};
    this._daily = [];
    this._logs = [];
    this._topLgas = [];
    this._page = 1;
    this._perPage = 10;
    this._total = 0;
    this._totalPages = 1;
    this._barChart = null;
    this._activeTimer = null;
  }

  getContent() {
    return '<div id="traffic-root" class="admin-traffic-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    const lgasRes = await api.lgas.getAll();
    this._lgas = lgasRes.data || [];
    this._renderShell();
    await this._loadAll();
    setPageLoading(false);
    // Refresh active now every 30s
    this._activeTimer = setInterval(() => this._refreshActiveNow(), 30000);
  }

  _renderShell() {
    const root = document.getElementById('traffic-root');
    if (!root) return;

    const lgaOptions = this._lgas.map(l =>
      '<option value="' + l.id + '">' + l.name + '</option>'
    ).join('');

    root.innerHTML =
      '<div class="tf-page-header">' +
      '<div class="tf-breadcrumb">ANALYTICS HUB / NETWORK TRAFFIC</div>' +
      '<div class="tf-page-header__row">' +
      '<div>' +
      '<h1 class="tf-page-header__title">Site Traffic Analytics</h1>' +
      '<p class="tf-page-header__sub">Monitoring real-time citizen engagement and administrative access across regional gateways.</p>' +
      '</div>' +
      '<div class="tf-header-controls">' +
      '<div class="tf-filter-group">' +
      '<div class="tf-filter-field">' +
      '<label class="tf-filter-label">DATE RANGE</label>' +
      '<div class="tf-date-range">' +
      '<input type="date" class="tf-date-input" id="tf-from" value="' + this._from + '" />' +
      '<span class="tf-date-sep">–</span>' +
      '<input type="date" class="tf-date-input" id="tf-to"   value="' + this._to + '" />' +
      '</div>' +
      '</div>' +
      '<div class="tf-filter-field">' +
      '<label class="tf-filter-label">LOCAL AREA (LGA)</label>' +
      '<select class="tf-select" id="tf-lga">' +
      '<option value="">All Regions</option>' +
      lgaOptions +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div id="tf-export-mount"></div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="tf-kpi-row" id="tf-kpi-row"></div>' +
      '<div class="tf-kpi-row tf-kpi-row--secondary" id="tf-kpi-row2"></div>' +

      '<div class="tf-charts-row">' +
      '<div class="tf-chart-card tf-chart-card--wide">' +
      '<div class="tf-chart-card__header">' +
      '<div>' +
      '<h3 class="tf-chart-card__title">Page Views</h3>' +
      '<p class="tf-chart-card__sub">Daily views vs unique visitors</p>' +
      '</div>' +
      '</div>' +
      '<div id="tf-bar-chart-mount" class="tf-chart-body"></div>' +
      '</div>' +
      '<div class="tf-chart-card">' +
      '<div class="tf-chart-card__header">' +
      '<h3 class="tf-chart-card__title">Top LGAs by Sessions</h3>' +
      '</div>' +
      '<div id="tf-top-lgas-mount" class="tf-top-lgas"></div>' +
      '</div>' +
      '</div>' +

      '<div class="tf-logs-card">' +
      '<div class="tf-logs-card__header">' +
      '<h3 class="tf-logs-card__title">Network Activity Logs</h3>' +
      '<div class="tf-logs-card__actions">' +
      '<div id="tf-refresh-mount"></div>' +
      '</div>' +
      '</div>' +
      '<div id="tf-logs-table"></div>' +
      '<div class="tf-pagination" id="tf-pagination"></div>' +
      '</div>';

    // Export button
    this.addChild(new Button({
      label: 'Export Data', icon: EXPORT_ICON, iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: async () => {
        const res = await api.analytics.exportReport('csv');
        if (res.error) showToast('error', 'Export failed. Please try again.');
        else showToast('success', 'Export downloaded.');
      },
    })).mount(root.querySelector('#tf-export-mount'));

    // Refresh button
    this.addChild(new Button({
      label: '', icon: REFRESH_ICON, iconPosition: 'left',
      variant: 'ghost', size: 'sm',
      onClick: () => this._loadAll(),
    })).mount(root.querySelector('#tf-refresh-mount'));

    this._bindEvents(root);
  }

  _bindEvents(root) {
    let timer;
    const refilter = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { this._page = 1; this._loadAll(); }, 400);
    };

    const fromEl = root.querySelector('#tf-from');
    const toEl = root.querySelector('#tf-to');
    const lgaEl = root.querySelector('#tf-lga');

    if (fromEl) this.on(fromEl, 'change', () => { this._from = fromEl.value; refilter(); });
    if (toEl) this.on(toEl, 'change', () => { this._to = toEl.value; refilter(); });
    if (lgaEl) this.on(lgaEl, 'change', () => { this._lgaId = lgaEl.value || null; refilter(); });

    this.delegate('[data-tf-page]', 'click', (e, btn) => {
      const p = parseInt(btn.dataset.tfPage, 10);
      if (p >= 1 && p <= this._totalPages) {
        this._page = p;
        this._loadLogs();
      }
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────

  async _loadAll() {
    await Promise.all([
      this._loadMetrics(),
      this._loadDaily(),
      this._loadLogs(),
      this._loadTopLgas(),
    ]);
  }

  async _loadMetrics() {
    const res = await api.analytics.getTrafficMetrics(this._from, this._to, this._lgaId);
    if (res.error) return;
    this._metrics = res.data || {};
    this._renderKpis();
  }

  async _loadDaily() {
    const res = await api.analytics.getTrafficDaily(this._from, this._to, this._lgaId);
    if (res.error) return;
    this._daily = res.data || [];
    this._renderBarChart();
  }

  async _loadLogs() {
    const res = await api.analytics.getTrafficLogs(
      this._from, this._to, this._lgaId, this._page, this._perPage
    );
    if (res.error) return;
    this._logs = res.data || [];
    this._total = res.meta?.total || 0;
    this._totalPages = res.meta?.totalPages || 1;
    this._renderLogs();
    this._renderPagination();
  }

  async _loadTopLgas() {
    const res = await api.analytics.getTrafficTopLgas(this._from, this._to);
    if (res.error) return;
    this._topLgas = res.data || [];
    this._renderTopLgas();
  }

  async _refreshActiveNow() {
    const res = await api.analytics.getTrafficMetrics(this._from, this._to, this._lgaId);
    if (res.data) {
      const el = document.getElementById('tf-active-now');
      if (el) el.textContent = fmt(res.data.activeNow || 0);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  _renderKpis() {
    const m = this._metrics;
    const row1 = document.getElementById('tf-kpi-row');
    const row2 = document.getElementById('tf-kpi-row2');
    if (!row1 || !row2) return;

    const trend = (val, label) => val == null ? '' :
      '<span class="tf-kpi__trend ' + (val >= 0 ? 'tf-kpi__trend--up' : 'tf-kpi__trend--down') + '">' +
      (val >= 0 ? '+' : '') + val + '% ' + label +
      '</span>';

    row1.innerHTML =
      this._kpiCard('TOTAL SESSIONS', fmt(m.totalSessions), trend(m.sessionsTrend, 'vs last period'), false) +
      this._kpiCard('AVG. PAGES / SESSION', (m.avgPagesPerSession || 0) + ' pages', '<span class="tf-kpi__sub">per visit</span>', false) +
      this._kpiCard('RETURN RATE', (m.returnRate || 0) + '%', '<span class="tf-kpi__sub">returning users</span>', false) +
      '<div class="tf-kpi-card tf-kpi-card--accent">' +
      '<p class="tf-kpi__label">ACTIVE NOW</p>' +
      '<p class="tf-kpi__value" id="tf-active-now">' + fmt(m.activeNow) + '</p>' +
      '<p class="tf-kpi__sub">Real-time update</p>' +
      '</div>';

    row2.innerHTML =
      this._kpiCard('USERS PER DAY', fmt(m.perDay), '', false) +
      this._kpiCard('USERS PER WEEK', fmt(m.perWeek), '', false) +
      this._kpiCard('USERS PER MONTH', fmt(m.perMonth), '', false);
  }

  _kpiCard(label, value, extra, accent) {
    return '<div class="tf-kpi-card' + (accent ? ' tf-kpi-card--accent' : '') + '">' +
      '<p class="tf-kpi__label">' + label + '</p>' +
      '<p class="tf-kpi__value">' + value + '</p>' +
      (extra ? extra : '') +
      '</div>';
  }

  _renderBarChart() {
    const mount = document.getElementById('tf-bar-chart-mount');
    if (!mount) return;

    const data = this._daily.map(d => ({
      label: new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }),
      value: d.pageViews,
      value2: d.uniqueVisitors,
    }));

    // Unmount existing chart child if any
    if (this._barChart) {
      this._barChart.unmount && this._barChart.unmount();
    }

    mount.innerHTML = '';
    this._barChart = this.addChild(new BarChart({
      data,
      color: 'var(--color-primary)',
      color2: 'var(--color-primary-40)',
      legend: ['Page Views', 'Unique Visitors'],
    }));
    this._barChart.mount(mount);
  }

  _renderTopLgas() {
    const el = document.getElementById('tf-top-lgas-mount');
    if (!el) return;

    if (!this._topLgas.length) {
      el.innerHTML = '<p class="tf-empty">No data for this period.</p>';
      return;
    }

    const max = Math.max(...this._topLgas.map(l => l.sessions), 1);
    el.innerHTML = this._topLgas.map((l, i) =>
      '<div class="tf-lga-row">' +
      '<span class="tf-lga-row__rank">' + (i + 1) + '</span>' +
      '<div class="tf-lga-row__info">' +
      '<span class="tf-lga-row__name">' + this.esc(l.lgaName) + '</span>' +
      '<div class="tf-lga-row__bar-wrap">' +
      '<div class="tf-lga-row__bar" style="width:' + Math.round((l.sessions / max) * 100) + '%"></div>' +
      '</div>' +
      '</div>' +
      '<span class="tf-lga-row__val">' + l.sessions.toLocaleString() + '</span>' +
      '</div>'
    ).join('');
  }

  _renderLogs() {
    const el = document.getElementById('tf-logs-table');
    if (!el) return;

    if (!this._logs.length) {
      el.innerHTML = '<p class="tf-empty">No activity logs for this period.</p>';
      return;
    }

    el.innerHTML =
      '<table class="tf-table">' +
      '<thead>' +
      '<tr>' +
      '<th>DATE</th>' +
      '<th>TIME</th>' +
      '<th>USER</th>' +
      '<th>LGA (LOCAL GOVT AREA)</th>' +
      '<th>STATE</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      this._logs.map(log =>
        '<tr>' +
        '<td>' + fmtDate(log.createdAt) + '</td>' +
        '<td>' + fmtTime(log.createdAt) + '</td>' +
        '<td>' +
        '<div class="tf-user-cell">' +
        (log.avatarUrl
          ? '<img src="' + this.esc(log.avatarUrl) + '" class="tf-avatar" alt="" />'
          : '<div class="tf-avatar tf-avatar--placeholder">' + initials(log.userName) + '</div>'
        ) +
        '<span>' + this.esc(log.userName) + '</span>' +
        '</div>' +
        '</td>' +
        '<td>' + this.esc(log.lgaName) + '</td>' +
        '<td>' + this.esc(log.lgaState) + '</td>' +
        '</tr>'
      ).join('') +
      '</tbody>' +
      '</table>';
  }

  _renderPagination() {
    const el = document.getElementById('tf-pagination');
    if (!el) return;

    const showing = Math.min(this._page * this._perPage, this._total);
    const from = Math.min((this._page - 1) * this._perPage + 1, this._total);

    let pages = '';
    const p = this._page, t = this._totalPages;
    const nums = new Set([1, 2, p - 1, p, p + 1, t - 1, t].filter(n => n >= 1 && n <= t));
    let prev = 0;
    [...nums].sort((a, b) => a - b).forEach(n => {
      if (prev && n - prev > 1) pages += '<span class="tf-page-ellipsis">…</span>';
      pages += '<button class="tf-page-btn ' + (n === p ? 'tf-page-btn--active' : '') + '" data-tf-page="' + n + '">' + n + '</button>';
      prev = n;
    });

    el.innerHTML =
      '<span class="tf-pagination__info">Showing ' + from + '–' + showing + ' of ' + this._total.toLocaleString() + ' entries</span>' +
      '<div class="tf-pagination__btns">' +
      '<button class="tf-page-btn tf-page-btn--nav" data-tf-page="' + (p - 1) + '" ' + (p <= 1 ? 'disabled' : '') + '>' + PREV_ICON + '</button>' +
      pages +
      '<button class="tf-page-btn tf-page-btn--nav" data-tf-page="' + (p + 1) + '" ' + (p >= t ? 'disabled' : '') + '>' + NEXT_ICON + '</button>' +
      '</div>';
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  beforeUnmount() {
    if (this._activeTimer) { clearInterval(this._activeTimer); this._activeTimer = null; }
  }
}