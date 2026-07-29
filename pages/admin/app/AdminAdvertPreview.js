/**
 * KTG Connect Admin — Advert Preview
 * Route: /admin/adverts/:id/preview
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Button }      from '../../../components/base/Button.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { router }      from '../../../core/router.js';
import { api }         from '../../../api/client.js';
import { formatDate }  from '../../../utils/date.js';

const EDIT_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const SEND_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
const CHECK_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const INFO_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
const TARGET_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';

export default class AdminAdvertPreviewPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminAdvertPreview.css';

  constructor(props) {
    super({
      title: 'Advert Preview',
      breadcrumbs: [
        { label: 'Dashboard',         path: '/admin'         },
        { label: 'Advert Management', path: '/admin/adverts' },
        { label: 'Preview'                                   },
      ],
      ...props,
    });
    this._id   = props.params?.id ? parseInt(props.params.id, 10) : null;
    this._item = null;
  }

  getContent() {
    return '<div id="ap-root" class="admin-advert-preview-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    const res = await api.adverts.adminGetById(this._id);
    setPageLoading(false);

    const root = document.getElementById('ap-root');
    if (!root) return;

    if (res.error || !res.data) {
      root.innerHTML = '<p style="color:var(--color-error)">Advert not found.</p>';
      return;
    }

    this._item = res.data;
    this._render(root);
  }

  _render(root) {
    const item = this._item;

    const hasBanner = !!item.imageUrl;
    const hasDates  = !!(item.startDate && item.endDate);
    const hasTarget = item.targetAllLgas || (item.lgaTargets?.length > 0);

    const checkItem = (done, label) =>
        '<div class="ap-check-item ' + (done ? 'ap-check-item--done' : 'ap-check-item--pending') + '">' +
        '<span class="ap-check-item__icon">' + (done ? CHECK_SVG : INFO_SVG) + '</span>' +
        '<span>' + label + '</span>' +
        '</div>';

    const lgaDisplay = item.targetAllLgas
        ? 'All LGAs (Regional)'
        : (item.lgaTargets || []).map(l => l.name).join(', ') || '—';

    const truncTitle = item.title
        ? item.title.slice(0, 24) + (item.title.length > 24 ? '…' : '')
        : '—';

    root.innerHTML =
        '<div class="ap-mode-badge">Review Mode</div>' +

        '<div class="ap-page-header">' +
        '<div>' +
        '<h1 class="ap-page-header__title">Advert Preview</h1>' +
        '<p class="ap-page-header__sub">Confirm the configuration and creative assets before official dispatch.</p>' +
        '</div>' +
        '</div>' +

        '<div class="ap-layout">' +

        // ── Left
        '<div class="ap-left">' +

        '<div class="ap-banner-card">' +
        '<div class="ap-banner-card__header">' +
        '<span class="ap-banner-card__label">Advert Banner</span>' +
        '<span class="ap-banner-card__spec">BANNER · 1920 × 1080</span>' +
        '</div>' +
        (item.imageUrl
                ? '<img src="' + this.esc(item.imageUrl) + '" class="ap-banner-img" alt="Banner preview" />'
                : '<div class="ap-banner-placeholder"><span>No banner uploaded</span></div>'
        ) +
        '</div>' +

        '<div class="ap-desc-card">' +
        '<h3 class="ap-desc-card__title">Campaign Description</h3>' +
        '<p class="ap-desc-card__body">' +
        this.esc(item.description || item.internalNote || 'No description provided.') +
        '</p>' +
        '</div>' +

        '</div>' +

        // ── Right
        '<div class="ap-right">' +

        '<div class="ap-details-card">' +
        '<h3 class="ap-details-card__title">Advert Details</h3>' +
        '<div class="ap-details-grid">' +
        '<div class="ap-detail"><span class="ap-detail__label">Advert ID</span><strong>' + this.esc(item.displayId || '—') + '</strong></div>' +
        '<div class="ap-detail"><span class="ap-detail__label">Date Published</span><strong>' + (item.startDate ? formatDate(item.startDate) : '—') + '</strong></div>' +
        '<div class="ap-detail"><span class="ap-detail__label">Caption Name</span><strong>' + this.esc(truncTitle) + '</strong></div>' +
        '<div class="ap-detail"><span class="ap-detail__label">Duration</span><strong>' + (item.durationDays != null ? item.durationDays + ' days' : '—') + '</strong></div>' +
        '</div>' +
        '</div>' +

        '<div class="ap-targeting-card">' +
        '<div class="ap-targeting-card__header">' +
        '<span class="ap-targeting-card__icon">' + TARGET_SVG + '</span>' +
        '<h3 class="ap-targeting-card__title">Targeting Scope</h3>' +
        '</div>' +
        '<div class="ap-targeting-pills">' +
        '<div class="ap-targeting-pill">' +
        '<span class="ap-targeting-pill__label">Reach</span>' +
        '<span class="ap-targeting-pill__value">Regional</span>' +
        '</div>' +
        '<div class="ap-targeting-pill">' +
        '<span class="ap-targeting-pill__label">Platform</span>' +
        '<span class="ap-targeting-pill__value">State Portal</span>' +
        '</div>' +
        '</div>' +
        '<div class="ap-targeting-notice">' +
        INFO_SVG +
        '<span>Estimated audience: active citizens in <strong>' + this.esc(lgaDisplay) + '</strong>.</span>' +
        '</div>' +
        '</div>' +

        '<div class="ap-checklist-card">' +
        '<p class="ap-checklist-card__label">Pre-flight Checklist</p>' +
        checkItem(hasBanner, 'Assets match quality guidelines') +
        checkItem(hasDates,  'Targeting parameters verified') +
        checkItem(hasTarget, 'Budget allocation confirmed') +
        '</div>' +

        '</div>' +

        '</div>' +

        '<div class="ap-footer">' +
        '<div id="ap-back-mount"></div>' +
        '<div id="ap-confirm-mount"></div>' +
        '</div>' +

        '<p class="ap-help">Need help with broadcast settings? <a href="#" class="ap-help__link">View documentation</a></p>';

    this.addChild(new Button({
      label: 'Back to Edit', icon: EDIT_SVG, iconPosition: 'left',
      variant: 'secondary', size: 'md',
      onClick: () => router.push('/admin/adverts/' + this._id + '/edit'),
    })).mount(root.querySelector('#ap-back-mount'));

    this.addChild(new Button({
      label: 'Confirm & Publish', icon: SEND_SVG, iconPosition: 'right',
      variant: 'primary', size: 'md',
      onClick: () => this._publish(),
    })).mount(root.querySelector('#ap-confirm-mount'));
  }

  async _publish() {
    const res = await api.adverts.adminUpdate(this._id, { status: 'active' });
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Advert published successfully.');
    router.push('/admin/adverts');
  }
}