/**
 * LagKonnect Admin — Top Active Users
 * ============================================================
 * Route:  /admin/active-users
 * Guard:  requireAdmin
 *
 * Displays the most active citizens on the platform,
 * ranked by a composite activity score (page views,
 * posts, reels, chat messages, and referrals).
 *
 * @module  ActiveUsersPage
 * @version 1.0.0
 */

import { AdminLayout }                      from '../../../components/layout/BaseLayout.js?v=20260806e';
import { store, setPageLoading, showToast } from '../../../core/store.js?v=20260806e';
import { api }                              from '../../../api/client.js?v=20260806e';

const ICON_ACTIVITY = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
const ICON_STAR     = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const ICON_CHAT     = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
const ICON_REEL     = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
const ICON_NEWS     = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 19.5v-11A2.5 2.5 0 016.5 6h12"/><line x1="8" y1="6" x2="16" y2="6"/></svg>`;
const ICON_LINK     = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`;

const REGION_LABELS = { west: 'Lagos West', central: 'Lagos Central', east: 'Lagos East', all: 'All Regions' };
const REGION_TABS   = ['all', 'west', 'central', 'east'];

const RANGE_OPTIONS = [
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days', selected: true },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 12 months' },
];

function fmt(n) {
  const num = n ?? 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export default class ActiveUsersPage extends AdminLayout {
  static styles = '/pages/admin/app/ActiveUsers.css?v=20260806e';

  constructor(props) {
    super({
      title: 'Top Active Users',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Active Users' },
      ],
      ...props,
    });

    this._data       = null;
    this._leaderboard = [];
    this._page       = 1;
    this._totalPages = 1;
    this._loading    = false;
    this._region     = sessionStorage.getItem('adminRegion') || 'west';
    this._filterRegion = 'all';
    this._range      = '30d';
    this._search     = '';
  }

  getContent() {
    return `<div id="au-root" class="au-page"></div>`;
  }

  /* ── Scoring guide (static HTML, no data needed) ─────────────────── */

  _scoringGuideHtml() {
    return `
      <details class="au-scoring-guide" id="au-scoring-guide">
        <summary class="au-scoring-guide__summary">
          ${ICON_ACTIVITY}
          <span>How is the activity score calculated?</span>
          <svg class="au-scoring-guide__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div class="au-scoring-guide__body">
          <p class="au-scoring-guide__intro">
            Every action is worth points — but harder actions are worth more.
            A citizen who films a reel or writes a news post contributes far more
            effort than one who passively browses, so the weights reflect that.
          </p>

          <table class="au-scoring-guide__table" aria-label="Scoring weights">
            <thead>
              <tr>
                <th>Action</th>
                <th>Points each</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${ICON_ACTIVITY}<span>Page view</span></td>
                <td class="au-scoring-guide__pts">×&thinsp;1</td>
                <td>Passive browsing — no real effort required</td>
              </tr>
              <tr>
                <td>${ICON_CHAT}<span>Chat message</span></td>
                <td class="au-scoring-guide__pts">×&thinsp;3</td>
                <td>Takes deliberate engagement with the community</td>
              </tr>
              <tr>
                <td>${ICON_NEWS}<span>News post</span></td>
                <td class="au-scoring-guide__pts">×&thinsp;10</td>
                <td>Written content creation takes time and thought</td>
              </tr>
              <tr>
                <td>${ICON_REEL}<span>Reel uploaded</span></td>
                <td class="au-scoring-guide__pts">×&thinsp;15</td>
                <td>Video production — the highest-effort citizen contribution</td>
              </tr>
              <tr>
                <td>${ICON_LINK}<span>Direct referral</span></td>
                <td class="au-scoring-guide__pts">×&thinsp;20</td>
                <td>Bringing a real person to the platform is uniquely valuable</td>
              </tr>
            </tbody>
          </table>

          <div class="au-scoring-guide__bonus">
            <strong>Referral network bonus</strong>
            <p>
              Referrers don't just earn points for signing people up — they also earn
              <strong>+20% of each referred user's own score</strong> during the same period.
              This rewards citizens whose recruits actually stay active on the platform,
              not just those who get people to register and disappear.
            </p>
            <p class="au-scoring-guide__formula">
              <code>Total score = own score + Σ(referred users' own scores) × 0.20</code>
            </p>
            <p>
              The "Bonus" column in the table below shows the network bonus portion
              separately so you can see who has built a genuinely active referral network.
            </p>
          </div>
        </div>
      </details>
    `;
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderShell();
    await this._loadData();
    setPageLoading(false);

    this.subscribe(store, 'adminRegion', () => {
      this._region = sessionStorage.getItem('adminRegion') || 'west';
      this._page   = 1;
      this._reload();
    });
  }

  /* ── Shell ────────────────────────────────────────────────────── */

  _renderShell() {
    const root = document.getElementById('au-root');
    if (!root) return;

    root.innerHTML = `
      <div class="ktg-page-header">
        <div class="ktg-page-header__text">
          <p class="ktg-page-header__eyebrow">Platform Analytics</p>
          <h1 class="ktg-page-header__title">Top Active Users</h1>
          <p class="ktg-page-header__subtitle">
            Most engaged citizens ranked by an effort-weighted activity score — views ×1 · chat ×3 · news ×10 · reels ×15 · referrals ×20, plus a 20% referral network bonus
          </p>
        </div>
      </div>

      ${this._scoringGuideHtml()}

      <!-- Stats row -->
      <div class="au-stats-row" id="au-stats">
        ${[1,2,3,4].map(() => `<div class="au-stat-card au-stat-card--skeleton"></div>`).join('')}
      </div>

      <!-- Top-3 Podium -->
      <div class="au-podium" id="au-podium" aria-hidden="true"></div>

      <!-- Leaderboard card -->
      <div class="au-card">
        <div class="au-card__header">
          <h2 class="au-card__title">All Active Users</h2>
          <div class="au-card__actions">
            <div class="au-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="au-search" class="au-search-input" placeholder="Search by name…" autocomplete="off" />
            </div>
            <div class="au-region-tabs" id="au-region-tabs" role="tablist" aria-label="Filter by region">
              ${REGION_TABS.map(r => `
                <button class="au-region-tab${r === this._filterRegion ? ' au-region-tab--active' : ''}"
                        data-region="${r}" role="tab"
                        aria-selected="${r === this._filterRegion}">
                  ${REGION_LABELS[r]}
                </button>
              `).join('')}
            </div>
            <label class="au-range-control">Period
              <select id="au-range" aria-label="Activity period">
                ${RANGE_OPTIONS.map(o => `
                  <option value="${o.value}"${o.selected ? ' selected' : ''}>${o.label}</option>
                `).join('')}
              </select>
            </label>
            <span class="au-card__sub" id="au-updated"></span>
          </div>
        </div>
        <div id="au-table-wrap">
          <div class="au-loading">Loading active users…</div>
        </div>
        <div class="au-pagination" id="au-pagination"></div>
      </div>
    `;

    this._bindEvents();
  }

  /* ── Data ─────────────────────────────────────────────────────── */

  async _loadData() {
    const region = this._filterRegion;
    const [statsRes, lbRes] = await Promise.all([
      api.analytics.getTopActiveUsers(region, this._range),
      api.analytics.getTopActiveUsers(region, this._range),
    ]);

    const data = statsRes.data ?? { top3: [], leaderboard: [] };
    this._leaderboard = lbRes.data?.leaderboard ?? data.leaderboard ?? [];
    this._totalPages  = Math.ceil(this._leaderboard.length / 20);

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

  /* ── Stats cards ──────────────────────────────────────────────── */

  _renderStats() {
    const container = document.getElementById('au-stats');
    if (!container) return;

    const lb = this._leaderboard;
    const totalScore = lb.reduce((s, u) => s + (u.activityScore ?? 0), 0);
    const avgScore   = lb.length > 0 ? Math.round(totalScore / lb.length) : 0;
    const totalPosts = lb.reduce((s, u) => s + (u.newsPosts ?? 0) + (u.reels ?? 0), 0);
    const totalChat  = lb.reduce((s, u) => s + (u.chatMessages ?? 0), 0);

    const cards = [
      { label: 'Top User Score', value: lb.length ? fmt(lb[0].activityScore) : '—', icon: ICON_ACTIVITY, color: 'primary' },
      { label: 'Total Posts',    value: fmt(totalPosts),                        icon: ICON_NEWS,     color: 'success' },
      { label: 'Total Chat',     value: fmt(totalChat),                         icon: ICON_CHAT,     color: 'info'    },
      { label: 'Users Tracked',  value: fmt(lb.length),                         icon: ICON_STAR,     color: 'warning' },
    ];

    container.innerHTML = cards.map(c => `
      <div class="au-stat-card">
        <div class="au-stat-card__top">
          <span class="au-stat-card__label">${c.label}</span>
          <span class="au-stat-card__icon au-stat-card__icon--${c.color}" aria-hidden="true">${c.icon}</span>
        </div>
        <p class="au-stat-card__value">${c.value}</p>
      </div>
    `).join('');
  }

  /* ── Top-3 Podium ─────────────────────────────────────────────── */

  _renderPodium() {
    const el = document.getElementById('au-podium');
    if (!el) return;

    const top3 = this._leaderboard.slice(0, 3);
    if (!top3.length) { el.hidden = true; return; }
    el.hidden = false;

    const order  = [top3[1], top3[0], top3[2]].filter(Boolean);
    const heights = { 0: '90px', 1: '120px', 2: '72px' };

    el.innerHTML = order.map((entry, i) => {
      const rank = this._leaderboard.indexOf(entry) + 1;
      const initl = initials(entry.name ?? '?');
      const avatar = entry.avatarUrl
          ? `<img src="${this.esc(entry.avatarUrl)}" alt="" class="au-podium__avatar" loading="lazy" />`
          : `<span class="au-podium__avatar au-podium__avatar--initials">${initl}</span>`;
      const podiumClass = rank === 1 ? 'au-podium__place--gold'
          : rank === 2 ? 'au-podium__place--silver'
              : 'au-podium__place--bronze';

      return `
        <div class="au-podium__place ${podiumClass}" style="--podium-h:${heights[i]}">
          ${rank === 1 ? ICON_STAR : ''}
          ${avatar}
          <p class="au-podium__name">${this.esc(entry.name ?? '—')}</p>
          <p class="au-podium__count">${fmt(entry.activityScore ?? 0)} pts</p>
          <div class="au-podium__block" style="height:${heights[i]}">
            <span class="au-podium__block-rank">#${rank}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ── Leaderboard table ────────────────────────────────────────── */

  _visibleRows() {
    const q = this._search.toLowerCase();
    return q
        ? this._leaderboard.filter(e => (e.name ?? '').toLowerCase().includes(q))
        : this._leaderboard;
  }

  _renderTable() {
    const wrap = document.getElementById('au-table-wrap');
    const upd  = document.getElementById('au-updated');
    if (!wrap) return;

    if (upd) upd.textContent = `Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    const rows = this._visibleRows();

    if (!rows.length) {
      wrap.innerHTML = `
        <div class="au-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity:.35;margin-bottom:12px"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <p>${this._search ? `No results for "<strong>${this.esc(this._search)}</strong>"` : 'No activity data yet.'}</p>
          <span>${this._search ? 'Try a different name.' : 'Activity will appear here once users start engaging.'}</span>
        </div>
      `;
      return;
    }

    const offset = (this._page - 1) * 20;

    wrap.innerHTML = `
      <table class="au-table" aria-label="Active users leaderboard">
        <thead>
          <tr>
            <th class="au-table__rank">#</th>
            <th>Citizen</th>
            <th>LGA</th>
            <th class="au-table__num" title="Own score + referral network bonus">Total Score</th>
            <th class="au-table__num" title="Page views ×1">Views</th>
            <th class="au-table__num" title="Chat messages ×3">Chat</th>
            <th class="au-table__num" title="News posts ×10">Posts</th>
            <th class="au-table__num" title="Reels ×15">Reels</th>
            <th class="au-table__num" title="Direct referrals ×20">Refs</th>
            <th class="au-table__num" title="+20% of referred users' own scores">Bonus</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((entry, i) => {
      const rank = offset + i + 1;
      const medal = rank <= 3
          ? `<span class="au-table__medal au-table__medal--${rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'}">#${rank}</span>`
          : `<span class="au-rank-num">${rank}</span>`;
      const initl = initials(entry.name ?? entry.username ?? '?');
      const avatar = entry.avatarUrl
          ? `<img src="${this.esc(entry.avatarUrl)}" alt="" class="au-avatar" loading="lazy" />`
          : `<span class="au-avatar au-avatar--initials" aria-hidden="true">${initl}</span>`;

      const bonus = entry.referralNetworkBonus ?? 0;
      const bonusCell = bonus > 0
          ? `<span class="au-bonus-pill">+${fmt(bonus)}</span>`
          : `<span class="au-table__num-muted">—</span>`;

      return `
              <tr class="au-table__row${rank <= 3 ? ' au-table__row--top' : ''}">
                <td class="au-table__rank" aria-label="Rank ${rank}">${medal}</td>
                <td>
                  <div class="au-user-cell">
                    ${avatar}
                    <div class="au-user-cell__info">
                      <span class="au-user-cell__name">${this.esc(entry.name ?? entry.username ?? '—')}</span>
                      <span class="au-user-cell__handle">@${this.esc(entry.username ?? '')}</span>
                    </div>
                  </div>
                </td>
                <td>${this.esc(entry.lgaName ?? '—')}</td>
                <td class="au-table__num au-table__num--strong">${fmt(entry.activityScore ?? 0)}</td>
                <td class="au-table__num">${fmt(entry.pageViews ?? 0)}</td>
                <td class="au-table__num">${fmt(entry.chatMessages ?? 0)}</td>
                <td class="au-table__num">${fmt(entry.newsPosts ?? 0)}</td>
                <td class="au-table__num">${fmt(entry.reels ?? 0)}</td>
                <td class="au-table__num">${fmt(entry.referrals ?? 0)}</td>
                <td class="au-table__num">${bonusCell}</td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  }

  /* ── Pagination ───────────────────────────────────────────────── */

  _renderPagination() {
    const el = document.getElementById('au-pagination');
    if (!el || this._totalPages <= 1) { if (el) el.innerHTML = ''; return; }

    el.innerHTML = `
      <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" id="au-prev-btn"
              ${this._page <= 1 ? 'disabled' : ''}>← Prev</button>
      <span class="au-page-info">Page ${this._page} of ${this._totalPages}</span>
      <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" id="au-next-btn"
              ${this._page >= this._totalPages ? 'disabled' : ''}>Next →</button>
    `;
  }

  /* ── Events ───────────────────────────────────────────────────── */

  _bindEvents() {
    // Pagination
    const prev = document.getElementById('au-prev-btn');
    const next = document.getElementById('au-next-btn');
    if (prev) this.on(prev, 'click', () => { if (this._page > 1) { this._page--; this._renderTable(); this._renderPagination(); } });
    if (next) this.on(next, 'click', () => { if (this._page < this._totalPages) { this._page++; this._renderTable(); this._renderPagination(); } });

    // Region tabs
    const tabs = document.getElementById('au-region-tabs');
    if (tabs) {
      this.on(tabs, 'click', (e) => {
        const btn = e.target.closest('[data-region]');
        if (!btn) return;
        this._filterRegion = btn.dataset.region;
        this._page = 1;
        this._search = '';
        const searchEl = document.getElementById('au-search');
        if (searchEl) searchEl.value = '';
        tabs.querySelectorAll('.au-region-tab').forEach(t => {
          t.classList.toggle('au-region-tab--active', t.dataset.region === this._filterRegion);
          t.setAttribute('aria-selected', t.dataset.region === this._filterRegion);
        });
        this._reload();
      });
    }

    // Search
    const searchEl = document.getElementById('au-search');
    let searchTimer;
    if (searchEl) {
      this.on(searchEl, 'input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this._search = searchEl.value.trim();
          this._page = 1;
          this._renderTable();
          this._renderPagination();
        }, 200);
      });
    }

    // Range selector
    const rangeEl = document.getElementById('au-range');
    if (rangeEl) {
      this.on(rangeEl, 'change', () => {
        this._range = rangeEl.value;
        this._page = 1;
        this._reload();
      });
    }
  }
}