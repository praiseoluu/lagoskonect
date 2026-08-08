/**
 * Lagos Konect — reel comment threads (TikTok-style)
 * ============================================================
 * One controller drives one reel's comment drawer. It owns the whole
 * conversation: loading the top-level comments, expanding a thread's replies on
 * demand ("View N replies"), and composing either a fresh comment or a reply to
 * a specific person.
 *
 * Threads are two levels deep, exactly like TikTok — a reply to a reply is
 * flattened onto the same root thread (the server does the flattening; here we
 * just drop the optimistic node into the right container and @-mention who is
 * being answered).
 *
 * The controller binds its OWN click/keydown listeners on the drawer element
 * and calls stopPropagation for the actions it handles, so it shields the
 * host Reels page's older wrap-level handlers without either double-firing.
 *
 * Usage (from a Reels page):
 *     const ctl = createCommentDrawer(drawerEl, {
 *       reelId,
 *       onCountDelta: (d) => { …update the tab/badge counts… },
 *     });
 *     ctl.load();      // first open
 */

import { api }     from '../api/client.js?v=20260807a';
import { store }   from '../core/store.js?v=20260807a';
import { timeAgo } from './date.js?v=20260807a';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function initialOf(name) {
  return esc((name || '?').trim().charAt(0).toUpperCase() || '?');
}

/** Avatar markup — a real picture when we have one, else a coloured initial. */
function avatarHtml(name, avatarUrl, cls) {
  return avatarUrl
    ? `<span class="${cls}"><img src="${esc(avatarUrl)}" alt="" loading="lazy"></span>`
    : `<span class="${cls} ${cls}--initial">${initialOf(name)}</span>`;
}

function replyToggleLabel(n) {
  return n === 1 ? 'View 1 reply' : `View ${n} replies`;
}

export function createCommentDrawer(drawer, { reelId, onCountDelta } = {}) {
  const list  = drawer.querySelector('.rf-item__comments-list');
  const input = drawer.querySelector('.rf-item__comment-input');
  const row   = drawer.querySelector('.rf-item__comment-input-row');
  if (!list || !input || !row) return { load() {} };

  // A small chip above the composer that appears while replying to someone.
  const chip = document.createElement('div');
  chip.className = 'rf-cmt-reply-chip';
  chip.hidden = true;
  chip.innerHTML = `
    <span class="rf-cmt-reply-chip__label">Replying to <strong data-chip-name></strong></span>
    <button type="button" class="rf-cmt-reply-chip__cancel" data-cmt-action="cancel-reply" aria-label="Cancel reply">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  row.parentNode.insertBefore(chip, row);

  let loaded    = false;
  let replyTo   = null; // { rootId, targetId, name } while composing a reply

  /* ── Node builders ──────────────────────────────────────────────────── */

  function rootNodeHtml(c) {
    const name = c.userName || 'Anonymous';
    const rc   = Number(c.replyCount || 0);
    return `
      <div class="rf-cmt" data-cmt-id="${c.id}" role="listitem">
        ${avatarHtml(name, c.avatarUrl, 'rf-cmt__avatar')}
        <div class="rf-cmt__main">
          <div class="rf-cmt__author">${esc(name)}</div>
          <p class="rf-cmt__text">${esc(c.text)}</p>
          <div class="rf-cmt__meta">
            <span class="rf-cmt__time">${c.createdAt ? esc(timeAgo(c.createdAt)) : ''}</span>
            <button type="button" class="rf-cmt__reply-btn" data-cmt-action="reply">Reply</button>
          </div>
          <button type="button" class="rf-cmt__replies-toggle" data-cmt-action="toggle-replies"
                  ${rc ? '' : 'hidden'}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="rf-cmt__replies-label">${replyToggleLabel(rc)}</span>
          </button>
          <div class="rf-cmt__replies" data-replies-for="${c.id}" hidden></div>
        </div>
      </div>`;
  }

  function replyNodeHtml(c) {
    const name = c.userName || 'Anonymous';
    return `
      <div class="rf-cmt rf-cmt--reply" data-cmt-id="${c.id}">
        ${avatarHtml(name, c.avatarUrl, 'rf-cmt__avatar')}
        <div class="rf-cmt__main">
          <div class="rf-cmt__author">${esc(name)}</div>
          <p class="rf-cmt__text">${esc(c.text)}</p>
          <div class="rf-cmt__meta">
            <span class="rf-cmt__time">${c.createdAt ? esc(timeAgo(c.createdAt)) : ''}</span>
            <button type="button" class="rf-cmt__reply-btn" data-cmt-action="reply">Reply</button>
          </div>
        </div>
      </div>`;
  }

  /* ── Loading ────────────────────────────────────────────────────────── */

  async function load() {
    if (loaded) return;
    loaded = true;
    const res = await api.reels.getComments(reelId, { perPage: 20 });
    if (res.error || !res.data?.length) {
      list.innerHTML = '<div class="rf-item__comment-empty">No comments yet. Be the first!</div>';
      return;
    }
    list.innerHTML = res.data.map(rootNodeHtml).join('');
  }

  // Fetch a thread's existing replies into its container, once. Safe to call
  // repeatedly — the dataset flag makes every call after the first a no-op.
  async function ensureRepliesLoaded(rootEl) {
    const id        = rootEl.dataset.cmtId;
    const container = rootEl.querySelector(`.rf-cmt__replies[data-replies-for="${id}"]`);
    if (!container || container.dataset.loaded) return container;
    container.dataset.loaded = '1';
    container.innerHTML = '<div class="rf-cmt__replies-loading">Loading…</div>';
    const res = await api.reels.getComments(reelId, { parentId: id, perPage: 50 });
    container.innerHTML = (res.data || []).map(replyNodeHtml).join('');
    return container;
  }

  async function toggleReplies(rootEl) {
    const container = rootEl.querySelector('.rf-cmt__replies');
    const toggle    = rootEl.querySelector('.rf-cmt__replies-toggle');
    const label     = toggle?.querySelector('.rf-cmt__replies-label');
    if (!container) return;

    if (container.hidden) {
      await ensureRepliesLoaded(rootEl);
      container.hidden = false;
      toggle?.classList.add('rf-cmt__replies-toggle--open');
      if (label) label.textContent = 'Hide replies';
    } else {
      container.hidden = true;
      toggle?.classList.remove('rf-cmt__replies-toggle--open');
      if (label) label.textContent = replyToggleLabel(replyCountOf(rootEl));
    }
  }

  function replyCountOf(rootEl) {
    return rootEl.querySelectorAll('.rf-cmt__replies > .rf-cmt').length
      || Number(rootEl.dataset.replyCount || 0);
  }

  /* ── Composing ──────────────────────────────────────────────────────── */

  function startReply(triggerEl) {
    const cmtEl = triggerEl.closest('.rf-cmt');
    if (!cmtEl) return;
    const name      = cmtEl.querySelector('.rf-cmt__author')?.textContent || '';
    const container = cmtEl.closest('.rf-cmt__replies');
    const rootId    = container ? container.dataset.repliesFor : cmtEl.dataset.cmtId;
    replyTo = { rootId, targetId: cmtEl.dataset.cmtId, name };
    chip.querySelector('[data-chip-name]').textContent = '@' + name;
    chip.hidden = false;
    input.placeholder = `Reply to ${name}…`;
    input.focus();
  }

  function cancelReply() {
    replyTo = null;
    chip.hidden = true;
    input.placeholder = 'Add a comment…';
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const me   = store.currentUser || {};
    const name = me.name || me.username || 'You';

    if (replyTo) {
      const rootEl    = list.querySelector(`.rf-cmt[data-cmt-id="${replyTo.rootId}"]`);
      const target    = replyTo;
      cancelReply();
      onCountDelta?.(1);
      api.reels.addComment(reelId, text, target.targetId);
      if (rootEl) {
        // Pull in any replies already on this thread before dropping ours at
        // the end, so opening a thread for the first time to reply does not
        // bury the replies that were already there.
        const container = await ensureRepliesLoaded(rootEl);
        const toggle    = rootEl.querySelector('.rf-cmt__replies-toggle');
        const label     = toggle?.querySelector('.rf-cmt__replies-label');
        if (container) {
          container.insertAdjacentHTML('beforeend', replyNodeHtml({
            id: 'tmp', userName: name, avatarUrl: me.avatarUrl, text, createdAt: new Date().toISOString(),
          }));
          container.hidden = false;
          if (toggle) { toggle.hidden = false; toggle.classList.add('rf-cmt__replies-toggle--open'); }
          if (label) label.textContent = 'Hide replies';
        }
      }
    } else {
      list.querySelector('.rf-item__comment-empty')?.remove();
      list.insertAdjacentHTML('afterbegin', rootNodeHtml({
        id: 'tmp', userName: name, avatarUrl: me.avatarUrl, text, replyCount: 0, createdAt: new Date().toISOString(),
      }));
      list.scrollTop = 0;
      onCountDelta?.(1);
      api.reels.addComment(reelId, text, null);
    }
  }

  /* ── Wiring ─────────────────────────────────────────────────────────── */

  drawer.addEventListener('click', (e) => {
    const act = e.target.closest('[data-cmt-action]');
    if (act) {
      e.stopPropagation();
      const kind = act.dataset.cmtAction;
      if (kind === 'reply')          startReply(act);
      else if (kind === 'toggle-replies') toggleReplies(act.closest('.rf-cmt'));
      else if (kind === 'cancel-reply')   cancelReply();
      return;
    }
    if (e.target.closest('.rf-item__comment-send')) { e.stopPropagation(); send(); }
  });

  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target === input) {
      e.preventDefault();
      e.stopPropagation();
      send();
    }
  });

  return { load };
}
