/**
 * KTG Connect Admin — Content Moderation
 * Route: /admin/content-moderation
 * Guards: requireAdmin
 *
 * Shows citizen reels with pending reports.
 * Admin can dismiss (keep live) or take down (pause) each reel.
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806g';
import { Button }      from '../../../components/base/Button.js?v=20260806g';
import { Modal }       from '../../../components/base/Modal.js?v=20260806g';
import { showToast, setPageLoading } from '../../../core/store.js?v=20260806g';
import { api }         from '../../../api/client.js?v=20260806g';
import { timeAgo }     from '../../../utils/date.js?v=20260806g';

const FLAG_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const BAN_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
const PLAY_SVG  = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const INBOX_SVG = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>';

const DISMISS_REASONS = [
  'Report is unfounded',
  'Content is within community guidelines',
  'False report',
  'Duplicate report',
  'Other',
];

const TAKEDOWN_REASONS = [
  'Inappropriate content',
  'Misinformation',
  'Harassment or bullying',
  'Spam or scam',
  'Violence or graphic content',
  'Violates community guidelines',
  'Other',
];

export default class AdminContentModerationPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminContentModeration.css?v=20260806g';

  constructor(props) {
    super({
      title: 'Content Moderation',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Content Moderation' },
      ],
      ...props,
    });
    this._items       = [];
    this._page        = 1;
    this._perPage     = 12;
    this._totalPages  = 1;
    this._tab         = 'pending';
    this._actionModal = null;
    this._previewModal = null;
    this._loadMoreBtn  = null;
  }

  getContent() {
    return '<div id="cm-root" class="admin-moderation-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    this._render();
    await Promise.all([this._loadMetrics(), this._loadItems(true)]);
    setPageLoading(false);
  }

  _render() {
    const root = document.getElementById('cm-root');
    if (!root) return;

    root.innerHTML =
        '<div class="cm-page-header">' +
        '<div>' +
        '<h1 class="cm-page-header__title">Content Moderation Queue</h1>' +
        '<p class="cm-page-header__sub">Review content reported by citizens. Reels flagged for nudity, abuse, hate speech, or any inappropriate material appear here. Dismiss legitimate content or take it down to remove it from the platform.</p>' +
        '</div>' +
        '<div class="cm-header-stats">' +
        '<div class="cm-header-stat" id="cm-stat-pending">' +
        '<span class="cm-header-stat__value">—</span>' +
        '<span class="cm-header-stat__label">Pending</span>' +
        '</div>' +
        '<div class="cm-header-stat" id="cm-stat-today">' +
        '<span class="cm-header-stat__value">—</span>' +
        '<span class="cm-header-stat__label">Resolved Today</span>' +
        '</div>' +
        '<div class="cm-header-stat" id="cm-stat-takendown">' +
        '<span class="cm-header-stat__value">—</span>' +
        '<span class="cm-header-stat__label">Taken Down</span>' +
        '</div>' +
        '</div>' +
        '</div>' +

        '<div class="cm-tabs" id="cm-tabs">' +
        '<button class="cm-tab cm-tab--active" data-tab="pending"   type="button">Pending Review</button>' +
        '<button class="cm-tab"                data-tab="resolved"  type="button">Resolved</button>'       +
        '<button class="cm-tab"                data-tab="dismissed" type="button">Dismissed</button>'      +
        '<button class="cm-tab"                data-tab="all"       type="button">All Reports</button>'    +
        '</div>' +

        '<div class="cm-grid" id="cm-grid">' + this._buildSkeletons(6) + '</div>' +

        '<div class="cm-load-more" id="cm-load-more-mount"></div>';

    this.delegate('.cm-tab', 'click', (e, btn) => {
      this._tab  = btn.dataset.tab;
      this._page = 1;
      document.querySelectorAll('.cm-tab').forEach(b =>
          b.classList.toggle('cm-tab--active', b.dataset.tab === this._tab)
      );
      this._loadItems(true);
    });

    this._loadMoreBtn = this.addChild(new Button({
      label:        'Load More',
      icon:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
      iconPosition: 'right',
      variant:      'secondary',
      size:         'md',
      onClick:      () => this._handleLoadMore(),
    }));
    this._loadMoreBtn.mount(root.querySelector('#cm-load-more-mount'));

    const btnEl = root.querySelector('#cm-load-more-mount .ktg-btn');
    if (btnEl) { btnEl.style.display = 'none'; this._loadMoreBtn._el = btnEl; }

    this._mountModals();

    this.delegate('[data-cm-action]', 'click', (e, btn) => {
      const action  = btn.dataset.cmAction;
      const reelId  = btn.dataset.reelId;
      const caption = btn.dataset.caption || '';
      if (action === 'preview')  this._openPreview(reelId);
      if (action === 'dismiss')  this._openActionModal('dismiss',  reelId, caption);
      if (action === 'takedown') this._openActionModal('takedown', reelId, caption);
    });
  }

  _buildSkeletons(n) {
    let html = '';
    for (let i = 0; i < n; i++) {
      html +=
          '<div class="cm-card cm-card--skeleton">' +
          '<div class="cm-card__thumb skeleton-block"></div>' +
          '<div class="cm-card__body">' +
          '<div class="skeleton-line skeleton-line--sm"></div>' +
          '<div class="skeleton-line skeleton-line--md"></div>' +
          '<div class="skeleton-line skeleton-line--lg"></div>' +
          '</div>' +
          '</div>';
    }
    return html;
  }

  _mountModals() {
    this._actionModal = this.addChild(new Modal({
      title: 'Review Flagged Reel',
      size:  'sm',
      body:  '',
      footer: '',
    }));
    this._actionModal.mount(document.body, { append: true });

    this._previewModal = this.addChild(new Modal({
      title:  'Reel Preview',
      size:   'md',
      body:   '',
      footer: '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Close</button>',
    }));
    this._previewModal.mount(document.body, { append: true });
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  async _loadMetrics() {
    const res = await api.moderation.metrics();
    if (res.error || !res.data) return;
    const m = res.data;

    const pendingEl    = document.querySelector('#cm-stat-pending .cm-header-stat__value');
    const todayEl      = document.querySelector('#cm-stat-today .cm-header-stat__value');
    const takenDownEl  = document.querySelector('#cm-stat-takendown .cm-header-stat__value');

    if (pendingEl)   pendingEl.textContent   = (m.pendingCount  || 0).toLocaleString();
    if (todayEl)     todayEl.textContent     = (m.resolvedToday || 0).toLocaleString();
    if (takenDownEl) takenDownEl.textContent = (m.takenDownCount || 0).toLocaleString();

    const pendingStat = document.getElementById('cm-stat-pending');
    if (pendingStat && m.pendingCount > 0) pendingStat.classList.add('cm-header-stat--urgent');
  }

  async _loadItems(replace) {
    const res = await api.moderation.list({
      page:    this._page,
      perPage: this._perPage,
      tab:     this._tab,
    });
    if (res.error) { showToast('error', res.error.message); return; }

    this._totalPages = res.meta?.totalPages || 1;
    this._items = replace
        ? (res.data || [])
        : this._items.concat(res.data || []);

    this._renderGrid(res.data || [], replace);
    this._updateLoadMore();
  }

  _renderGrid(items, replace) {
    const grid = document.getElementById('cm-grid');
    if (!grid) return;

    if (replace) grid.innerHTML = '';

    if (!items.length && replace) {
      const messages = {
        pending:  'No flagged reels waiting for review. All clear!',
        resolved: 'No resolved reports yet.',
        dismissed:'No dismissed reports yet.',
        all:      'No reports found.',
      };
      grid.innerHTML =
          '<div class="cm-empty">' +
          '<div class="cm-empty__icon">' + INBOX_SVG + '</div>' +
          '<h3 class="cm-empty__title">Queue is clear</h3>' +
          '<p class="cm-empty__sub">' + (messages[this._tab] || messages.all) + '</p>' +
          '</div>';
      return;
    }

    items.forEach(item => grid.appendChild(this._buildCard(item)));
  }

  _buildCard(item) {
    const card = document.createElement('div');
    card.className       = 'cm-card';
    card.dataset.reelId  = item.reelId;

    const thumbHtml = item.thumbnailUrl
        ? '<img src="' + this.esc(item.thumbnailUrl) + '" alt="" class="cm-card__thumb-img" loading="lazy" />'
        : '<div class="cm-card__thumb-placeholder"></div>';

    const durationHtml = item.duration
        ? '<span class="cm-card__duration">' + this._formatDuration(item.duration) + '</span>'
        : '';

    const avatarHtml = item.authorAvatar
        ? '<img src="' + this.esc(item.authorAvatar) + '" class="cm-author-avatar" alt="" />'
        : '<div class="cm-author-avatar cm-author-avatar--placeholder">' +
        this.esc((item.authorName || 'U').charAt(0).toUpperCase()) +
        '</div>';

    const reasonsHtml = item.reportReasons
        ? '<div class="cm-card__reasons">' +
        item.reportReasons.split(', ').map(r =>
            '<span class="cm-card__reason-tag">' + this.esc(r) + '</span>'
        ).join('') +
        '</div>'
        : '';

    const actionsHtml = item.reportStatus === 'pending'
        ? '<div class="cm-card__actions">' +
        '<button class="cm-action-btn cm-action-btn--dismiss" ' +
        'data-cm-action="dismiss" data-reel-id="' + this.esc(item.reelId) + '" ' +
        'data-caption="' + this.esc((item.caption || '').slice(0, 60)) + '">' +
        CHECK_SVG + ' Dismiss' +
        '</button>' +
        '<button class="cm-action-btn cm-action-btn--takedown" ' +
        'data-cm-action="takedown" data-reel-id="' + this.esc(item.reelId) + '" ' +
        'data-caption="' + this.esc((item.caption || '').slice(0, 60)) + '">' +
        BAN_SVG + ' Take Down' +
        '</button>' +
        '</div>'
        : '<div class="cm-card__status-badge">' +
        (item.reportStatus === 'resolved' ? CHECK_SVG + ' Taken down' : BAN_SVG + ' Dismissed') +
        '</div>';

    card.innerHTML =
        '<div class="cm-card__thumb" data-cm-action="preview" data-reel-id="' + this.esc(item.reelId) + '">' +
        thumbHtml +
        durationHtml +
        '<span class="cm-card__report-badge">' + FLAG_SVG + item.reportCount + ' report' + (item.reportCount !== 1 ? 's' : '') + '</span>' +
        '<button class="cm-card__play-btn" aria-label="Preview video">' + PLAY_SVG + '</button>' +
        '</div>' +

        '<div class="cm-card__body">' +
        '<div class="cm-card__author">' +
        avatarHtml +
        '<div class="cm-card__author-info">' +
        '<span class="cm-card__author-name">' + this.esc(item.authorName || 'Unknown') + '</span>' +
        '<span class="cm-card__author-meta">' + this.esc(item.lgaName || '—') + ' &bull; ' + timeAgo(item.latestReportAt) + '</span>' +
        '</div>' +
        '</div>' +
        '<p class="cm-card__caption">' + this.esc((item.caption || '').slice(0, 100) || 'No caption') + '</p>' +
        reasonsHtml +
        actionsHtml +
        '</div>';

    return card;
  }

  // ── Preview modal ─────────────────────────────────────────────────────────

  _openPreview(reelId) {
    const item = this._items.find(r => r.reelId === reelId);
    if (!item?.videoUrl) { showToast('error', 'No video available for this reel.'); return; }

    this._previewModal.setBody(
        '<video class="cm-preview-video" src="' + this.esc(item.videoUrl) + '" controls autoplay playsinline></video>' +
        (item.caption ? '<p class="cm-preview-caption">' + this.esc(item.caption) + '</p>' : '')
    );

    this._previewModal.open();
  }

  // ── Action modal ──────────────────────────────────────────────────────────

  _openActionModal(action, reelId, caption) {
    const isDismiss  = action === 'dismiss';
    const reasons    = isDismiss ? DISMISS_REASONS : TAKEDOWN_REASONS;
    const titleText  = isDismiss ? 'Dismiss Reports'       : 'Take Down Reel';
    const submitText = isDismiss ? 'Confirm Dismiss'       : 'Confirm Take Down';
    const submitCls  = isDismiss ? 'ktg-btn--secondary'    : 'ktg-btn--danger';
    const descText   = isDismiss
        ? 'The reports will be closed and the reel will remain visible to citizens.'
        : 'The reel will be hidden from all citizens immediately. The author will be notified.';

    this._actionModal.update({
      title: titleText,
      body:
        '<div class="cm-modal-body">' +
        '<p class="cm-modal-desc">' + descText + '</p>' +
        (caption ? '<p class="cm-modal-caption">"' + this.esc(caption) + '"</p>' : '') +
        '<div class="cm-modal-field">' +
        '<label class="cm-modal-label">Reason</label>' +
        '<select class="cm-modal-select" id="cm-action-reason">' +
        '<option value="">Select a reason…</option>' +
        reasons.map(r => '<option value="' + r + '">' + r + '</option>').join('') +
        '</select>' +
        '</div>' +
        '<div class="cm-modal-field">' +
        '<label class="cm-modal-label">Note <span style="font-weight:normal;text-transform:none;letter-spacing:0">(optional)</span></label>' +
        '<textarea class="cm-modal-textarea" id="cm-action-note" rows="2" placeholder="Additional context for your records…"></textarea>' +
        '</div>' +
        '</div>',
      footer:
        '<div class="cm-modal-footer">' +
        '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>' +
        '<button class="ktg-btn ' + submitCls + ' ktg-btn--md" id="cm-confirm-btn">' + submitText + '</button>' +
        '</div>',
    });

    this._actionModal.open();

    requestAnimationFrame(() => {
      const confirmBtn = document.getElementById('cm-confirm-btn');
      if (!confirmBtn) return;

      this.on(confirmBtn, 'click', async () => {
        const reason = document.getElementById('cm-action-reason')?.value || '';
        const note   = document.getElementById('cm-action-note')?.value.trim() || '';

        if (!reason) { showToast('error', 'Please select a reason.'); return; }

        confirmBtn.disabled    = true;
        confirmBtn.textContent = 'Processing…';

        const fullNote = reason + (note ? ': ' + note : '');
        const res = isDismiss
            ? await api.moderation.dismiss(reelId, fullNote)
            : await api.moderation.takedown(reelId, fullNote);

        confirmBtn.disabled = false;

        if (res.error) {
          showToast('error', res.error.message);
          confirmBtn.textContent = submitText;
          return;
        }

        this._actionModal.close();
        showToast('success', isDismiss ? 'Reports dismissed — reel stays live.' : 'Reel taken down successfully.');

        const card = document.querySelector('[data-reel-id="' + reelId + '"].cm-card');
        if (card) {
          card.classList.add('cm-card--removing');
          setTimeout(() => card.remove(), 300);
        }

        this._items = this._items.filter(r => r.reelId !== reelId);
        this._loadMetrics();
      });
    });
  }

  // ── Load more ─────────────────────────────────────────────────────────────

  async _handleLoadMore() {
    if (this._page >= this._totalPages) return;
    this._page += 1;
    this._loadMoreBtn?.setLoading(true);
    await this._loadItems(false);
    this._loadMoreBtn?.setLoading(false);
  }

  _updateLoadMore() {
    const btnEl = document.querySelector('#cm-load-more-mount .ktg-btn');
    if (btnEl) btnEl.style.display = this._page < this._totalPages ? '' : 'none';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0
        ? m + ':' + String(s).padStart(2, '0')
        : '0:' + String(s).padStart(2, '0');
  }
}