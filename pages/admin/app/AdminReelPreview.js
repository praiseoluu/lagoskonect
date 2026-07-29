/**
 * KTG Connect Admin — Reel Preview & Review
 * Route: /admin/reels/:id/preview
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Button }      from '../../../components/base/Button.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { router }      from '../../../core/router.js';
import { api }         from '../../../api/client.js';
import { formatDate }  from '../../../utils/date.js';

const TRASH_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
const EDIT_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const SEND_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
const USERS_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
const MAP_SVG    = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
const CHART_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
const CLOCK_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const SHARE_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
const INFO_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
const BELL_SVG   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>';
const APP_SVG    = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
const LIKE_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
const SHARE2_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
const COMMENT_SVG= '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';

export default class AdminReelPreviewPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminReelPreview.css';

  constructor(props) {
    super({
      title: 'Preview Reel',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin'       },
        { label: 'Reels',     path: '/admin/reels' },
        { label: 'Preview'                          },
      ],
      ...props,
    });
    this._id   = props.params && props.params.id;
    this._item = null;
  }

  getContent() {
    return '<div id="rp-root" class="admin-reel-preview-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    const res = await api.reels.adminGetById(this._id);
    setPageLoading(false);

    const root = document.getElementById('rp-root');
    if (!root) return;

    if (res.error || !res.data) {
      root.innerHTML = '<p style="color:var(--color-error)">Reel not found.</p>';
      return;
    }

    this._item = res.data;
    this._render(root);
  }

  _render(root) {
    const item = this._item;

    const lgaDisplay = item.targetAllLgas
      ? 'All LGAs'
      : ((item.lgaTargets || []).map(function(l) { return l.name; }).join(', ') || item.lgaName || '—');

    const lgaCount = item.targetAllLgas
      ? 'All'
      : ((item.lgaTargets || []).length || 1).toString();

    const hashtags = (item.hashtags || []).map(function(h) {
      return '<span class="rp-hashtag">' + h + '</span>';
    }).join('');

    const channelBadges =
      (item.deliveryPush  ? '<span class="rp-channel-badge">' + BELL_SVG + ' Push</span>'   : '') +
      (item.deliveryEmail ? '<span class="rp-channel-badge">' + APP_SVG  + ' In-App</span>' : '') +
      (item.deliverySms   ? '<span class="rp-channel-badge">' + APP_SVG  + ' SMS</span>'    : '');

    const thumbnailStyle = item.thumbnailUrl
      ? 'background-image:url(' + this.esc(item.thumbnailUrl) + ');background-size:cover;background-position:center;'
      : 'background:linear-gradient(135deg,#1a1a2e,#16213e);';

    root.innerHTML =
      // Page header
      '<div class="rp-page-header">' +
        '<div>' +
          '<h1 class="rp-page-header__title">' + this.esc(item.title || item.caption || 'Reel Preview') + '</h1>' +
          '<p class="rp-page-header__sub">Distribution ID: #RC-' + (this._id || '').slice(-6).toUpperCase() + '</p>' +
        '</div>' +
        '<div id="rp-delete-mount"></div>' +
      '</div>' +

      // Two-column layout
      '<div class="rp-layout">' +

        // Left: phone preview
        '<div class="rp-left">' +
          '<div class="rp-live-badge"><span class="rp-live-dot"></span> Live Preview</div>' +
          '<div class="rp-meta-badges"><span class="rp-meta-badge">9:16 AR</span><span class="rp-meta-badge">4K HDR</span></div>' +
          '<div class="rp-phone" style="' + thumbnailStyle + '">' +
            (item.videoUrl
              ? '<video class="rp-phone-video" src="' + this.esc(item.videoUrl) + '" controls playsinline></video>'
              : ''
            ) +
            '<div class="rp-phone-overlay">' +
              '<div class="rp-phone-author">' +
                '<div class="rp-phone-avatar"></div>' +
                '<span class="rp-phone-author-name">City Council Official</span>' +
                '<span class="rp-phone-author-badge">&#128205; LGA</span>' +
                '<button class="rp-phone-more" type="button">&#8942;</button>' +
              '</div>' +
              '<div class="rp-phone-actions">' +
                '<button class="rp-phone-action">' + LIKE_SVG    + '<span>' + (item.likes        || 0) + '</span></button>' +
                '<button class="rp-phone-action">' + SHARE2_SVG  + '<span>' + (item.shares       || 0) + '</span></button>' +
                '<button class="rp-phone-action">' + COMMENT_SVG + '<span>' + (item.commentCount || 0) + '</span></button>' +
              '</div>' +
              '<p class="rp-phone-caption">' + this.esc((item.caption || '').slice(0, 80)) + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Right: distribution + metadata
        '<div class="rp-right">' +

          // Review Distribution
          '<div class="rp-card">' +
            '<div class="rp-card__header">' +
              '<span class="rp-card__header-icon">' + USERS_SVG + '</span>' +
              '<h3 class="rp-card__title">Review Distribution</h3>' +
            '</div>' +
            '<div class="rp-dist-stats">' +
              '<div class="rp-dist-stat">' +
                '<p class="rp-dist-stat__label">TOTAL RESIDENTS</p>' +
                '<p class="rp-dist-stat__value" id="rp-reach">—</p>' +
                '<p class="rp-dist-stat__trend" id="rp-engagement">Loading...</p>' +
              '</div>' +
              '<div class="rp-dist-stat">' +
                '<p class="rp-dist-stat__label">PRIMARY LGAS</p>' +
                '<p class="rp-dist-stat__value">' + lgaCount + '</p>' +
              '</div>' +
              '<div class="rp-dist-stat">' +
                '<p class="rp-dist-stat__label">EST. ENGAGEMENT</p>' +
                '<p class="rp-dist-stat__value" id="rp-eng-rate">—</p>' +
                '<div class="rp-engagement-bar"><div class="rp-engagement-bar__fill" id="rp-eng-bar" style="width:0%"></div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          // Schedule + Metadata row
          '<div class="rp-two-col">' +

            '<div class="rp-card">' +
              '<div class="rp-card__header">' +
                '<span class="rp-card__header-icon">' + CLOCK_SVG + '</span>' +
                '<h3 class="rp-card__title">Scheduled</h3>' +
              '</div>' +
              '<div class="rp-schedule-rows">' +
                '<div class="rp-schedule-row"><span>Broadcast Date</span><strong>' + formatDate(item.publishedAt || item.createdAt) + '</strong></div>' +
                '<div class="rp-schedule-row"><span>Broadcast Time</span><strong>Immediately (Local)</strong></div>' +
              '</div>' +
              '<button class="rp-modify-link" type="button" id="rp-modify-schedule">Modify Schedule</button>' +
            '</div>' +

            '<div class="rp-card">' +
              '<div class="rp-card__header">' +
                '<span class="rp-card__header-icon">' + SHARE_SVG + '</span>' +
                '<h3 class="rp-card__title">Metadata &amp; Channels</h3>' +
              '</div>' +
              '<div class="rp-channel-badges">' + channelBadges + '</div>' +
              (hashtags ? '<div class="rp-hashtags"><p class="rp-hashtags__label">SMART URL TAGS</p><div class="rp-hashtags__list">' + hashtags + '</div></div>' : '') +
            '</div>' +

          '</div>' +

          // LGA info notice
          '<div class="rp-info-notice">' +
            '<span class="rp-info-notice__icon">' + INFO_SVG + '</span>' +
            '<p>This reel will be distributed to verified residents in <strong>' + this.esc(lgaDisplay) + '</strong>.</p>' +
          '</div>' +

          // Actions
          '<div class="rp-footer">' +
            '<div id="rp-edit-mount"></div>' +
            '<div id="rp-confirm-mount"></div>' +
          '</div>' +

          '<p class="rp-help">Need help with broadcast settings? <a href="#" class="rp-help__link">View Content</a></p>' +

        '</div>' +
      '</div>';

    // Mount buttons
    this.addChild(new Button({
      label: 'Delete Reels', icon: TRASH_SVG, iconPosition: 'left',
      variant: 'ghost', size: 'md',
      onClick: () => this._delete(),
    })).mount(root.querySelector('#rp-delete-mount'));

    this.addChild(new Button({
      label: 'Edit Content', icon: EDIT_SVG, iconPosition: 'left',
      variant: 'secondary', size: 'md',
      onClick: () => router.push('/admin/reels/' + this._id + '/edit'),
    })).mount(root.querySelector('#rp-edit-mount'));

    this.addChild(new Button({
      label: 'Confirm & Send Reels', icon: SEND_SVG, iconPosition: 'right',
      variant: 'primary', size: 'md',
      onClick: () => this._confirm(),
    })).mount(root.querySelector('#rp-confirm-mount'));

    const modifyBtn = root.querySelector('#rp-modify-schedule');
    if (modifyBtn) {
      this.on(modifyBtn, 'click', () => router.push('/admin/reels/' + this._id + '/edit'));
    }

    // Load reach data
    this._loadReach(item);
  }

  async _loadReach(item) {
    const lgaIds = item.targetAllLgas ? [] : (item.lgaTargets || []).map(l => l.id);
    const res    = await api.reels.adminEstimateReach(lgaIds, item.targetAllLgas);
    if (res.error || !res.data) return;
    const data = res.data;

    const reachEl   = document.getElementById('rp-reach');
    const engEl     = document.getElementById('rp-engagement');
    const engRateEl = document.getElementById('rp-eng-rate');
    const engBarEl  = document.getElementById('rp-eng-bar');

    if (reachEl)   reachEl.textContent   = (data.reach || 0).toLocaleString();
    if (engEl)     engEl.textContent     = '+' + (data.engagementRate || 0).toFixed(1) + '% vs prev. month';
    if (engRateEl) engRateEl.textContent = (data.engagementRate || 0) + '%';
    if (engBarEl)  engBarEl.style.width  = Math.min(100, data.engagementRate || 0) + '%';
  }

  async _confirm() {
    const res = await api.reels.adminUpdate(this._id, { status: 'published' });
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Reel published and sent successfully!');
    router.push('/admin/reels');
  }

  async _delete() {
    if (!confirm('Delete this reel? This cannot be undone.')) return;
    const res = await api.reels.adminDelete(this._id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Reel deleted.');
    router.push('/admin/reels');
  }
}
