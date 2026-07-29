/**
 * LagKonnect — Date Utilities
 * ============================================================
 * Pure date formatting helpers. No dependencies.
 */

/**
 * Returns a human-readable relative time string.
 * e.g. "2 hours ago", "3 days ago", "just now"
 * @param {string|Date} date
 * @returns {string}
 */
export function timeAgo(date) {
  const now = Date.now();
  // Normalise naive datetime strings (no timezone offset) to UTC so that
  // the diff is computed correctly regardless of server/browser timezone.
  // e.g. "2025-07-20T10:30:00" → "2025-07-20T10:30:00Z"
  let normalised = date;
  if (typeof date === 'string' && !/[Zz]|[+-]\d{2}:\d{2}|[+-]\d{4}$/.test(date)) {
    normalised = date + 'Z';
  }
  const then = new Date(normalised).getTime();
  const diff = Math.floor((now - then) / 1000); // seconds

  if (diff < 60) return 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m !== 1 ? 's' : ''} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h !== 1 ? 's' : ''} ago`;
  }
  if (diff < 604800) {
    const d = Math.floor(diff / 86400);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
  }
  if (diff < 2592000) {
    const w = Math.floor(diff / 604800);
    return `${w} week${w !== 1 ? 's' : ''} ago`;
  }
  return formatDate(date);
}

/**
 * Formats a date as "15 May 2025".
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Formats a date as "15 May 2025, 9:00 AM".
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/**
 * Formats a duration in seconds as "1:02" or "12:45".
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Returns "Today", "Yesterday", or a formatted date.
 * @param {string|Date} date
 * @returns {string}
 */
export function friendlyDate(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(date);
}