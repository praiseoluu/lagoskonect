/**
 * KTG Connect Admin — View News Headline Details
 * Route: /admin/news/:id
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Button } from '../../../components/base/Button.js';
import { Badge } from '../../../components/base/Badge.js';
import { Modal } from '../../../components/base/Modal.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { formatDate } from '../../../utils/date.js';

export default class AdminNewsViewPage extends AdminLayout {
  static styles = '/pages/admin/app/NewsViews.css';

  constructor(props) {
    super({
      title: 'View News Headline',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'News Management', path: '/admin/news' },
        { label: 'View' },
      ],
      ...props,
    });
    this._id = parseInt(props.params?.id, 10);
    this._item = null;
  }

  getContent() {
    return `<div id="nv-root" class="news-view-page"></div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    const res = await api.news.adminGetById(this._id);
    setPageLoading(false);

    const root = document.getElementById('nv-root');
    if (!root) return;

    if (res.error || !res.data) {
      root.innerHTML = `<p style="color:var(--color-error)">Article not found.</p>`;
      return;
    }

    this._item = res.data;
    await this._loadMarked();
    this._render(root);
  }

  async _loadMarked() {
    if (window.marked) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  _renderBody(text) {
    if (!text) return '—';
    if (window.marked) {
      // marked.parse returns safe HTML from markdown
      return window.marked.parse(text);
    }
    // fallback — plain escaped text
    return this.esc(text).replace(/\n/g, '<br>');
  }

  _render(root) {
    const item = this._item;

    root.innerHTML = `
      <!-- Header -->
      <div class="nv-header">
        <button class="nv-back" id="nv-back" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h1 class="nv-header__title">View News Headline Details</h1>
        <div id="nv-actions"></div>
      </div>

      <!-- Banner -->
      <div class="nv-banner">
        ${item.imageUrl
        ? `<img src="${this.esc(item.imageUrl)}" alt="News banner" class="nv-banner__img" />`
        : `<div class="nv-banner__placeholder"><span>News Banner</span></div>`
      }
      </div>

      <!-- Detail fields -->
      <div class="nv-fields-grid">
        ${this._field('NEWS ID', String(item.newsId || item.id))}
        ${this._field('CAPTION NAME', item.title)}
        ${this._field('DATE RECEIVED', formatDate(item.createdAt))}
        ${this._field('DATE PUBLISHED', item.publishedAt ? formatDate(item.publishedAt) : '—')}
        ${this._field('DURATION', item.durationDays != null ? `${item.durationDays} Days` : '—')}
        ${this._field('STATUS', '', Badge.html(item.status, Badge.variantFor(item.status)))}
      </div>

      <div class="nv-body-section">
        <label class="nv-body-section__label">News Texts</label>
        <div class="nv-body-section__text nv-body-section__text--rendered">${this._renderBody(item.body || item.summary)}</div>
        <div class="nv-body-section__footer">
          <span>Supports plain text and markdown.</span>
          <span>${(item.body || '').length} / 2000 characters</span>
        </div>
      </div>
    `;

    // Back button
    this.on(root.querySelector('#nv-back'), 'click', () => router.push('/admin/news'));

    // Action buttons
    const actionsMount = root.querySelector('#nv-actions');
    if (actionsMount) {
      const editBtn = this.addChild(new Button({
        label: 'Edit', variant: 'secondary', size: 'md',
        onClick: () => router.push(`/admin/news/${this._id}/edit`),
      }));
      editBtn.mount(actionsMount);

      if (item.status !== 'published') {
        const publishBtn = this.addChild(new Button({
          label: 'Publish Now', variant: 'primary', size: 'md',
          onClick: () => this._publish(),
        }));
        publishBtn.mount(actionsMount);
      }
    }
  }

  _field(label, value, customHtml = '') {
    return `
      <div class="nv-field">
        <label class="nv-field__label">${label}</label>
        <div class="nv-field__value">${customHtml || this.esc(value)}</div>
      </div>
    `;
  }

  async _publish() {
    const res = await api.news.adminPublish(this._id);
    if (res.error) { showToast('error', res.error.message); return; }
    showToast('success', 'Article published successfully.');
    router.push('/admin/news');
  }
}