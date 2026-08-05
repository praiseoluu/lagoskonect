/**
 * LagKonnect Admin — Create / Edit Advert
 * Routes: /admin/adverts/new  |  /admin/adverts/:id/edit
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260805b';
import { Input }       from '../../../components/base/Input.js';
import { Button }      from '../../../components/base/Button.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { router }      from '../../../core/router.js';
import { api }         from '../../../api/client.js';

const UPLOAD_SVG = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>';
const LOCK_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
const TRASH_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
const INFO_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

export default class AdminAdvertFormPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminAdvertForm.css';

  constructor(props) {
    const isEdit = !!props.params?.id;
    super({
      title: isEdit ? 'Edit Advert' : 'Add Advert',
      breadcrumbs: [
        { label: 'Dashboard',         path: '/admin'          },
        { label: 'Advert Management', path: '/admin/adverts'  },
        { label: isEdit ? 'Edit' : 'Add Advert'               },
      ],
      ...props,
    });
    this._editId   = props.params?.id ? parseInt(props.params.id, 10) : null;
    this._existing = null;
    this._imageFile = null;

    this._titleInput      = null;
    this._advertiserInput = null;
    this._descInput       = null;
    this._noteInput       = null;
    this._ctaLabelInput   = null;
    this._ctaUrlInput     = null;
    this._startInput      = null;
    this._endInput        = null;
  }

  getContent() {
    return '<div id="af-root" class="admin-advert-form-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    if (this._editId) {
      const res = await api.adverts.adminGetById(this._editId);
      this._existing = res.data || null;
    }
    this._render();
    setPageLoading(false);
  }

  _render() {
    const root = document.getElementById('af-root');
    if (!root) return;

    const ex     = this._existing;
    const isEdit = !!this._editId;
    const imageOnly = !ex || (!ex.advertiser && !ex.ctaLabel);

    root.innerHTML =
        '<div class="af-modal-wrap">' +
        '<div class="af-modal">' +

        // ── Header
        '<div class="af-modal__header">' +
        '<div>' +
        '<h2 class="af-modal__title">' + (isEdit ? 'Edit Advert' : 'New Advert') + '</h2>' +
        '<p class="af-modal__sub">Configure the creative details and display options for this advertisement.</p>' +
        '</div>' +
        '</div>' +

        // ── Body
        '<div class="af-modal__body">' +

        // Row 1 — Caption name + Advert ID
        '<div class="af-row">' +
        '<div class="af-field af-field--grow">' +
        '<label class="af-field__label">Caption Name</label>' +
        '<div id="title-mount"></div>' +
        '</div>' +
        '<div class="af-field">' +
        '<label class="af-field__label">Advert ID</label>' +
        '<div class="af-id-field">' +
        '<span>' + (ex ? ex.displayId : 'Auto-assigned') + '</span>' +
        '<span class="af-id-field__lock">' + LOCK_SVG + '</span>' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Row 2 — Dates + Duration
        '<div class="af-row">' +
        '<div class="af-field af-field--grow">' +
        '<label class="af-field__label">Start Date <span class="af-field__optional">(optional)</span></label>' +
        '<div id="start-mount"></div>' +
        '</div>' +
        '<div class="af-field af-field--grow">' +
        '<label class="af-field__label">End Date <span class="af-field__optional">(optional)</span></label>' +
        '<div id="end-mount"></div>' +
        '</div>' +
        '<div class="af-field">' +
        '<label class="af-field__label">Duration</label>' +
        '<div class="af-duration-display" id="af-duration">—</div>' +
        '</div>' +
        '</div>' +

        // Banner upload
        '<div class="af-field">' +
        '<label class="af-field__label">Advert Banner</label>' +
        '<div class="af-upload-zone ' + (ex?.imageUrl ? 'af-upload-zone--has-image' : '') + '" id="af-upload-zone">' +
        this._buildUploadZone(ex) +
        '<input type="file" id="af-image-input" class="af-upload-zone__input" accept="image/jpeg,image/png,image/webp,image/svg+xml" />' +
        '</div>' +
        '<p class="af-field__hint">SVG, PNG, JPG or WebP — max 5 MB, recommended 800 × 400 px</p>' +
        '</div>' +

        // Placement select
        '<div class="af-field">' +
        '<label class="af-field__label">Placement</label>' +
        '<select class="af-select" id="af-type-select">' +
        '<option value="banner"'       + ((!ex || ex.type === 'banner')       ? ' selected' : '') + '>Home · Chat · Landing (General)</option>' +
        '<option value="news"'         + ((ex?.type === 'news')         ? ' selected' : '') + '>News Page</option>' +
        '<option value="feed"'         + ((ex?.type === 'feed')         ? ' selected' : '') + '>Reels Page</option>' +
        '<option value="interstitial"' + ((ex?.type === 'interstitial') ? ' selected' : '') + '>Interstitial / Popup</option>' +
        '</select>' +
        '</div>' +

        // Region select
        '<div class="af-field">' +
        '<label class="af-field__label">Target Region</label>' +
        '<select class="af-select" id="af-region-select">' +
        '<option value="west"'     + ((ex?.region === 'west')    ? ' selected' : '') + '>Lagos West</option>' +
        '<option value="central"'  + ((ex?.region === 'central')  ? ' selected' : '') + '>Lagos Central</option>' +
        '<option value="east"'     + ((ex?.region === 'east')    ? ' selected' : '') + '>Lagos East</option>' +
        '<option value="all"'      + ((ex?.region === 'all' || !ex?.region) ? ' selected' : '') + '>All Regions</option>' +
        '</select>' +
        '<p class="af-field__hint">Select which region this advert will be displayed in</p>' +
        '</div>' +

        // Image-only toggle
        '<label class="af-toggle-card' + (imageOnly ? ' af-toggle-card--active' : '') + '" id="af-image-only-card">' +
        '<input type="checkbox" class="af-toggle-card__checkbox" id="af-image-only"' + (imageOnly ? ' checked' : '') + ' />' +
        '<span class="af-toggle-card__switch"><span class="af-toggle-card__knob"></span></span>' +
        '<span class="af-toggle-card__text">' +
        '<span class="af-toggle-card__title">Image-only advert</span>' +
        '<span class="af-toggle-card__desc">Display just the banner with no advertiser name, description, or CTA overlay.</span>' +
        '</span>' +
        '</label>' +

        // Overlay content group
        '<div class="af-overlay-group' + (imageOnly ? ' af-overlay-group--hidden' : '') + '" id="af-overlay-group">' +
        '<div class="af-overlay-group__header">' +
        '<span class="af-overlay-group__title">Overlay Content</span>' +
        '<span class="af-overlay-group__hint">Shown on top of the banner image</span>' +
        '</div>' +

        '<div class="af-field">' +
        '<label class="af-field__label">Advertiser / Organisation <span class="af-field__optional">(optional)</span></label>' +
        '<div id="advertiser-mount"></div>' +
        '</div>' +

        '<div class="af-field">' +
        '<label class="af-field__label">Description <span class="af-field__optional">(optional)</span></label>' +
        '<div id="desc-mount"></div>' +
        '</div>' +

        '<div class="af-row">' +
        '<div class="af-field af-field--grow">' +
        '<label class="af-field__label">CTA Label <span class="af-field__optional">(optional)</span></label>' +
        '<div id="cta-label-mount"></div>' +
        '</div>' +
        '<div class="af-field af-field--grow">' +
        '<label class="af-field__label">CTA URL <span class="af-field__optional">(optional)</span></label>' +
        '<div id="cta-url-mount"></div>' +
        '</div>' +
        '</div>' +
        '</div>' +

        // Internal note
        '<div class="af-field">' +
        '<label class="af-field__label">Internal Status Note</label>' +
        '<div id="note-mount"></div>' +
        '</div>' +

        // Notice
        '<div class="af-notice">' +
        '<div class="af-notice__icon">' + INFO_SVG + '</div>' +
        '<div>' +
        '<p class="af-notice__title">Asset Verification</p>' +
        '<p class="af-notice__body">Changes to publication dates may affect scheduled display windows. Coordinate with the technical team before shifting live dates.</p>' +
        '</div>' +
        '</div>' +

        '</div>' + // end .af-modal__body

        // ── Footer
        '<div class="af-modal__footer">' +
        (isEdit ? '<div id="delete-btn-mount"></div>' : '<div></div>') +
        '<div class="af-modal__footer-right">' +
        '<div id="cancel-btn-mount"></div>' +
        '<div id="save-btn-mount"></div>' +
        '</div>' +
        '</div>' +

        '</div>' +
        '</div>';

    this._mountInputs(root, ex);
    this._bindEvents(root);
  }

  _buildUploadZone(ex) {
    if (ex?.imageUrl) {
      return '<img src="' + this.esc(ex.imageUrl) + '" class="af-upload-zone__preview" alt="Banner preview" />';
    }
    return (
        '<div class="af-upload-zone__placeholder">' +
        '<span class="af-upload-zone__icon">' + UPLOAD_SVG + '</span>' +
        '<p class="af-upload-zone__title"><span class="af-upload-zone__cta">Click to upload</span> or drag and drop</p>' +
        '<p class="af-upload-zone__sub">SVG, PNG, JPG — max 5 MB</p>' +
        '</div>'
    );
  }

  _mountInputs(root, ex) {
    const $ = sel => root.querySelector(sel);

    this._titleInput = this.addChild(new Input({
      placeholder: 'e.g. Youth Skill Empowerment Campaign',
      value: ex?.title || '',
    }));
    this._titleInput.mount($('#title-mount'));

    this._advertiserInput = this.addChild(new Input({
      placeholder: 'e.g. Lagos State Ministry of Youth',
      value: ex?.advertiser || '',
    }));
    this._advertiserInput.mount($('#advertiser-mount'));

    this._startInput = this.addChild(new Input({ type: 'date', value: ex?.startDate || '' }));
    this._startInput.mount($('#start-mount'));

    this._endInput = this.addChild(new Input({ type: 'date', value: ex?.endDate || '' }));
    this._endInput.mount($('#end-mount'));

    this._descInput = this.addChild(new Input({
      type: 'textarea', rows: 3,
      placeholder: 'Brief description of the campaign...',
      value: ex?.description || '',
    }));
    this._descInput.mount($('#desc-mount'));

    this._ctaLabelInput = this.addChild(new Input({
      placeholder: 'e.g. Learn More',
      value: ex?.ctaLabel || '',
    }));
    this._ctaLabelInput.mount($('#cta-label-mount'));

    this._ctaUrlInput = this.addChild(new Input({
      placeholder: 'https://...',
      value: ex?.ctaUrl || '',
    }));
    this._ctaUrlInput.mount($('#cta-url-mount'));

    this._noteInput = this.addChild(new Input({
      type: 'textarea', rows: 3,
      placeholder: 'Internal notes for your records...',
      value: ex?.internalNote || '',
    }));
    this._noteInput.mount($('#note-mount'));

    // Image-only toggle
    const imageOnlyCheckbox = $('#af-image-only');
    const overlayGroup      = $('#af-overlay-group');
    const toggleCard        = $('#af-image-only-card');
    if (imageOnlyCheckbox) {
      const sync = () => {
        const on = imageOnlyCheckbox.checked;
        overlayGroup?.classList.toggle('af-overlay-group--hidden', on);
        toggleCard?.classList.toggle('af-toggle-card--active', on);
      };
      this.on(imageOnlyCheckbox, 'change', sync);
      sync();
    }

    // Buttons
    this.addChild(new Button({
      label: 'Cancel', variant: 'ghost', size: 'md',
      onClick: () => router.push('/admin/adverts'),
    })).mount($('#cancel-btn-mount'));

    this.addChild(new Button({
      label: this._editId ? 'Save Changes' : 'Create Advert',
      variant: 'primary', size: 'md',
      onClick: () => this._submit(),
    })).mount($('#save-btn-mount'));

    if (this._editId) {
      this.addChild(new Button({
        label: 'Delete Advert', icon: TRASH_SVG, iconPosition: 'left',
        variant: 'ghost', size: 'md',
        onClick: () => this._delete(),
      })).mount($('#delete-btn-mount'));
    }

    this._updateDuration(root);
  }

  _bindEvents(root) {
    const zone      = root.querySelector('#af-upload-zone');
    const fileInput = root.querySelector('#af-image-input');

    if (zone) {
      this.on(zone, 'click',     ()  => fileInput?.click());
      this.on(zone, 'dragover',  (e) => { e.preventDefault(); zone.classList.add('af-upload-zone--drag'); });
      this.on(zone, 'dragleave', ()  => zone.classList.remove('af-upload-zone--drag'));
      this.on(zone, 'drop', (e) => {
        e.preventDefault();
        zone.classList.remove('af-upload-zone--drag');
        const f = e.dataTransfer?.files?.[0];
        if (f) this._handleImageFile(f, root);
      });
    }

    if (fileInput) {
      this.on(fileInput, 'change', (e) => {
        const f = e.target.files?.[0];
        if (f) this._handleImageFile(f, root);
        e.target.value = '';
      });
    }

    const startEl = root.querySelector('#start-mount input');
    const endEl   = root.querySelector('#end-mount input');
    if (startEl) this.on(startEl, 'change', () => this._updateDuration(root));
    if (endEl)   this.on(endEl,   'change', () => this._updateDuration(root));
  }

  _updateDuration(root) {
    const durEl = root.querySelector('#af-duration');
    if (!durEl) return;
    const start = this._startInput?.getValue();
    const end   = this._endInput?.getValue();
    if (start && end) {
      const days = Math.round((new Date(end) - new Date(start)) / 86_400_000);
      durEl.textContent = days >= 0 ? days + (days === 1 ? ' day' : ' days') : 'Invalid range';
    } else {
      durEl.textContent = '—';
    }
  }

  _handleImageFile(file, root) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type))  { showToast('error', 'Only JPG, PNG, WebP or SVG allowed.'); return; }
    if (file.size > 5 * 1024 * 1024)  { showToast('error', 'Max file size is 5 MB.'); return; }

    this._imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const zone = root.querySelector('#af-upload-zone');
      if (!zone) return;
      zone.innerHTML =
          '<img src="' + e.target.result + '" class="af-upload-zone__preview" alt="Banner preview" />' +
          '<input type="file" id="af-image-input" class="af-upload-zone__input" accept="image/*" />';
      const newInput = zone.querySelector('#af-image-input');
      if (newInput) {
        this.on(newInput, 'change', (ev) => {
          const f = ev.target.files?.[0];
          if (f) this._handleImageFile(f, root);
        });
      }
    };
    reader.readAsDataURL(file);
  }

  async _submit() {
    const title     = this._titleInput?.getValue().trim();
    const imageOnly = document.getElementById('af-image-only')?.checked;
    const advertiser = imageOnly ? '' : this._advertiserInput?.getValue().trim();
    const desc       = imageOnly ? '' : this._descInput?.getValue().trim();
    const ctaLabel   = imageOnly ? '' : this._ctaLabelInput?.getValue().trim();
    const ctaUrl     = imageOnly ? '' : this._ctaUrlInput?.getValue().trim();
    const note       = this._noteInput?.getValue().trim();
    const startDate  = this._startInput?.getValue();
    const endDate    = this._endInput?.getValue();
    const type       = document.getElementById('af-type-select')?.value || 'banner';
    const region     = document.getElementById('af-region-select')?.value || 'all';

    if (!title) {
      this._titleInput?.setError('Caption name is required.');
      return;
    }

    let imageUrl     = this._existing?.imageUrl     || null;
    let cloudinaryId = this._existing?.cloudinaryId || null;

    if (this._imageFile) {
      const up = await api.adverts.adminUploadBanner(this._imageFile);
      if (up.error) { showToast('error', 'Banner upload failed: ' + up.error.message); return; }
      const d = up.data || up;
      imageUrl     = d.url;
      cloudinaryId = d.publicId;
    }

    const payload = {
      title,
      advertiser,
      description:   desc       || null,
      internalNote:  note       || null,
      ctaLabel:      ctaLabel   || null,
      ctaUrl:        ctaUrl     || null,
      imageUrl,
      cloudinaryId,
      startDate:     startDate  || null,
      endDate:       endDate    || null,
      targetAllLgas: true,
      type,
      region:        region === 'all' ? null : region,
      status: 'active',
    };

    const res = this._editId
        ? await api.adverts.adminUpdate(this._editId, payload)
        : await api.adverts.adminCreate(payload);

    if (res.error) { showToast('error', res.error.message); return; }

    if (!this._editId) {
      router.push('/admin/adverts/' + res.data.id + '/preview');
    } else {
      showToast('success', 'Advert updated successfully.');
      router.push('/admin/adverts');
    }
  }

  async _delete() {
    if (!confirm('Permanently delete this advert? This cannot be undone.')) return;
    const res = await api.adverts.adminDelete(this._editId);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Advert deleted.');
    router.push('/admin/adverts');
  }
}