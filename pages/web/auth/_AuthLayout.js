/**
 * Lagos Konect — Auth Layout
 * ============================================================
 * Two-panel shell: left = form, right = hero image.
 *
 * Usage (inside a page's render()):
 *   return AuthLayout.wrap({
 *     title: 'Create your account',
 *     subtitle: 'Join your LGA community today.',
 *     content: `<div id="form-mount"></div>`,
 *     footer: `Already have an account? <a href="/login">Log in</a>`,
 *     showCopyright: false,   // optional, shows "© Lagos Konect 2026" bottom-left
 *   });
 */

import { LanguageSwitcher } from "../../../components/feature/LanguageSwitcher.js?v=20260806c";

export class AuthLayout {
    /**
     * @param {{
     *   title: string,
     *   subtitle?: string,
     *   content: string,
     *   footer?: string,
     *   showCopyright?: boolean,
     * }} opts
     * @returns {string}
     */
    static wrap({ title, subtitle, content, footer, showCopyright = false }) {
        return `
      <div class="auth-shell">

        <!-- Left: form panel -->
        <div class="auth-panel">

          <!-- Header row: logo left, language switcher right -->
          <div class="auth-panel__header">
            <div class="auth-panel__logo">
              <img
                src="/assets/icons/logo-green.svg"
                alt="Lagos Konect logo"
                width="40"
                height="40"
              />
              <span class="auth-panel__logo-name">Lagos Konect</span>
            </div>
            <!-- Language switcher — kept outside the scrollable body so its dropdown is never clipped -->
            <div class="auth-panel__lang" id="auth-lang-slot"></div>
          </div>

          <!-- Scrollable form body -->
          <div class="auth-panel__body">

          <!-- Heading -->
          <div class="auth-panel__heading">
            <h1 class="auth-panel__title">${title}</h1>
            ${subtitle ? `<p class="auth-panel__subtitle">${subtitle}</p>` : ''}
          </div>

          <!-- Content slot -->
          ${content}

          <!-- Footer slot -->
          ${footer ? `<div class="auth-panel__footer">${footer}</div>` : ''}

          ${showCopyright ? `<p class="auth-panel__copyright">© Lagos Konect 2026</p>` : ''}
          </div><!-- end auth-panel__body -->
        </div>

        <!-- Right: hero image panel -->
        <div class="auth-image-panel" aria-hidden="true">
          <img
            src="/assets/images/auth/register--image.jpg"
            alt=""
            class="auth-image-panel__img"
          />
          <div class="auth-image-panel__overlay"></div>
          <p class="auth-image-panel__caption">
            Enter your details to start engaging with your local government and make an impact today.
          </p>
        </div>

      </div>
    `;
    }

    /**
     * Mounts the language switcher into the already-rendered layout.
     * Call from the host page's afterMount() so the #public-lang-slot
     * element exists in the DOM. The switcher is registered as a child
     * of the host so it is unmounted automatically with the page.
     *
     * @param {import('../../../core/component.js?v=20260806c').Component} host
     * @returns {LanguageSwitcher|null}
     */
    static mountLanguageSwitcher(host) {
        const slot = host?.$('#auth-lang-slot');
        if (!slot) return null;
        const switcher = host.addChild(
            new LanguageSwitcher({ compact: true, align: 'end' }),
        );
        switcher.mount(slot);
        return switcher;
    }
}
