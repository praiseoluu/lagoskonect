/**
 * LagKonnect — Analytics API
 * Dashboard + Analytics page endpoints.
 */
import { _fetch, BASE_URL } from './_fetch.js?v=20260807a';

export const analytics = {

  // ── Dashboard ─────────────────────────────────────────────────────────

  async getMetrics(region) {
    const qs = region ? '?region=' + encodeURIComponent(region) : '';
    return await _fetch('GET', '/admin/analytics/metrics' + qs);
  },

  async getInsights(range, region) {
    const p = new URLSearchParams();
    if (range) p.set('range', range);
    if (region) p.set('region', region);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/analytics/insights' + qs);
  },

  async getTopLGAs(region) {
    const qs = region ? '?region=' + encodeURIComponent(region) : '';
    return await _fetch('GET', '/admin/analytics/top-lgas' + qs);
  },

  async getFlagged(region) {
    const qs = region ? '?region=' + encodeURIComponent(region) : '';
    return await _fetch('GET', '/admin/analytics/flagged' + qs);
  },

  async getUsersBreakdown() {
    return await _fetch('GET', '/admin/analytics/users-by-region');
  },

  async dismissReport(reportId) {
    return await _fetch('PATCH', '/admin/analytics/flagged/' + reportId);
  },

  // ── Analytics page ────────────────────────────────────────────────────

  async getOverview(region, range) {
    const p = new URLSearchParams();
    if (region) p.set('region', region);
    if (range) p.set('range', range);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/analytics/overview' + qs);
  },

  async getWeekly(region, range) {
    const p = new URLSearchParams();
    if (region) p.set('region', region);
    if (range) p.set('range', range);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/analytics/weekly' + qs);
  },

  async getTopics(region, range) {
    const p = new URLSearchParams();
    if (region) p.set('region', region);
    if (range) p.set('range', range);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/analytics/topics' + qs);
  },

   async getLgaHeatmap(region, range) {
     const p = new URLSearchParams();
     if (region) p.set('region', region);
     if (range) p.set('range', range);
     const qs = p.toString() ? '?' + p : '';
     return await _fetch('GET', '/admin/analytics/lga-heatmap' + qs);
   },

   async getTopActiveUsers(region, range) {
     const p = new URLSearchParams();
     if (region) p.set('region', region);
     if (range) p.set('range', range);
     const qs = p.toString() ? '?' + p : '';
     return await _fetch('GET', '/admin/analytics/top-active-users' + qs);
   },

   async recordPageview(page, lgaId, userId) {
    return await _fetch('POST', '/data/visit', {
      page: page,
      lgaId: lgaId || null,
      userId: userId || null,
    });
  },


  // ── Traffic ───────────────────────────────────────────────────────────

  async getTrafficMetrics(from, to, lgaId) {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (lgaId) p.set('lgaId', lgaId);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/traffic/metrics' + qs);
  },

  async getTrafficDaily(from, to, lgaId) {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (lgaId) p.set('lgaId', lgaId);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/traffic/daily' + qs);
  },

  async getTrafficLogs(from, to, lgaId, page, perPage) {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (lgaId) p.set('lgaId', lgaId);
    if (page) p.set('page', page);
    if (perPage) p.set('perPage', perPage);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/traffic/logs' + qs);
  },

  async getTrafficTopLgas(from, to) {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const qs = p.toString() ? '?' + p : '';
    return await _fetch('GET', '/admin/traffic/top-lgas' + qs);
  },

  async exportReport(format) {
    try {
      const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
      const token = auth ? (auth.token || '') : '';
      const url = BASE_URL + '/admin/analytics/export?format=' + encodeURIComponent(format || 'csv')
        + '&token=' + encodeURIComponent(token);

      if (format === 'pdf') {
        const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) return { error: { code: 'EXPORT_ERROR', message: 'Export failed.' } };
        const html = await res.text();

        const d = new Date();
        const stamp = d.getFullYear() + '-'
          + String(d.getMonth() + 1).padStart(2, '0') + '-'
          + String(d.getDate()).padStart(2, '0');
        const filename = 'LagKonnect_Analytics_' + stamp;

        // Chrome uses document.title for PDF filename when printing.
        // Inject title tag to ensure it's set before print dialog opens.
        const titled = html.replace(/<title>[^<]*<\/title>/, '<title>' + filename + '</title>');

        const blob = new Blob([titled], { type: 'text/html; charset=utf-8' });
        const objUrl = URL.createObjectURL(blob);
        const tab = window.open(objUrl, '_blank');
        if (tab) {
          let printed = false;
          const doPrint = () => {
            if (printed) return;
            printed = true;
            try {
              tab.document.title = filename;
              tab.focus();
              tab.print();
            } catch (e) { }
          };
          tab.onload = doPrint;
          setTimeout(doPrint, 800);
        }
        setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
        return { data: { opened: true } };
      }

      // CSV — fetch as blob and download
      const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) return { error: { code: 'EXPORT_ERROR', message: 'Export failed.' } };
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = 'analytics_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.style.position = 'fixed';
      a.style.opacity = '0';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(objUrl); }, 1000);
      return { data: { downloaded: true } };
    } catch (e) {
      return { error: { code: 'EXPORT_ERROR', message: 'Export failed.' } };
    }
  },
};