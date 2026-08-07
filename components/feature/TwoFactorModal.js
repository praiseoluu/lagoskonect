/**
 * LagKonnect — Two-Factor Auth Modal
 * ============================================================
 * Manages its own DOM directly — does NOT use setState() or
 * _rerender() so the framework never replaces this.el mid-session.
 *
 * The overlay element is created once and persists for the entire
 * app session. Steps are rendered into #twofa-body innerHTML only,
 * never touching the outer overlay element.
 */

import { Component } from '../../../core/component.js?v=20260806e';
import { store, showToast } from '../../../core/store.js?v=20260806e';
import { api } from '../../../api/client.js?v=20260806e';

export class TwoFactorModal extends Component {
  static styles = '/components/feature/TwoFactorModal.css?v=20260806e';

  constructor(props = {}) {
    super(props);
    this._isOpen = false;
    this._mode = 'enable';
    this._step = 1;
    this._secret = '';
    this._otpauthUri = '';
    this._backupCodes = [];
    this._prevFocus = null;
  }

  render() {
    return `
      <div class="twofa-overlay" role="dialog" aria-modal="true" aria-label="Two-Factor Authentication" inert>
        <div class="twofa-modal">
          <button class="twofa-modal__close" id="twofa-close" type="button" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div id="twofa-body"></div>
        </div>
      </div>
    `;
  }

  afterMount() {
    const closeBtn = this.el.querySelector('#twofa-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this._isOpen) this.close(); });
  }

  open(mode = 'enable') {
    if (this._isOpen) return;
    this._isOpen = true;
    this._mode = mode;
    this._step = 1;
    this._prevFocus = document.activeElement;
    this.el.removeAttribute('inert');
    this.el.classList.add('twofa-overlay--visible');
    document.body.style.overflow = 'hidden';
    this._renderStep();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.el.setAttribute('inert', '');
    this.el.classList.remove('twofa-overlay--visible');
    document.body.style.overflow = '';
    this._prevFocus?.focus();
    this._secret = '';
    this._otpauthUri = '';
    this._backupCodes = [];
    const body = this.el.querySelector('#twofa-body');
    if (body) body.innerHTML = '';
  }

  _body() { return this.el.querySelector('#twofa-body'); }

  async _renderStep() {
    if (this._mode === 'disable') { this._renderDisable(); return; }
    if (this._step === 1) await this._renderSetupStep();
    else if (this._step === 2) this._renderConfirmStep();
    else if (this._step === 3) this._renderBackupStep();
  }

  async _renderSetupStep() {
    const body = this._body();
    if (!body) return;
    body.innerHTML = `
      <div class="twofa-step">
        <div class="twofa-step__icon twofa-step__icon--blue" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
        </div>
        <h2 class="twofa-step__title">Set Up Authenticator App</h2>
        <p class="twofa-step__desc">Scan this QR code with your authenticator app (Google Authenticator, Authy, or Microsoft Authenticator).</p>
        <div class="twofa-qr" id="twofa-qr-wrap"><div class="twofa-qr__loading">Loading QR code…</div></div>
        <details class="twofa-manual">
          <summary class="twofa-manual__toggle">Can't scan? Enter code manually</summary>
          <p class="twofa-manual__desc">In your app, choose "Enter setup key" and type:</p>
          <code class="twofa-manual__code" id="twofa-secret">Loading…</code>
        </details>
        <p class="twofa-step__hint">Once scanned, click Continue to verify it worked.</p>
        <div class="twofa-step__actions">
          <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="step1-cancel">Cancel</button>
          <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="step1-next">Continue →</button>
        </div>
      </div>`;
    body.querySelector('#step1-cancel').addEventListener('click', () => this.close());
    body.querySelector('#step1-next').addEventListener('click', () => { this._step = 2; this._renderStep(); });
    const res = await api.auth.twoFaSetup();
    if (res.error) { showToast('error', res.error.message); this.close(); return; }
    this._secret = res.data.secret;
    this._otpauthUri = res.data.otpauthUri;
    const qrWrap = body.querySelector('#twofa-qr-wrap');
    const secretEl = body.querySelector('#twofa-secret');
    if (secretEl) secretEl.textContent = this._secret.match(/.{1,4}/g)?.join(' ') || this._secret;
    if (qrWrap) {
      try {
        // Load QR library if not already loaded
        if (!window.qrcode) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/utils/qrcode.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const qr = window.qrcode(0, 'M');
        qr.addData(this._otpauthUri);
        qr.make();
        qrWrap.innerHTML = qr.createImgTag(4);
        const img = qrWrap.querySelector('img');
        if (img) { img.alt = '2FA QR Code'; img.className = 'twofa-qr__img'; }
      } catch (e) {
        console.warn('TwoFactorModal: QR generation failed', e);
        qrWrap.innerHTML = `<p class="twofa-qr__fallback">Could not generate QR code. Please use the manual code below.</p>`;
      }
    }
  }

  _renderConfirmStep() {
    const body = this._body();
    if (!body) return;
    body.innerHTML = `
      <div class="twofa-step">
        <div class="twofa-step__icon twofa-step__icon--green" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 class="twofa-step__title">Verify Your Code</h2>
        <p class="twofa-step__desc">Enter the 6-digit code shown in your authenticator app to confirm setup.</p>
        <input type="text" class="twofa-code-input" id="twofa-code" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code" aria-label="6-digit authenticator code" />
        <p class="twofa-step__error" id="confirm-error" aria-live="polite"></p>
        <div class="twofa-step__actions">
          <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="step2-back">← Back</button>
          <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="step2-confirm">Activate 2FA</button>
        </div>
      </div>`;
    const input = body.querySelector('#twofa-code');
    const errorEl = body.querySelector('#confirm-error');
    const confirmBtn = body.querySelector('#step2-confirm');
    setTimeout(() => input?.focus(), 100);
    body.querySelector('#step2-back').addEventListener('click', () => { this._step = 1; this._renderStep(); });
    const handleConfirm = async () => {
      const code = input.value.trim();
      if (code.length !== 6) { errorEl.textContent = 'Please enter the 6-digit code.'; return; }
      errorEl.textContent = '';
      confirmBtn.textContent = 'Verifying…';
      confirmBtn.disabled = true;
      const res = await api.auth.twoFaConfirm(code);
      confirmBtn.textContent = 'Activate 2FA';
      confirmBtn.disabled = false;
      if (res.error) { errorEl.textContent = res.error.code === 'INVALID_CODE' ? 'Incorrect code. Please check your app and try again.' : res.error.message; return; }
      if (store.currentUser) store.currentUser = { ...store.currentUser, twoFaEnabled: true, totpMethod: 'totp' };
      this._backupCodes = res.data.backupCodes;
      this._step = 3;
      this._renderStep();
    };
    confirmBtn.addEventListener('click', handleConfirm);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleConfirm(); });
    input.addEventListener('input', () => { if (input.value.length === 6) handleConfirm(); });
  }

  _renderBackupStep() {
    const body = this._body();
    if (!body) return;
    const codes = this._backupCodes;
    const codesHtml = codes.map((c) => `<code class="twofa-backup__code">${c}</code>`).join('');
    body.innerHTML = `
      <div class="twofa-step">
        <div class="twofa-step__icon twofa-step__icon--amber" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h2 class="twofa-step__title">Save Your Backup Codes</h2>
        <p class="twofa-step__desc"><strong>Store these somewhere safe.</strong> If you lose access to your authenticator app, these are the only way back in. Each code can only be used once.</p>
        <div class="twofa-backup__grid">${codesHtml}</div>
        <p class="twofa-step__warning">⚠️ These codes will not be shown again.</p>
        <div class="twofa-step__actions">
          <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="step3-copy">Copy All Codes</button>
          <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="step3-done">I've Saved My Codes</button>
        </div>
      </div>`;
    body.querySelector('#step3-copy').addEventListener('click', () => {
      navigator.clipboard?.writeText(codes.join('\n')).then(() => showToast('success', 'Backup codes copied.'));
    });
    body.querySelector('#step3-done').addEventListener('click', () => {
      showToast('success', '2FA enabled. Your account is now more secure.');
      this.close();
      window._refresh2FASection?.();
    });
  }

  _renderDisable() {
    const body = this._body();
    if (!body) return;
    body.innerHTML = `
      <div class="twofa-step">
        <div class="twofa-step__icon twofa-step__icon--red" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h2 class="twofa-step__title">Disable Two-Factor Authentication</h2>
        <p class="twofa-step__desc">Enter your current authenticator code to confirm you want to disable 2FA.</p>
        <input type="text" class="twofa-code-input" id="twofa-disable-code" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code" aria-label="Current authenticator code" />
        <p class="twofa-step__error" id="disable-error" aria-live="polite"></p>
        <div class="twofa-step__actions">
          <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="disable-cancel">Cancel</button>
          <button class="ktg-btn ktg-btn--danger ktg-btn--md" id="disable-confirm">Disable 2FA</button>
        </div>
      </div>`;
    const input = body.querySelector('#twofa-disable-code');
    const errorEl = body.querySelector('#disable-error');
    const disableBtn = body.querySelector('#disable-confirm');
    setTimeout(() => input?.focus(), 100);
    body.querySelector('#disable-cancel').addEventListener('click', () => this.close());
    const handleDisable = async () => {
      const code = input.value.trim();
      if (!code) { errorEl.textContent = 'Please enter your authenticator code.'; return; }
      errorEl.textContent = '';
      disableBtn.textContent = 'Disabling…';
      disableBtn.disabled = true;
      const res = await api.auth.twoFaDisable(code);
      disableBtn.textContent = 'Disable 2FA';
      disableBtn.disabled = false;
      if (res.error) { errorEl.textContent = res.error.code === 'INVALID_CODE' ? 'Incorrect code. Please try again.' : res.error.message; return; }
      if (store.currentUser) store.currentUser = { ...store.currentUser, twoFaEnabled: false, totpMethod: 'none' };
      showToast('success', '2FA has been disabled.');
      this.close();
      window._refresh2FASection?.();
    };
    disableBtn.addEventListener('click', handleDisable);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleDisable(); });
  }
}