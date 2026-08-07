/**
 * Lagos Konect — Newsletter Unsubscribe Page
 * Route:  /newsletter/unsubscribe?token=xxx
 * Guards: none (public, token-authenticated)
 */

import { Component }   from '../../../core/component.js?v=20260806h';
import { PublicLayout } from './_PublicLayout.js?v=20260806h';
import { api }          from '../../../api/client.js?v=20260806h';

export default class NewsletterUnsubscribePage extends Component {
    static styles       = '/pages/web/auth/_PublicLayout.css?v=20260806h';
    static dependencies = ['/pages/web/auth/Landing.css'];

    constructor(props) {
        super(props);
        this._state = 'loading'; // 'loading' | 'success' | 'already' | 'error'
    }

    render() {
        return PublicLayout.wrap({ content: `<div id="unsub-root"></div>` });
    }

    async afterMount() {
        this._renderState('loading');

        const token = new URLSearchParams(window.location.search).get('token') || '';
        if (!token) {
            this._renderState('error', 'No unsubscribe token found. Please use the link from your email.');
            return;
        }

        const res = await api.newsletter.unsubscribe(token);

        if (!res.error) {
            this._renderState(res.data?.alreadyUnsubscribed ? 'already' : 'success');
        } else {
            const msg = res.error.code === 'NOT_FOUND'
                ? 'This unsubscribe link is invalid or has already been used.'
                : (res.error.message || 'Something went wrong. Please try again.');
            this._renderState('error', msg);
        }
    }

    _renderState(state, message) {
        const root = this.el?.querySelector('#unsub-root');
        if (!root) return;

        const configs = {
            loading: {
                icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#068927" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
                title: 'One moment…',
                body:  'Processing your unsubscribe request.',
                spin:  true,
            },
            success: {
                icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#068927" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
                title: 'You\'ve been unsubscribed',
                body:  'You\'ll no longer receive Lagos Konect newsletter emails. We\'re sorry to see you go!',
            },
            already: {
                icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#068927" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
                title: 'Already unsubscribed',
                body:  'This email address is not on our newsletter list.',
            },
            error: {
                icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
                title: 'Something went wrong',
                body:  message || 'Unable to process your request.',
            },
        };

        const cfg = configs[state] || configs.error;

        root.innerHTML = `
      <div style="
        max-width:480px;
        margin:80px auto;
        padding:48px 32px;
        background:#fff;
        border-radius:16px;
        box-shadow:0 2px 16px rgba(0,0,0,.08);
        text-align:center;
      ">
        <div style="margin-bottom:20px;${cfg.spin ? 'animation:spin 1s linear infinite;display:inline-block;' : ''}">${cfg.icon}</div>
        <h1 style="font-size:1.35rem;font-weight:700;color:#111;margin:0 0 12px;">${cfg.title}</h1>
        <p style="color:#555;line-height:1.6;margin:0 0 32px;">${cfg.body}</p>
        <a href="/"
           style="
             display:inline-block;
             padding:12px 28px;
             background:#068927;
             color:#fff;
             border-radius:8px;
             text-decoration:none;
             font-weight:600;
             font-size:0.95rem;
           ">
          Back to Lagos Konect
        </a>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    }
}
