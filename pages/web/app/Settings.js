/**
 * Lagos Konect - Settings Page
 * Route: /settings
 * Guards: requireAuth + requireCitizen
 * ============================================================
 * Layout:
 *   Left sidebar — anchor links for 4 sections (sticky)
 *   Right content — single scrollable page with all 4 sections:
 *     1. Edit Profile   — avatar upload, name, email, LGA dropdown
 *     2. Language       — 2-column grid of languages, CURRENT pill
 *     3. Notifications  — 3 toggles (Official, Community, LGA-specific)
 *     4. Privacy        — profile visibility dropdown, 2FA toggle
 *
 * Scrollspy: sidebar highlights the active section as user scrolls.
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js?v=20260806f';
import { Avatar } from '../../../components/base/UI.js?v=20260806f';
import { Toggle } from '../../../components/base/UI.js?v=20260806f';
import { Input } from '../../../components/base/Input.js?v=20260806f';
import { Button } from '../../../components/base/Button.js?v=20260806f';
import { store, showToast, setPageLoading } from '../../../core/store.js?v=20260806f';
import { api } from '../../../api/client.js?v=20260806f';
import { loadPrefs, saveSession } from '../../../utils/storage.js?v=20260806f';
import { t, setLanguage, getLanguage, LANGUAGES } from '../../../core/i18n.js?v=20260806f';

const LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'pcm', label: 'Nigerian Pidgin', native: 'Pidgn' },
  { code: 'ha', label: 'Hausa', native: 'Hausa' },
  { code: 'yo', label: 'Yoruba', native: 'Yorùbá' },
];

const SECTIONS = [
  { id: 'section-profile', key: 'settings.secProfile' },
  { id: 'section-referrals', key: 'settings.referrals' },
  { id: 'section-payment', key: 'settings.secPayment' },
  { id: 'section-language', key: 'settings.secLanguage' },
  { id: 'section-notifications', key: 'settings.secNotifications' },
  { id: 'section-privacy', key: 'settings.secPrivacy' },
];

export default class SettingsPage extends WebLayout {
  static styles = '/pages/web/app/Settings.css?v=20260806f';

  constructor(props) {
    super({ title: t('settings.title'), ...props });
    this._prefs = loadPrefs();
    this._lgas = [];
    this._saving = false;
    this._activeSection = 'section-profile';
    this._referralData = null;
    this._contestData = null;

    // Refs to child Input components for profile form
    this._nameInput = null;
    this._emailInput = null;
    this._dobInput = null;
    this._cityInput = null;
    this._addressInput = null;
    // Password form
    this._currentPasswordInput = null;
    this._newPasswordInput = null;
    this._confirmPasswordInput = null;
  }

  getContent() {
    return `<div class="settings-page" id="settings-root"></div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    // Load LGAs for dropdown
    const lgaRes = await api.lgas.getAll();
    this._lgas = lgaRes.data || [];
    this._render();
    this._loadReferralData();
    this._bindScrollspy();
    setPageLoading(false);
  }

  // ── Main render ───────────────────────────────────────────────────────

  _render() {
    const root = this.getContentEl()?.querySelector('#settings-root');
    if (!root) return;

    root.innerHTML = `
      <div class="settings-layout">

        <!-- Left nav sidebar -->
        <aside class="settings-nav" id="settings-nav" aria-label="Settings sections">
          <h1 class="settings-nav__title">${this.esc(t('settings.title'))}</h1>
          <p class="settings-nav__subtitle">${this.esc(t('settings.subtitle'))}</p>
          <ul class="settings-nav__list" role="list">
            ${SECTIONS.map((s) => `
              <li>
                <a class="settings-nav__link ${s.id === this._activeSection ? 'settings-nav__link--active' : ''}"
                  href="#${s.id}" data-section="${s.id}">
                  ${s.id === 'section-profile' ? this._navIcon('profile') : ''}
                  ${s.id === 'section-referrals' ? this._navIcon('star') : ''}
                  ${s.id === 'section-payment' ? this._navIcon('payment') : ''}
                  ${s.id === 'section-language' ? this._navIcon('language') : ''}
                  ${s.id === 'section-notifications' ? this._navIcon('bell') : ''}
                  ${s.id === 'section-privacy' ? this._navIcon('shield') : ''}
                  ${this.esc(t(s.key))}
                </a>
              </li>
            `).join('')}
          </ul>
        </aside>

        <!-- Right scrollable content -->
        <div class="settings-content" id="settings-content">

          <!-- 1. Edit Profile -->
          <section class="settings-section" id="section-profile">
            <h2 class="settings-section__title">${this.esc(t('settings.secProfile'))}</h2>
            <div class="settings-card">
              ${this._renderProfileSection()}
            </div>
          </section>

          <!-- 2. Referral Contest -->
          <section class="settings-section" id="section-referrals">
            <h2 class="settings-section__title">Referral Contest</h2>
            <div class="settings-card settings-referral-card" id="referral-card">
              <p class="settings-referral-card__loading">Loading your referral details…</p>
            </div>
          </section>

          <!-- 3. Payment Details & Verification -->
          <section class="settings-section" id="section-payment">
            <h2 class="settings-section__title">Payment & Verification</h2>
            <p class="settings-section__desc">Add your bank account so we can pay your referral and activity rewards. Upload a government-issued ID to complete verification.</p>
            <div class="settings-card">
              ${this._renderPaymentSection()}
            </div>
          </section>

          <!-- 4. Language Preferences -->
          <section class="settings-section" id="section-language">
            <h2 class="settings-section__title">${this.esc(t('settings.languageHeading'))}</h2>
            <div class="settings-card">
              ${this._renderLanguageSection()}
            </div>
          </section>

          <!-- 4. Notification Management -->
          <section class="settings-section" id="section-notifications">
            <h2 class="settings-section__title">${this.esc(t('settings.notifHeading'))}</h2>
            <p class="settings-section__desc">${this.esc(t('settings.notifDesc'))}</p>
            <div class="settings-card" id="notif-card">
              ${this._renderNotifSection()}
            </div>
          </section>

          <!-- 5. Privacy & Security -->
          <section class="settings-section" id="section-privacy">
            <h2 class="settings-section__title">${this.esc(t('settings.privacyHeading'))}</h2>
            <div class="settings-card" id="privacy-card">
              ${this._renderPrivacySection()}
            </div>
          </section>

        </div>
      </div>
    `;

    this._mountProfileInputs(root);
    this._mountPaymentInputs(root);
    this._mountNotifToggles(root);
    this._mountPrivacyControls(root);
    this._bindNavLinks(root);
    this._bindProfileActions(root);
    this._bindLanguageActions(root);
  }

  async _loadReferralData() {
    try {
      const [mine, contest] = await Promise.all([
        api.referrals.getMine(),
        api.referrals.getContest(),
      ]);
      this._referralData = mine.data || null;
      this._contestData = contest.data || null;
    } catch {
      this._referralData = null;
      this._contestData = null;
    }
    const card = this.getContentEl()?.querySelector('#referral-card');
    if (card) {
      card.innerHTML = this._renderReferralSection();
      this._bindReferralActions(card);
    }
  }

  _renderReferralSection() {
    const mine = this._referralData;
    const contest = this._contestData?.contest;
    const leaders = this._contestData?.leaderboard || [];
    if (!mine) {
      return '<p class="settings-referral-card__error">Referral details are temporarily unavailable. Please try again later.</p>';
    }
    const prizes = contest?.prizes || {};
    return `
      <div class="settings-referral-card__intro">
        <div>
          <p class="settings-referral-card__eyebrow">${this.esc(contest?.title || 'Invite friends to Lagos Konect')}</p>
          <h3>Grow the community. Earn ₦250 each.</h3>
          <p>Share your link and earn ₦250 for every successful referral after your friend completes OTP verification.</p>
        </div>
        <strong class="settings-referral-card__count">₦${((mine.rewardAmount ?? mine.referralCount * 250)).toLocaleString('en-NG')}<small>${mine.referralCount} verified referrals</small></strong>
      </div>
      <div class="settings-referral-link">
        <span>${this.esc(mine.referralLink)}</span>
        <button type="button" class="settings-referral-link__copy" id="copy-referral-link">Copy link</button>
      </div>
      <div class="settings-referral-prizes">
        <span><b>1st</b> ${this.esc(prizes.first || 'Prize')}</span>
        <span><b>2nd</b> ${this.esc(prizes.second || 'Prize')}</span>
        <span><b>3rd</b> ${this.esc(prizes.third || 'Prize')}</span>
      </div>
      ${leaders.length ? `<div class="settings-referral-leaders"><b>Current leaders</b>${leaders.slice(0, 3).map((row) => `<span>#${row.rank} ${this.esc(row.name)} · ${row.referralCount}</span>`).join('')}</div>` : ''}
    `;
  }

  _bindReferralActions(card) {
    card.querySelector('#copy-referral-link')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this._referralData.referralLink);
        showToast('success', 'Referral link copied.');
      } catch {
        showToast('error', 'Could not copy the referral link.');
      }
    });
  }

  // ── Section HTML builders ─────────────────────────────────────────────

  _renderProfileSection() {
    const user = store.currentUser;
    const avatarHtml = Avatar.html({ name: user?.name || '', imageUrl: user?.avatarUrl || null, size: 'xl' });

    return `
      <!-- Avatar -->
      <div class="settings-avatar-row">
        <div class="settings-avatar-wrap" id="avatar-wrap">
          ${avatarHtml}
          <input type="file" id="avatar-file-input" class="settings-avatar__file-input"
            accept="image/*" aria-label="Upload profile picture" />
        </div>
        <div class="settings-avatar-actions">
          <p class="settings-avatar-actions__label">${t('settings.profilePicture')}</p>
          <div class="settings-avatar-actions__btns">
            <button class="settings-avatar__change-btn" id="avatar-change-btn" type="button">
              ${t('settings.changePhoto')}
            </button>
            <button class="settings-avatar__remove-btn" id="avatar-remove-btn" type="button">
              ${t('settings.removePhoto')}
            </button>
          </div>
        </div>
      </div>

      <!-- Form fields -->
      <div class="settings-form-grid">
        <div class="settings-form-field">
          <label class="settings-field-label" for="field-name">${t('settings.fullName')}</label>
          <div id="name-mount"></div>
        </div>
        <div class="settings-form-field">
          <label class="settings-field-label">${t('settings.usernameLabel')}</label>
          <div class="settings-username-row" id="username-display-row">
            <span class="settings-username-value" id="username-display">@${this.esc(store.currentUser?.username || '—')}</span>
            <button class="settings-username-edit-btn" id="username-edit-btn" type="button">${t('common.change')}</button>
          </div>
          <div id="username-edit-row" class="settings-username-edit-row" style="display:none">
            <div id="username-input-mount" style="flex:1"></div>
            <button class="ktg-btn ktg-btn--primary ktg-btn--sm" id="username-save-btn" type="button">${t('common.save')}</button>
            <button class="ktg-btn ktg-btn--ghost ktg-btn--sm" id="username-cancel-btn" type="button">${t('common.cancel')}</button>
          </div>
        </div>
        <div class="settings-form-field">
          <label class="settings-field-label" for="field-email">${t('settings.emailAddress')}</label>
          <div id="email-mount"></div>
        </div>
        <div class="settings-form-field">
          <label class="settings-field-label">${t('settings.phoneNumber')}</label>
          <div id="phone-mount"></div>
        </div>
        <div class="settings-form-field">
          <label class="settings-field-label" for="field-lga">${t('settings.selectedLga')}</label>
          <select class="settings-select" id="lga-select" aria-label="Select LGA">
            ${this._lgas.map((l) => `
              <option value="${l.id}" ${l.id === store.currentUser?.lgaId ? 'selected' : ''}>
                ${this.esc(l.name)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="settings-form-field">
          <label class="settings-field-label" for="field-dob">${t('settings.dateOfBirth')}</label>
          <div id="dob-mount"></div>
        </div>
        <div class="settings-form-field">
          <label class="settings-field-label">${t('settings.stateLabel')}</label>
          <input class="settings-input-readonly" value="Lagos State" disabled aria-label="${t('settings.stateLabel')}" />
        </div>
        <div class="settings-form-field">
          <label class="settings-field-label" for="field-city">${t('settings.cityLabel')}</label>
          <div id="city-mount"></div>
        </div>
        <div class="settings-form-field settings-form-field--full">
          <label class="settings-field-label" for="field-address">${t('settings.residentialAddress')}</label>
          <div id="address-mount"></div>
        </div>
      </div>

      <!-- Save button -->
      <div class="settings-form-footer">
        <div id="save-profile-mount"></div>
      </div>
    `;
  }

  _renderPaymentSection() {
    const user = store.currentUser;
    const idUrl = user?.idDocumentUrl || null;
    const idType = user?.idType || '';

    return `
      <!-- Bank Account -->
      <div class="settings-payment-block">
        <div class="settings-payment-block__header">
          <div class="settings-privacy-row__icon settings-privacy-row__icon--green" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
          </div>
          <div>
            <p class="settings-privacy-row__label">Bank Account</p>
            <p class="settings-privacy-row__desc">Enter your Nigerian bank account to receive referral and activity payments.</p>
          </div>
        </div>
        <div class="settings-form-grid settings-payment-grid">
          <div class="settings-form-field">
            <label class="settings-field-label">Bank Name</label>
            <div id="bank-name-mount"></div>
          </div>
          <div class="settings-form-field">
            <label class="settings-field-label">Account Number</label>
            <div id="bank-account-number-mount"></div>
          </div>
          <div class="settings-form-field settings-form-field--full">
            <label class="settings-field-label">Account Name (as on bank record)</label>
            <div id="bank-account-name-mount"></div>
          </div>
        </div>
        <div class="settings-form-footer">
          <div id="save-payment-mount"></div>
        </div>
      </div>

      <div class="settings-card__divider"></div>

      <!-- ID Document -->
      <div class="settings-payment-block">
        <div class="settings-payment-block__header">
          <div class="settings-privacy-row__icon settings-privacy-row__icon--green" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 10h.01M11 10h6M7 14h10"/></svg>
          </div>
          <div>
            <p class="settings-privacy-row__label">Identity Document</p>
            <p class="settings-privacy-row__desc">Upload a clear photo or scan of your government-issued ID. Accepted: JPEG, PNG, WebP, PDF (max 10 MB).</p>
          </div>
        </div>
        <div class="settings-form-grid settings-payment-grid">
          <div class="settings-form-field">
            <label class="settings-field-label">ID Type</label>
            <select class="settings-select" id="id-type-select" aria-label="ID Type">
              <option value="">— Select type —</option>
              <option value="NIN" ${idType === 'NIN' ? 'selected' : ''}>NIN</option>
              <option value="Voter's Card" ${idType === "Voter's Card" ? 'selected' : ''}>Voter's Card</option>
              <option value="Driver's Licence" ${idType === "Driver's Licence" ? 'selected' : ''}>Driver's Licence</option>
              <option value="International Passport" ${idType === 'International Passport' ? 'selected' : ''}>International Passport</option>
            </select>
          </div>
          <div class="settings-form-field">
            <label class="settings-field-label">Upload Document</label>
            <div class="settings-id-upload-row">
              <input type="file" id="id-document-input" class="settings-avatar__file-input"
                accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="Upload ID document" />
              <button class="settings-id-upload-btn" id="id-upload-btn" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
                ${idUrl ? 'Replace document' : 'Choose file'}
              </button>
              ${idUrl ? `<a href="${this.esc(idUrl)}" target="_blank" rel="noopener noreferrer" class="settings-id-view-link">View uploaded</a>` : ''}
              <span class="settings-id-filename" id="id-filename">${idUrl ? '✓ Document on file' : 'No file selected'}</span>
            </div>
            <p class="settings-id-upload-status" id="id-upload-status" aria-live="polite"></p>
          </div>
        </div>
      </div>
    `;
  }

  _renderLanguageSection() {
    const current = getLanguage();
    return `
      <p class="settings-section__desc">${this.esc(t('settings.languageDesc'))}</p>
      <div class="settings-lang-grid">
        ${LANGUAGES.map((l) => {
      const isActive = l.code === current;
      return `
            <button
              class="settings-lang-btn ${isActive ? 'settings-lang-btn--active' : ''}"
              data-lang="${l.code}" type="button" aria-pressed="${isActive}">
              <span class="settings-lang-btn__icon" aria-hidden="true">
                ${this._langIcon(l.code)}
              </span>
              <span class="settings-lang-btn__label">${this.esc(l.native)}</span>
              ${isActive ? `<span class="settings-lang-btn__pill">${this.esc(t('settings.current'))}</span>` : ''}
            </button>
          `;
    }).join('')}
      </div>
    `;
  }

  _renderNotifSection() {
    const user = store.currentUser;
    const lgaName = this.esc(user?.lgaName || 'your LGA');

    const rawLga = user?.lgaName || t('chat.yourLga');
    const groups = [
      {
        heading: t('settings.notifGroupSecurity'),
        items: [
          { key: 'newLogin', label: t('settings.notifNewLogin'), desc: t('settings.notifNewLoginDesc') },
        ],
      },
      {
        heading: t('settings.notifGroupNews'),
        items: [
          { key: 'official',     label: t('settings.notifOfficial'),                            desc: t('settings.notifOfficialDesc') },
          { key: 'breakingNews', label: t('settings.notifBreaking'),                            desc: t('settings.notifBreakingDesc') },
          { key: 'lgaAlerts',    label: t('settings.notifLgaAlerts', { lga: rawLga }),          desc: t('settings.notifLgaAlertsDesc', { lga: rawLga }) },
        ],
      },
      {
        heading: t('settings.notifGroupCommunity'),
        items: [
          { key: 'community',    label: t('settings.notifChatReplies'),   desc: t('settings.notifChatRepliesDesc') },
          { key: 'reelLikes',    label: t('settings.notifReelLikes'),     desc: t('settings.notifReelLikesDesc') },
          { key: 'reelComments', label: t('settings.notifReelComments'),  desc: t('settings.notifReelCommentsDesc') },
        ],
      },
    ];

    return groups.map((g) => `
      <div class="settings-notif-group">
        <p class="settings-notif-group__heading">${this.esc(g.heading)}</p>
        ${g.items.map((item) => `
          <div class="settings-notif-row" id="notif-row-${item.key}">
            <div class="settings-notif-row__text">
              <p class="settings-notif-row__label">${this.esc(item.label)}</p>
              <p class="settings-notif-row__desc">${this.esc(item.desc)}</p>
            </div>
            <div id="notif-toggle-${item.key}"></div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  _renderPrivacySection() {
    const user = store.currentUser;
    const visibility = user?.profileVisibility || 'public';
    const twoFa = user?.twoFaEnabled || false;
    const hasPassword = user?.hasPassword ?? true;
    return `
      <!-- Profile Visibility -->
      <div class="settings-privacy-row">
        <div class="settings-privacy-row__icon settings-privacy-row__icon--green" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="settings-privacy-row__body">
          <p class="settings-privacy-row__label">${t('settings.profileVisibility')}</p>
          <p class="settings-privacy-row__desc">
            ${t('settings.profileVisibilityDesc')}
          </p>
          <select class="settings-select settings-select--sm" id="visibility-select"
            aria-label="${t('settings.profileVisibility')}">
            <option value="public"   ${visibility === 'public' ? 'selected' : ''}>${t('settings.visPublic')}</option>
            <option value="members"  ${visibility === 'members' ? 'selected' : ''}>${t('settings.visMembers')}</option>
            <option value="private"  ${visibility === 'private' ? 'selected' : ''}>${t('settings.visPrivate')}</option>
          </select>
        </div>
        <div class="settings-privacy-row__shield" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-border)" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" opacity="0.4">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
      </div>

      <div class="settings-card__divider"></div>

      <!-- Change Password -->
      <div class="settings-privacy-row settings-privacy-row--col" id="password-section">
        <div style="display:flex;align-items:flex-start;gap:var(--space-4);margin-bottom:var(--space-4);">
          <div class="settings-privacy-row__icon settings-privacy-row__icon--green" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div>
            <p class="settings-privacy-row__label">${hasPassword ? t('settings.changePassword') : t('settings.setPassword')}</p>
            <p class="settings-privacy-row__desc">
              ${hasPassword ? t('settings.changePasswordDesc') : t('settings.setPasswordDesc')}
            </p>
          </div>
        </div>
        <div class="settings-password-form" id="password-form">
          ${hasPassword ? `
            <div id="current-password-mount" style="margin-bottom:var(--space-3);"></div>
          ` : ''}
          <div id="new-password-mount" style="margin-bottom:var(--space-3);"></div>
          <div id="confirm-password-mount" style="margin-bottom:var(--space-4);"></div>
          <div id="save-password-mount"></div>
        </div>
      </div>

      <div class="settings-card__divider"></div>

      <!-- 2FA -->
      <div class="settings-privacy-row">
        <div class="settings-privacy-row__icon settings-privacy-row__icon--green" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 018 0v4"/>
          </svg>
        </div>
        <div class="settings-privacy-row__body">
          <p class="settings-privacy-row__label">${t('settings.twoFaTitle')}</p>
          <p class="settings-privacy-row__desc">
            ${t('settings.twoFaDesc')}
          </p>
          ${twoFa
        ? `<button class="settings-2fa-btn settings-2fa-btn--disable" id="twofa-btn" type="button">
                ${t('settings.disable2fa')}
              </button>`
        : `<button class="settings-2fa-btn" id="twofa-btn" type="button">
                ${t('settings.enable2fa')}
              </button>`
    }
        </div>
      </div>
    `;
  }

  // ── Mount child components ─────────────────────────────────────────────

  _mountProfileInputs(root) {
    const user = store.currentUser;

    this._nameInput = this.addChild(new Input({
      id: 'field-name', name: 'name',
      value: user?.name || '', placeholder: t('settings.fullName'),
    }));
    this._nameInput.mount(root.querySelector('#name-mount'));

    // Username inline edit
    this._wireUsernameEdit(root);

    this._emailInput = this.addChild(new Input({
      id: 'field-email', name: 'email', type: 'email',
      value: user?.email || '', placeholder: t('settings.emailPlaceholder'),
    }));
    this._emailInput.mount(root.querySelector('#email-mount'));

    this.addChild(new Input({
      id: 'field-phone', name: 'phone', type: 'phone',
      value: (user?.phone || '').replace('+234', '0'),
      readonly: true,
      hint: t('settings.phoneReadonly'),
    })).mount(root.querySelector('#phone-mount'));

    this._dobInput = this.addChild(new Input({
      id: 'field-dob', name: 'dob', type: 'date',
      value: user?.dob || '',
      placeholder: t('settings.dateOfBirth'),
    }));
    this._dobInput.mount(root.querySelector('#dob-mount'));

    this._cityInput = this.addChild(new Input({
      id: 'field-city', name: 'city',
      value: user?.city || '', placeholder: t('settings.cityLabel'),
    }));
    this._cityInput.mount(root.querySelector('#city-mount'));

    this._addressInput = this.addChild(new Input({
      id: 'field-address', name: 'address',
      value: user?.address || '', placeholder: t('settings.residentialAddress'),
    }));
    this._addressInput.mount(root.querySelector('#address-mount'));

    this._bankNameInput          = null;
    this._bankAccountNumberInput = null;
    this._bankAccountNameInput   = null;

    const saveBtn = this.addChild(new Button({
      label: t('settings.saveProfile'),
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>`,
      iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => this._saveProfile(saveBtn),
    }));
    saveBtn.mount(root.querySelector('#save-profile-mount'));
  }

  _mountPaymentInputs(root) {
    const user = store.currentUser;

    this._bankNameInput = this.addChild(new Input({
      id: 'field-bank-name', name: 'bankName',
      value: user?.bankName || '',
      placeholder: 'e.g. First Bank, GTBank, Access Bank…',
    }));
    this._bankNameInput.mount(root.querySelector('#bank-name-mount'));

    this._bankAccountNumberInput = this.addChild(new Input({
      id: 'field-bank-account-number', name: 'bankAccountNumber',
      value: user?.bankAccountNumber || '',
      placeholder: '10-digit account number',
      type: 'tel',
    }));
    this._bankAccountNumberInput.mount(root.querySelector('#bank-account-number-mount'));

    this._bankAccountNameInput = this.addChild(new Input({
      id: 'field-bank-account-name', name: 'bankAccountName',
      value: user?.bankAccountName || '',
      placeholder: 'Full name as it appears on your bank account',
    }));
    this._bankAccountNameInput.mount(root.querySelector('#bank-account-name-mount'));

    const savePaymentBtn = this.addChild(new Button({
      label: 'Save Payment Details',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>`,
      iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => this._savePaymentDetails(savePaymentBtn),
    }));
    savePaymentBtn.mount(root.querySelector('#save-payment-mount'));

    // ID document upload
    const idUploadBtn = root.querySelector('#id-upload-btn');
    const idFileInput = root.querySelector('#id-document-input');
    if (idUploadBtn && idFileInput) {
      this.on(idUploadBtn, 'click', () => idFileInput.click());
      this.on(idFileInput, 'change', (e) => this._handleIdUpload(e, root));
    }
  }

  _wireUsernameEdit(root) {
    const displayRow = root.querySelector('#username-display-row');
    const editRow    = root.querySelector('#username-edit-row');
    const display    = root.querySelector('#username-display');
    const editBtn    = root.querySelector('#username-edit-btn');
    const saveBtn    = root.querySelector('#username-save-btn');
    const cancelBtn  = root.querySelector('#username-cancel-btn');
    if (!displayRow || !editRow) return;

    this._usernameInput = this.addChild(new Input({
      placeholder: t('settings.usernamePlaceholder'),
      name: 'username',
      value: store.currentUser?.username || '',
    }));
    this._usernameInput.mount(root.querySelector('#username-input-mount'));

    const showEdit = () => {
      displayRow.style.display = 'none';
      editRow.style.display = 'flex';
      this._usernameInput.focus?.();
    };
    const hideEdit = () => {
      displayRow.style.display = '';
      editRow.style.display = 'none';
    };

    editBtn?.addEventListener('click', showEdit);
    cancelBtn?.addEventListener('click', hideEdit);
    saveBtn?.addEventListener('click', async () => {
      const val = this._usernameInput.getValue()?.trim();
      if (!val) return;
      saveBtn.disabled = true;
      saveBtn.textContent = t('common.saving');
      const res = await api.users.updateUsername(val);
      saveBtn.disabled = false;
      saveBtn.textContent = t('common.save');
      if (res.error) {
        this._usernameInput.setError(
            res.error.code === 'USERNAME_TAKEN' ? t('settings.errUsernameTaken') : res.error.message
        );
        return;
      }
      store.currentUser = res.data;
      const session = JSON.parse(sessionStorage.getItem('adm_auth') || '{}');
      session.user = res.data;
      sessionStorage.setItem('adm_auth', JSON.stringify(session));
      if (display) display.textContent = '@' + res.data.username;
      this._usernameInput.setError('');
      hideEdit();
      showToast('success', t('settings.usernameUpdated'));
    });
  }

  _mountNotifToggles(root) {
    const user = store.currentUser;
    const prefs = user?.notifPrefs || {};
    const defaults = {
      official: true, community: true, lgaAlerts: false,
      newLogin: true, reelLikes: true, reelComments: true, breakingNews: true,
    };

    for (const key of Object.keys(defaults)) {
      const mount = root.querySelector(`#notif-toggle-${key}`);
      if (!mount) continue;
      const toggle = this.addChild(new Toggle({
        checked: prefs[key] !== undefined ? prefs[key] : defaults[key],
        onChange: (val) => this._saveNotifPref(key, val),
      }));
      toggle.mount(mount);
    }
  }

  _mountPrivacyControls(root) {
    // Visibility dropdown
    const visSelect = root.querySelector('#visibility-select');
    if (visSelect) {
      this.on(visSelect, 'change', () => this._savePrivacy({ profileVisibility: visSelect.value }));
    }

    // 2FA button
    const twofaBtn = root.querySelector('#twofa-btn');
    if (twofaBtn) {
      this.on(twofaBtn, 'click', () => this._toggleTwoFa(root));
    }

    // Password form
    const hasPassword = store.currentUser?.hasPassword ?? true;
    if (hasPassword) {
      this._currentPasswordInput = this.addChild(new Input({
        id: 'current-password', name: 'currentPassword', type: 'password',
        placeholder: t('settings.currentPassword'),
      }));
      this._currentPasswordInput.mount(root.querySelector('#current-password-mount'));
    }
    this._newPasswordInput = this.addChild(new Input({
      id: 'new-password', name: 'newPassword', type: 'password',
      placeholder: t('settings.newPassword'),
    }));
    this._newPasswordInput.mount(root.querySelector('#new-password-mount'));

    this._confirmPasswordInput = this.addChild(new Input({
      id: 'confirm-password', name: 'confirmPassword', type: 'password',
      placeholder: t('settings.confirmPassword'),
    }));
    this._confirmPasswordInput.mount(root.querySelector('#confirm-password-mount'));

    const savePasswordBtn = this.addChild(new Button({
      label: hasPassword ? t('settings.updatePassword') : t('settings.setPasswordBtn'),
      variant: 'secondary', size: 'md',
      onClick: () => this._savePassword(savePasswordBtn),
    }));
    savePasswordBtn.mount(root.querySelector('#save-password-mount'));
  }

  // ── Event binding ──────────────────────────────────────────────────────

  _bindNavLinks(root) {
    const content = root.querySelector('#settings-content');
    this.delegate('.settings-nav__link', 'click', (e, link) => {
      e.preventDefault();
      const target = root.querySelector(`#${link.dataset.section}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  _bindProfileActions(root) {
    // Avatar upload
    const changeBtn = root.querySelector('#avatar-change-btn');
    const removeBtn = root.querySelector('#avatar-remove-btn');
    const fileInput = root.querySelector('#avatar-file-input');

    if (changeBtn && fileInput) {
      this.on(changeBtn, 'click', () => fileInput.click());
      this.on(fileInput, 'change', (e) => this._handleAvatarUpload(e, root));
    }
    if (removeBtn) {
      this.on(removeBtn, 'click', () => this._removeAvatar(root));
    }
  }

  _bindLanguageActions(root) {
    this.delegate('.settings-lang-btn', 'click', (e, btn) => {
      const code = btn.dataset.lang;
      if (!code || getLanguage() === code) return;
      const meta = LANGUAGES.find((l) => l.code === code);
      showToast('success', t('settings.setTo', { name: meta?.native || code }));
      // Persists the choice and triggers router.reload() to re-render the whole
      // app (including this page) in the new dictionary.
      setLanguage(code);
    });
  }

  // ── Scrollspy ──────────────────────────────────────────────────────────

  _bindScrollspy() {
    const sections = SECTIONS.map((s) => ({
      id: s.id,
      el: this.getContentEl()?.querySelector(`#${s.id}`),
    })).filter((s) => s.el);
    if (!sections.length) return;

    // Scroll happens on window (WebLayout content is not a scrolling div)
    this.on(window, 'scroll', () => {
      const scrollTop = window.scrollY + 100;
      let current = sections[0].id;
      for (const s of sections) {
        if (s.el.getBoundingClientRect().top + window.scrollY <= scrollTop) {
          current = s.id;
        }
      }
      if (current !== this._activeSection) {
        this._activeSection = current;
        const nav = this.getContentEl()?.querySelector('#settings-nav');
        nav?.querySelectorAll('.settings-nav__link').forEach((link) => {
          link.classList.toggle('settings-nav__link--active', link.dataset.section === current);
        });
      }
    }, { passive: true });
  }

  // ── Actions ────────────────────────────────────────────────────────────

  async _handleAvatarUpload(e, root) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      showToast('error', t('settings.errPhotoInvalid'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', t('settings.errPhotoTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      // Optimistic update
      const wrap = root.querySelector('#avatar-wrap');
      if (wrap) {
        wrap.innerHTML = Avatar.html({ name: store.currentUser?.name || '', imageUrl: dataUrl, size: 'xl' }) +
            `<input type="file" id="avatar-file-input" class="settings-avatar__file-input"
            accept="image/*" aria-label="Upload profile picture" />`;
        // Re-bind file input
        const newInput = wrap.querySelector('#avatar-file-input');
        if (newInput) this.on(newInput, 'change', (e2) => this._handleAvatarUpload(e2, root));
      }
      const res = await api.users.uploadAvatar(dataUrl);
      if (res.error) {
        showToast('error', t('settings.errPhotoUpload'));
        return;
      }
      if (res.data?.avatarUrl) {
        store.currentUser = { ...store.currentUser, avatarUrl: res.data.avatarUrl };
        const { saveSession } = await import('../../../utils/storage.js?v=20260806f');
        const auth = JSON.parse(sessionStorage.getItem('adm_auth') || '{}');
        saveSession({ token: auth.token, role: store.role, user: store.currentUser });
      }
      showToast('success', t('settings.photoUpdated'));
    };
    reader.readAsDataURL(file);
  }

  async _removeAvatar(root) {
    const res = await api.users.uploadAvatar(null);
    if (res.error) { showToast('error', t('settings.errPhotoRemove')); return; }
    const wrap = root.querySelector('#avatar-wrap');
    if (wrap) {
      wrap.innerHTML = Avatar.html({ name: store.currentUser?.name || '', imageUrl: null, size: 'xl' }) +
          `<input type="file" id="avatar-file-input" class="settings-avatar__file-input"
          accept="image/*" aria-label="Upload profile picture" />`;
      const newInput = wrap.querySelector('#avatar-file-input');
      if (newInput) this.on(newInput, 'change', (e) => this._handleAvatarUpload(e, root));
    }
    showToast('success', t('settings.photoRemoved'));
  }

  async _saveProfile(btn) {
    const name = this._nameInput?.getValue()?.trim();
    const email = this._emailInput?.getValue()?.trim();
    const dob = this._dobInput?.getValue()?.trim() || null;
    const city = this._cityInput?.getValue()?.trim() || null;
    const address = this._addressInput?.getValue()?.trim() || null;
    const lgaId = Number(this.getContentEl()?.querySelector('#lga-select')?.value);
    const lga = this._lgas.find((l) => l.id === lgaId);

    if (!name) { this._nameInput?.setError(t('settings.errNameRequired')); return; }
    this._nameInput?.clearError();

    if (this._saving) return;
    this._saving = true;
    btn.setLoading(true);

    const res = await api.users.updateProfile({
      name, email: email || null,
      lgaId, lgaName: lga?.name || '',
      dob, city, address,
    });

    this._saving = false;
    btn.setLoading(false);

    if (res.error) { showToast('error', res.error.message || t('settings.errSaveFailed')); return; }

    const updatedUser = {
      ...store.currentUser,
      name, email: email || null,
      lgaId, lgaName: lga?.name || '',
      dob, city, address,
    };
    store.currentUser = updatedUser;
    store.currentLGA = { id: lgaId, name: lga?.name || '' };

    saveSession({
      token: JSON.parse(sessionStorage.getItem('adm_auth') || '{}').token,
      role: store.role,
      user: updatedUser,
    });

    showToast('success', t('settings.profileUpdated'));
  }

  async _savePaymentDetails(btn) {
    const bankName          = this._bankNameInput?.getValue()?.trim() || null;
    const bankAccountNumber = this._bankAccountNumberInput?.getValue()?.trim() || null;
    const bankAccountName   = this._bankAccountNameInput?.getValue()?.trim() || null;
    const idType = this.getContentEl()?.querySelector('#id-type-select')?.value || null;

    btn.setLoading(true);
    const res = await api.users.updateProfile({ bankName, bankAccountNumber, bankAccountName, idType });
    btn.setLoading(false);

    if (res.error) { showToast('error', res.error.message || 'Failed to save payment details.'); return; }

    store.currentUser = { ...store.currentUser, bankName, bankAccountNumber, bankAccountName, idType };
    saveSession({
      token: JSON.parse(sessionStorage.getItem('adm_auth') || '{}').token,
      role: store.role,
      user: store.currentUser,
    });
    showToast('success', 'Payment details saved.');
  }

  async _handleIdUpload(e, root) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      showToast('error', 'Only JPEG, PNG, WebP or PDF files are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', 'File must be under 10 MB.');
      return;
    }

    const statusEl  = root.querySelector('#id-upload-status');
    const filenameEl = root.querySelector('#id-filename');
    if (statusEl)  statusEl.textContent = 'Uploading…';
    if (filenameEl) filenameEl.textContent = file.name;

    const idType = root.querySelector('#id-type-select')?.value || null;
    if (idType) await api.users.updateProfile({ idType });

    const res = await api.users.uploadIdDocument(file);
    if (res.error) {
      if (statusEl) statusEl.textContent = res.error.message || 'Upload failed.';
      showToast('error', res.error.message || 'Failed to upload ID document.');
      return;
    }

    store.currentUser = { ...store.currentUser, idDocumentUrl: res.data?.idDocumentUrl, idType };
    saveSession({
      token: JSON.parse(sessionStorage.getItem('adm_auth') || '{}').token,
      role: store.role,
      user: store.currentUser,
    });

    if (statusEl) statusEl.textContent = '✓ Uploaded successfully';
    const uploadBtn = root.querySelector('#id-upload-btn');
    if (uploadBtn) uploadBtn.textContent = 'Replace document';
    showToast('success', 'ID document uploaded.');
  }

  async _saveNotifPref(key, val) {
    const res = await api.users.updateNotifPrefs({ [key]: val });
    if (res.error) showToast('error', t('settings.errNotifSave'));
  }

  async _savePassword(btn) {
    const hasPassword = store.currentUser?.hasPassword ?? true;
    const currentPassword = this._currentPasswordInput?.getValue()?.trim() || '';
    const newPassword = this._newPasswordInput?.getValue()?.trim() || '';
    const confirmPassword = this._confirmPasswordInput?.getValue()?.trim() || '';

    if (!newPassword) { this._newPasswordInput?.setError(t('settings.errNewPasswordRequired')); return; }
    if (newPassword.length < 8) { this._newPasswordInput?.setError(t('settings.errPasswordLength')); return; }
    if (newPassword !== confirmPassword) { this._confirmPasswordInput?.setError(t('settings.errPasswordMismatch')); return; }
    this._newPasswordInput?.clearError();
    this._confirmPasswordInput?.clearError();

    btn.setLoading(true);
    const res = await api.users.updatePassword({ currentPassword, newPassword });
    btn.setLoading(false);

    if (res.error) {
      const msg = res.error.code === 'INVALID_PASSWORD'
          ? t('settings.errCurrentPasswordWrong')
          : res.error.message || t('settings.errPasswordUpdate');
      if (res.error.code === 'INVALID_PASSWORD') this._currentPasswordInput?.setError(msg);
      else showToast('error', msg);
      return;
    }

    showToast('success', t('settings.passwordUpdated'));
    this._currentPasswordInput?.setValue('');
    this._newPasswordInput?.setValue('');
    this._confirmPasswordInput?.setValue('');

    if (res.data?.hasPassword && !hasPassword) {
      store.currentUser = { ...store.currentUser, hasPassword: true };
    }
  }

  async _savePrivacy(data) {
    const res = await api.users.updatePrivacySettings(data);
    if (res.error) showToast('error', t('settings.errPrivacySave'));
    else showToast('success', t('settings.privacyUpdated'));
  }

  async _toggleTwoFa(root) {
    const user = store.currentUser;
    const enabled = user?.twoFaEnabled || false;

    if (!window._twoFaModal) {
      const { TwoFactorModal } = await import('../../../components/feature/TwoFactorModal.js?v=20260806f');
      window._twoFaModal = new TwoFactorModal();
      await window._twoFaModal.mount(document.body, { append: true });
    }

    // Callback to refresh the button after modal closes
    window._refresh2FASection = () => {
      const btn = root.querySelector('#twofa-btn');
      const isNowEnabled = store.currentUser?.twoFaEnabled || false;
      if (btn) {
        btn.textContent = isNowEnabled ? t('settings.disable2fa') : t('settings.enable2fa');
        btn.classList.toggle('settings-2fa-btn--disable', isNowEnabled);
      }
    };

    window._twoFaModal.open(enabled ? 'disable' : 'enable');
  }

  // ── Icon helpers ───────────────────────────────────────────────────────

  _navIcon(name) {
    const icons = {
      profile: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      star: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      payment: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
      language: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
      bell: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
      shield: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    };
    return icons[name] || '';
  }

  _langIcon(code) {
    // Simple emoji flag approximation per language
    const icons = {
      en: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
      ig: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
      ha: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
      yo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
    };
    return icons[code] || icons.en;
  }
}
