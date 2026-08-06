/**
 * Lagos Konect — Referral Payouts (admin)
 * Route: /admin/withdrawals
 * ============================================================
 * The queue of citizens asking to cash out referral earnings.
 *
 * Nothing here moves money. An admin makes the bank transfer themselves, then
 * records it here. Recording it is what permanently reduces the citizen's
 * balance and sends their confirmation email, so the button deliberately says
 * "I have paid this" rather than "Pay".
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js?v=20260806c';
import { showToast, setPageLoading } from '../../../core/store.js?v=20260806c';
import { api } from '../../../api/client.js?v=20260806c';
import { formatDateTime } from '../../../utils/date.js?v=20260806c';

const naira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = [
  { key: 'pending',  label: 'Awaiting payment' },
  { key: 'paid',     label: 'Paid' },
  { key: 'rejected', label: 'Declined' },
];

export default class WithdrawalsPage extends AdminLayout {
  static styles = '/pages/admin/app/Withdrawals.css?v=20260806c';

  constructor(props) {
    super({ title: 'Referral Payouts', ...props });
    this._status   = 'pending';
    this._requests = [];
    this._summary  = null;
  }

  getContent() {
    return `<div class="wd-page" id="wd-root"></div>`;
  }

  async onContentReady() {
    await this._load();

    this.delegate('[data-tab]', 'click', (e, el) => {
      this._status = el.dataset.tab;
      this._load();
    });
    this.delegate('[data-copy]', 'click', (e, el) => this._copy(el.dataset.copy));
    this.delegate('[data-pay]',  'click', (e, el) => this._pay(Number(el.dataset.pay)));
    this.delegate('[data-reject]', 'click', (e, el) => this._reject(Number(el.dataset.reject)));
  }

  async _load() {
    setPageLoading(true);
    const res = await api.withdrawals.adminList(this._status);
    setPageLoading(false);

    if (res.error) {
      showToast('error', res.error.message || 'Could not load payout requests.');
      return;
    }

    this._requests = res.data.requests || [];
    this._summary  = res.data.summary  || null;
    this._paint();
  }

  _paint() {
    const root = this.getContentEl()?.querySelector('#wd-root');
    if (!root) return;

    const s = this._summary || {};

    root.innerHTML = `
      <header class="wd-header">
        <div>
          <p class="wd-eyebrow">Referrals</p>
          <h1 class="wd-title">Payout requests</h1>
          <p class="wd-sub">
            Make the transfer from your bank, then record it here. Recording it reduces the
            citizen's balance and emails them a confirmation.
          </p>
        </div>
        <div class="wd-stats">
          <div class="wd-stat wd-stat--owed">
            <span class="wd-stat__value">${naira(s.pendingTotal)}</span>
            <span class="wd-stat__label">Awaiting payment</span>
            <span class="wd-stat__sub">${s.pending ?? 0} request${s.pending === 1 ? '' : 's'}</span>
          </div>

          <div class="wd-stat wd-stat--paid">
            <span class="wd-stat__value">${naira(s.paidTotal)}</span>
            <span class="wd-stat__label">Total paid out</span>
            <span class="wd-stat__sub">
              ${s.paid ?? 0} payout${s.paid === 1 ? '' : 's'}
              ${s.paidThisMonth ? ` · ${naira(s.paidThisMonth)} this month` : ''}
            </span>
          </div>
        </div>
      </header>

      <div class="wd-tabs" role="tablist">
        ${TABS.map((t) => `
          <button class="wd-tab${this._status === t.key ? ' wd-tab--active' : ''}"
                  data-tab="${t.key}" role="tab" aria-selected="${this._status === t.key}">
            ${t.label}${s[t.key] != null ? ` <span class="wd-tab__count">${s[t.key]}</span>` : ''}
          </button>`).join('')}
      </div>

      <div class="wd-list">
        ${this._requests.length ? this._requests.map((r) => this._card(r)).join('') : `
          <div class="wd-empty">Nothing here.</div>`}
      </div>
    `;
  }

  _card(r) {
    const u = r.user || {};
    const pending = r.status === 'pending';

    return `
      <article class="wd-card wd-card--${r.status}">
        <div class="wd-card__amount">
          <span class="wd-card__value">${naira(r.amount)}</span>
          <span class="wd-badge wd-badge--${r.status}">${r.status}</span>
        </div>

        <div class="wd-card__body">
          <div class="wd-card__who">
            <strong>${this.esc(u.name || 'Unknown')}</strong>
            <span>@${this.esc(u.username || '')}</span>
            <span class="wd-card__meta">${this.esc(u.email || '')}${u.phone ? ' · ' + this.esc(u.phone) : ''}</span>
            <span class="wd-card__meta">${this.esc(u.lgaName || '—')} · ${u.referralCount ?? 0} referrals</span>

            <span class="wd-id">
              ${u.idType ? `<span class="wd-id__type">${this.esc(u.idType)}</span>` : `<span class="wd-id__none">No ID on file</span>`}
              ${u.idDocumentUrl
                ? `<a class="wd-id__link" href="${this.esc(u.idDocumentUrl)}" target="_blank" rel="noopener noreferrer">View ID</a>`
                : ''}
            </span>
          </div>

          <div class="wd-pay-to">
            <p class="wd-pay-to__title">Pay to</p>
            <p class="wd-pay-to__bank">${this.esc(r.bankName)}</p>
            <p class="wd-pay-to__number">
              <span>${this.esc(r.accountNumber)}</span>
              <button class="wd-copy" data-copy="${this.esc(r.accountNumber)}" type="button">Copy</button>
            </p>
            <p class="wd-pay-to__name">${this.esc(r.accountName)}</p>
          </div>

          <div class="wd-card__when">
            <span>Requested ${this.esc(formatDateTime(r.requestedAt))}</span>
            ${r.processedAt ? `<span>Processed ${this.esc(formatDateTime(r.processedAt))}</span>` : ''}
            ${r.paymentReference ? `<span>Ref: ${this.esc(r.paymentReference)}</span>` : ''}
            ${r.adminNote ? `<span class="wd-card__note">${this.esc(r.adminNote)}</span>` : ''}
          </div>
        </div>

        ${pending ? `
          <div class="wd-card__actions">
            <button class="wd-btn wd-btn--pay" data-pay="${r.id}" type="button">I have paid this</button>
            <button class="wd-btn wd-btn--reject" data-reject="${r.id}" type="button">Decline</button>
          </div>` : ''}
      </article>`;
  }

  async _copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('success', 'Account number copied.');
    } catch {
      showToast('info', text);
    }
  }

  async _pay(id) {
    const r = this._requests.find((x) => x.id === id);
    if (!r) return;

    // Deliberately a confirm: this is the irreversible step, and it fires the
    // citizen's "your money has been sent" email.
    const ok = window.confirm(
      `Confirm you have already transferred ${naira(r.amount)} to:\n\n`
      + `${r.bankName}\n${r.accountNumber}\n${r.accountName}\n\n`
      + `This reduces their balance and emails them a receipt.`
    );
    if (!ok) return;

    const reference = window.prompt('Bank reference (optional) — helps trace the transfer later:', '') || '';

    const res = await api.withdrawals.markPaid(id, { paymentReference: reference.trim() || undefined });
    if (res.error) {
      showToast('error', res.error.message || 'Could not record that payment.');
      return;
    }

    showToast('success', 'Recorded. The citizen has been emailed.');
    this._load();
  }

  async _reject(id) {
    const reason = window.prompt('Why is this being declined? The citizen will see this.', '');
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('error', 'Give a reason so the citizen knows what happened.');
      return;
    }

    const res = await api.withdrawals.reject(id, reason.trim());
    if (res.error) {
      showToast('error', res.error.message || 'Could not decline that request.');
      return;
    }

    showToast('info', 'Declined. Their balance has been released.');
    this._load();
  }
}
