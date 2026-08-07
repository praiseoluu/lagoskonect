/**
 * LagKonnect — Referral payouts
 * ============================================================
 * Citizen: save a bank account, see the balance, request a withdrawal.
 * Admin:   work the payout queue and confirm transfers.
 */

import { _fetch } from './_fetch.js?v=20260806e';

export const withdrawals = {
  /** Balance, saved account and any request still awaiting approval. */
  async summary() {
    return await _fetch('GET', '/referrals/payout');
  },

  /** @param {{bankName: string, accountNumber: string, accountName: string}} account */
  async saveAccount(account) {
    return await _fetch('PUT', '/referrals/payout-account', account);
  },

  /** Omit amount to withdraw the whole available balance. */
  async request(amount) {
    return await _fetch('POST', '/referrals/withdrawals', amount != null ? { amount } : {});
  },

  async mine() {
    return await _fetch('GET', '/referrals/withdrawals');
  },

  // ── Admin ───────────────────────────────────────────────────────────────

  async adminList(status = 'pending') {
    return await _fetch('GET', '/admin/withdrawals?status=' + encodeURIComponent(status));
  },

  /** Confirms the transfer was actually made: reduces the balance, emails the user. */
  async markPaid(id, { paymentReference, note } = {}) {
    return await _fetch('POST', `/admin/withdrawals/${id}/pay`, { paymentReference, note });
  },

  async reject(id, reason) {
    return await _fetch('POST', `/admin/withdrawals/${id}/reject`, { reason });
  },
};
