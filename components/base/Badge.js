/**
 * Lagos Konect — Badge Component
 * ============================================================
 * Lightweight status and category badge.
 * Works as a mounted Component or as a pure static HTML string
 * for use inside other components' render() calls.
 *
 * Variants map to semantic colour tokens defined in tokens.css:
 *
 *   Status:       active | suspended | pending | draft | published
 *   Category:     official | community | security | event | proposal
 *   Semantic:     info | warning | error
 *
 * Usage:
 *   // Mounted instance
 *   new Badge({ label: 'Active', variant: 'active' }).mount(container);
 *
 *   // Static HTML string — use inside another component's render()
 *   Badge.html('Active',   'active')
 *   Badge.html('Official', 'official', 'sm')
 *   Badge.html('Pending',  'pending',  'md', true)  // with dot
 *
 * @module  Badge
 * @version 2.0.0
 */

import { Component } from '../../core/component.js?v=20260806d';

/* ── Valid prop values ──────────────────────────────────────────────────── */
const VALID_SIZES = Object.freeze(['sm', 'md']);

const VARIANT_MAP = Object.freeze({
  // Raw API status strings → variant name
  active:          'active',
  suspended:       'suspended',
  pending:         'pending',
  draft:           'draft',
  published:       'active',
  paused:          'pending',
  open:            'info',
  resolved:        'active',
  flagged:         'error',

  // Notification categories
  'Security Alert': 'security',
  Official:         'official',
  Community:        'community',
  Event:            'event',

  // Roles
  super_admin:      'official',
  admin:            'active',
  moderator:        'community',
  citizen:          'community',
});

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */
export class Badge extends Component {
  static styles = '/components/base/Badge.css?v=20260806d';

  constructor(props = {}) {
    super({
      label:   '',
      variant: 'active',
      size:    'md',
      dot:     false,
      ...props,
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const { label, variant, size, dot } = this.props;
    return Badge.html(label, variant, size, dot);
  }

  /* ── Static helpers ───────────────────────────────────────────────────── */

  /**
   * Returns a badge HTML string — use inside another component's render().
   *
   * @param {string}        label
   * @param {string}        [variant='active']
   * @param {'sm'|'md'}     [size='md']
   * @param {boolean}       [dot=false]   Show a coloured dot before the label
   * @returns {string}
   */
  static html(label = '', variant = 'active', size = 'md', dot = false) {
    const safeSize    = VALID_SIZES.includes(size) ? size : 'md';
    const dotMarkup   = dot ? `<span class="ktg-badge__dot" aria-hidden="true"></span>` : '';
    // Escape the label — badge is often rendered from API data
    const safeLabel   = String(label)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return `<span class="ktg-badge ktg-badge--${variant} ktg-badge--${safeSize}">${dotMarkup}${safeLabel}</span>`;
  }

  /**
   * Maps a raw status / role / category string from the API to
   * the correct variant class name.
   *
   * @param {string} status
   * @returns {string}  Variant name; falls back to 'draft' for unknown values.
   */
  static variantFor(status) {
    return VARIANT_MAP[status] ?? 'draft';
  }

  /**
   * Convenience method — returns a fully-formed badge HTML string
   * for a raw API status string.
   *
   * @param {string}    status
   * @param {'sm'|'md'} [size='md']
   * @param {boolean}   [dot=false]
   * @returns {string}
   */
  static forStatus(status, size = 'md', dot = false) {
    const variant = Badge.variantFor(status);
    // Display the original status string with basic formatting
    const label   = String(status).replace(/_/g, ' ');
    return Badge.html(label, variant, size, dot);
  }
}