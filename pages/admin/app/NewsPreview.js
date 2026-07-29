/**
 * KTG Connect Admin — Preview News Headline
 * Route: /admin/news/:id/preview
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Button } from '../../../components/base/Button.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';

const TRASH_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
const EDIT_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const SEND_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
const USERS_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
const BELL_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>';
const SMS_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
const EMAIL_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
const CAL_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const INFO_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
const MEGAPHONE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>';

export default class AdminNewsPreviewPage extends AdminLayout {
  static styles = '/pages/admin/app/NewsViews.css';

  constructor(props) {
    super({
      title: 'Preview News Headline',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'News Management', path: '/admin/news' },
        { label: 'Preview' },
      ],
      ...props,
    });
    this._id = parseInt(props.params && props.params.id, 10);
    this._item = null;
  }

  getContent() {
    return '<div id="np-root" class="news-preview-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    const res = await api.news.adminGetById(this._id);
    setPageLoading(false);

    const root = document.getElementById('np-root');
    if (!root) return;

    if (res.error || !res.data) {
      root.innerHTML = '<p style="color:var(--color-error)">Article not found.</p>';
      return;
    }

    this._item = res.data;
    this._render(root);
  }

  _render(root) {
    const item = this._item;

    // Delivery channel badges
    const channelBadges = this._buildChannelBadges(item);

    // LGA display string
    const lgaDisplay = item.targetAllLgas
      ? 'All LGAs'
      : ((item.lgaTargets || []).map(function (l) { return l.name; }).join(', ') || item.lgaName || 'Selected LGAs');

    // Scheduled time string
    const schedTime = item.scheduledAt
      ? new Date(item.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'Send Immediately';

    // Content preview image
    const previewImg = item.imageUrl
      ? '<img src="' + this.esc(item.imageUrl) + '" alt="" class="np-preview-img" />'
      : '<div class="np-preview-img np-preview-img--placeholder"></div>';

    root.innerHTML =
      // Breadcrumb strip
      '<div class="np-breadcrumb">' +
      '<button class="np-breadcrumb__link" id="np-back-crumb" type="button">New Announcement</button>' +
      '<span class="np-breadcrumb__sep">&rsaquo;</span>' +
      '<span class="np-breadcrumb__current">Review &amp; Send</span>' +
      '</div>' +

      // Page header
      '<div class="np-page-header">' +
      '<div>' +
      '<h1 class="np-page-header__title">Preview News Headline</h1>' +
      '<p class="np-page-header__sub">Check all details before broadcasting to the community.</p>' +
      '</div>' +
      '<div id="np-delete-mount"></div>' +
      '</div>' +

      // Main white card
      '<div class="np-main-card">' +

      // Two-column layout
      '<div class="np-layout">' +

      // Left: content preview
      '<div class="np-preview-col">' +
      '<p class="np-col-label">CONTENT PREVIEW</p>' +
      '<div class="np-preview-card">' +
      previewImg +
      '<div class="np-preview-card__body">' +
      '<h2 class="np-preview-card__title">' + this.esc(item.title) + '</h2>' +
      '<p class="np-preview-card__text">' + this.esc((item.summary || '').slice(0, 180)) + '</p>' +
      '</div>' +
      '<div class="np-preview-card__footer">' +
      '<span>Previewing responsive view</span>' +
      '<div class="np-preview-card__view-icons">' +
      '<span class="np-view-icon" title="Mobile"></span>' +
      '<span class="np-view-icon" title="Tablet"></span>' +
      '<span class="np-view-icon np-view-icon--active" title="Desktop"></span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Right: distribution summary
      '<div class="np-summary-col">' +
      '<p class="np-col-label">DISTRIBUTION SUMMARY</p>' +

      // Estimated recipients
      '<div class="np-summary-row">' +
      '<div class="np-summary-row__icon np-summary-row__icon--green">' + USERS_SVG + '</div>' +
      '<div class="np-summary-row__content">' +
      '<p class="np-summary-row__label">Estimated Recipients</p>' +
      '<p class="np-summary-row__value" id="np-reach">Loading&hellip;</p>' +
      '</div>' +
      '</div>' +

      // Delivery channels
      '<div class="np-summary-row">' +
      '<div class="np-summary-row__icon np-summary-row__icon--green">' + MEGAPHONE + '</div>' +
      '<div class="np-summary-row__content">' +
      '<p class="np-summary-row__label">Delivery Channels</p>' +
      '<div class="np-channel-badges">' + channelBadges + '</div>' +
      '</div>' +
      '</div>' +

      // Scheduled time
      '<div class="np-summary-row">' +
      '<div class="np-summary-row__icon np-summary-row__icon--green">' + CAL_SVG + '</div>' +
      '<div class="np-summary-row__content">' +
      '<p class="np-summary-row__label">Scheduled Time</p>' +
      '<p class="np-summary-row__date">' + schedTime + '</p>' +
      '</div>' +
      '</div>' +

      // Info notice
      '<div class="np-info-notice">' +
      '<span class="np-info-notice__icon">' + INFO_SVG + '</span>' +
      '<p>This message will be sent to verified residents within <strong>' + this.esc(lgaDisplay) + '</strong> as per your current filters.</p>' +
      '</div>' +

      '</div>' +

      '</div>' +

      // Footer actions
      '<div class="np-footer">' +
      '<div id="np-back-btn-mount"></div>' +
      '<div id="np-confirm-btn-mount"></div>' +
      '</div>' +

      '</div>' +

      // Help text
      '<p class="np-help">Need help with broadcast settings? ' +
      '<a href="#" class="np-help__link">View Documentation</a>' +
      '</p>';

    // Wire up buttons
    const backCrumb = root.querySelector('#np-back-crumb');
    if (backCrumb) this.on(backCrumb, 'click', () => router.push('/admin/news/' + this._id + '/edit'));

    this.addChild(new Button({
      label: 'Delete News',
      icon: TRASH_SVG,
      iconPosition: 'left',
      variant: 'ghost',
      size: 'md',
      onClick: () => this._delete(),
    })).mount(root.querySelector('#np-delete-mount'));

    this.addChild(new Button({
      label: 'Back to Edit',
      icon: EDIT_SVG,
      iconPosition: 'left',
      variant: 'secondary',
      size: 'md',
      onClick: () => router.push('/admin/news/' + this._id + '/edit'),
    })).mount(root.querySelector('#np-back-btn-mount'));

    this.addChild(new Button({
      label: 'Confirm & Send News',
      icon: SEND_SVG,
      iconPosition: 'right',
      variant: 'primary',
      size: 'md',
      onClick: () => this._confirm(),
    })).mount(root.querySelector('#np-confirm-btn-mount'));

    // Load reach asynchronously
    this._fetchReach(item);
  }

  _buildChannelBadges(item) {
    var badges = '';
    if (item.deliveryEmail) {
      badges += '<span class="np-channel-badge">' + EMAIL_SVG + ' Email</span>';
    }
    if (item.deliverySms) {
      badges += '<span class="np-channel-badge">' + SMS_SVG + ' SMS</span>';
    }
    if (item.deliveryPush) {
      badges += '<span class="np-channel-badge">' + BELL_SVG + ' Push</span>';
    }
    if (!badges) badges = '<span class="np-channel-badge--none">None selected</span>';
    return badges;
  }

  async _fetchReach(item) {
    const lgaIds = item.targetAllLgas
      ? []
      : (item.lgaTargets || []).map(function (l) { return l.id; });
    const res = await api.news.estimateReach(lgaIds, item.targetAllLgas);
    const el = document.getElementById('np-reach');
    if (el) {
      const count = (res.data && res.data.reach) ? res.data.reach : 0;
      el.textContent = count.toLocaleString() + ' Residents';
    }
  }

  async _confirm() {
    const res = await api.news.adminPublish(this._id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'News published and sent successfully!');
    router.push('/admin/news');
  }

  async _delete() {
    if (!confirm('Delete this article? This cannot be undone.')) return;
    const res = await api.news.adminDelete(this._id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Article deleted.');
    router.push('/admin/news');
  }
}