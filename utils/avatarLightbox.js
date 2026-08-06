/**
 * Lagos Konect — Avatar lightbox
 * ============================================================
 * Tap a profile picture, see it full size.
 *
 * Attached once from app.js as a single delegated listener on the document,
 * rather than wired into each page. There are eight copies of the profile
 * pages (Profile and UserProfile, once per region plus the shared originals),
 * and adding this to each would mean eight places to keep in step. A delegated
 * listener also survives every re-render for free, which matters because the
 * chat list repaints constantly.
 *
 * Only opens for avatars that actually have a picture. An avatar showing
 * initials has nothing larger to reveal, so it stays inert and keeps its
 * normal behaviour — on the chat list that is a link through to the profile.
 */

/**
 * Selectors whose images should open full size when tapped.
 *
 * The profile hero only. Chat avatars are deliberately left alone: they link
 * through to the person's profile, and that journey — tap the face in chat,
 * land on their profile, then open the picture — is the one that was asked
 * for. Hijacking the chat avatar would break the first half of it.
 */
const TARGETS = '.profile-hero__avatar-wrap';

let _overlay = null;

function close() {
  if (!_overlay) return;
  _overlay.remove();
  _overlay = null;
  document.body.style.removeProperty('overflow');
  document.removeEventListener('keydown', onKey);
}

function onKey(e) {
  if (e.key === 'Escape') close();
}

function open(src, alt) {
  close();

  _overlay = document.createElement('div');
  _overlay.className = 'avatar-lightbox';
  _overlay.setAttribute('role', 'dialog');
  _overlay.setAttribute('aria-modal', 'true');
  _overlay.setAttribute('aria-label', alt ? `Photo of ${alt}` : 'Profile photo');

  const img = document.createElement('img');
  img.className = 'avatar-lightbox__img';
  img.src = src;
  img.alt = alt || '';

  const btn = document.createElement('button');
  btn.className = 'avatar-lightbox__close';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Close');
  btn.textContent = '×';

  _overlay.append(img, btn);
  document.body.appendChild(_overlay);

  // Stop the page behind from scrolling under the overlay on touch devices.
  document.body.style.overflow = 'hidden';

  // Anywhere outside the picture closes it, which is what people try first.
  _overlay.addEventListener('click', (e) => {
    if (e.target !== img) close();
  });

  // If the picture itself fails there is nothing to look at; don't strand
  // the viewer on a black screen.
  img.addEventListener('error', close);

  document.addEventListener('keydown', onKey);
  btn.focus();
}

/**
 * Starts listening. Safe to call once, from the app bootstrap.
 */
export function initAvatarLightbox() {
  document.addEventListener('click', (e) => {
    const holder = e.target.closest(TARGETS);
    if (!holder) return;

    const img = holder.querySelector('img');
    if (!img?.src) return;          // initials-only avatar — nothing to show

    e.preventDefault();
    open(img.src, img.alt);
  });
}
