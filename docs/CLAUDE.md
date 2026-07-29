# KTG Connect — Project Memory (CLAUDE.md)

> Canonical reference for AI assistants and developers. Keep this file up to date whenever architecture or conventions change.

---

## Project Overview

**KTG Connect** is a civic engagement platform for citizens of **Katsina State, Nigeria**, organized around Local Government Areas (LGAs). Citizens register with email, choose a username, and join their LGA's digital community. The platform provides news, video reels, community chat, in-app notifications, and citizen profiles — all scoped to the user's LGA. A separate admin panel lets government staff manage content, users, adverts, and platform settings.

The project is deployed on **cPanel/Apache shared hosting**. There is no build step, no bundler, and no npm — everything is plain ES6 modules served directly by Apache with `.htaccess` SPA routing.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS ES6+ (no framework, no bundler) |
| Backend | PHP 8.x (no framework — pure procedural/OOP) |
| Database | MySQL (utf8mb4, InnoDB) |
| Auth | JWT HS256, TOTP 2FA, Google OAuth |
| Media | IDrive e2 (S3-compatible, private bucket via proxy) |
| Email | Resend REST API (`EmailService.php`) |
| SMS/WhatsApp | Meta Cloud API (`WhatsAppService.php`) |
| Real-time | Server-Sent Events (SSE) |
| Hosting | cPanel / Apache shared hosting |
| CSS | Plain CSS with custom properties (no preprocessor) |

---

## Repository Structure

```
afx-connect/
├── index.html              # SPA shell — single HTML file for citizen app
├── app.js                  # Bootstrap: restores session, registers routes, starts router
├── .htaccess               # SPA routing + security headers + cache policy
│
├── core/
│   ├── store.js            # Global reactive state (Proxy-based)
│   ├── router.js           # Client-side SPA router + route guards
│   └── Component.js        # Base class all page/UI components extend
│
├── utils/
│   ├── storage.js          # sessionStorage helpers: saveSession, loadSession, clearSession
│   ├── toast.js            # Toast notification helper
│   ├── sse.js              # SSE client (EventSource wrapper, polls /events/stream)
│   ├── date.js             # timeAgo(), formatDate() helpers
│   ├── thumbnail.js        # extractVideoThumbnail() — canvas frame grab from video File
│   ├── validators.js       # Frontend input validation helpers
│   └── cssLoader.js        # Dynamic CSS loading for page components
│
├── api/
│   ├── _fetch.js           # Core HTTP wrapper — injects Bearer token, returns {data}|{error}
│   ├── _mockData.js        # Mock data for dev/testing
│   ├── client.js           # Unified `api` namespace (imports all modules below)
│   ├── auth.js             # Auth: login, register, verifyPhone, forgotPassword, 2FA, OAuth
│   ├── users.js            # Citizen profile, avatar, password, username, privacy, notifPrefs
│   ├── news.js             # Citizen + admin news endpoints
│   ├── reels.js            # Citizen + admin reels endpoints (upload, like, comment, subscribe)
│   ├── chat.js             # Chat messages, reactions, unread count, members
│   ├── notifications.js    # Get, mark-read, unread count
│   ├── adverts.js          # Citizen + admin advert endpoints
│   ├── analytics.js        # Admin analytics, traffic, export
│   ├── adminTeam.js        # Admin team management (super_admin only)
│   ├── lgasAdmin.js        # Admin LGA CRUD
│   ├── moderation.js       # Content moderation (dismiss/takedown reel reports)
│   └── platformSettings.js # Feature flags (maintenance mode, etc.)
│
├── components/
│   ├── base/               # Button, Input, Toggle, Avatar, Modal, UI primitives
│   ├── layout/             # BaseLayout (WebLayout, AdminLayout)
│   └── feature/
│       ├── CreateReel.js         # Citizen reel upload modal (video + thumbnail)
│       ├── SelectLGAModal.js     # LGA picker modal
│       └── TwoFactorModal.js     # 2FA setup/confirm modal
│
├── pages/
│   ├── web/
│   │   ├── auth/           # Landing, Login, Signup, VerifyPhone, ForgotPassword,
│   │   │                   # VerifyIdentity, ResetCredentials, TwoFactorLogin,
│   │   │                   # OAuthCallback, ForceChangePassword, SelectLGA
│   │   └── app/            # Home, News, NewsDetail, Reels, ReelDetail, Chat,
│   │                       # Notifications, Settings, Profile, UserProfile, Welcome
│   └── admin/
│       ├── auth/           # AdminLogin
│       └── app/            # Dashboard, Users, News, NewsForm, NewsView, NewsPreview,
│                           # AdminReels, AdminReelForm, AdminReelPreview, AdminAdverts,
│                           # AdminAdvertForm, AdminAdvertPreview, AdminLGA, Analytics,
│                           # Traffic, AdminSettings, AdminManagement, ChatManagement,
│                           # AdminContentModeration
│
├── docs/
│   ├── CLAUDE.md           # ← this file (also at repo root)
│   └── HANDOFF.md          # Current status and next tasks
│
└── server/
    ├── index.php           # API router — flat if/elseif chain matching method+path
    ├── .htaccess           # Routes /api/v1/* to index.php; allows /uploads/* directly
    ├── .env.example        # Environment variable template
    │
    ├── config/
    │   ├── database.php    # PDO singleton, reads DB_* env vars
    │   ├── jwt.php         # JWT_SECRET and JWT_EXPIRES_IN constants
    │   ├── cors.php        # CORS headers (setCorsHeaders())
    │   ├── oauth.php       # Google OAuth client credentials
    │   └── s3.php          # IDrive e2 credentials (S3_ENDPOINT, S3_BUCKET, S3_KEY, S3_SECRET)
    │
    ├── middleware/
    │   └── auth.php        # requireAuth(), requireRole() — validates Bearer JWT,
    │                       # checks blacklist, updates last_seen_at, reads fresh lgaId from DB
    │                       # Citizens ONLY — never call from admin controllers
    │
    ├── utils/
    │   ├── Response.php          # Static helpers: json(), error(), paginated()
    │   ├── Validator.php         # Input validation: isEmail(), minLength(), jsonBody(), etc.
    │   ├── JWT.php               # HS256 encode/decode, 30-day default expiry
    │   ├── TOTP.php              # TOTP secret generation and code verification
    │   ├── S3.php                # IDrive e2 upload/delete + presignedGetUrl() (Sig V4, no SDK)
    │   ├── Paginator.php         # Pagination helper
    │   ├── Settings.php          # Feature flag helper — reads platform_settings with caching
    │   ├── NotificationService.php  # Central notification hub (send, broadcastToLgas)
    │   ├── WhatsAppService.php   # Meta Cloud API wrapper — sendOtp(), sendInvite()
    │   └── EmailService.php      # Resend REST wrapper — sendOtp(), sendNewsAlert()
    │
    ├── controllers/        # One class per domain (see API Endpoints section)
    │
    ├── migrations/         # Sequential SQL migration files (001–033)
    │
    └── uploads/
        ├── avatars/        # User-uploaded avatar files (served directly by Apache)
        └── chat/           # Chat file/image attachments (served directly by Apache)
```

---

## Architecture Decisions

### Frontend SPA (no build toolchain)
The entire frontend is served as static files. Apache's `.htaccess` routes all non-file requests to `index.html`. ES6 `import` statements work via native browser module support. **There is no Webpack, Vite, or npm.**

### Component Base Class
All pages and reusable UI components extend `core/Component.js`. Key rules:
- `setState(patch)` always triggers `_rerender()`, which **replaces the entire DOM subtree** for that component. Never use `setState()` to store timer/countdown values — this destroys and recreates input elements mid-keystroke. Use plain instance variables (`this._myVar`) instead.
- Lifecycle: `mount(el)` → `render()` → `afterMount()` → `update()` → `unmount()`
- Child components are registered via `this.addChild(component)` and cleaned up automatically on unmount.
- `this.esc(str)` is the HTML-escaping helper — always use it for user-supplied strings in template literals.
- **Page components extend `WebLayout` (or `AdminLayout`), not `Component` directly.** Use `getContent()` to return initial HTML and `onContentReady()` for async data fetching. Use `getContentEl()` to get the content wrapper, then `querySelector` descendants from it.
- `this.$('#id')` uses `querySelector` on descendants only — it **cannot match the root element itself**. If your root element has the ID you need, use `getContentEl()?.querySelector('#id')` or `this.el` directly.

### Global Store
`core/store.js` is a JavaScript Proxy-based reactive store. Any assignment (`store.foo = bar`) triggers all subscribers registered via `store.subscribe('foo', handler)`. The store is populated from `sessionStorage` on page load (in `app.js`) so state survives page refreshes within the same browser session.

### API Response Contract
Every API response is either:
```json
{ "data": { ... } }
```
or:
```json
{ "error": { "code": "ERROR_CODE", "message": "Human readable message", ...extra } }
```
The `api/_fetch.js` wrapper normalises this — callers always receive `{ data, error }`.

### Backend Router
`server/index.php` is a flat `if/elseif` chain. There is no framework router. Routes are matched by `$method` + `$path` (after stripping `/server/api/v1` prefix). Dynamic segments are matched with `preg_match`. To add a new endpoint: add an `elseif` block and require the controller at the top.

### Authentication Flow
- Citizens register with **email + username + password** (not phone). OTP is sent to email via Resend.
- Login accepts **email**, **phone**, or **username** as identifier — the backend auto-detects which.
- JWT is issued on verification/login, stored in `sessionStorage` (`ktg_auth` key via `storage.js`).
- `requireAuth()` / `requireRole()` in `auth.php` validate the Bearer token, check the `jwt_blacklist` table, update `last_seen_at`, and re-read `lgaId` from DB. **Citizens only** — never call from admin controllers.
- LGA ID is re-read from the database on every authenticated request — JWT LGA is not trusted.
- **Admin auth is completely separate**: different table (`admins`), different login endpoint, JWT payload uses `adminId` (not `userId`) and `type: 'admin'`. Every admin controller has a **private `requireAdmin()`** method — never use the global `requireRole()` from admin code.
- 2FA (TOTP) is optional. When enabled, login returns `2FA_REQUIRED` with a partial session token in `sessionStorage['ktg_2fa_partial']`.

### Session Storage Keys (citizen)
| Key | Content |
|---|---|
| `ktg_auth` | `{ token, role, user }` — main session |
| `ktg_register_email` | Email address during registration/verification flow |
| `ktg_pending_user_id` | userId during registration/verification flow |
| `ktg_reset_identifier` | Phone or email during forgot-password flow |
| `ktg_reset_token` | One-time token after identity verified, before password reset |
| `ktg_2fa_partial` | Partial session token during 2FA challenge |

### LGA-Based Data Isolation
All citizen-facing content (news, reels, chat, adverts) is scoped to the user's `lga_id`. The backend reads `lgaId` fresh from the DB on every authenticated request. Admin content can target specific LGAs or all LGAs.

### Notifications
- **SSE stream**: `GET /events/stream` — citizens connect with a Bearer token via query param (`?token=`). The `EventsController` polls the DB every 2 seconds and pushes new notification counts.
- **NotificationService**: Central PHP class. `send()` inserts a single notification after checking the user's preference column. `broadcastToLgas()` fetches all eligible users with `preference=1` and does a bulk INSERT.
- Notifications have categories: `Official`, `Community`, `Security Alert`, `Event`.
- 7 user preference columns control delivery: `notif_official`, `notif_community`, `notif_lga_alerts`, `notif_new_login`, `notif_reel_likes`, `notif_reel_comments`, `notif_breaking_news`.
- Notification titles use **username** (not full name) for actor display (likes, comments, new reel).
- Self-interaction notifications are suppressed — likes/comments on your own reel send nothing.

### Feature Flags
`platform_settings` table holds key/value pairs. `Settings::is('maintenance_mode')` returns a boolean. When maintenance mode is on, all non-admin, non-auth API routes return 503. Other flags: `allow_registrations`, `chat_enabled`, `reels_enabled`, `adverts_enabled`.

### Media Storage (IDrive e2 — S3-compatible, private bucket)
- **Avatars**: uploaded to server filesystem at `server/uploads/avatars/{userId}.{ext}`, served via Apache.
- **Chat attachments**: uploaded to `server/uploads/chat/`, served via Apache.
- **Reels, news images, advert banners**: uploaded to **IDrive e2** (private bucket) via `S3::upload()`.
  - `S3::upload($tmpPath, $key, $mime)` → returns a proxy URL: `{BASE_URL}/media?key={encoded_key}`
  - `GET /media?key=...` is a public proxy endpoint that generates a **pre-signed redirect (302)** to the private S3 object (1-hour expiry). Browsers cache the redirect for 30 minutes.
  - Object keys are random (`bin2hex(random_bytes(10))` + extension). Stored in `cloudinary_id` DB column.
  - `S3::delete($key)` removes the object.
  - `S3::presignedGetUrl($key, $expiry)` generates a direct Signature V4 URL (used internally by the proxy).
- **Video thumbnails**: extracted **client-side** via `utils/thumbnail.js` (`extractVideoThumbnail(file)` — canvas frame grab at 1s) and uploaded alongside the video as a separate `thumbnail` multipart field. No server-side video processing.

---

## Coding Conventions

### PHP
- PHP 8.x — use `declare(strict_types=1)`, named arguments where helpful, `match` expressions.
- Controllers are plain classes with public methods called directly from `index.php`.
- Always use `Response::error(...)` and `Response::json(...)` — never `echo` directly.
- All DB queries use **prepared statements** with `?` placeholders — no string interpolation.
- `Validator::jsonBody()` reads and decodes the request body; returns `null` if not JSON.
- Error codes are `SCREAMING_SNAKE_CASE` strings (e.g., `INVALID_PASSWORD`, `NOT_FOUND`).

### JavaScript
- ES6 modules everywhere — use `import`/`export`, no CommonJS.
- No TypeScript. No JSX. No build step.
- Template literals for HTML generation inside components.
- **Always escape user content** with `this.esc()` in HTML template literals.
- `camelCase` for variables and functions, `PascalCase` for classes and component files.
- Never use `setState()` for values that change frequently — use plain instance variables.
- API calls always use the `api.*` namespace from `api/client.js`.
- Router intercepts all `<a href>` clicks automatically (no `data-external` needed for internal links; use `target="_blank"` or `data-external` for external links).

### CSS
- Custom properties (CSS variables) for all design tokens (colors, spacing, typography).
- BEM-like naming: `block__element--modifier` (e.g., `reel-card__author-name`).
- Component-scoped CSS files co-located with the JS component.

### Git / Branching
- Working branch: **`claude/amazing-cannon-e9uku`** → merges into **`dev`** → merges into `main`.
- Migrations are named `###_description.sql` with sequential numbers. **Current highest: 033.**
- **Never modify an existing migration.** Always create a new sequentially numbered file.

---

## Database Schema Summary

| Table | Purpose |
|---|---|
| `lgas` | LGA reference data (name, state, is_capital, chairman_name) |
| `users` | Citizens: auth (email+password), username, profile, LGA, 2FA, notification prefs |
| `admins` | Admin team: auth, roles (super_admin / admin / moderator) |
| `jwt_blacklist` | Revoked tokens (checked on every authenticated request) |
| `news` | Articles with status, LGA targeting, headline/breaking flags |
| `news_lga_targets` | Many-to-many: news ↔ LGAs |
| `reels` | Short videos (S3), LGA targeting, moderation, `cloudinary_id` stores S3 key |
| `reel_lga_targets` | Many-to-many: reels ↔ LGAs |
| `reel_likes` | User reel likes (unique per user+reel) |
| `reel_comments` | User comments on reels |
| `reel_reports` | User-submitted reel reports + admin resolution |
| `reel_subscriptions` | Bell subscriptions: `follower_id` notified when `target_id` posts |
| `chat_messages` | LGA group chat messages with emoji reactions, file attachments |
| `chat_invites` | Chat invite tokens |
| `chat_last_read` | Per-user per-LGA last-read tracking for unread counts |
| `chat_reports` | Citizen-reported chat messages + admin resolution |
| `banned_words` | Profanity filter words (pre-seeded, admin-manageable) |
| `notifications` | In-app notifications (category, priority, read status, linkTo) |
| `adverts` | Banner/interstitial/feed ads with LGA targeting, `cloudinary_id` stores S3 key |
| `advert_lga_targets` | Many-to-many: adverts ↔ LGAs |
| `user_totp` | TOTP secrets and backup codes for 2FA |
| `oauth_states` | CSRF state tokens for Google OAuth flow |
| `page_views` | Lightweight analytics event log |
| `platform_settings` | Key/value feature flags |
| `posts` | Table exists but feature is **scrapped** — routes removed, PostController dead code |

**ID format**: Most tables use `AUTO_INCREMENT` starting at `100001` for consistent 6-digit IDs.

**Column note**: `reels.cloudinary_id` and `adverts.cloudinary_id` now store S3 object keys (e.g. `reels/lga42/abc123def456.mp4`), not Cloudinary public IDs. The column name is legacy — the data is S3.

---

## Business Rules

1. **Citizens are LGA-scoped.** All content (news, reels, chat, adverts) is filtered by the user's `lga_id`.
2. **Email verification is required** for citizen registration. OTP is 4 digits, sent via Resend, expires in 10 minutes.
3. **Usernames** are 3–30 characters, alphanumeric + underscore + hyphen, case-insensitive unique (utf8mb4_unicode_ci collation). Set at registration, changeable in Settings.
4. **Login identifier** is auto-detected: contains `@` → email; starts with `+` or all digits → phone; otherwise → username (case-insensitive).
5. **Admin-created citizens** start with `is_verified = 1` and `must_change_password = 1`. They must set a new password on first login.
6. **Pending registrations**: if a citizen tries to register with an email that has a `pending` account, the backend returns `PENDING_VERIFICATION` with a refreshed OTP.
7. **LGA ID is always re-read from DB** on authenticated requests — JWT LGA is not trusted.
8. **Headline news**: only one article can be headline at a time. Enforced in PHP, not at DB level.
9. **Breaking news dispatch** uses `notif_breaking_news` preference. Regular news dispatch uses `notif_official`.
10. **Self-interaction notifications are suppressed**: likes and comments on your own reels send no notification.
11. **Reel subscriptions**: when a user posts a reel, all `reel_subscriptions.follower_id` where `target_id = userId` receive a `Community` notification (respects `notif_community` preference).
12. **Usernames in notifications**: all notification titles use `username` (with fallback to `name`) — never full name.
13. **Maintenance mode** exempts: all `/auth/*` routes and all `/admin/*` routes.
14. **Admin roles**: `super_admin` > `admin` > `moderator`. Only `super_admin` can manage the admin team.
15. **Chat profanity filter**: enforced server-side on send. Case-insensitive substring match. Admin-manageable via banned words CRUD.
16. **Display names in chat and reels** are resolved at read time via `COALESCE(u.username, stored_name)` JOIN — always shows current username even for old messages.

---

## API Endpoints Reference

### Media Proxy (public, no auth)
| Method | Path | Description |
|---|---|---|
| GET | `/media?key=...` | Generate pre-signed S3 redirect (302) for private bucket objects |

### Auth (`/auth/*`)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register citizen (`name`, `email`, `username`, `password`, `lgaId`, `gender`) |
| POST | `/auth/verify-phone` | Verify email OTP → issues JWT (route name is legacy) |
| POST | `/auth/resend-otp` | Resend OTP (type: `phone` for registration, `identity` for password reset) |
| POST | `/auth/login` | Login with `identifier` (email/username/phone) + `password` |
| POST | `/auth/logout` | Blacklist token |
| POST | `/auth/forgot-password` | Send identity OTP to phone or email |
| POST | `/auth/verify-identity` | Verify identity OTP → issues reset token |
| POST | `/auth/reset-password` | Reset password with reset token |
| POST | `/auth/change-password` | Force change password (admin-created accounts) |
| GET | `/auth/oauth/google/redirect` | Start Google OAuth |
| GET | `/auth/oauth/google/callback` | Google OAuth callback |
| GET | `/auth/2fa/status` | Get 2FA status |
| POST | `/auth/2fa/setup` | Generate TOTP secret |
| POST | `/auth/2fa/confirm` | Confirm and activate 2FA |
| POST | `/auth/2fa/validate` | Validate TOTP during login |
| POST | `/auth/2fa/disable` | Disable 2FA |
| POST | `/auth/2fa/backup` | Use backup code |

### Citizens — Users (`/users/*`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | citizen | Get own profile |
| PATCH | `/users/me` | citizen | Update profile (name, email, DOB, city, address, lgaId) |
| POST | `/users/me/avatar` | citizen | Upload avatar (base64 → server filesystem) |
| PATCH | `/users/me/password` | citizen | Change password |
| PATCH | `/users/me/username` | citizen | Change username (case-insensitive uniqueness check) |
| POST | `/users/me/welcome-seen` | citizen | Mark welcome screen as seen |
| PATCH | `/users/me/privacy` | citizen | Update privacy settings |
| PATCH | `/users/me/notif-prefs` | citizen | Update notification preferences |
| GET | `/users/profile/:username` | public | Get public profile (respects privacy settings) |

### Citizens — Reels (`/reels/*`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reels` | citizen | List LGA reels (paginated) |
| POST | `/reels/upload` | citizen | Upload reel (multipart: `file`, `caption`, `hashtags`, `thumbnail`) |
| GET | `/reels/by/:userId` | public | List reels by user |
| GET | `/reels/:reelId` | citizen | Get reel detail |
| POST | `/reels/:reelId/like` | citizen | Toggle like |
| GET | `/reels/:reelId/comments` | citizen | List comments (paginated) |
| POST | `/reels/:reelId/comments` | citizen | Post comment |
| POST | `/reels/:reelId/report` | citizen | Report reel |
| GET | `/reels/:reelId/subscription` | citizen | Get own subscription state for reel's author |
| POST | `/reels/:reelId/subscribe` | citizen | Subscribe to reel author (bell) |
| DELETE | `/reels/:reelId/subscribe` | citizen | Unsubscribe from reel author |
| DELETE | `/reels/:reelId` | admin role | Admin delete reel |

### Citizens — News, Chat, Notifications, Adverts
All require Bearer JWT. Full list in `server/index.php`.

### Admin (`/admin/*`)
All require admin JWT (`adminId` in payload, `type: 'admin'`). Full list in `server/index.php`.

### Cron
| Method | Path | Description |
|---|---|---|
| GET | `/cron/publish-scheduled` | Publish scheduled news (protected by `CRON_SECRET` query param) |

---

## Technical Constraints

- **No build step** — cannot use npm packages in the frontend. Everything must be plain JS.
- **cPanel/Apache shared hosting** — no Docker, no Node.js, no long-running processes.
- **SSE not WebSocket** — real-time via Server-Sent Events polling every 2 seconds.
- **IDrive e2 free plan** — bucket cannot be made public. All media served via `/media` proxy (302 redirect to pre-signed URL). No server-side video processing — thumbnails extracted client-side.
- **No ORM** — raw PDO with prepared statements throughout.
- **PHP sessions not used** — all state is JWT-based.
- **Katsina State only** — `state` field is hard-coded to `'Katsina State'` in API responses.
- **`cloudinary_id` column name is legacy** — now stores S3 object keys. Do not rename without a migration.

---

## Environment Variables

Defined in `server/.env` (not committed). Template at `server/.env.example`:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_NAME=afx_connect
DB_USER=afx_user
DB_PASS=your_strong_password_here

JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING_IN_PRODUCTION
JWT_EXPIRES_IN=2592000

# Base URL for API (used by S3 proxy URL construction — no trailing slash)
BASE_URL=https://api.ktgconnect.com/api/v1

# IDrive e2 (S3-compatible object storage)
S3_ENDPOINT=https://n8i5.c17.e2-object.com
S3_REGION=us-east-1
S3_BUCKET=ktg-connect
S3_KEY=your_access_key_id
S3_SECRET=your_secret_access_key

# Resend (email OTPs + news alerts)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@ktgconnect.com
RESEND_FROM_NAME=KTG Connect

# WhatsApp Meta Cloud API (chat invites, optional OTP fallback)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_token
WHATSAPP_OTP_TEMPLATE=afx_otp
WHATSAPP_INVITE_TEMPLATE=afx_invite
WHATSAPP_API_VERSION=v19.0

# Cron secret for scheduled news publishing
CRON_SECRET=CHANGE_THIS_TO_A_RANDOM_SECRET
```

Frontend `BASE_URL` is hard-coded in `api/_fetch.js` (`http://localhost/server/api/v1` for local dev). Change this for production.

---

## Known Gotchas

| Note |
|---|
| Admin JWT uses `adminId` not `userId`. Every admin controller has a **private `requireAdmin()`**. **Never call `requireRole()` from admin controllers** — it queries the `users` table. |
| `requireRole()` in `auth.php` is for citizens only. |
| `reels.cloudinary_id` and `adverts.cloudinary_id` now store S3 object keys, not Cloudinary IDs. Column name is legacy. |
| `BASE_URL` is **not** a PHP constant — read it with `getenv('BASE_URL')`. No `define()` for it exists. |
| `PostController.php` still exists as dead code — safe to delete. The `posts` DB table also still exists. |
| Chat profanity filter is case-insensitive substring match — banning "ass" also catches "class". |
| The `/auth/verify-phone` endpoint and `api.auth.verifyPhone()` method verify an **email** OTP now (name is legacy from the phone-based era). |
| `reel_subscriptions` subscribes a user to an **author**, not a specific reel. When any reel is posted by `target_id`, all `follower_id` subscribers are notified. |
