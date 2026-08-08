/**
 * LagKonnect — Referrals API
 * ============================================================
 * Endpoints for the referral programme:
 *  • Citizen: get own code, track incoming referrals
 *  • Admin:   leaderboard, region stats, per-user drill-down
 */

import { _fetch } from './_fetch.js?v=20260807a';

export const referrals = {

  // ── Citizen ───────────────────────────────────────────────────────────

  /** Get the current user's personal referral code & summary. */
  async getMyCode() {
    return await _fetch('GET', '/referrals/my-code');
  },

  /** Record a referral when someone registers via a referral link. */
  async track(code) {
    return await _fetch('POST', '/referrals/track', { code }, false);
  },

  /** Get the authenticated user's referral history. */
  async getMyHistory(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page)    params.set('page',    opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage || 20);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/referrals/my-history${qs}`);
  },

  // ── Admin ─────────────────────────────────────────────────────────────

  /**
   * Fetch the top referrers leaderboard, optionally scoped to a region.
   * @param {{ page?: number, perPage?: number, region?: string }} opts
   */
  async adminLeaderboard(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page)    params.set('page',    opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage || 20);
    if (opts.region)  params.set('region',  opts.region);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/admin/referrals/leaderboard${qs}`);
  },

  /**
   * Get aggregate referral stats for the platform or a specific region.
   * @param {{ region?: string }} opts
   */
  async adminStats(opts = {}) {
    const params = new URLSearchParams();
    if (opts.region) params.set('region', opts.region);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', `/admin/referrals/stats${qs}`);
  },

   /**
    * Get the complete referral history for a specific user, plus their
    * full profile and 30-day activity metrics.
    * @param {number} userId
    * @param {{ page?: number, perPage?: number }} [opts]
    */
   async adminGetUserReferrals(userId, opts = {}) {
     const params = new URLSearchParams();
     if (opts.page)    params.set('page',    opts.page);
     if (opts.perPage) params.set('perPage', opts.perPage || 20);
     const qs = params.toString() ? `?${params}` : '';
     return await _fetch('GET', `/admin/referrals/user/${userId}${qs}`);
   },
};
