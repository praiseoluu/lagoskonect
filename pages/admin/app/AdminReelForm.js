/**
 * Lagos Konect Admin — Create / Edit Reel
 * Routes: /admin/reels/new  |  /admin/reels/:id/edit
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806h';
import { Input } from '../../../components/base/Input.js?v=20260806h';
import { Button } from '../../../components/base/Button.js?v=20260806h';
import { showToast, setPageLoading } from '../../../core/store.js?v=20260806h';
import { router } from '../../../core/router.js?v=20260806h';
import { api } from '../../../api/client.js?v=20260806h';
import { extractVideoThumbnail } from '../../../utils/thumbnail.js?v=20260806h';

const UPLOAD_SVG = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>';
const SEND_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

export default class AdminReelFormPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminReelForm.css?v=20260806h';

  constructor(props) {
    const isEdit = !!props.params?.id;
    super({
      title: isEdit ? 'Edit Reel' : 'Create Reel',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Reels', path: '/admin/reels' },
        { label: isEdit ? 'Edit' : 'Create' },
      ],
      ...props,
    });
    this._editId = props.params?.id || null;
    this._existing = null;
    this._lgaList = [];
    this._selectedLgas = [];
    this._targetAll = false;
    this._videoFile = null;
    this._uploadedVideo = null; // { videoUrl, thumbnailUrl, cloudinaryId, duration }
    this._uploadProgress = 0;
    this._reach = 0;
    this._reachTimer = null;
    this._captionInput = null;
    this._hashtags = [];  // array of strings e.g. ['#Katsina', '#Community']
  }

  getContent() {
    return '<div id="rf-root" class="admin-reel-form-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    const [lgaRes, existingRes] = await Promise.all([
      api.lgas.getAll(),
      this._editId ? api.reels.adminGetById(this._editId) : Promise.resolve({ data: null }),
    ]);
    this._lgaList = lgaRes.data || [];
    this._existing = existingRes.data || null;

    if (this._existing) {
      if (this._existing.targetAllLgas) {
        this._targetAll = true;
      } else {
        // Use lgaTargets junction data if available, else fall back to lga_id/lga_name
        if (this._existing.lgaTargets && this._existing.lgaTargets.length) {
          this._selectedLgas = this._existing.lgaTargets.map(l => ({ id: l.id, name: l.name }));
        } else if (this._existing.lgaId && this._existing.lgaName) {
          this._selectedLgas = [{ id: this._existing.lgaId, name: this._existing.lgaName }];
        }
      }
      this._hashtags = this._existing.hashtags || [];
    }

    this._render();
    setPageLoading(false);
  }

  _render() {
    const root = document.getElementById('rf-root');
    if (!root) return;
    const ex = this._existing;

    root.innerHTML =
      '<div class="rf-page-header">' +
      '<div>' +
      '<h1 class="rf-page-header__title">' + (this._editId ? 'Edit' : 'Create') + ' Reel</h1>' +
      '<p class="rf-page-header__sub">Produce high-impact governance updates for your local constituency.</p>' +
      '</div>' +
      '</div>' +

      '<div class="rf-layout">' +

      // Left: video upload
      '<div class="rf-left">' +
      '<div class="rf-phone-frame" id="rf-phone-frame">' +
      this._buildPhoneUpload(ex) +
      '<div class="rf-phone-controls">' +
      '<button class="rf-phone-ctrl" type="button" title="Timer">&#9711;</button>' +
      '<button class="rf-phone-ctrl" type="button" title="Text">T&#7523;</button>' +
      '<button class="rf-phone-ctrl" type="button" title="Music">&#9835;</button>' +
      '<button class="rf-phone-ctrl rf-phone-ctrl--preview" type="button" id="rf-preview-btn">PREVIEW</button>' +
      '</div>' +
      '</div>' +

      '<div class="rf-delivery-card">' +
      '<p class="rf-card-label">DELIVERY CHANNELS</p>' +
      '<div class="rf-channels">' +
      this._channelHtml('push', '&#128276;', 'Push', 'Mobile App Only', ex ? (ex.deliveryPush !== false) : true) +
      this._channelHtml('sms', '&#128172;', 'SMS', 'Direct to Phone', ex ? !!ex.deliverySms : false) +
      this._channelHtml('email', '@', 'Email', 'Newsletter format', ex ? !!ex.deliveryEmail : false) +
      '</div>' +
      '</div>' +
      '</div>' +

      // Right: details + settings
      '<div class="rf-right">' +

      '<div class="rf-card">' +
      '<h3 class="rf-card__title">Reel Details</h3>' +
      '<div class="rf-field">' +
      '<label class="rf-field__label">CAPTION</label>' +
      '<div id="caption-mount"></div>' +
      '</div>' +
      '<div class="rf-field">' +
      '<label class="rf-field__label">HASHTAGS</label>' +
      '<div class="rf-hashtag-tags" id="rf-hashtag-tags">' +
      this._buildHashtagTags() +
      '</div>' +
      '<div class="rf-hashtag-input-row">' +
      '<input type="text" class="rf-hashtag-input" id="rf-hashtag-input" ' +
      'placeholder="Type a hashtag and press Enter..." maxlength="32" />' +
      '</div>' +
      '</div>' +
      '<div class="rf-field">' +
      '<label class="rf-field__label">LGA DISTRIBUTION</label>' +
      '<div class="rf-lga-tags" id="rf-lga-tags">' +
      this._buildLgaTags() +
      '</div>' +
      '<div class="rf-lga-actions">' +
      '<button class="rf-add-lga-btn" id="rf-add-lga" type="button">+ Add LGA</button>' +
      '<button class="rf-all-lgas-btn ' + (this._targetAll ? 'rf-all-lgas-btn--active' : '') + '" id="rf-all-lgas" type="button">&#127758; All LGAs</button>' +
      '</div>' +
      '<div class="rf-lga-picker" id="rf-lga-picker" hidden>' +
      '<select class="rf-lga-select" id="rf-lga-select">' +
      '<option value="">Select LGA...</option>' +
      this._lgaList.map(l => '<option value="' + l.id + '" data-name="' + l.name + '">' + this.esc(l.name) + '</option>').join('') +
      '</select>' +
      '<button class="rf-lga-done-btn" id="rf-lga-done" type="button">Done</button>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="rf-card">' +
      '<h3 class="rf-card__title">Engagement Settings</h3>' +
      '<div class="rf-setting-row">' +
      '<div>' +
      '<p class="rf-setting__label">Public Feedback</p>' +
      '<p class="rf-setting__hint">Allow citizens to comment and vote on this reel.</p>' +
      '</div>' +
      '<label class="rf-toggle" for="allow-comments">' +
      '<input type="checkbox" id="allow-comments" ' + (ex ? (ex.allowComments !== false ? 'checked' : '') : 'checked') + ' />' +
      '<span class="rf-toggle__track"></span>' +
      '</label>' +
      '</div>' +
      '</div>' +

      '<div class="rf-action-row">' +
      '<div id="draft-btn-mount"></div>' +
      '<div id="publish-btn-mount"></div>' +
      '</div>' +

      '<div class="rf-protip">' +
      '<span class="rf-protip__icon">&#9432;</span>' +
      '<p><strong>Pro-tip:</strong> Reels with a specific LGA distribution reach 40% more residents than generic district-wide posts.</p>' +
      '</div>' +

      '</div>' +

      '</div>';

    this._mountInputs(root, ex);
    this._bindEvents(root);
    this._fetchReach();
  }

  _buildPhoneUpload(ex) {
    if (ex && ex.videoUrl) {
      return '<video class="rf-phone-video" src="' + this.esc(ex.videoUrl) + '" controls playsinline></video>';
    }
    if (this._uploadedVideo) {
      return '<video class="rf-phone-video" src="' + this.esc(this._uploadedVideo.videoUrl) + '" controls playsinline></video>';
    }
    return (
      '<div class="rf-phone-upload" id="rf-phone-upload">' +
      '<div class="rf-phone-upload__icon">' + UPLOAD_SVG + '</div>' +
      '<p class="rf-phone-upload__title">Upload Reel Footage</p>' +
      '<p class="rf-phone-upload__sub">Drag and drop MP4 or MOV files here, or use the camera to record directly.</p>' +
      '<button class="rf-browse-btn" type="button" id="rf-browse-btn">Browse Gallery</button>' +
      '<div class="rf-upload-progress" id="rf-upload-progress" hidden>' +
      '<div class="rf-upload-progress__bar" id="rf-progress-bar" style="width:0%"></div>' +
      '<span class="rf-upload-progress__label" id="rf-progress-label">Uploading... 0%</span>' +
      '</div>' +
      '<input type="file" id="rf-video-input" class="rf-video-input" accept="video/mp4,video/quicktime,video/webm" />' +
      '</div>'
    );
  }

  _buildHashtagTags() {
    if (!this._hashtags.length) return '';
    return this._hashtags.map(h =>
      '<span class="rf-hashtag-tag">' + this.esc(h) +
      ' <button class="rf-lga-tag__remove" data-hashtag="' + this.esc(h) + '" type="button">&#215;</button>' +
      '</span>'
    ).join('');
  }

  _buildLgaTags() {
    if (this._targetAll) {
      return '<span class="rf-lga-tag">All LGAs <button class="rf-lga-tag__remove" data-remove-all type="button">&#215;</button></span>';
    }
    return this._selectedLgas.map(l =>
      '<span class="rf-lga-tag">' + this.esc(l.name) +
      ' <button class="rf-lga-tag__remove" data-lga-id="' + l.id + '" type="button">&#215;</button>' +
      '</span>'
    ).join('');
  }

  _channelHtml(key, emoji, label, sublabel, checked) {
    const cls = checked ? ' rf-channel--checked' : '';
    const chk = checked ? ' checked' : '';
    return (
      '<label class="rf-channel' + cls + '" data-channel="' + key + '">' +
      '<input type="checkbox" class="rf-channel__checkbox" id="rf-channel-' + key + '"' + chk + ' />' +
      '<div class="rf-channel__icon">' + emoji + '</div>' +
      '<div class="rf-channel__info">' +
      '<p class="rf-channel__label">' + label + '</p>' +
      '<p class="rf-channel__sub">' + sublabel + '</p>' +
      '</div>' +
      '<span class="rf-channel__check">&#10003;</span>' +
      '</label>'
    );
  }

  _mountInputs(root, ex) {
    const $ = sel => root.querySelector(sel);

    this._captionInput = this.addChild(new Input({
      type: 'textarea',
      placeholder: 'Briefly describe the governance update...',
      value: ex ? (ex.caption || '') : '',
      rows: 3,
    }));
    this._captionInput.mount($('#caption-mount'));

    this.addChild(new Button({
      label: 'Save Draft', variant: 'secondary', size: 'md',
      onClick: () => this._submit('draft'),
    })).mount($('#draft-btn-mount'));

    this.addChild(new Button({
      label: 'Publish Now', icon: SEND_SVG, iconPosition: 'right',
      variant: 'primary', size: 'md',
      onClick: () => this._submit('published'),
    })).mount($('#publish-btn-mount'));
  }

  _bindEvents(root) {
    // Video file input
    const videoInput = root.querySelector('#rf-video-input');
    const browseBtn = root.querySelector('#rf-browse-btn');
    const phoneFrame = root.querySelector('#rf-phone-frame');

    if (browseBtn) this.on(browseBtn, 'click', e => { e.stopPropagation(); videoInput && videoInput.click(); });
    if (phoneFrame) {
      this.on(phoneFrame, 'dragover', e => { e.preventDefault(); phoneFrame.classList.add('rf-phone-frame--drag'); });
      this.on(phoneFrame, 'dragleave', () => phoneFrame.classList.remove('rf-phone-frame--drag'));
      this.on(phoneFrame, 'drop', e => {
        e.preventDefault();
        phoneFrame.classList.remove('rf-phone-frame--drag');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._handleVideoFile(f, root);
      });
    }
    if (videoInput) {
      this.on(videoInput, 'change', e => {
        const f = e.target.files && e.target.files[0];
        if (f) this._handleVideoFile(f, root);
        e.target.value = '';
      });
    }

    // Hashtag input — add on Enter or comma
    const hashInput = root.querySelector('#rf-hashtag-input');
    if (hashInput) {
      this.on(hashInput, 'keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ',') return;
        e.preventDefault();
        let val = hashInput.value.trim().replace(/,/g, '');
        if (!val) return;
        if (!val.startsWith('#')) val = '#' + val;
        val = val.toLowerCase().replace(/\s+/g, '');
        if (!this._hashtags.includes(val)) {
          this._hashtags.push(val);
          this._refreshHashtagTags(root);
        }
        hashInput.value = '';
      });
    }

    // Hashtag tag removal
    this.delegate('[data-hashtag]', 'click', (e, btn) => {
      if (!btn.classList.contains('rf-lga-tag__remove')) return;
      const h = btn.dataset.hashtag;
      this._hashtags = this._hashtags.filter(x => x !== h);
      this._refreshHashtagTags(root);
    });

    // Channel toggles
    this.delegate('.rf-channel', 'click', (e, lbl) => {
      const cb = lbl.querySelector('.rf-channel__checkbox');
      if (cb) lbl.classList.toggle('rf-channel--checked', cb.checked);
    });

    // LGA tag removal
    this.delegate('[data-lga-id]', 'click', (e, btn) => {
      if (!btn.classList.contains('rf-lga-tag__remove')) return;
      const lgaId = parseInt(btn.dataset.lgaId, 10);
      this._selectedLgas = this._selectedLgas.filter(l => l.id !== lgaId);
      this._refreshLgaTags(root);
      this._fetchReach();
    });

    this.delegate('[data-remove-all]', 'click', (e, btn) => {
      if (!btn.classList.contains('rf-lga-tag__remove')) return;
      this._targetAll = false;
      this._selectedLgas = [];
      this._refreshLgaTags(root);
      this._fetchReach();
    });

    // All LGAs toggle
    const allLgasBtn = root.querySelector('#rf-all-lgas');
    if (allLgasBtn) {
      this.on(allLgasBtn, 'click', () => {
        this._targetAll = !this._targetAll;
        this._selectedLgas = [];
        allLgasBtn.classList.toggle('rf-all-lgas-btn--active', this._targetAll);
        this._refreshLgaTags(root);
        this._fetchReach();
      });
    }

    // Add LGA button
    const addLgaBtn = root.querySelector('#rf-add-lga');
    const lgaPicker = root.querySelector('#rf-lga-picker');
    const lgaSelect = root.querySelector('#rf-lga-select');

    if (addLgaBtn && lgaPicker) {
      this.on(addLgaBtn, 'click', () => {
        lgaPicker.hidden = !lgaPicker.hidden;
      });
    }

    const doneBtn = root.querySelector('#rf-lga-done');
    if (doneBtn && lgaPicker) {
      this.on(doneBtn, 'click', () => { lgaPicker.hidden = true; });
    }

    if (lgaSelect) {
      this.on(lgaSelect, 'change', () => {
        const opt = lgaSelect.options[lgaSelect.selectedIndex];
        const id = parseInt(lgaSelect.value, 10);
        if (!id) return;
        const name = opt.dataset.name || opt.text;
        if (!this._selectedLgas.find(l => l.id === id)) {
          this._selectedLgas.push({ id, name });
          this._refreshLgaTags(root);
          this._fetchReach();
        }
        lgaSelect.value = ''; // reset selection but keep picker open for more
      });
    }
  }

  _refreshHashtagTags(root) {
    const el = root.querySelector('#rf-hashtag-tags');
    if (el) el.innerHTML = this._buildHashtagTags();
  }

  _refreshLgaTags(root) {
    const tagsEl = root.querySelector('#rf-lga-tags');
    if (tagsEl) tagsEl.innerHTML = this._buildLgaTags();
    const allBtn = root.querySelector('#rf-all-lgas');
    if (allBtn) allBtn.classList.toggle('rf-all-lgas-btn--active', this._targetAll);
    // Re-bind add btn
    const addBtn = root.querySelector('#rf-add-lga');
    const picker = root.querySelector('#rf-lga-picker');
    if (addBtn && picker) this.on(addBtn, 'click', () => { picker.hidden = !picker.hidden; });
  }

  async _handleVideoFile(file, root) {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) { showToast('error', 'Only MP4, MOV or WebM files are allowed.'); return; }
    if (file.size > 100 * 1024 * 1024) { showToast('error', 'Max file size is 100MB.'); return; }

    this._videoFile = file;

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    const frame = root.querySelector('#rf-phone-frame');
    if (frame) {
      const existingUpload = frame.querySelector('#rf-phone-upload');
      if (existingUpload) existingUpload.style.display = 'none';
      let vid = frame.querySelector('.rf-phone-video');
      if (!vid) {
        vid = document.createElement('video');
        vid.className = 'rf-phone-video';
        vid.controls = true;
        vid.playsInline = true;
        frame.insertBefore(vid, frame.firstChild);
      }
      vid.src = localUrl;
    }

    // Show progress
    const progressWrap = root.querySelector('#rf-upload-progress');
    const progressBar = root.querySelector('#rf-progress-bar');
    const progressLbl = root.querySelector('#rf-progress-label');
    if (progressWrap) progressWrap.hidden = false;
    if (progressLbl) progressLbl.textContent = 'Extracting thumbnail…';

    const thumbnailBlob = file.type.startsWith('video/') ? await extractVideoThumbnail(file) : null;

    if (progressLbl) progressLbl.textContent = 'Uploading... 0%';

    const res = await api.reels.adminUploadVideo(file, pct => {
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressLbl) progressLbl.textContent = 'Uploading... ' + pct + '%';
    }, thumbnailBlob);

    if (progressWrap) progressWrap.hidden = true;

    if (res.error) { showToast('error', 'Upload failed: ' + res.error.message); this._videoFile = null; return; }

    this._uploadedVideo = res.data || res;
    showToast('success', 'Video uploaded successfully.');
  }

  async _fetchReach() {
    clearTimeout(this._reachTimer);
    this._reachTimer = setTimeout(async () => {
      const lgaIds = this._targetAll ? [] : this._selectedLgas.map(l => l.id);
      const res = await api.reels.adminEstimateReach(lgaIds, this._targetAll);
      if (res.error) return;
      const data = res.data || {};
      this._reach = data.reach || 0;
    }, 400);
  }

  async _submit(status) {
    const caption = this._captionInput ? this._captionInput.getValue().trim() : '';

    if (!caption) { if (this._captionInput) this._captionInput.setError('Caption is required.'); return; }

    if (!this._editId && !this._uploadedVideo) {
      showToast('error', 'Please upload a video first.');
      return;
    }

    const lgaIds = this._targetAll ? [] : this._selectedLgas.map(l => l.id);
    if (!this._targetAll && lgaIds.length === 0) {
      showToast('error', 'Please add at least one LGA.');
      return;
    }

    const root = document.getElementById('rf-root');
    const allowComments = root ? (root.querySelector('#allow-comments') ? root.querySelector('#allow-comments').checked : true) : true;
    const deliveryPush = root ? (root.querySelector('#rf-channel-push') ? root.querySelector('#rf-channel-push').checked : true) : true;
    const deliverySms = root ? (root.querySelector('#rf-channel-sms') ? root.querySelector('#rf-channel-sms').checked : false) : false;
    const deliveryEmail = root ? (root.querySelector('#rf-channel-email') ? root.querySelector('#rf-channel-email').checked : false) : false;

    const payload = {
      caption,
      hashtags: this._hashtags,
      allowComments,
      deliveryPush,
      deliverySms,
      deliveryEmail,
      targetAllLgas: this._targetAll,
      lgaIds,
      videoUrl: this._uploadedVideo ? this._uploadedVideo.videoUrl : (this._existing ? this._existing.videoUrl : null),
      thumbnailUrl: this._uploadedVideo ? this._uploadedVideo.thumbnailUrl : (this._existing ? this._existing.thumbnailUrl : null),
      cloudinaryId: this._uploadedVideo ? this._uploadedVideo.cloudinaryId : (this._existing ? this._existing.cloudinaryId : null),
      duration: this._uploadedVideo ? this._uploadedVideo.duration : (this._existing ? this._existing.duration : 0),
    };

    const res = this._editId
      ? await api.reels.adminUpdate(this._editId, payload)
      : await api.reels.adminCreate(payload);

    if (res.error) { showToast('error', res.error.message); return; }

    if (status === 'draft') {
      showToast('success', 'Saved as draft.');
      router.push('/admin/reels');
    } else {
      router.push('/admin/reels/' + res.data.reelId + '/preview');
    }
  }

  beforeUnmount() {
    clearTimeout(this._reachTimer);
  }
}