/**
 * PayoutPanel — cashing out referral earnings.
 *
 * Mounted by the Referrals page in each region. Written as one component
 * rather than repeated in every regional copy of that page, so the payout
 * rules live in a single place.
 *
 * Shows what has been earned, what is still available, and where the money
 * will be sent. Requesting a withdrawal reserves the amount immediately, so
 * the available figure drops the moment the request is submitted rather than
 * when an admin gets round to it.
 */

import { Component } from '../../core/component.js?v=20260805c';
import { showToast } from '../../core/store.js?v=20260805c';
import { api } from '../../api/client.js?v=20260805c';
import { formatDate } from '../../utils/date.js?v=20260805c';

const naira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class PayoutPanel extends Component {
  static styles = '/components/feature/PayoutPanel.css?v=20260805c';

  constructor(props = {}) {
    super(props);
    this._data    = null;
    this._history = [];
    this._editing = false;
    this._busy    = false;
  }

  render() {
    return `<section class="payout" aria-label="Referral earnings"><div class="payout__loading">Loading your earnings…</div></section>`;
  }

  async afterMount() {
    await this._load();

    this.delegate('#payout-edit',   'click', () => { this._editing = true;  this._paint(); });
    this.delegate('#payout-cancel', 'click', () => { this._editing = false; this._paint(); });
    this.delegate('#payout-save',    'click', () => this._saveAccount());
    this.delegate('#payout-save-id', 'click', () => this._saveIdentity());
    this.delegate('#payout-request', 'click', () => this._request());
  }

  async _load() {
    const [sum, hist] = await Promise.all([
      api.withdrawals.summary(),
      api.withdrawals.mine(),
    ]);

    if (sum.error) {
      this.el.innerHTML = `<div class="payout__error">${this.esc(sum.error.message || 'Could not load your earnings.')}</div>`;
      return;
    }

    this._data    = sum.data;
    this._history = hist.data || [];
    // No account saved yet: open the form straight away rather than hiding
    // the only useful action behind an extra click.
    this._editing = !this._data.payoutAccount;
    this._paint();
  }

  _paint() {
    const d = this._data;
    if (!d) return;

    this.el.innerHTML = `
      <header class="payout__head">
        <div>
          <h2 class="payout__title">Referral earnings</h2>
          <p class="payout__sub">
            ${d.referralCount} referral${d.referralCount === 1 ? '' : 's'} at ${naira(d.rewardRate)} each.
          </p>
        </div>
        <div class="payout__balance">
          <span class="payout__balance-value">${naira(d.availableAmount)}</span>
          <span class="payout__balance-label">Available</span>
        </div>
      </header>

      <dl class="payout__figures">
        <div><dt>Earned</dt><dd>${naira(d.totalEarned)}</dd></div>
        <div><dt>Paid out</dt><dd>${naira(d.totalPaid)}</dd></div>
        <div><dt>Awaiting approval</dt><dd>${naira(d.pendingAmount)}</dd></div>
      </dl>

      ${this._accountHtml()}
      ${this._identityHtml()}
      ${this._actionHtml()}
      ${this._historyHtml()}
    `;
  }

  /**
   * Identity verification.
   *
   * Lives here rather than only under Settings because this is where a citizen
   * is thinking about being paid, and it is the document an admin looks at
   * before releasing the money. Uploading is not enforced — an admin can still
   * decline a request with no ID attached — but the panel says plainly that a
   * payout is likely to be held up without one.
   */
  _identityHtml() {
    const id = this._data.identity || {};
    const has = !!id.idDocumentUrl;

    const preview = has
      ? `<a class="payout__id-view" href="${this.esc(id.idDocumentUrl)}" target="_blank" rel="noopener noreferrer">View uploaded document</a>`
      : '';

    return `
      <div class="payout__identity">
        <p class="payout__form-title">Identity verification</p>

        <div class="payout__id-state ${has ? 'payout__id-state--ok' : 'payout__id-state--missing'}">
          ${has
            ? `<span>${this.esc(id.idType || 'Document')} on file</span> ${preview}`
            : `<span>No identification uploaded. Payouts may be held until you add one.</span>`}
        </div>

        <div class="payout__fields">
          <label class="payout__field">
            <span>ID type</span>
            <select id="pf-idtype">
              <option value="">Select…</option>
              ${['NIN', "Voter's Card", "Driver's Licence", 'International Passport']
                .map((t) => `<option value="${this.esc(t)}" ${id.idType === t ? 'selected' : ''}>${this.esc(t)}</option>`)
                .join('')}
            </select>
          </label>
          <label class="payout__field">
            <span>Upload a clear photo or scan</span>
            <input id="pf-iddoc" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
          </label>
        </div>

        <div class="payout__form-actions">
          <button class="payout__btn" id="payout-save-id" type="button">
            ${has ? 'Update identification' : 'Save identification'}
          </button>
        </div>
      </div>`;
  }

  _accountHtml() {
    const a = this._data.payoutAccount;

    if (!this._editing && a) {
      return `
        <div class="payout__account">
          <div>
            <p class="payout__account-bank">${this.esc(a.bankName)}</p>
            <p class="payout__account-number">${this.esc(a.accountNumber)} &middot; ${this.esc(a.accountName)}</p>
          </div>
          <button class="payout__link-btn" id="payout-edit" type="button">Change</button>
        </div>`;
    }

    return `
      <div class="payout__form">
        <p class="payout__form-title">Where should we send your money?</p>
        <div class="payout__fields">
          <label class="payout__field">
            <span>Bank name</span>
            <input id="pf-bank" type="text" value="${a ? this.esc(a.bankName) : ''}" placeholder="e.g. GTBank" maxlength="120" />
          </label>
          <label class="payout__field">
            <span>Account number</span>
            <input id="pf-number" type="text" inputmode="numeric" value="${a ? this.esc(a.accountNumber) : ''}"
                   placeholder="10 digits" maxlength="10" />
          </label>
          <label class="payout__field">
            <span>Account name</span>
            <input id="pf-name" type="text" value="${a ? this.esc(a.accountName) : ''}"
                   placeholder="Name exactly as it appears at your bank" maxlength="150" />
          </label>
        </div>
        <div class="payout__form-actions">
          <button class="payout__btn payout__btn--primary" id="payout-save" type="button">Save account</button>
          ${a ? `<button class="payout__btn" id="payout-cancel" type="button">Cancel</button>` : ''}
        </div>
      </div>`;
  }

  _actionHtml() {
    const d = this._data;

    if (d.openRequest) {
      return `
        <div class="payout__notice payout__notice--pending">
          <strong>${naira(d.openRequest.amount)} awaiting approval.</strong>
          Requested ${this.esc(formatDate(d.openRequest.requestedAt))}. You will be emailed once it has been paid.
        </div>`;
    }

    if (!d.payoutAccount) {
      return `<div class="payout__notice">Save your bank details above to request a withdrawal.</div>`;
    }

    if (d.availableAmount < d.minWithdrawal) {
      return `
        <div class="payout__notice">
          The minimum withdrawal is ${naira(d.minWithdrawal)}. Keep referring to reach it.
        </div>`;
    }

    return `
      <div class="payout__request">
        <button class="payout__btn payout__btn--primary payout__btn--wide" id="payout-request" type="button">
          Withdraw ${naira(d.availableAmount)}
        </button>
        <p class="payout__hint">Paid by bank transfer once an admin approves it.</p>
      </div>`;
  }

  _historyHtml() {
    if (!this._history.length) return '';

    return `
      <div class="payout__history">
        <p class="payout__history-title">Withdrawal history</p>
        <ul class="payout__history-list">
          ${this._history.map((h) => `
            <li>
              <span class="payout__history-amount">${naira(h.amount)}</span>
              <span class="payout__badge payout__badge--${this.esc(h.status)}">${this.esc(h.status)}</span>
              <span class="payout__history-date">${this.esc(formatDate(h.requestedAt))}</span>
              ${h.status === 'rejected' && h.adminNote
                ? `<span class="payout__history-note">${this.esc(h.adminNote)}</span>` : ''}
            </li>`).join('')}
        </ul>
      </div>`;
  }

  async _saveAccount() {
    if (this._busy) return;

    const bankName      = this.$('#pf-bank')?.value.trim() || '';
    const accountNumber = (this.$('#pf-number')?.value || '').replace(/\s+/g, '');
    const accountName   = this.$('#pf-name')?.value.trim() || '';

    if (!bankName || !accountNumber || !accountName) {
      showToast('error', 'Fill in all three fields.');
      return;
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      showToast('error', 'Account number must be exactly 10 digits.');
      return;
    }

    this._busy = true;
    const res = await api.withdrawals.saveAccount({ bankName, accountNumber, accountName });
    this._busy = false;

    if (res.error) {
      showToast('error', res.error.message || 'Could not save those details.');
      return;
    }

    showToast('success', 'Bank details saved.');
    this._editing = false;
    await this._load();
  }

  /**
   * Saves the ID type and, if one was chosen, the document itself.
   *
   * The two are separate endpoints — the type is an ordinary profile field,
   * the file is a multipart upload — so either can be updated on its own.
   * Someone correcting only the type should not have to re-upload the scan.
   */
  async _saveIdentity() {
    if (this._busy) return;

    const idType = this.$('#pf-idtype')?.value || '';
    const file   = this.$('#pf-iddoc')?.files?.[0] || null;

    if (!idType && !file) {
      showToast('error', 'Choose an ID type, a document, or both.');
      return;
    }

    if (file && file.size > 5 * 1024 * 1024) {
      showToast('error', 'That file is larger than 5MB. Try a smaller photo or scan.');
      return;
    }

    this._busy = true;
    const btn = this.$('#payout-save-id');
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    // Restores the button on every path that does not repaint the panel.
    // Returning early on an error used to leave it stuck on "Saving…", which
    // looked like a hang and hid the message explaining what actually failed.
    const done = () => {
      this._busy = false;
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; }
    };

    try {
      if (idType) {
        const res = await api.users.updateProfile({ idType });
        if (res.error) {
          showToast('error', res.error.message || 'Could not save the ID type.');
          done();
          return;
        }
      }

      if (file) {
        const up = await api.users.uploadIdDocument(file);
        if (up.error) {
          showToast('error', up.error.message || 'Could not upload that document.');
          done();
          return;
        }
      }

      showToast('success', 'Identification saved.');
      this._busy = false;
      await this._load();   // repaints, so the button is rebuilt from scratch
    } catch (err) {
      // A thrown error (network drop, unreadable response) must not strand
      // the button either. Show what actually broke: a generic apology tells
      // the person nothing and tells whoever has to fix it even less.
      const detail = err?.message ? ` (${err.message})` : '';
      showToast('error', `Could not save your identification${detail}`);
      console.error('[payout] identity save failed', err);
      done();
    }
  }

  async _request() {
    if (this._busy) return;

    this._busy = true;
    const btn = this.$('#payout-request');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending request…'; }

    const res = await api.withdrawals.request();
    this._busy = false;

    if (res.error) {
      showToast('error', res.error.message || 'Could not submit that request.');
      this._paint();
      return;
    }

    showToast('success', 'Withdrawal requested. You will be emailed once it is paid.');
    await this._load();
  }
}
