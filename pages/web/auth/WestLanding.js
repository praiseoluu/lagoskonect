/**
 * Lagos West Connect — Landing Page
 * ============================================================
 * Route: /west
 *
 * Landing page for the west senatorial zone.
 * Inherits all carousel, layout and bootstrap behaviour from
 * LandingBase — this file only owns the hero copy.
 *
 * @module  WestLandingPage
 * @version 2.0.0
 */

import { LandingBase } from './_LandingBase.js?v=20260806c';
import { t }           from '../../../core/i18n.js?v=20260806c';

export default class WestLandingPage extends LandingBase {

  get region() { return 'west'; }

  renderContent() {
    return `
      <section class="landing__hero" aria-labelledby="hero-heading">
        <div class="landing__hero-inner">
          <div class="landing__hero-content">
            <h1 class="landing__hero-heading" id="hero-heading">
              Lagos West Connect
            </h1>
            <p class="rl-tagline">
              ${t('landing.heroSubtitleWest')}
            </p>
          </div>
        </div>
      </section>
    `;
  }
}
