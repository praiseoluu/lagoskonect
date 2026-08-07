/**
 * KTG Connect — 404 Not Found (Web App)
 * Route: /404
 */
import { Component } from '../../core/component.js?v=20260806h';
import { store } from '../../core/store.js?v=20260806h';

export default class NotFoundPage extends Component {
  render() {
    const isLoggedIn = store.isAuthenticated && store.role === 'citizen';
    const r = sessionStorage.getItem('lagosRegion');
    const region = (r === 'west' || r === 'central' || r === 'east') ? r : 'west';
    const homeHref = isLoggedIn ? `/${region}/home` : '/';
    return `
      <div class="notfound-shell">
        <div class="notfound-card">
          <div class="notfound-code" aria-hidden="true">404</div>
          <h1 class="notfound-title">Page not found</h1>
          <p class="notfound-desc">
            The page you're looking for doesn't exist or may have been moved.
          </p>
          <a
            href="${homeHref}"
            class="ktg-btn ktg-btn--primary ktg-btn--md"
          >
            ${isLoggedIn ? '← Back to home' : '← Back to start'}
          </a>
        </div>
      </div>
    `;
  }
}
