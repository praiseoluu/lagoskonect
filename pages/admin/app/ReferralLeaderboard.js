/**
 * LagKonnect Admin - Referral Contest Leaderboard
 * ============================================================
 * Route:  /admin/referrals
 * Guard:  requireAdmin
 *
 * Displays a ranked leaderboard of users with the most referrals,
 * filterable by region. Stat cards show platform-wide referral health.
 *
 * @module  ReferralLeaderboard
 * @version 1.0.0
 */

import { AdminLayout }                      from '../../../components/layout/BaseLayout.js?v=20260806b';
import { Modal }                             from '../../../components/base/Modal.js?v=20260806b';
import { store, setPageLoading, showToast } from '../../../core/store.js?v=20260806b';
import { api }                              from '../../../api/client.js?v=20260806b';
import { timeAgo }                          from '../../../utils/date.js?v=20260806b';

/* ── Medal SVGs for top-3 positions ─────────────────────────────────────── */
const MEDAL = {
  1: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#F5C400" stroke-width="1.5"/><text x="12" y="17" text-anchor="middle" font-size="11" font-weight="700" fill="#7A5C00">1</text></svg>`,
  2: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#C0C0C0" stroke="#A8A8A8" stroke-width="1.5"/><text x="12" y="17" text-anchor="middle" font-size="11" font-weight="700" fill="#444">2</text></svg>`,
  3: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#CD7F32" stroke="#B56C28" stroke-width="1.5"/><text x="12" y="17" text-anchor="middle" font-size="11" font-weight="700" fill="#5C2F0A">3</text></svg>`,
};

const ICON_USERS  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`;
const ICON_LINK   = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`;
const ICON_TREND  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const ICON_CHECK  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const REGION_LABELS = { west: 'Lagos West', central: 'Lagos Central', east: 'Lagos East', all: 'All Regions' };
const REGION_TABS   = ['all', 'west', 'central', 'east'];

function fmt(n) {
  const num = n ?? 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export default class ReferralLeaderboardPage extends AdminLayout {
  static styles = '/pages/admin/app/ReferralLeaderboard.css?v=20260806b';

  constructor(props) {
    super({
      title: 'Referral Contest',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Referral Contest' },
      ],
      ...props,
    });

    this._stats       = null;
    this._leaderboard = [];
    this._page        = 1;
    this._totalPages  = 1;
    this._loading     = false;
    this._region      = sessionStorage.getItem('adminRegion') || 'west';
    this._filterRegion = 'all';   // page-level region filter (overrides sidebar for this view)
    this._search       = '';
    this._detailModal  = null;
    this._detailPage   = 1;
    this._detailUserName = '';
  }

  getContent() {
    return `<div id="rl-root" class="rl-page"></div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderShell();
    await this._loadData();
    setPageLoading(false);

    // Reload when admin switches region
    this.subscribe(store, 'adminRegion', () => {
      this._region = sessionStorage.getItem('adminRegion') || 'west';
      this._page   = 1;
      this._reload();
    });
  }

  /* ── Shell ────────────────────────────────────────────────────────────── */

  _renderShell() {
    const root = document.getElementById('rl-root');
    if (!root) return;

    root.innerHTML = `
      <div class="ktg-page-header">
        <div class="ktg-page-header__text">
          <p class="ktg-page-header__eyebrow">Referral Programme</p>
          <h1 class="ktg-page-header__title">Referral Contest Leaderboard</h1>
          <p class="ktg-page-header__subtitle">
            Top citizens driving platform growth through referrals
          </p>
        </div>
      </div>

      <!-- Stats row -->
      <div class="rl-stats-row" id="rl-stats">
        ${[1,2,3,4].map(() => `<div class="rl-stat-card rl-stat-card--skeleton"></div>`).join('')}
      </div>

      <!-- Top 3 podium -->
      <div class="rl-podium" id="rl-podium" aria-hidden="true"></div>

      <!-- Leaderboard card -->
      <div class="rl-card">
        <div class="rl-card__header">
          <h2 class="rl-card__title">All Referrers</h2>
          <div class="rl-card__actions">
            <div class="rl-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="rl-search" class="rl-search-input" placeholder="Search by name…" autocomplete="off" />
            </div>
            <div class="rl-region-tabs" id="rl-region-tabs" role="tablist" aria-label="Filter by region">
              ${REGION_TABS.map(r => `
                <button class="rl-region-tab${r === this._filterRegion ? ' rl-region-tab--active' : ''}"
                        data-region="${r}" role="tab"
                        aria-selected="${r === this._filterRegion}">
                  ${REGION_LABELS[r]}
                </button>
              `).join('')}
            </div>
            <button class="ktg-btn ktg-btn--ghost ktg-btn--sm rl-export-btn" id="rl-export-btn" type="button" title="Export CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <span class="rl-card__sub" id="rl-updated"></span>
          </div>
        </div>
        <div id="rl-table-wrap">
          <div class="rl-loading">Loading leaderboard…</div>
        </div>
        <div class="rl-pagination" id="rl-pagination"></div>
       </div>

       <!-- Detail modal -->
       <div id="rl-detail-mount"></div>
     `;

    // Detail modal
      this._detailModal = this.addChild(new Modal({
        title: 'User Detail',
        size: 'lg',
        body: '<div id="rl-detail-content"><p class="rl-loading">Loading…</p></div>',
        footer: '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Close</button>',
      }));
     this._detailModal.mount(document.body, { append: true });
   }

  /* ── Data ─────────────────────────────────────────────────────────────── */

  async _loadData() {
    const region = this._filterRegion;
    const [statsRes, lbRes] = await Promise.all([
      api.referrals.adminStats({ region }),
      api.referrals.adminLeaderboard({ region, page: this._page, perPage: 20 }),
    ]);

    this._stats       = statsRes.data ?? null;
    this._leaderboard = lbRes.data?.entries ?? lbRes.data ?? [];
    this._totalPages  = lbRes.meta?.totalPages ?? 1;

    this._renderStats();
    this._renderPodium();
    this._renderTable();
    this._renderPagination();
    this._bindEvents();
  }

  async _reload() {
    setPageLoading(true);
    await this._loadData();
    setPageLoading(false);
  }

  /* ── Stats cards ──────────────────────────────────────────────────────── */

  _renderStats() {
    const container = document.getElementById('rl-stats');
    if (!container) return;

    const s = this._stats || {};
    const cards = [
      { label: 'Total Referrals',     value: fmt(s.totalReferrals ?? 0),           icon: ICON_LINK,  color: 'primary'  },
      { label: 'Active Referrers',    value: fmt(s.activeReferrers ?? 0),          icon: ICON_USERS, color: 'success'  },
      { label: 'Converted (30 days)', value: fmt(s.convertedThisMonth ?? 0),       icon: ICON_CHECK, color: 'info'     },
      { label: 'Growth Rate',         value: `${(s.growthRate ?? 0).toFixed(1)}%`, icon: ICON_TREND, color: 'warning'  },
    ];

    container.innerHTML = cards.map(c => `
      <div class="rl-stat-card">
        <div class="rl-stat-card__top">
          <span class="rl-stat-card__label">${c.label}</span>
          <span class="rl-stat-card__icon rl-stat-card__icon--${c.color}" aria-hidden="true">${c.icon}</span>
        </div>
        <p class="rl-stat-card__value">${c.value}</p>
      </div>
    `).join('');
  }

  /* ── Top-3 Podium ─────────────────────────────────────────────────────── */

  _renderPodium() {
    const el = document.getElementById('rl-podium');
    if (!el) return;

    const top3 = this._leaderboard.slice(0, 3);
    if (!top3.length) { el.hidden = true; return; }
    el.hidden = false;

    // Reorder to podium layout: 2nd | 1st | 3rd
    const order  = [top3[1], top3[0], top3[2]].filter(Boolean);
    const heights = { 0: '90px', 1: '120px', 2: '72px' }; // 2nd, 1st, 3rd

    el.innerHTML = order.map((entry, i) => {
      const realRank = order.indexOf(entry) === 1 ? 1 : order.indexOf(entry) === 0 ? 2 : 3;
      // figure out actual rank
      const rank = this._leaderboard.indexOf(entry) + 1;
      const initl = initials(entry.name ?? '?');
      const avatar = entry.avatarUrl
        ? `<img src="${this.esc(entry.avatarUrl)}" alt="" class="rl-podium__avatar" loading="lazy" />`
        : `<span class="rl-podium__avatar rl-podium__avatar--initials">${initl}</span>`;
      const podiumClass = rank === 1 ? 'rl-podium__place--gold'
                        : rank === 2 ? 'rl-podium__place--silver'
                        : 'rl-podium__place--bronze';

      return `
        <div class="rl-podium__place ${podiumClass}" style="--podium-h:${heights[i]}">
          ${MEDAL[rank] ?? ''}
          ${avatar}
          <p class="rl-podium__name">${this.esc(entry.name ?? '—')}</p>
          <p class="rl-podium__count">${fmt(entry.referrals ?? 0)} referrals</p>
          <div class="rl-podium__block" style="height:${heights[i]}">
            <span class="rl-podium__block-rank">#${rank}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ── Leaderboard table ────────────────────────────────────────────────── */

  _visibleRows() {
    const q = this._search.toLowerCase();
    return q
      ? this._leaderboard.filter(e => (e.name ?? '').toLowerCase().includes(q))
      : this._leaderboard;
  }

  _renderTable() {
    const wrap = document.getElementById('rl-table-wrap');
    const upd  = document.getElementById('rl-updated');
    if (!wrap) return;

    if (upd) upd.textContent = `Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    const rows = this._visibleRows();

    if (!rows.length) {
      wrap.innerHTML = `
        <div class="rl-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity:.35;margin-bottom:12px"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          <p>${this._search ? `No results for "<strong>${this.esc(this._search)}</strong>"` : 'No referral data yet for this region.'}</p>
          <span>${this._search ? 'Try a different name.' : 'Data appears here once users start inviting others.'}</span>
        </div>
      `;
      return;
    }

    const offset = (this._page - 1) * 20;

    wrap.innerHTML = `
      <table class="rl-table" aria-label="Referral leaderboard">
        <thead>
          <tr>
            <th class="rl-table__rank">#</th>
            <th>Citizen</th>
            <th>LGA</th>
            <th>Region</th>
            <th class="rl-table__num">Referrals</th>
            <th class="rl-table__num">Converted</th>
            <th class="rl-table__num">Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((entry, i) => {
            const rank        = offset + i + 1;
            const medal       = MEDAL[rank] ?? `<span class="rl-rank-num">${rank}</span>`;
            const initl       = initials(entry.name ?? entry.userName ?? '?');
            const avatar      = entry.avatarUrl
              ? `<img src="${this.esc(entry.avatarUrl)}" alt="" class="rl-avatar" loading="lazy" />`
              : `<span class="rl-avatar rl-avatar--initials" aria-hidden="true">${initl}</span>`;
            const rate        = entry.referrals > 0
              ? Math.round((entry.converted ?? 0) / entry.referrals * 100)
              : 0;
            const regionKey   = entry.region ?? 'west';
            const regionBadge = `<span class="rl-region-badge rl-region-badge--${regionKey}">${REGION_LABELS[regionKey] ?? regionKey}</span>`;

             return `
               <tr class="rl-table__row${rank <= 3 ? ' rl-table__row--top' : ''}"
                   data-user-id="${entry.userId}"
                   data-user-name="${this.esc(entry.name ?? entry.userName ?? '')}"
                   role="button"
                   tabindex="0"
                   aria-label="View referrals for ${this.esc(entry.name ?? entry.userName ?? '')}">
                 <td class="rl-table__rank" aria-label="Rank ${rank}">${medal}</td>
                 <td>
                   <div class="rl-user-cell">
                     ${avatar}
                     <div class="rl-user-cell__info">
                       <span class="rl-user-cell__name">${this.esc(entry.name ?? entry.userName ?? '—')}</span>
                       <span class="rl-user-cell__handle">${entry.handle ? this.esc(entry.handle) : ''}</span>
                     </div>
                   </div>
                 </td>
                 <td>${this.esc(entry.lgaName ?? '—')}</td>
                 <td>${regionBadge}</td>
                 <td class="rl-table__num rl-table__num--strong">${fmt(entry.referrals ?? 0)}</td>
                 <td class="rl-table__num">${fmt(entry.converted ?? 0)}</td>
                 <td class="rl-table__num">
                   <span class="rl-rate-badge rl-rate-badge--${rate >= 50 ? 'good' : rate >= 25 ? 'mid' : 'low'}">
                     ${rate}%
                   </span>
                 </td>
               </tr>
             `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  /* ── Pagination ───────────────────────────────────────────────────────── */

  _renderPagination() {
    const el = document.getElementById('rl-pagination');
    if (!el || this._totalPages <= 1) { if (el) el.innerHTML = ''; return; }

    el.innerHTML = `
      <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" id="rl-prev-btn"
              ${this._page <= 1 ? 'disabled' : ''}>← Prev</button>
      <span class="rl-page-info">Page ${this._page} of ${this._totalPages}</span>
      <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" id="rl-next-btn"
              ${this._page >= this._totalPages ? 'disabled' : ''}>Next →</button>
    `;
  }

  /* ── CSV Export ───────────────────────────────────────────────────────── */

  _exportCSV() {
    const rows = this._visibleRows();
    if (!rows.length) return;

    const header = ['Rank', 'Name', 'Handle', 'LGA', 'Region', 'Referrals', 'Converted', 'Rate %'];
    const offset = (this._page - 1) * 20;
    const lines  = rows.map((e, i) => {
      const rank = offset + i + 1;
      const rate = e.referrals > 0 ? Math.round((e.converted ?? 0) / e.referrals * 100) : 0;
      return [rank, e.name ?? '', e.handle ?? '', e.lgaName ?? '', REGION_LABELS[e.region] ?? e.region ?? '', e.referrals ?? 0, e.converted ?? 0, rate].join(',');
    });

    const csv  = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `referral-leaderboard-${this._filterRegion}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ── Events ───────────────────────────────────────────────────────────── */

   _bindEvents() {
     // Pagination
     const prev = document.getElementById('rl-prev-btn');
     const next = document.getElementById('rl-next-btn');
     if (prev) this.on(prev, 'click', () => { if (this._page > 1) { this._page--; this._reload(); } });
     if (next) this.on(next, 'click', () => { if (this._page < this._totalPages) { this._page++; this._reload(); } });

     // Region tabs
     const tabs = document.getElementById('rl-region-tabs');
     if (tabs) {
       this.on(tabs, 'click', (e) => {
         const btn = e.target.closest('[data-region]');
         if (!btn) return;
         this._filterRegion = btn.dataset.region;
         this._page = 1;
         this._search = '';
         const searchEl = document.getElementById('rl-search');
         if (searchEl) searchEl.value = '';
         // Update active tab visuals
         tabs.querySelectorAll('.rl-region-tab').forEach(t => {
           t.classList.toggle('rl-region-tab--active', t.dataset.region === this._filterRegion);
           t.setAttribute('aria-selected', t.dataset.region === this._filterRegion);
         });
         this._reload();
       });
     }

     // Search
     const searchEl = document.getElementById('rl-search');
     let searchTimer;
     if (searchEl) {
       this.on(searchEl, 'input', () => {
         clearTimeout(searchTimer);
         searchTimer = setTimeout(() => {
           this._search = searchEl.value.trim();
           this._renderTable();
           this._renderPagination();
         }, 200);
       });
     }

     // Export
     const exportBtn = document.getElementById('rl-export-btn');
     if (exportBtn) this.on(exportBtn, 'click', () => this._exportCSV());

     // Drill-down: click on a user row to see their referred users
     const tableWrap = document.getElementById('rl-table-wrap');
     if (tableWrap) {
       this.on(tableWrap, 'click', (e) => {
         const row = e.target.closest('[data-user-id]');
         if (!row) return;
         const userId = parseInt(row.dataset.userId, 10);
         const userName = row.dataset.userName;
         this._showUserReferrals(userId, userName);
       });
       // Keyboard accessibility
       this.on(tableWrap, 'keydown', (e) => {
         if (e.key !== 'Enter' && e.key !== ' ') return;
         const row = e.target.closest('[data-user-id]');
         if (!row) return;
         e.preventDefault();
         const userId = parseInt(row.dataset.userId, 10);
         const userName = row.dataset.userName;
         this._showUserReferrals(userId, userName);
       });
     }
   }

    /* ── Drill-down: show full user profile + referrals ────────── */

    async _showUserReferrals(userId, userName) {
      this._detailPage = 1;
      this._detailUserName = userName;

      const contentEl = document.getElementById('rl-detail-content');
      if (!contentEl) return;

      this._detailModal.setTitle(`User Detail — ${this.esc(userName)}`);
      contentEl.innerHTML = '<div class="rl-loading">Loading user details…</div>';
      this._detailModal.open();

      try {
        const res = await api.referrals.adminGetUserReferrals(userId, { page: this._detailPage ?? 1, perPage: 20 });
        if (res.error) {
          contentEl.innerHTML = `<p class="rl-empty">Failed to load user details.</p>`;
          return;
        }

        const data    = res.data;
        const user    = data.user ?? {};
        const activity = data.activity ?? {};
        const entries = data.entries ?? [];
        const meta    = res.meta ?? {};
        const total   = meta.total ?? 0;
        const totalPages = meta.totalPages ?? 1;
        const page    = this._detailPage ?? 1;

        contentEl.innerHTML = this._renderUserDetail(user, activity, entries, total, totalPages, page, userName);

        this._bindDetailEvents(userId, userName, page, totalPages);
      } catch {
        contentEl.innerHTML = `<p class="rl-empty">Error loading user details.</p>`;
      }
    }

    _renderUserDetail(user, activity, entries, total, totalPages, page, fallbackName) {
      const avatar = user.avatarUrl
        ? `<img src="${this.esc(user.avatarUrl)}" alt="${this.esc(user.name || '')}" class="rl-profile__avatar" />`
        : `<span class="rl-profile__avatar rl-profile__avatar--initials">${initials(user.name || fallbackName || '?')}</span>`;

      const verifiedBadge = user.isVerified
        ? `<span class="rl-detail-badge rl-detail-badge--verified"><span class="rl-check-icon"></span> Verified</span>`
        : `<span class="rl-detail-badge rl-detail-badge--unverified">Unverified</span>`;

      const statusBadge = user.status === 'active'
        ? `<span class="rl-detail-badge rl-detail-badge--active">${user.status}</span>`
        : `<span class="rl-detail-badge rl-detail-badge--inactive">${user.status || 'inactive'}</span>`;

      const activityItems = [
        { label: 'Page Views',     value: fmt(activity.pageViews ?? 0),     icon: ICON_TREND },
        { label: 'News Posts',      value: fmt(activity.newsPosts ?? 0),     icon: ICON_USERS  },
        { label: 'Reels',           value: fmt(activity.reels ?? 0),         icon: ICON_USERS  },
        { label: 'Chat Messages',   value: fmt(activity.chatMessages ?? 0), icon: ICON_USERS  },
        { label: 'Referrals',       value: fmt(activity.referralCount ?? 0),  icon: ICON_LINK  },
      ];

      let rowsHtml = '';
      if (entries.length) {
        rowsHtml = entries.map(e => {
          const confirmed = e.status === 'confirmed';
          const eAvatar = e.avatarUrl
            ? `<img src="${this.esc(e.avatarUrl)}" alt="${this.esc(e.name || '')}" class="rl-referred__avatar" />`
            : `<span class="rl-referred__avatar rl-referred__avatar--initials">${initials(e.name || '?')}</span>`;

          return `
            <tr>
              <td class="rl-referred__cell">
                ${eAvatar}
                <span class="rl-referred__name">${this.esc(e.name || '—')}</span>
              </td>
              <td class="rl-referred__cell"><span class="rl-referred__handle">@${this.esc(e.username || '')}</span></td>
              <td class="rl-referred__date">${timeAgo(e.joinedAt)}</td>
              <td><span class="rl-detail-status rl-detail-status--${confirmed ? 'confirmed' : 'pending'}">${confirmed ? 'Confirmed' : 'Pending'}</span></td>
            </tr>
          `;
        }).join('');
      } else {
        rowsHtml = `
          <tr><td colspan="4" class="rl-empty-row">
            <div class="rl-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                   style="opacity:.35;margin-bottom:8px"><circle cx="9" cy="7" r="4"/>
                   <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/></svg>
              <p>No referrals yet for this user.</p>
              <span>Referred users will appear here once they sign up.</span>
            </div>
          </td></tr>
        `;
      }

      const pager = totalPages > 1
        ? `<div class="rl-detail-pagination">
             <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" ${page <= 1 ? 'disabled' : ''} data-action="prev">← Prev</button>
             <span class="rl-page-info">Page ${page} of ${totalPages}</span>
             <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" ${page >= totalPages ? 'disabled' : ''} data-action="next">Next →</button>
           </div>`
        : '';

      return `
        <!-- Profile header -->
        <div class="rl-profile-header">
          ${avatar}
          <div class="rl-profile__info">
            <h3 class="rl-profile__name">${this.esc(user.name || fallbackName || '—')}</h3>
            <p class="rl-profile__handle">@${this.esc(user.username || '')}</p>
            <div class="rl-profile__badges">
              ${verifiedBadge}
              ${statusBadge}
            </div>
          </div>
          <div class="rl-profile__score">
            <span class="rl-score__value">${activity.activityScore ?? 0}</span>
            <span class="rl-score__label">Activity Score</span>
            <span class="rl-score__period">last ${activity.periodDays ?? 30} days</span>
          </div>
        </div>

        <!-- Contact + profile fields -->
        <div class="rl-profile-grid">
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">Email</span>
            <span class="rl-profile__field-value">${this.esc(user.email || '—')}</span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">Referral Code</span>
            <span class="rl-profile__field-value rl-profile__code">${this.esc(user.referralCode || '—')}</span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">LGA</span>
            <span class="rl-profile__field-value">${this.esc(user.lgaName || '—')}</span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">Region</span>
            <span class="rl-profile__field-value">
              <span class="rl-region-badge rl-region-badge--${user.region || 'west'}">${REGION_LABELS[user.region || 'west'] || user.region || '—'}</span>
            </span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">City / State</span>
            <span class="rl-profile__field-value">${this.esc(user.city || '—')} / ${this.esc(user.state || '—')}</span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">Member Since</span>
            <span class="rl-profile__field-value">${this.esc(user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—')}</span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">Total Referrals</span>
            <span class="rl-profile__field-value rl-profile__referral-count">${fmt(total)} ${user.referralCount && user.referralCount !== total ? `<span class="rl-profile__sub">(user card: ${fmt(user.referralCount)})</span>` : ''}</span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">Last Seen</span>
            <span class="rl-profile__field-value">${this.esc(user.lastSeenAt || '—')}</span>
          </div>
          <div class="rl-profile__field">
            <span class="rl-profile__field-label">Referred By</span>
            <span class="rl-profile__field-value">
              ${user.referredBy
                ? `<span class="rl-referred-by" data-ref-id="${user.referredBy}">${user.referredByName ? this.esc(user.referredByName) : '#' + user.referredBy}${user.referredByUsername ? ' (@' + this.esc(user.referredByUsername) + ')' : ''}</span>`
                : 'Direct sign-up'}
            </span>
          </div>
        </div>

        <!-- Activity metrics -->
        <div class="rl-section">
          <h4 class="rl-section__title">30-Day Activity</h4>
          <div class="rl-activity-grid">
            ${activityItems.map(a => `
              <div class="rl-activity-item">
                <span class="rl-activity__icon" aria-hidden="true">${a.icon}</span>
                <span class="rl-activity__value">${a.value}</span>
                <span class="rl-activity__label">${a.label}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Referred users table -->
        <div class="rl-section">
          <h4 class="rl-section__title">Referred Users (${total})</h4>
          <div class="rl-detail-table-wrap">
            <table class="rl-detail-table" aria-label="Referred users">
              <thead><tr>
                <th>User</th>
                <th>Username</th>
                <th>Joined</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          ${pager}
        </div>
      `;
    }

    _bindDetailEvents(userId, userName, page, totalPages) {
      const contentEl = document.getElementById('rl-detail-content');
      if (!contentEl) return;

      if (this._boundDetailHandler) {
        this.off(contentEl, 'click', this._boundDetailHandler);
      }

      this._boundDetailHandler = (e) => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
          const action = btn.dataset.action;
          if (action === 'prev' && page > 1) {
            this._detailPage = page - 1;
            this._showUserReferrals(userId, userName);
          } else if (action === 'next' && page < totalPages) {
            this._detailPage = page + 1;
            this._showUserReferrals(userId, userName);
          }
          return;
        }

        const refLink = e.target.closest('[data-ref-id]');
        if (refLink) {
          const refId = parseInt(refLink.dataset.refId, 10);
          if (refId > 0) {
            const refName = refLink.textContent.replace(/\s*\(@[^)]+\)$/, '').trim() || ('#' + refId);
            this._detailPage = 1;
            this._showUserReferrals(refId, refName);
          }
        }
      };

      this.on(contentEl, 'click', this._boundDetailHandler);
    }
}
