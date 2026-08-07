/**
 * Lagos Konnect — Referral Programme
 * Route: /referrals
 * Guards: requireAuth + requireCitizen
 */

import { WebLayout }           from '../../../components/layout/BaseLayout.js?v=20260806h';
import { setPageLoading, showToast } from '../../../core/store.js?v=20260806h';
import { api }                 from '../../../api/client.js?v=20260806h';
import { PayoutPanel } from '../../../components/feature/PayoutPanel.js?v=20260806h';
import { timeAgo }             from '../../../utils/date.js?v=20260806h';
import { t }                   from '../../../core/i18n.js?v=20260806h';

export default class ReferralsPage extends WebLayout {
    static styles = '/pages/web/app/Referrals.css?v=20260806h';

    constructor(props) {
        super({ title: 'Referral Programme', ...props });
        this._referralData = null;
        this._history      = [];
    }

    getContent() {
        return `<div class="referrals-page" id="referrals-root">
      <div aria-hidden="true" style="display:flex;flex-direction:column;gap:16px;max-width:760px;margin:0 auto">
        <div class="skeleton-block" style="height:88px;border-radius:12px"></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div class="skeleton-block" style="height:90px;border-radius:12px"></div>
          <div class="skeleton-block" style="height:90px;border-radius:12px"></div>
          <div class="skeleton-block" style="height:90px;border-radius:12px"></div>
        </div>
        <div class="skeleton-block" style="height:160px;border-radius:12px"></div>
        <div class="skeleton-block" style="height:260px;border-radius:12px"></div>
      </div>
    </div>`;
    }

    async onContentReady() {
        setPageLoading(true);
        const [codeRes, historyRes] = await Promise.all([
            api.referrals.getMyCode(),
            api.referrals.getMyHistory(),
        ]);
        this._referralData = codeRes.data  || null;
        this._history      = historyRes.data || [];
        setPageLoading(false);
        this._render();
    }

    _render() {
        const root = document.getElementById('referrals-root');
        if (!root) return;

        const d     = this._referralData;
        const link  = d?.link || `${window.location.origin}/join?ref=${d?.code || ''}`;
        const count  = d?.referralCount ?? 0;
        const earnings = d?.rewardAmount ?? (d?.referralCount ?? 0) * 250;
        const confirmed = this._history.filter(h => h.status === 'confirmed').length;

        root.innerHTML = `
      <div class="ref-page">

        <div class="ref-page__header">
          <h1 class="ref-page__title">Referral Programme</h1>
          <p class="ref-page__subtitle">Invite neighbours and friends to join Lagos Konect. Every successful referral earns you <strong>₦250</strong>.</p>
        </div>

        <!-- Stats -->
        <div class="ref-stats">
          <div class="ref-stat-card">
            <span class="ref-stat-card__value">${count}</span>
            <span class="ref-stat-card__label">Referred</span>
          </div>
          <div class="ref-stat-card ref-stat-card--accent">
            <span class="ref-stat-card__value">₦${earnings.toLocaleString('en-NG')}</span>
            <span class="ref-stat-card__label">Earned</span>
          </div>
          <div class="ref-stat-card">
            <span class="ref-stat-card__value">${confirmed}</span>
            <span class="ref-stat-card__label">Confirmed</span>
          </div>
        </div>

        <div class="ref-earning-note" role="note">
          <span class="ref-earning-note__icon" aria-hidden="true">₦</span>
          <div>
            <strong>₦250 per successful referral</strong>
            <p>Referrals count after the person you invited completes account verification.</p>
          </div>
          <span class="ref-earning-note__example">10 referrals = ₦2,500</span>
        </div>

        <!-- Link card -->
        <div class="ref-link-card">
          <h2 class="ref-link-card__title">Your Referral Link</h2>
          <div class="ref-link-card__code">
            <span class="ref-link-card__code-text">${this.esc(link)}</span>
            <button class="ref-link-card__copy-btn" id="copy-link-btn" type="button" aria-label="Copy link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
          </div>
          ${d?.code ? `<p class="ref-link-card__code-label">Code: <strong>${this.esc(d.code)}</strong></p>` : ''}
          <div class="ref-link-card__share" style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="ref-share-btn ref-share-btn--whatsapp" id="share-whatsapp-btn" type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.523 5.846L.057 23.852l6.137-1.608A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.897-1.339l-.351-.21-3.642.955.972-3.548-.228-.364A9.577 9.577 0 012.4 12c0-5.294 4.306-9.6 9.6-9.6s9.6 4.306 9.6 9.6-4.306 9.6-9.6 9.6z"/></svg>
              WhatsApp
            </button>
            <button class="ref-share-btn ref-share-btn--twitter" id="share-twitter-btn" type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Twitter / X
            </button>
            <button class="ref-share-btn ref-share-btn--email" id="share-email-btn" type="button">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Email
            </button>
          </div>
        </div>

        <!-- History -->
        <div id="payout-mount"></div>

        <div class="ref-history-card">
          <h2 class="ref-history-card__title">Referral History</h2>
          ${this._history.length ? `
            <div class="ref-history-table-wrap">
              <table class="ref-history-table">
                <thead><tr>
                  <th scope="col">Name</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Status</th>
                </tr></thead>
                <tbody>
                  ${this._history.map(h => `
                    <tr>
                      <td>${this.esc(h.name || h.userName || 'Anonymous')}</td>
                      <td>${timeAgo(h.joinedAt || h.createdAt)}</td>
                      <td><span class="ref-status ref-status--${this.esc(h.status || 'pending')}">${this.esc(h.status || 'pending')}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="ref-history-empty">
              <p>You haven't referred anyone yet. Share your link to get started!</p>
            </div>
          `}
        </div>

      </div>
    `;

        this._bindEvents(root, link);

        // Referral earnings and withdrawals. Lives in its own component so the
        // payout rules are not duplicated across the regional copies.
        const payoutMount = root.querySelector('#payout-mount');
        if (payoutMount) {
            this._payoutPanel = this.addChild(new PayoutPanel());
            this._payoutPanel.mount(payoutMount);
        }
    }

    _bindEvents(root, link) {
        const copyBtn = root.querySelector('#copy-link-btn');
        if (copyBtn) {
            this.on(copyBtn, 'click', async () => {
                try {
                    await navigator.clipboard.writeText(link);
                    showToast('success', 'Referral link copied!');
                } catch {
                    showToast('info', `Your link: ${link}`);
                }
            });
        }

        const whatsappBtn = root.querySelector('#share-whatsapp-btn');
        if (whatsappBtn) {
            this.on(whatsappBtn, 'click', () => {
                const text = encodeURIComponent(`Join me on Lagos Konect! Sign up using my referral link: ${link}`);
                window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
            });
        }

        const twitterBtn = root.querySelector('#share-twitter-btn');
        if (twitterBtn) {
            this.on(twitterBtn, 'click', () => {
                const text = encodeURIComponent(`Join me on Lagos Konect — your local government, connected! Sign up here: ${link}`);
                window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener');
            });
        }

        const emailBtn = root.querySelector('#share-email-btn');
        if (emailBtn) {
            this.on(emailBtn, 'click', () => {
                const subject = encodeURIComponent('Join me on Lagos Konect!');
                const body = encodeURIComponent(`Hi!\n\nI'd like to invite you to join Lagos Konect — a civic engagement app that keeps you connected with your local government.\n\nSign up using my referral link:\n${link}\n\nSee you there!`);
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
            });
        }
    }
}
