# KTG Connect — Handoff Document

> Current project status for any AI assistant or developer picking this up. Update this file after every significant change.
>
> **Last updated**: 2026-06-08
> **Working branch**: `claude/amazing-cannon-e9uku` → merges into `dev`

---

## Current Project Status

All planned feature batches are complete. The platform is feature-complete and ready for production deployment pending environment configuration and migration runs.

---

## Completed Features

### Auth & Onboarding
- [x] Citizen registration with **email** + username + password (email OTP verification, 4-digit, real `random_int()`)
- [x] Login accepts **email**, **phone**, or **username** as identifier (auto-detected server-side)
- [x] Auto-login after successful email verification
- [x] Pending/unverified account detection on re-registration
- [x] Forced password change for admin-created accounts (`must_change_password`)
- [x] Forgot password flow: phone or email → OTP → new password
- [x] Google OAuth (full flow)
- [x] Two-Factor Authentication (TOTP + backup codes)
- [x] JWT blacklist on logout
- [x] Separate admin auth (JWT uses `adminId`, not `userId`)
- [x] Maintenance mode

### Citizen Identity & Profiles
- [x] **Usernames**: 3–30 chars, alphanumeric/underscore/hyphen, case-insensitive unique
- [x] Username shown in chat messages, reel cards, reel detail, settings, own profile
- [x] Username editable inline in Settings → Privacy & Security
- [x] **Public user profiles** at `/u/:username` (no auth required):
  - Hero (avatar, name, @handle, verified badge, LGA pill, join date)
  - Stats (reel count, total likes, member duration)
  - Reels grid (TikTok-style 3-column, 9:16 aspect ratio, 2px gaps)
  - Private profiles show only @handle + lock notice
- [x] Own profile page shows `@handle` line
- [x] Admin user management table shows username column

### Citizen App
- [x] Home, News (LGA-scoped), Reels (LGA-scoped, citizen upload)
- [x] **Reels features**:
  - Citizen upload (video + client-side thumbnail, caption, hashtags)
  - Like, comment, share, report
  - Bell/subscribe button on ReelDetail (next to author name) — subscribes to author's future reels
  - Author name is a clickable link to `/u/:username`
  - Reel cards on feed: author name is a clickable link (click does not trigger video navigation)
  - Reel list and detail resolve live usernames via JOIN (old stored names updated at read time)
- [x] Community chat:
  - Reactions, reply, unread count (SSE), search
  - File/image attachments
  - Invite member (WhatsApp invite)
  - View members panel
  - Profanity filter enforced server-side
  - Message usernames are clickable links to `/u/:username`
- [x] In-app notifications (SSE-driven count, paginated list, mark read)
  - All notification titles use username (not full name)
- [x] Settings:
  - Edit profile (name, email, DOB, city, address, LGA, avatar)
  - Change username (inline edit with availability check)
  - Language preferences (English only; others show "COMING SOON")
  - Notification management (7 toggles)
  - Privacy & Security: visibility, 2FA, password change

### Notification System
- [x] SSE real-time stream (`/events/stream`)
- [x] `NotificationService` PHP class — single-user + LGA broadcast
- [x] 7 preference types: official, community, lgaAlerts, newLogin, reelLikes, reelComments, breakingNews
- [x] Reel subscription notifications: new reel posted → all subscribers notified (respects `notif_community`)
- [x] Notification titles show username (with fallback to name)

### Admin Panel
- [x] Dashboard, User Management (with username column), News, Reels, Adverts, Moderation, LGA, Analytics, Traffic, Platform Settings, Admin Team
- [x] News email dispatch via Resend on publish
- [x] Chat Management: LGA selector, message feed, per-message Delete/Warn/Manage, admin send, members panel, banned words CRUD

### Media Storage (IDrive e2)
- [x] Pure PHP AWS Signature V4 (`S3.php`) — no SDK, works on shared hosting
- [x] Private bucket — all objects served via `GET /media?key=...` proxy (302 → pre-signed URL, 1hr expiry, 30min browser cache)
- [x] Client-side video thumbnail extraction (`utils/thumbnail.js`) — canvas frame grab at 1s, no server-side video processing
- [x] Reels, news images, advert banners all stored on S3; avatars and chat files on server filesystem

### Messaging Infrastructure
- [x] `WhatsAppService.php` — Meta Cloud API (chat invites, optional OTP)
- [x] `EmailService.php` — Resend REST API (email OTP, news alerts)

### Database
- [x] Migrations 001–033 defined
- [ ] **Migrations 027–033 must be verified as run on production** (see below)

---

## Features Removed / Scrapped

- **Community Posts** — `PostController.php` exists as dead code, `posts` DB table exists but routes removed from `index.php`. Safe to delete both.

---

## Pending Actions Before Production

### 1. Run Outstanding Migrations

Check which migrations have been run on the production DB and run any that haven't. The following were added in recent sessions:

```
027_extend_user_notif_prefs.sql    — adds notif_new_login, notif_reel_likes,
                                     notif_reel_comments, notif_breaking_news columns
028_create_banned_words.sql        — banned words table (pre-seeded)
029_create_chat_reports.sql        — chat message reports table
030_chat_messages_nullable_user_id.sql
031_fix_chat_reports_int_types.sql
032_email_username_auth.sql        — makes phone nullable, adds username column (unique,
                                     utf8mb4_unicode_ci), makes email NOT NULL, adds gender ENUM
033_create_reel_subscriptions.sql  — reel author subscriptions (bell feature)
```

> **Note on migration 032**: Some ALTER statements may already be partially applied if you ran earlier manual changes. Run statements individually in phpMyAdmin and skip any that return "Duplicate column" errors.

### 2. Configure `server/.env`

```ini
# Database
DB_HOST=localhost
DB_NAME=afx_connect
DB_USER=afx_user
DB_PASS=your_db_password

# JWT — generate: php -r "echo bin2hex(random_bytes(32));"
JWT_SECRET=CHANGE_THIS

# API base URL (no trailing slash) — used by S3 proxy URL construction
BASE_URL=https://api.ktgconnect.com/api/v1

# IDrive e2 — create bucket, generate access key in IDrive e2 dashboard
S3_ENDPOINT=https://n8i5.c17.e2-object.com
S3_REGION=us-east-1
S3_BUCKET=ktg-connect
S3_KEY=your_access_key_id
S3_SECRET=your_secret_access_key

# Resend — https://resend.com/api-keys
RESEND_API_KEY=re_your_key
RESEND_FROM_EMAIL=noreply@ktgconnect.com
RESEND_FROM_NAME=KTG Connect

# WhatsApp — Meta Cloud API (for chat invites)
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_OTP_TEMPLATE=afx_otp
WHATSAPP_INVITE_TEMPLATE=afx_invite

# Cron
CRON_SECRET=your_random_secret
```

### 3. Update Frontend BASE_URL

In `api/_fetch.js`, change:
```js
const BASE_URL = 'http://localhost/server/api/v1';
```
to:
```js
const BASE_URL = 'https://api.ktgconnect.com/api/v1';
```

### 4. IDrive e2 Bucket Setup

1. Log into IDrive e2 dashboard → create bucket `ktg-connect`
2. Keep bucket **private** (free plan does not allow public access — proxy handles this)
3. Security → Access Keys → create a key → copy Key ID and Secret
4. Set the correct `S3_ENDPOINT` for your bucket's region (shown on bucket detail page)

### 5. Resend Domain Verification

- resend.com → Domains → Add `ktgconnect.com` → add DNS records (SPF, DKIM, DMARC)

### 6. WhatsApp Setup (Meta Cloud API)

1. [developers.facebook.com](https://developers.facebook.com) → Create App → Business → Add WhatsApp product
2. Get **Phone Number ID** from WhatsApp Settings → Phone Numbers
3. Generate permanent token: business.facebook.com → System Users → Generate Token → `whatsapp_business_messaging`
4. Create and submit two message templates for Meta approval:
   - `afx_otp` — body with `{{1}}` = OTP code
   - `afx_invite` — body with `{{1}}` = signup URL

### 7. Configure cPanel Cron Job

Every 5 minutes:
```
GET https://api.ktgconnect.com/api/v1/cron/publish-scheduled?secret=<CRON_SECRET>
```

---

## Known Issues / Gotchas

| Note |
|---|
| Admin JWT uses `adminId` not `userId`. Every admin controller has a private `requireAdmin()`. Never call `requireRole()` from admin controllers — it queries the `users` table. |
| `BASE_URL` is **not** a PHP constant — use `getenv('BASE_URL')`. A `define()` does not exist for it. |
| `reels.cloudinary_id` and `adverts.cloudinary_id` now store S3 object keys (legacy column name — do not rename without migration). |
| `/auth/verify-phone` and `api.auth.verifyPhone()` now verify an **email** OTP (name is legacy from phone era). |
| `reel_subscriptions` subscribes to an **author**, not a specific reel. Bell button on any reel subscribes you to all future reels by that author. |
| Chat profanity filter is case-insensitive substring match — banning short words may catch legitimate words. |
| `PostController.php` and the `posts` table are dead code — safe to delete. |
| Migration 032 has some statements that may already be applied depending on prior manual DB changes. Run interactively and skip duplicates. |

---

## Implementation Notes

### Admin Auth Pattern
Every admin controller has a **private** `requireAdmin()` that reads the Bearer token, decodes the JWT, checks `$payload['type'] === 'admin'`, and returns the payload (`adminId`, `role`, `type`). Never use the global `requireRole()` in admin code.

### Adding a New API Endpoint
1. Add `elseif` block in `server/index.php`
2. Create/extend controller in `server/controllers/`
3. Add client method in `api/*.js`

### Adding a New Migration
Next number is **034**. Create `server/migrations/034_description.sql`. Never modify existing migration files.

### Adding a New Notification Trigger
1. Call `NotificationService::send($this->db, $userId, $data, 'notif_preference_key')`
2. For a new preference type: add DB column in new migration, update `UserController::sanitise()`, `AuthController::sanitiseUser()`, `UserController::updateNotifPrefs()` prefMap, and `Settings.js` toggles

### The `setState()` Gotcha
`Component.setState()` always triggers a full re-render of that component's DOM subtree. Never store timer values or frequently-changing values in state. Use plain instance variables (`this._myVar`).

### WebLayout Page Pattern
Page components that extend `WebLayout` use:
- `getContent()` → return skeleton/placeholder HTML string
- `onContentReady()` → async: fetch data, populate DOM via `getContentEl()?.querySelector(...)`
- Never use `this.$('#root-id')` to match the root element — `querySelector` only matches descendants. Use `getContentEl()?.querySelector('#root-id')` or `this.el` directly.

### S3 Media Uploads
```php
$key = S3::makeKey('reels/42', 'mp4');          // → 'reels/42/abc123def456.mp4'
$url = S3::upload($tmpPath, $key, 'video/mp4'); // → BASE_URL/media?key=reels%2F42%2Fabc...
// Store $url as video_url and $key as cloudinary_id in DB
S3::delete($key);                               // cleanup on delete
```

### sessionStorage Keys (Citizen)
```
ktg_auth              → { token, role, user }
ktg_register_email    → email address (registration flow)
ktg_pending_user_id   → userId (registration flow)
ktg_reset_identifier  → phone or email (forgot-password flow)
ktg_reset_token       → one-time token after identity verified
ktg_2fa_partial       → partial JWT during 2FA challenge
```

### API Response Contract
Every response is `{ data: ... }` or `{ error: { code, message } }`. The `_fetch.js` wrapper normalises this — callers always receive `{ data, error }`.
