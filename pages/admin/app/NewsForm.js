/**
 * Lagos Konnect Admin — Add / Edit News Headline
 * Routes: /admin/news/new  |  /admin/news/:id/edit
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806g';
import { Input } from '../../../components/base/Input.js?v=20260806g';
import { Button } from '../../../components/base/Button.js?v=20260806g';
import { Dropdown } from '../../../components/base/Forms.js?v=20260806g';
import { showToast, setPageLoading } from '../../../core/store.js?v=20260806g';
import { router } from '../../../core/router.js?v=20260806g';
import { api } from '../../../api/client.js?v=20260806g';
import { parseServerDate } from '../../../utils/date.js?v=20260806g';

const _pad = (n) => String(n).padStart(2, '0');

const CATEGORIES = [
  'Health', 'Infrastructure', 'Education', 'Environment',
  'Governance', 'Security', 'Agriculture', 'Technology',
  'Community', 'Finance', 'General',
];

const UPLOAD_ICON = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`;

export default class AdminNewsFormPage extends AdminLayout {
  static styles = '/pages/admin/app/NewsForm.css?v=20260806g';

  constructor(props) {
    const isEdit = !!props.params?.id;
    super({
      title: isEdit ? 'Edit News Headline' : 'Add News Headline',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'News Management', path: '/admin/news' },
        { label: isEdit ? 'Edit' : 'Add News' },
      ],
      ...props,
    });
    this._editId = props.params?.id ? parseInt(props.params.id, 10) : null;
    this._existing = null;
    this._lgaList = [];
    this._selectedLgas = new Set();
    this._targetAll = false;
    this._imageFile = null;
    this._imagePreview = null;
    this._reach = 0;
    this._reachTimer = null;
    this._easyMDE = null;  // EasyMDE rich text editor instance

    // Form component refs
    this._titleInput = null;
    this._categoryDrop = null;
    this._datePicker = null;
    this._timePicker = null;
    this._scheduleEnabled = false;
  }

  getContent() {
    return `<div id="nf-root" class="news-form-page"></div>`;
  }

  async onContentReady() {
    setPageLoading(true);

    const [lgaRes, existingRes] = await Promise.all([
      api.lgas.getAll(),
      this._editId ? api.news.adminGetById(this._editId) : Promise.resolve({ data: null }),
    ]);

    this._lgaList = lgaRes.data || [];
    this._existing = existingRes.data || null;

    if (this._editId && this._existing) {
      this.setTitle('Edit News Headline');
      // Pre-fill selections
      if (this._existing.targetAllLgas) {
        this._targetAll = true;
      } else {
        (this._existing.lgaTargets || []).forEach(l => this._selectedLgas.add(l.id));
      }
    }

    this._render();
    setPageLoading(false);
  }

  _render() {
    const root = document.getElementById('nf-root');
    if (!root) return;

    const ex = this._existing;
    const status = ex?.status || 'draft';

    root.innerHTML = `
      <!-- Page header with action buttons -->
      <div class="nf-page-header">
        <div>
          <h1 class="nf-page-header__title">${this._editId ? 'Edit' : 'Create'} News Article</h1>
          <p class="nf-page-header__sub">Draft and circulate administrative updates across LGAs.</p>
        </div>
        <div class="nf-header-actions">
          <div id="draft-btn-mount"></div>
          <div id="publish-btn-mount"></div>
        </div>
      </div>

      <div class="nf-layout">

        <!-- ── Left column ── -->
        <div class="nf-left">

          <!-- Title -->
          <div class="nf-card">
            <p class="nf-card__section-label">HEADLINE TITLE</p>
            <div id="title-mount"></div>
          </div>

          <!-- Body editor -->
          <div class="nf-card">
            <p class="nf-card__section-label">NEWS ARTICLE CONTENT</p>
            <textarea id="nf-body-editor" class="nf-body-editor"
              placeholder="Write the body of the news article here…">${this.esc(ex?.body || '')}</textarea>
          </div>

          <!-- Media upload -->
          <div class="nf-card">
            <div class="nf-media-header">
              <p class="nf-card__section-label">MEDIA UPLOAD</p>
              <span class="nf-media-maxsize">MAX 5MB</span>
            </div>
            <div class="nf-upload-zone ${ex?.imageUrl ? 'nf-upload-zone--has-image' : ''}" id="upload-zone">
              ${ex?.imageUrl
        ? `<img src="${this.esc(ex.imageUrl)}" class="nf-upload-zone__preview" alt="Banner" />`
        : `<div class="nf-upload-zone__placeholder" id="upload-placeholder">
                     <span class="nf-upload-zone__icon">${UPLOAD_ICON}</span>
                     <p class="nf-upload-zone__title">Drag and drop images or flyers</p>
                     <p class="nf-upload-zone__sub">PNG, JPG, or PDF (High resolution recommended)</p>
                     <button class="nf-browse-btn" type="button" id="browse-btn">BROWSE FILES</button>
                   </div>`
      }
              <input type="file" id="image-input" class="nf-upload-zone__input"
                accept="image/jpeg,image/png,image/webp" aria-label="Upload banner image" />
            </div>
          </div>

          <!-- Language Translations (pre-written) -->
          <div class="nf-card nf-translations-card">
            <div class="nf-translations-header" id="nf-translations-toggle" role="button" tabindex="0"
                 aria-expanded="false" aria-controls="nf-translations-body">
              <p class="nf-card__section-label" style="margin:0">LANGUAGE TRANSLATIONS</p>
              <span class="nf-translations-hint">Optional — Yoruba, Igbo, Pidgin</span>
              <svg class="nf-translations-chevron" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div id="nf-translations-body" hidden>
              <p class="nf-translations-desc">Provide pre-written translations to appear for citizens who have selected these languages. Leave blank to rely on automatic translation only.</p>

              ${[
                { code: 'yo', lang: 'Yoruba', placeholder: 'Translated title in Yoruba…', bodyPh: 'Article body in Yoruba…' },
                { code: 'ig', lang: 'Igbo',   placeholder: 'Translated title in Igbo…',   bodyPh: 'Article body in Igbo…'   },
                { code: 'pcm', lang: 'Nigerian Pidgin', placeholder: 'Translated title in Pidgin…', bodyPh: 'Article body in Pidgin…' },
              ].map(({ code, lang, placeholder, bodyPh }) => {
                const tx = ex?.translations?.[code] || {};
                return `
                  <details class="nf-translation-block" data-lang="${code}">
                    <summary class="nf-translation-block__summary">${lang}</summary>
                    <div class="nf-translation-block__fields">
                      <div class="nf-field">
                        <label class="nf-field__label" for="nf-tx-title-${code}">TITLE</label>
                        <input type="text" id="nf-tx-title-${code}" class="nf-tx-title"
                               data-tx-lang="${code}" data-tx-field="title"
                               placeholder="${this.esc(placeholder)}"
                               value="${this.esc(tx.title || '')}" />
                      </div>
                      <div class="nf-field">
                        <label class="nf-field__label" for="nf-tx-body-${code}">BODY</label>
                        <textarea id="nf-tx-body-${code}" class="nf-tx-body"
                                  data-tx-lang="${code}" data-tx-field="body"
                                  placeholder="${this.esc(bodyPh)}"
                                  rows="5">${this.esc(tx.body || '')}</textarea>
                      </div>
                    </div>
                  </details>
                `;
              }).join('')}
            </div>
          </div>

        </div>

        <!-- ── Right sidebar ── -->
        <div class="nf-right">

          <!-- Classification card -->
          <div class="nf-card">
            <div class="nf-sidebar-card-header">
              <span class="nf-sidebar-card-icon">📊</span>
              <h3 class="nf-sidebar-card-title">Classification</h3>
            </div>

            <div class="nf-field">
              <label class="nf-field__label">GOVERNANCE CATEGORY</label>
              <div id="category-mount"></div>
            </div>

            <div class="nf-flag nf-flag--light">
              <div>
                <p class="nf-flag__label">BREAKING</p>
                <p class="nf-flag__hint">Instant notification trigger</p>
              </div>
              <label class="nf-toggle" for="breaking-toggle">
                <input type="checkbox" id="breaking-toggle" ${ex?.breaking ? 'checked' : ''} />
                <span class="nf-toggle__track"></span>
              </label>
            </div>

            <div class="nf-flag nf-flag--light">
              <div>
                <p class="nf-flag__label">SET AS HEADLINE</p>
                <p class="nf-flag__hint">Featured in hero slot on news page</p>
              </div>
              <label class="nf-toggle" for="headline-toggle">
                <input type="checkbox" id="headline-toggle" ${ex?.isHeadline ? 'checked' : ''} />
                <span class="nf-toggle__track"></span>
              </label>
            </div>
          </div>

          <!-- Source attribution card -->
          <div class="nf-card">
            <div class="nf-sidebar-card-header">
              <span class="nf-sidebar-card-icon">🔗</span>
              <h3 class="nf-sidebar-card-title">Source Attribution</h3>
            </div>
            <div class="nf-field">
              <label class="nf-field__label" for="nf-source-url">SOURCE URL</label>
              <input
                type="url"
                id="nf-source-url"
                class="nf-source-url-input"
                placeholder="https://original-source.com/article"
                value="${this.esc(ex?.sourceUrl || '')}"
              />
              <p class="nf-field__hint">Link to the original article or reference page</p>
            </div>
          </div>

          <!-- Distribution card -->
          <div class="nf-card">
            <div class="nf-sidebar-card-header">
              <span class="nf-sidebar-card-icon">📍</span>
              <h3 class="nf-sidebar-card-title">Distribution</h3>
            </div>

            <div class="nf-field">
              <label class="nf-field__label">TARGET LGAS</label>
              <div class="nf-dist-lga-list" id="nf-lga-list">
                <!-- All regional areas checkbox -->
                <label class="nf-dist-lga-item ${this._targetAll ? 'nf-dist-lga-item--checked' : ''}" id="all-lgas-label">
                  <input type="checkbox" class="nf-dist-checkbox" id="all-lgas-checkbox" ${this._targetAll ? 'checked' : ''} />
                  <span>All Regional Areas</span>
                </label>
                <!-- Individual LGAs -->
                <div id="individual-lgas" ${this._targetAll ? 'style="opacity:0.4;pointer-events:none"' : ''}>
                  ${this._lgaList.slice(0, 5).map(l => this._lgaCheckboxDist(l)).join('')}
                  ${this._lgaList.length > 5 ? `
                    <button class="nf-show-more-lgas" id="nf-show-more" type="button">
                      + ADD SPECIFIC ZONE
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- Estimated reach -->
            <div class="nf-reach-light">
              <span class="nf-reach-light__label">Estimated reach</span>
              <span class="nf-reach-light__value" id="nf-reach">${this._reach.toLocaleString()}</span>
            </div>
          </div>

          <!-- Schedule card -->
          <div class="nf-card">
            <div class="nf-sidebar-card-header">
              <span class="nf-sidebar-card-icon">🕐</span>
              <h3 class="nf-sidebar-card-title">Schedule</h3>
            </div>

            <div class="nf-status-pill">
              <span class="nf-status-dot ${status === 'published' ? 'nf-status-dot--active' : 'nf-status-dot--draft'}"></span>
              <span class="nf-status-label">${status === 'published' ? 'Published' : status === 'scheduled' ? 'Scheduled' : 'Draft Mode'}</span>
            </div>

            <div id="publish-now-mount"></div>

            <div class="nf-schedule-row">
              <div class="nf-schedule-fields" id="nf-schedule-fields" ${ex?.scheduledAt ? '' : 'hidden'}>
                <div id="date-mount"></div>
                <div id="time-mount"></div>
              </div>
              <button class="nf-cal-btn" id="schedule-toggle-btn" type="button" title="Schedule for later">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </button>
            </div>

          </div>

          <!-- Delivery channels -->
          <div class="nf-card">
            <div class="nf-sidebar-card-header">
              <span class="nf-sidebar-card-icon">📡</span>
              <h3 class="nf-sidebar-card-title">Delivery Channels</h3>
            </div>
            <div class="nf-channels" id="nf-channels">
              ${this._channelCard('push', '🔔', 'Push', 'Mobile App Only', ex?.deliveryPush ?? true)}
              ${this._channelCard('sms', '💬', 'SMS', 'Direct to Phone', ex?.deliverySms ?? false)}
              ${this._channelCard('email', '@', 'Email', 'Newsletter format', ex?.deliveryEmail ?? false)}
            </div>
          </div>

        </div>
      </div>
    `;

    this._mountFormInputs(root, ex);
    this._bindFormEvents(root);
    this._fetchReach();
  }

  _channelCard(key, emoji, label, sublabel, checked) {
    return `
      <label class="nf-channel ${checked ? 'nf-channel--checked' : ''}" data-channel="${key}">
        <input type="checkbox" class="nf-channel__checkbox" id="channel-${key}" ${checked ? 'checked' : ''} />
        <div class="nf-channel__icon">${emoji}</div>
        <div class="nf-channel__info">
          <p class="nf-channel__label">${label}</p>
          <p class="nf-channel__sub">${sublabel}</p>
        </div>
        <span class="nf-channel__check" aria-hidden="true">✓</span>
      </label>
    `;
  }

  _lgaCheckboxDist(lga) {
    const checked = this._selectedLgas.has(lga.id);
    return `
      <label class="nf-dist-lga-item ${checked ? 'nf-dist-lga-item--checked' : ''}" data-lga-id="${lga.id}">
        <input type="checkbox" class="nf-lga-checkbox" ${checked ? 'checked' : ''} />
        <span>${this.esc(lga.name)}</span>
      </label>
    `;
  }

  _lgaCheckbox(lga) {
    const checked = this._selectedLgas.has(lga.id);
    return `
      <label class="nf-lga-item ${checked ? 'nf-lga-item--checked' : ''}" data-lga-id="${lga.id}">
        <input type="checkbox" class="nf-lga-checkbox" ${checked ? 'checked' : ''} />
        <span>${this.esc(lga.name)}</span>
      </label>
    `;
  }

  _mountFormInputs(root, ex) {
    const $ = (sel) => root.querySelector(sel);

    this._titleInput = this.addChild(new Input({
      placeholder: 'Enter an authoritative headline…',
      value: ex?.title || '',
      name: 'title',
    }));
    this._titleInput.mount($('#title-mount'));

    this._initEditor(ex?.body || '');

    this._categoryDrop = this.addChild(new Dropdown({
      placeholder: 'Select category…',
      value: ex?.category || '',
      options: CATEGORIES.map(c => ({ value: c, label: c })),
    }));
    this._categoryDrop.mount($('#category-mount'));

    // Schedule date/time pickers if pre-existing
    if (ex?.scheduledAt) {
      this._scheduleEnabled = true;
      // Stored as UTC; the pickers show the admin's own local time. The date
      // part must come from the same clock as the time part — reading the date
      // off toISOString() (UTC) next to a local time could land on the wrong day.
      const dt = parseServerDate(ex.scheduledAt);
      const dateStr = `${dt.getFullYear()}-${_pad(dt.getMonth() + 1)}-${_pad(dt.getDate())}`;
      const timeStr = `${_pad(dt.getHours())}:${_pad(dt.getMinutes())}`;
      this._datePicker = this.addChild(new Input({ type: 'date', label: 'Date', value: dateStr }));
      this._datePicker.mount($('#date-mount'));
      this._timePicker = this.addChild(new Input({ type: 'time', label: 'Time', value: timeStr }));
      this._timePicker.mount($('#time-mount'));
    }

    // Header action buttons
    const draftBtn = this.addChild(new Button({
      label: 'Save Draft', variant: 'secondary', size: 'md',
      onClick: () => this._submit('draft'),
    }));
    draftBtn.mount($('#draft-btn-mount'));

    const publishBtn = this.addChild(new Button({
      label: 'Publish News', variant: 'primary', size: 'md',
      onClick: () => this._submit('published'),
    }));
    publishBtn.mount($('#publish-btn-mount'));

    // Publish Now button in schedule card
    const publishNowBtn = this.addChild(new Button({
      label: 'PUBLISH NOW', variant: 'primary', size: 'lg', fullWidth: true,
      onClick: () => this._submit('published'),
    }));
    publishNowBtn.mount($('#publish-now-mount'));
  }

  async _initEditor(initialValue = '') {
    // Load EasyMDE CSS from jsDelivr if not already loaded
    if (!document.getElementById('easymde-css')) {
      const link = document.createElement('link');
      link.id = 'easymde-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/easymde@2.21.0/dist/easymde.min.css';
      document.head.appendChild(link);
    }

    // Load Font Awesome for EasyMDE toolbar icons
    if (!document.getElementById('fa-css')) {
      const fa = document.createElement('link');
      fa.id = 'fa-css';
      fa.rel = 'stylesheet';
      fa.href = 'https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css';
      document.head.appendChild(fa);
    }

    // Load EasyMDE JS if not already present
    if (!window.EasyMDE) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/easymde@2.21.0/dist/easymde.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch {
        // CDN failed — fall back to a plain styled textarea
        console.warn('[EasyMDE] Failed to load from CDN. Falling back to plain textarea.');
        const textarea = document.getElementById('nf-body-editor');
        if (textarea) {
          textarea.style.display = 'block';
          textarea.style.width = '100%';
          textarea.style.minHeight = '280px';
          textarea.style.padding = 'var(--space-3) var(--space-4)';
          textarea.style.border = '1.5px solid var(--color-border)';
          textarea.style.borderRadius = 'var(--radius-md)';
          textarea.style.fontFamily = 'var(--font-family)';
          textarea.style.fontSize = 'var(--font-size-sm)';
          textarea.style.resize = 'vertical';
          textarea.style.background = 'var(--color-bg)';
          textarea.style.color = 'var(--color-text)';
          // Store ref so _submit can still read it
          this._easyMDE = { value: () => textarea.value, toTextArea: () => { } };
        }
        return;
      }
    }

    const textarea = document.getElementById('nf-body-editor');
    if (!textarea) return;

    this._easyMDE = new window.EasyMDE({
      element: textarea,
      initialValue,
      placeholder: 'Write your news content here…',
      autofocus: false,
      spellChecker: false,
      status: false,
      autoDownloadFontAwesome: false,
      toolbar: [
        'heading-1', 'heading-2', 'heading-3', '|',
        'bold', 'italic', 'strikethrough', '|',
        'unordered-list', 'ordered-list', 'quote', '|',
        'link', '|',
        'preview', 'side-by-side', 'fullscreen', '|',
        'guide',
      ],
      renderingConfig: {
        singleLineBreaks: false,
      },
    });
  }

  _bindFormEvents(root) {
    // Image upload
    const uploadZone = root.querySelector('#upload-zone');
    const imageInput = root.querySelector('#image-input');
    const browseBtn = root.querySelector('#browse-btn');

    if (browseBtn) this.on(browseBtn, 'click', (e) => { e.stopPropagation(); imageInput?.click(); });
    if (uploadZone) {
      this.on(uploadZone, 'click', () => imageInput?.click());
      this.on(uploadZone, 'dragover', (e) => { e.preventDefault(); uploadZone.classList.add('nf-upload-zone--drag'); });
      this.on(uploadZone, 'dragleave', () => uploadZone.classList.remove('nf-upload-zone--drag'));
      this.on(uploadZone, 'drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('nf-upload-zone--drag');
        const file = e.dataTransfer?.files?.[0];
        if (file) this._handleImageFile(file, root);
      });
    }
    if (imageInput) {
      this.on(imageInput, 'change', (e) => {
        const file = e.target.files?.[0];
        if (file) this._handleImageFile(file, root);
        e.target.value = '';
      });
    }

    // Channel checkboxes
    this.delegate('.nf-channel', 'click', (e, label) => {
      const cb = label.querySelector('.nf-channel__checkbox');
      if (cb) label.classList.toggle('nf-channel--checked', cb.checked);
    });

    // All Regional Areas checkbox
    const allCheckbox = root.querySelector('#all-lgas-checkbox');
    if (allCheckbox) {
      this.on(allCheckbox, 'change', () => {
        this._targetAll = allCheckbox.checked;
        const allLabel = root.querySelector('#all-lgas-label');
        const individualWrap = root.querySelector('#individual-lgas');
        allLabel?.classList.toggle('nf-dist-lga-item--checked', this._targetAll);
        if (individualWrap) {
          individualWrap.style.opacity = this._targetAll ? '0.4' : '1';
          individualWrap.style.pointerEvents = this._targetAll ? 'none' : '';
        }
        this._fetchReach();
      });
    }

    // Individual LGA checkboxes
    this.delegate('.nf-lga-checkbox', 'change', (e, cb) => {
      const label = cb.closest('[data-lga-id]');
      const lgaId = parseInt(label?.dataset.lgaId, 10);
      if (!lgaId) return;
      if (cb.checked) { this._selectedLgas.add(lgaId); label?.classList.add('nf-dist-lga-item--checked'); }
      else { this._selectedLgas.delete(lgaId); label?.classList.remove('nf-dist-lga-item--checked'); }
      this._fetchReach();
    });

    // Show more LGAs
    const showMoreBtn = root.querySelector('#nf-show-more');
    if (showMoreBtn) {
      this.on(showMoreBtn, 'click', () => {
        const list = root.querySelector('#individual-lgas');
        if (!list) return;
        this._lgaList.slice(5).forEach(l => {
          const div = document.createElement('div');
          div.innerHTML = this._lgaCheckboxDist(l);
          list.insertBefore(div.firstElementChild, showMoreBtn);
        });
        showMoreBtn.remove();
      });
    }

    // Schedule calendar button — toggles date/time pickers
    const calBtn = root.querySelector('#schedule-toggle-btn');
    if (calBtn) {
      this.on(calBtn, 'click', () => {
        this._scheduleEnabled = !this._scheduleEnabled;
        const fields = root.querySelector('#nf-schedule-fields');
        if (fields) fields.hidden = !this._scheduleEnabled;
        if (this._scheduleEnabled && !this._datePicker) {
          this._datePicker = this.addChild(new Input({ type: 'date', label: 'Date' }));
          this._datePicker.mount(root.querySelector('#date-mount'));
          this._timePicker = this.addChild(new Input({ type: 'time', label: 'Time' }));
          this._timePicker.mount(root.querySelector('#time-mount'));
        }
        calBtn.classList.toggle('nf-cal-btn--active', this._scheduleEnabled);
      });
    }
  }

  _handleImageFile(file, root) {
    if (!file.type.startsWith('image/')) { showToast('error', 'Only image files allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('error', 'Max file size is 5MB.'); return; }

    this._imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this._imagePreview = e.target.result;
      const zone = root.querySelector('#upload-zone');
      const previewBox = root.querySelector('#preview-box');
      if (zone) zone.innerHTML = `<img src="${e.target.result}" class="nf-upload-zone__preview" alt="Banner" />
        <input type="file" id="image-input" class="nf-upload-zone__input" accept="image/*" />`;
      if (previewBox) previewBox.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
      // Re-bind input
      const newInput = root.querySelector('#image-input');
      if (newInput) {
        this.on(newInput, 'change', (ev) => {
          const f = ev.target.files?.[0];
          if (f) this._handleImageFile(f, root);
        });
      }
    };
    reader.readAsDataURL(file);
  }

  async _fetchReach() {
    clearTimeout(this._reachTimer);
    this._reachTimer = setTimeout(async () => {
      const lgaIds = this._targetAll ? [] : [...this._selectedLgas];
      const res = await api.news.estimateReach(lgaIds, this._targetAll);
      if (res.error) return;
      this._reach = res.data.reach || 0;
      const reachEl = document.getElementById('nf-reach');
      const barEl = document.getElementById('nf-reach-bar');
      if (reachEl) reachEl.textContent = this._reach.toLocaleString();
      // Bar fill: relative to total active users (approximate)
      if (barEl) barEl.style.width = `${Math.min(100, (this._reach / 10000) * 100)}%`;
    }, 400);
  }

  async _submit(status) {
    const title = this._titleInput?.getValue()?.trim();
    const body = this._easyMDE ? this._easyMDE.value().trim() : '';
    const category = this._categoryDrop?.state?.value || this._categoryDrop?.getValue?.() || '';
    const lgaIds = this._targetAll ? [] : [...this._selectedLgas];

    if (!title) { this._titleInput?.setError('Title is required.'); return; }
    if (!body && status === 'published') {
      showToast('error', 'Message content is required before publishing.');
      return;
    }
    if (!this._targetAll && lgaIds.length === 0) {
      showToast('error', 'Please select at least one LGA or choose All LGAs.');
      return;
    }

    const root = document.getElementById('nf-root');
    const channels = {
      deliveryPush: root?.querySelector('#channel-push')?.checked ?? true,
      deliverySms: root?.querySelector('#channel-sms')?.checked ?? false,
      deliveryEmail: root?.querySelector('#channel-email')?.checked ?? false,
    };
    const isHeadline = root?.querySelector('#headline-toggle')?.checked ?? false;
    const breaking = root?.querySelector('#breaking-toggle')?.checked ?? false;

    let scheduledAt = null;
    if (status === 'scheduled' || this._scheduleEnabled) {
      const date = this._datePicker?.getValue();
      const time = this._timePicker?.getValue();
      if (date && time) {
        // The pickers give a local wall-clock time, but the cron compares
        // scheduled_at against NOW(), which is UTC. Send the same instant
        // expressed in UTC so the article publishes when the admin meant.
        const local = new Date(`${date}T${time}:00`);
        scheduledAt = `${local.getUTCFullYear()}-${_pad(local.getUTCMonth() + 1)}-${_pad(local.getUTCDate())}`
                    + ` ${_pad(local.getUTCHours())}:${_pad(local.getUTCMinutes())}:00`;
      } else {
        showToast('error', 'Please set a date and time for scheduling.');
        return;
      }
    }

    this._saveBtn?.setLoading(true);

    // Upload image to Cloudinary first if one was selected
    let imageUrl = this._existing?.imageUrl || null;
    if (this._imageFile) {
      const uploadRes = await api.news.uploadNewsImage(this._imageFile);
      if (uploadRes.error) {
        showToast('error', `Image upload failed: ${uploadRes.error.message}`);
        this._saveBtn?.setLoading(false);
        return;
      }
      imageUrl = uploadRes.data?.url || uploadRes.url;
    }

    const sourceUrl = document.getElementById('nf-source-url')?.value?.trim() || null;

    const payload = {
      title, body, category,
      summary: body?.slice(0, 200) || '',
      imageUrl,
      isHeadline,
      breaking,
      sourceUrl,
      targetAllLgas: this._targetAll,
      lgaIds,
      status,
      scheduledAt,
      ...channels,
    };

    const res = this._editId
      ? await api.news.adminUpdate(this._editId, payload)
      : await api.news.adminCreate(payload);

    if (res.error) { this._saveBtn?.setLoading(false); showToast('error', res.error.message); return; }

    this._saveBtn?.setLoading(false);
    if (status === 'draft') {
      showToast('success', 'Saved as draft.');
      router.push('/admin/news');
    } else {
      router.push(`/admin/news/${res.data.id}/preview`);
    }
  }

  beforeUnmount() {
    if (this._easyMDE) {
      this._easyMDE.toTextArea();
      this._easyMDE = null;
    }
    clearTimeout(this._reachTimer);
  }
}