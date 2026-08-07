/**
 * LagKonnect — Newsletter API
 * ============================================================
 * Public endpoint — no auth required.
 */

import { _fetch } from './_fetch.js?v=20260806h';

export const newsletter = {
  /**
   * Subscribe an email address to the newsletter.
   * @param {string} email
   * @returns {Promise<{data:{subscribed:boolean}}|{error:{code:string,message:string}}>}
   */
  async subscribe(email) {
    return await _fetch('POST', '/newsletter/subscribe', { email }, false);
  },

  /**
   * Unsubscribe using the one-click token from the confirmation email.
   * @param {string} token
   */
  async unsubscribe(token) {
    return await _fetch('POST', '/newsletter/unsubscribe', { token }, false);
  },
};
