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
 *   import { Button, Input, Modal, Table }    from '../../components/index.js';
 *   import { WebLayout, AdminLayout }          from '../../components/index.js';
 *   import { StatCard, NewsCard, ReelCard }    from '../../components/index.js';
 *   import { OTPInput, Dropdown, FileUpload }  from '../../components/index.js';
 *
 * @module  ComponentIndex
 * @version 2.0.0
 */

/* ══════════════════════════════════════════════════════════════════════════
   BASE COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

// ── Primitives ─────────────────────────────────────────────────────────────
export { Button }       from './base/Button.js';
export { Input }        from './base/Input.js';
export { Badge }        from './base/Badge.js';
export { Modal }        from './base/Modal.js';
export { Table }        from './base/Table.js';

// ── Card family ────────────────────────────────────────────────────────────
export {
  Card,
  StatCard,
  NewsCard,
  ReelCard,
} from './base/Card.js';

// ── UI utilities ───────────────────────────────────────────────────────────
export {
  ToastContainer,
  Avatar,
  Tabs,
  Toggle,
} from './base/UI.js';

// ── Form components ────────────────────────────────────────────────────────
export {
  OTPInput,
  Dropdown,
  FileUpload,
  ProgressBar,
  ChatBubble,
} from './base/Forms.js';

/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

// ── Sidebar ────────────────────────────────────────────────────────────────
export {
  Sidebar,
  WebSidebar,
  AdminSidebar,
} from './layout/Sidebar.js';

// ── Topbar ─────────────────────────────────────────────────────────────────
export {
  Topbar,
  WebTopbar,
  AdminTopbar,
} from './layout/Topbar.js';

// ── Page layouts ───────────────────────────────────────────────────────────
export {
  BaseLayout,
  WebLayout,
  AdminLayout,
} from './layout/BaseLayout.js';

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