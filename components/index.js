/**
 * Lagos Konect — Component Library Index
 * ============================================================
 * Central barrel file for the entire component library.
 *
 * Rules:
 *   • Never import component files directly in page modules.
 *   • Always import through this index.
 *   • CSS is co-located with each component and loaded
 *     automatically by the component base class via the
 *     static `styles` property.
 *
 * Usage:
 *   import { Button, Input, Modal, Table }    from '../../components/index.js?v=20260806d';
 *   import { WebLayout, AdminLayout }          from '../../components/index.js?v=20260806d';
 *   import { StatCard, NewsCard, ReelCard }    from '../../components/index.js?v=20260806d';
 *   import { OTPInput, Dropdown, FileUpload }  from '../../components/index.js?v=20260806d';
 *
 * @module  ComponentIndex
 * @version 2.0.0
 */

/* ══════════════════════════════════════════════════════════════════════════
   BASE COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

// ── Primitives ─────────────────────────────────────────────────────────────
export { Button }       from './base/Button.js?v=20260806d';
export { Input }        from './base/Input.js?v=20260806d';
export { Badge }        from './base/Badge.js?v=20260806d';
export { Modal }        from './base/Modal.js?v=20260806d';
export { Table }        from './base/Table.js?v=20260806d';

// ── Card family ────────────────────────────────────────────────────────────
export {
  Card,
  StatCard,
  NewsCard,
  ReelCard,
} from './base/Card.js?v=20260806d';

// ── UI utilities ───────────────────────────────────────────────────────────
export {
  ToastContainer,
  Avatar,
  Tabs,
  Toggle,
} from './base/UI.js?v=20260806d';

// ── Form components ────────────────────────────────────────────────────────
export {
  OTPInput,
  Dropdown,
  FileUpload,
  ProgressBar,
  ChatBubble,
} from './base/Forms.js?v=20260806d';

/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

// ── Sidebar ────────────────────────────────────────────────────────────────
export {
  Sidebar,
  WebSidebar,
  AdminSidebar,
} from './layout/Sidebar.js?v=20260806d';

// ── Topbar ─────────────────────────────────────────────────────────────────
export {
  Topbar,
  WebTopbar,
  AdminTopbar,
} from './layout/Topbar.js?v=20260806d';

// ── Page layouts ───────────────────────────────────────────────────────────
export {
  BaseLayout,
  WebLayout,
  AdminLayout,
} from './layout/BaseLayout.js?v=20260806d';

/* ══════════════════════════════════════════════════════════════════════════
   CSS MANIFEST  (reference only — do not uncomment)
   ══════════════════════════════════════════════════════════════════════════
   Each component self-registers its stylesheet via the static `styles`
   property on the Component base class. The paths below are listed for
   documentation and auditing purposes only.

   Base:
     components/base/Button.css
     components/base/Input.css
     components/base/Badge.css
     components/base/Modal.css
     components/base/Table.css
     components/base/Card.css
     components/base/UI.css
     components/base/Forms.css

   Layout:
     components/layout/Sidebar.css
     components/layout/Topbar.css
     components/layout/BaseLayout.css
   ══════════════════════════════════════════════════════════════════════════ */