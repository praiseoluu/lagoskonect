# KTG Connect — PHP REST API

Pure PHP 8.x REST API backend for the KTG Connect civic engagement app.  
No frameworks. MySQL 8.x. JWT authentication.

---

## Quick Start

### 1. Requirements

- PHP 8.1+
- MySQL 8.0+
- Apache (mod_rewrite) or Nginx
- A web server pointing to this directory

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials and a strong JWT_SECRET
```

For Apache, add to your `.htaccess` or VirtualHost:
```apache
SetEnv DB_HOST     localhost
SetEnv DB_NAME     afx_connect
SetEnv DB_USER     your_db_user
SetEnv DB_PASS     your_db_password
SetEnv JWT_SECRET  your_very_long_random_secret
```

For Nginx + PHP-FPM, add to your pool config (`/etc/php/8.x/fpm/pool.d/www.conf`):
```ini
env[DB_HOST]    = localhost
env[DB_NAME]    = afx_connect
env[DB_USER]    = your_db_user
env[DB_PASS]    = your_db_password
env[JWT_SECRET] = your_very_long_random_secret
```

### 3. Generate real password hashes

The seed files ship with placeholder bcrypt hashes. Run this once:

```bash
php generate_hashes.php
```

Copy the output hashes into `seeds/users.sql` and `seeds/admin_users.sql`,
replacing every `$2y$10$PLACEHOLDER_...` string.

### 4. Run database setup

```bash
# Migrations only (safe to run on existing DB — uses CREATE TABLE IF NOT EXISTS):
php setup.php

# First-time setup with seed data:
php setup.php --seed

# Fresh start (DROPS ALL TABLES first — development only!):
php setup.php --seed --fresh
```

### 5. Verify

```bash
curl http://localhost/api/v1/lgas
# Should return: {"data": [{"id": 1, "name": "Agege", ...}, ...]}
```

---

## Test Credentials

After seeding, these credentials work:

| Name | Phone/Email | Password | Status |
|---|---|---|---|
| Adaeze Okonkwo | +2348031234567 | citizen1 | ✅ Active |
| Emeka Nwosu | +2348059876543 | citizen2 | ✅ Active |
| Chukwuemeka Eze | emeka@example.com | citizen3 | ✅ Active |
| Ngozi Adeyemi | +2348167778899 | citizen4 | ✅ Active |
| Amina Yusuf | amina@example.com | citizen5 | ✅ Active |
| Fatima Bello | +2348121112233 | citizen_suspended | 🚫 Suspended |
| Segun Lawal | +2348033334455 | citizen_pending | ⏳ Unverified |

**OTP codes (mock):**
- Post-registration phone verify: `1234`
- Forgot-password identity verify: `123456`

---

## Connecting the Frontend

In the KTG Connect frontend `api/client.js`, change one line:

```js
// Mock mode (current):
const BASE_URL = null; // uses _mockData.js internally

// Real backend:
const BASE_URL = 'https://your-api-domain.com/api/v1';
```

Then update the fetch calls in each API module to use `BASE_URL` instead of the mock functions.

---

## API Endpoints

All endpoints are prefixed `/api/v1/`. Protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | No | Login with phone + password |
| POST | `/auth/register` | No | Register new citizen |
| POST | `/auth/verify-phone` | No | Verify phone with OTP |
| POST | `/auth/resend-otp` | No | Resend OTP |
| POST | `/auth/forgot-password` | No | Start password reset |
| POST | `/auth/verify-identity` | No | Verify identity OTP (6-digit) |
| POST | `/auth/reset-password` | No | Set new password |
| POST | `/auth/logout` | Yes | Logout (blacklist token) |

### LGAs
| GET | `/lgas` | No | List all 20 Lagos LGAs |

### Users (Citizen)
| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Get own profile |
| PATCH | `/users/me` | Update name, email, lgaId |
| POST | `/users/me/avatar` | Upload avatar (multipart) |
| PATCH | `/users/me/password` | Change password |
| POST | `/users/me/welcome-seen` | Mark welcome page seen |
| PATCH | `/users/me/privacy` | Update privacy settings |
| PATCH | `/users/me/notif-prefs` | Update notification prefs |

### News
| GET | `/news` | LGA news feed (paginated) |
| GET | `/news/:slug` | Single news item by slug |

### Reels
| GET | `/reels` | LGA reel feed (paginated) |
| GET | `/reels/:reelId` | Single reel |
| POST | `/reels/:reelId/like` | Toggle like |
| GET | `/reels/:reelId/comments` | Get comments (paginated) |
| POST | `/reels/:reelId/comments` | Post comment |

### Chat (LGA Group)
| GET | `/chat/messages` | Chat history (oldest-first) |
| POST | `/chat/messages` | Send message |
| GET | `/chat/online-count` | Online member count |
| POST | `/chat/messages/:id/reactions` | Toggle emoji reaction |
| POST | `/chat/invite` | Invite by phone |

### Notifications
| GET | `/notifications` | List notifications (paginated) |
| GET | `/notifications/unread-count` | Unread count |
| PATCH | `/notifications/:id/read` | Mark one read |
| PATCH | `/notifications/read-all` | Mark all read |

### Posts
| GET | `/posts` | Approved LGA posts (paginated) |
| GET | `/posts/mine` | Own posts (pending + approved) |
| POST | `/posts` | Create post (enters pending) |

### Adverts
| GET | `/adverts` | Active adverts for current LGA |

---

## Response Format

All responses follow this envelope:

**Success:**
```json
{ "data": { ... } }

// With pagination:
{ "data": [...], "meta": { "page": 1, "perPage": 20, "total": 100, "totalPages": 5 } }
```

**Error:**
```json
{ "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

### HTTP Status Codes
| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No content (preflight) |
| 401 | Unauthenticated / Invalid credentials |
| 403 | Forbidden / Suspended |
| 404 | Not found |
| 409 | Conflict (e.g. phone taken) |
| 422 | Validation error |
| 500 | Server error |

---

## Project Structure

```
ktg-api/
├── index.php               ← Front controller + router
├── setup.php               ← DB migration + seed runner
├── generate_hashes.php     ← Generate bcrypt hashes for seeds
├── .htaccess               ← Apache URL rewriting
├── nginx.conf.example      ← Nginx config snippet
├── .env.example            ← Environment config template
├── config/
│   ├── database.php        ← PDO connection
│   ├── jwt.php             ← JWT secret + expiry
│   └── cors.php            ← CORS headers
├── middleware/
│   └── auth.php            ← JWT validation + role guards
├── controllers/
│   ├── AuthController.php
│   ├── LgaController.php
│   ├── UserController.php
│   ├── NewsController.php
│   ├── ReelController.php
│   ├── ChatController.php
│   ├── NotificationController.php
│   ├── PostController.php
│   └── AdvertController.php
├── utils/
│   ├── Response.php        ← JSON response helpers
│   ├── Validator.php       ← Field validation + phone normalisation
│   ├── JWT.php             ← HS256 JWT encode/decode
│   └── Paginator.php       ← LIMIT/OFFSET helpers
├── migrations/
│   ├── 001_create_lgas.sql
│   ├── 002_create_users.sql
│   ├── 003_create_admins.sql
│   ├── 004_create_jwt_blacklist.sql
│   ├── 005_create_news.sql
│   ├── 006_create_reels.sql
│   ├── 007_create_chat_messages.sql
│   ├── 008_create_notifications.sql
│   ├── 009_create_posts.sql
│   └── 010_create_adverts.sql
└── seeds/
    ├── lgas.sql
    ├── users.sql
    ├── admin_users.sql
    ├── news.sql
    ├── reels.sql
    ├── notifications.sql
    ├── posts_and_adverts.sql
    └── chat_messages.sql
```

---

## Security Checklist (Before Production)

- [ ] Set a strong `JWT_SECRET` (min 32 random characters)
- [ ] Replace all `PLACEHOLDER_` bcrypt hashes with real hashes
- [ ] Set `DB_PASS` to a strong password
- [ ] Lock `CORS` to your exact frontend domain in `config/cors.php`
- [ ] Set up HTTPS (never run auth over plain HTTP)
- [ ] Create a dedicated MySQL user with only the permissions needed:
  ```sql
  CREATE USER 'afx_user'@'localhost' IDENTIFIED BY 'strong_password';
  GRANT SELECT, INSERT, UPDATE, DELETE ON afx_connect.* TO 'afx_user'@'localhost';
  ```
- [ ] Add a cron job to clean expired JWT blacklist entries:
  ```sql
  DELETE FROM jwt_blacklist WHERE expires_at < NOW();
  ```
- [ ] Wire real SMS (Termii or Twilio) for OTP delivery — replace the `'1234'` / `'123456'` mock in `AuthController.php`
- [ ] Move `uploads/` directory outside the web root or add a proper CDN
