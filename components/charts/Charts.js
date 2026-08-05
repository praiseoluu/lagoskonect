/**
 * LagKonnect — Chart Components
 * Self-contained chart classes extending Component.
 *
 * Exports:
 *   BarChart        — standard grouped/stacked bar chart
 *   ClusterBarChart — multi-series cluster bars (dashboard governance insights)
 *   SparklineChart  — mini SVG sparkline (decorative)
 *   TopicsChart     — horizontal progress bars with labels + percentages
 *   HeatmapChart    — LGA engagement grid cards (High/Med/Low)
 *   TrendCard       — KPI card with value + trend arrow
 */

import { Component } from '../../core/component.js?v=20260805c';

// ── BarChart ───────────────────────────────────────────────────────────────
// Props: { data: [{label, value, value2?}], color, color2, legend: [str,str], height }

export class BarChart extends Component {
  static styles = '/components/charts/Charts.css?v=20260805c';

  render() { return '<div class="ktg-bar-chart"></div>'; }

  afterMount() { this._draw(); }

  _draw() {
    const el = this.el;
    if (!el) return;
    const data = this.props.data || [];
    if (!data.length) { el.innerHTML = '<p class="ktg-chart-empty">No data available.</p>'; return; }

    const max = Math.max(...data.map(d => Math.max(d.value || 0, d.value2 || 0)), 1);
    const color = this.props.color || 'var(--color-primary)';
    const color2 = this.props.color2 || 'var(--color-primary-40)';

    // Y-axis: 4 evenly spaced labels
    const yTicks = [max, Math.round(max * 0.66), Math.round(max * 0.33), 0];
    const yAxisHtml =
      '<div class="ktg-bar-chart__y-axis">' +
      yTicks.map(t => '<span>' + (t >= 1000 ? (t / 1000).toFixed(1) + 'k' : t) + '</span>').join('') +
      '</div>';

    let barsRow = '<div class="ktg-bar-chart__bars-row">';
    let labelsRow = '<div class="ktg-bar-chart__labels-row">';
    let hasSecondary = false;

    for (const d of data) {
      const pct = Math.max(Math.round(((d.value || 0) / max) * 100), (d.value || 0) > 0 ? 2 : 0);
      const pct2 = d.value2 != null ? Math.max(Math.round(((d.value2 || 0) / max) * 100), (d.value2 || 0) > 0 ? 2 : 0) : null;
      if (pct2 != null) hasSecondary = true;
      const tip = d.label + ': ' + (d.value || 0).toLocaleString() + (pct2 != null ? ' / ' + (d.value2 || 0).toLocaleString() : '');
      barsRow +=
        '<div class="ktg-bar-chart__col">' +
        (pct2 != null ? '<div class="ktg-bar-chart__bar ktg-bar-chart__bar--secondary" style="height:' + pct2 + '%;background:' + color2 + '" title="' + tip + '"></div>' : '') +
        '<div class="ktg-bar-chart__bar" style="height:' + pct + '%;background:' + color + '" title="' + tip + '"></div>' +
        '</div>';
      labelsRow += '<span class="ktg-bar-chart__label">' + d.label + '</span>';
    }

    barsRow += '</div>';
    labelsRow += '</div>';

    let legendHtml = '';
    if (this.props.legend && hasSecondary) {
      legendHtml =
        '<div class="ktg-chart-legend">' +
        '<span class="ktg-chart-legend__item"><span style="background:' + color + '"></span>' + (this.props.legend[0] || '') + '</span>' +
        '<span class="ktg-chart-legend__item"><span style="background:' + color2 + '"></span>' + (this.props.legend[1] || '') + '</span>' +
        '</div>';
    }

    el.innerHTML =
      '<div class="ktg-bar-chart__wrap">' +
      yAxisHtml +
      '<div class="ktg-bar-chart__chart-area">' +
      barsRow +
      '<div class="ktg-bar-chart__axis-line"></div>' +
      labelsRow +
      '</div>' +
      '</div>' +
      legendHtml;

    // Attach native tooltip via mouseover for richer display
    el.querySelectorAll('.ktg-bar-chart__bar').forEach(bar => {
      bar.addEventListener('mouseenter', (e) => {
        const tip = bar.getAttribute('title');
        if (!tip) return;
        const tt = document.createElement('div');
        tt.className = 'ktg-chart-tooltip';
        tt.textContent = tip;
        document.body.appendChild(tt);
        const move = (ev) => {
          tt.style.left = (ev.clientX + 12) + 'px';
          tt.style.top = (ev.clientY - 28) + 'px';
        };
        move(e);
        bar.addEventListener('mousemove', move);
        bar.addEventListener('mouseleave', () => { tt.remove(); bar.removeEventListener('mousemove', move); }, { once: true });
      });
    });
  }
}

// ── ClusterBarChart ────────────────────────────────────────────────────────
// Multi-series cluster bars for the dashboard Governance Insights chart.
// Props: {
//   data:   [{label, registrations, messages, reels, activeUsers, newsViews}],
//   series: [{key, label, cssVar}]
// }

export class ClusterBarChart extends Component {
  static styles = '/components/charts/Charts.css?v=20260805c';

  render() { return '<div class="dash-cluster-chart__inner"></div>'; }

  afterMount() { this._draw(); }

  setData(data, series) {
    this.props.data = data;
    this.props.series = series;
    this._draw();
  }

  _draw() {
    const el = this.el;
    if (!el) return;
    const data = this.props.data || [];
    const series = this.props.series || [];

    if (!data.length) {
      el.innerHTML = '<p class="dash-chart-empty">No data for this period.</p>';
      return;
    }

    const maxVal = Math.max(...data.flatMap(d => series.map(s => d[s.key] || 0)), 1);

    const yTicks = [maxVal, Math.round(maxVal * 0.66), Math.round(maxVal * 0.33), 0];
    const yAxis =
      '<div class="ktg-bar-chart__y-axis">' +
      yTicks.map(t => '<span>' + (t >= 1000 ? (t / 1000).toFixed(1) + 'k' : t) + '</span>').join('') +
      '</div>';

    let barsRow = '<div class="dash-cluster-chart__bars-row">';
    let labelsRow = '<div class="dash-cluster-chart__labels-row">';

    for (const period of data) {
      barsRow += '<div class="dash-cluster-chart__group">';
      for (const s of series) {
        const val = period[s.key] || 0;
        const pct = val > 0 ? Math.max(Math.round((val / maxVal) * 100), 3) : 0;
        const barStyle = val > 0
          ? 'height:' + pct + '%;background:var(' + s.cssVar + ')'
          : 'height:2%;background:var(' + s.cssVar + ');';
        barsRow +=
          '<div class="dash-cluster-chart__bar-wrap" title="' + s.label + ': ' + val.toLocaleString() + '">' +
          '<div class="dash-cluster-chart__bar" style="' + barStyle + '" role="presentation"></div>' +
          '</div>';
      }
      barsRow += '</div>';
      labelsRow += '<span class="dash-cluster-chart__label">' + (period.label || '') + '</span>';
    }

    barsRow += '</div>';
    labelsRow += '</div>';

    el.innerHTML =
      '<div class="ktg-bar-chart__wrap" style="flex:1">' +
      yAxis +
      '<div class="dash-cluster-chart__chart-area">' +
      barsRow +
      '<div class="dash-cluster-chart__axis-line"></div>' +
      labelsRow +
      '</div>' +
      '</div>';

    el.querySelectorAll('.dash-cluster-chart__bar-wrap').forEach(wrap => {
      wrap.addEventListener('mouseenter', (e) => {
        const tip = wrap.getAttribute('title');
        if (!tip) return;
        const tt = document.createElement('div');
        tt.className = 'ktg-chart-tooltip';
        tt.textContent = tip;
        document.body.appendChild(tt);
        const move = (ev) => { tt.style.left = (ev.clientX + 12) + 'px'; tt.style.top = (ev.clientY - 28) + 'px'; };
        move(e);
        wrap.addEventListener('mousemove', move);
        wrap.addEventListener('mouseleave', () => { tt.remove(); wrap.removeEventListener('mousemove', move); }, { once: true });
      });
    });
  }
}

// ── SparklineChart ─────────────────────────────────────────────────────────
// Mini SVG sparkline. Props: { values: number[], color, fillColor }

export class SparklineChart extends Component {
  static styles = '/components/charts/Charts.css?v=20260805c';

  render() { return '<div class="ktg-sparkline"></div>'; }

  afterMount() { this._draw(); }

  _draw() {
    const el = this.el;
    if (!el) return;
    const vals = this.props.values || [];
    if (vals.length < 2) { el.innerHTML = ''; return; }

    const max = Math.max(...vals, 1);
    const color = this.props.color || 'var(--color-primary-40)';
    const fill = this.props.fillColor || 'var(--color-primary-15)';
    const w = 200, h = 48;
    const step = w / (vals.length - 1);
    const pts = vals.map((v, i) => (i * step) + ',' + (h - (v / max) * h)).join(' ');

    el.innerHTML =
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="48" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<polyline points="0,' + h + ' ' + pts + ' ' + w + ',' + h + '" fill="' + fill + '" stroke="none"/>' +
      '</svg>';
  }
}

// ── TopicsChart ────────────────────────────────────────────────────────────
// Horizontal progress bars. Props: { data: [{label, pct, count}] }

export class TopicsChart extends Component {
  static styles = '/components/charts/Charts.css?v=20260805c';

  render() { return '<div class="ktg-topics-chart"></div>'; }

  afterMount() { this._draw(); }

  _draw() {
    const el = this.el;
    if (!el) return;
    const data = this.props.data || [];
    if (!data.length) { el.innerHTML = '<p class="ktg-chart-empty">No data available.</p>'; return; }

    let html = '';
    for (const d of data) {
      html +=
        '<div class="ktg-topic-row">' +
        '<span class="ktg-topic-row__label">' + d.label + '</span>' +
        '<div class="ktg-topic-row__bar-wrap"><div class="ktg-topic-row__bar" style="width:' + d.pct + '%"></div></div>' +
        '<span class="ktg-topic-row__pct">' + d.pct + '%</span>' +
        '</div>';
    }
    el.innerHTML = html;
  }
}

// ── HeatmapChart ───────────────────────────────────────────────────────────
// LGA engagement grid. Props: { data: [{lgaName, level, score, activeUsers, interactions}] }

export class HeatmapChart extends Component {
  static styles = '/components/charts/Charts.css?v=20260805c';

  render() { return '<div class="ktg-heatmap-chart"></div>'; }

  afterMount() { this._draw(); }

  _draw() {
    const el = this.el;
    if (!el) return;
    const data = this.props.data || [];
    if (!data.length) { el.innerHTML = '<p class="ktg-chart-empty">No engagement data yet.</p>'; return; }

    let html = '<div class="ktg-heatmap-grid">';
    for (const d of data) {
      const cls = 'ktg-heatmap-card--' + (d.level || 'low').toLowerCase();
      html +=
        '<div class="ktg-heatmap-card ' + cls + '" title="' + d.lgaName + ': ' + (d.activeUsers || 0) + ' active users, ' + (d.interactions || 0) + ' interactions">' +
        '<p class="ktg-heatmap-card__name">' + d.lgaName + '</p>' +
        '<p class="ktg-heatmap-card__level">' + (d.level || 'Low') + '</p>' +
        '</div>';
    }
    html += '</div>';
    html +=
      '<div class="ktg-heatmap-legend">' +
      '<span class="ktg-heatmap-legend__item ktg-heatmap-legend--high">High</span>' +
      '<span class="ktg-heatmap-legend__item ktg-heatmap-legend--med">Med</span>' +
      '<span class="ktg-heatmap-legend__item ktg-heatmap-legend--low">Low</span>' +
      '</div>';

    el.innerHTML = html;
  }
}

// ── TrendCard ──────────────────────────────────────────────────────────────
// KPI card. Props: { label, value, trend, trendLabel, trendUp }

export class TrendCard extends Component {
  static styles = '/components/charts/Charts.css?v=20260805c';

  render() { return '<div class="ktg-trend-card"></div>'; }

  afterMount() { this._draw(); }

  _draw() {
    const el = this.el;
    if (!el) return;
    const { label, value, trend, trendLabel, trendUp } = this.props;
    const trendColor = trendUp ? 'var(--color-success)' : 'var(--color-error)';
    const arrow = trendUp ? '↑' : '↓';

    el.innerHTML =
      '<p class="ktg-trend-card__label">' + (label || '') + '</p>' +
      '<p class="ktg-trend-card__value">' + (value || '—') + '</p>' +
      (trend != null
        ? '<p class="ktg-trend-card__trend" style="color:' + trendColor + '">' +
        arrow + (trend > 0 ? '+' : '') + trend + '% ' +
        '<span>' + (trendLabel || '') + '</span>' +
        '</p>'
        : '');
  }
}