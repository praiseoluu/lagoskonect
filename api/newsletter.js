/**
 * LagKonnect — Newsletter API
 * ============================================================
 * Public endpoint — no auth required.
 */

import { _fetch } from './_fetch.js';

export const newsletter = {
  /**
   * Subscribe an email address to the newsletter.
   * @param {string} email
   * @returns {Promise<{data:{subscribed:boolean}}|{error:{code:string,message:string}}>}
   */
  async subscribe(email) {
    return await _fetch('POST', '/newsletter/subscribe', { email }, false);
  },
};
