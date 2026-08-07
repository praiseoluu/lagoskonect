/**
 * Lagos East Connect — Landing Page
 * ============================================================
 * Route: /east
 *
 * Landing page for the east senatorial zone.
 * Inherits all carousel, layout and bootstrap behaviour from
 * LandingBase — this file only owns the hero copy.
 *
 * @module  EastLandingPage
 * @version 2.0.0
 */

import { LandingBase } from './_LandingBase.js?v=20260806h';
import { t }           from '../../../core/i18n.js?v=20260806h';

export default class EastLandingPage extends LandingBase {

  get region() { return 'east'; }

  renderContent() {
    return `
      <section class="landing__hero" aria-labelledby="hero-heading">
        <div class="landing__hero-inner">
          <div class="landing__hero-content">
            <h1 class="landing__hero-heading" id="hero-heading">
              Lagos East Connect
            </h1>
            <p class="rl-tagline">
              ${t('landing.heroSubtitleEast')}
            </p>
          </div>
        </div>
      </section>
    `;
  }
}
