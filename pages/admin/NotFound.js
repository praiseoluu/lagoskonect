/**
 * KTG Connect — 404 Not Found (Admin App)
 * Route: /admin/404
 */
import { Component } from '../../../core/component.js';

export default class AdminNotFoundPage extends Component {
  render() {
    return `
      <div class="notfound-shell">
        <div class="notfound-card">
          <div class="notfound-code" aria-hidden="true">404</div>
          <h1 class="notfound-title">Page not found</h1>
          <p class="notfound-desc">This page doesn't exist in the admin portal.</p>
          <a href="/admin" class="ktg-btn ktg-btn--primary ktg-btn--md">← Back to dashboard</a>
        </div>
      </div>
    `;
  }
}
