/**
 * Lagos Konect — Terms & Conditions Page
 * Route: /terms
 * ============================================================
 * Static public page. No auth required.
 */

import { Component }    from '../../../core/component.js?v=20260807a';
import { PublicLayout }  from './_PublicLayout.js?v=20260807a';
import { api }           from '../../../api/client.js?v=20260807a';
import { showToast }     from '../../../core/store.js?v=20260807a';

export default class TermsPage extends Component {
  static styles = '/pages/web/auth/_PublicLayout.css?v=20260807a';
  static dependencies = ['/pages/web/auth/Landing.css', '/components/base/Button.css'];

  render() {
    return PublicLayout.wrap({
      content: `
        <section class="terms-page" style="max-width:780px;margin:0 auto;padding:var(--space-12,3rem) var(--space-6,1.5rem);">
          <h1 style="font-size:var(--font-size-3xl,2rem);font-weight:var(--font-weight-bold,700);color:var(--color-text);margin-bottom:var(--space-2,0.5rem);">
            Terms &amp; Conditions
          </h1>
          <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);margin-bottom:var(--space-8,2rem);">
            Last updated: July 2026
          </p>

          <div style="display:flex;flex-direction:column;gap:var(--space-8,2rem);color:var(--color-text);line-height:1.7;">

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">1. Acceptance of Terms</h2>
              <p>By accessing or using Lagos Konect ("the Platform"), you agree to be bound by these Terms &amp; Conditions. If you do not agree to these terms, please do not use the Platform.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">2. Eligibility</h2>
              <p>The Platform is intended for residents of Lagos State, Nigeria. You must be at least 13 years of age to create an account. By registering, you confirm that the information you provide is accurate and that you reside within a Lagos State Local Government Area.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">3. User Accounts</h2>
              <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. Lagos Konect is not liable for any loss or damage arising from your failure to keep your password secure.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">4. Community Guidelines</h2>
              <p style="margin-bottom:var(--space-2);">When using community features (chat, posts, reels), you agree not to:</p>
              <ul style="padding-left:var(--space-6);display:flex;flex-direction:column;gap:var(--space-1);">
                <li>Post content that is defamatory, abusive, or harassing.</li>
                <li>Share false or misleading information about government services or officials.</li>
                <li>Engage in spam, phishing, or any form of fraudulent activity.</li>
                <li>Upload material that infringes any third-party intellectual property rights.</li>
                <li>Incite violence, discrimination, or hatred based on ethnicity, religion, or gender.</li>
              </ul>
              <p style="margin-top:var(--space-3);">Violations may result in content removal, account suspension, or referral to law-enforcement authorities.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">5. Privacy</h2>
              <p>Your use of the Platform is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Platform, you consent to the collection and use of your information as described in the Privacy Policy.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">6. Content Ownership</h2>
              <p>You retain ownership of content you submit to the Platform. By posting content, you grant Lagos Konect a non-exclusive, royalty-free licence to display, distribute, and promote that content within the Platform and related services.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">7. Advertisements</h2>
              <p>The Platform may display adverts from Lagos State Government agencies and approved private sponsors. We are not responsible for the content of third-party advertisements or any products/services they promote.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">8. Limitation of Liability</h2>
              <p>The Platform is provided "as is" without warranties of any kind. Lagos Konect shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">9. Changes to These Terms</h2>
              <p>We reserve the right to update these Terms at any time. Continued use of the Platform after changes are posted constitutes your acceptance of the revised Terms. We will endeavour to notify users of material changes via in-app notification.</p>
            </div>

            <div>
              <h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--space-3);">10. Contact</h2>
              <p>If you have questions about these Terms, please contact us at
                <a href="mailto:support@lagkonnect.com"
                   style="color:var(--color-primary);text-decoration:underline;">support@lagkonnect.com</a>.
              </p>
            </div>

          </div>
        </section>
      `,
    });
  }

  afterMount() {
    PublicLayout.mountLanguageSwitcher(this);
    PublicLayout.bindMobileMenu(this);
    PublicLayout.bindScroll(this);
    PublicLayout.bindNewsletter(this, async (email) => {
      const res = await api.newsletter.subscribe(email);
      if (res.error) {
        showToast('error', res.error.message || 'Could not subscribe. Please try again.');
      } else {
        showToast('success', "You're subscribed! Check your inbox for a confirmation email.");
      }
    });
  }
}
