-- Migration 032: Email-based auth + unique usernames + gender field
-- Phone becomes optional; email becomes required; username added.
-- NOTE: Steps are safe to run individually in phpMyAdmin if some already applied.

-- 1. Make phone nullable
ALTER TABLE users
    MODIFY COLUMN phone VARCHAR(20) NULL DEFAULT NULL;

-- 2. Add username column (nullable first so we can back-fill)
--    Skip this statement if the column already exists.
ALTER TABLE users
    ADD COLUMN username VARCHAR(30) NULL COLLATE utf8mb4_unicode_ci AFTER name;

-- 3. Back-fill placeholder usernames for any rows that have none
UPDATE users SET username = CONCAT('user_', id) WHERE username IS NULL OR username = '';

-- 4. Make username NOT NULL with correct collation, then add unique index
--    Skip the ADD UNIQUE KEY line if the key already exists.
ALTER TABLE users
    MODIFY COLUMN username VARCHAR(30) NOT NULL COLLATE utf8mb4_unicode_ci;

ALTER TABLE users
    ADD UNIQUE KEY uq_users_username (username);

-- 5. Back-fill placeholder emails for any rows that have no email
UPDATE users
    SET email = CONCAT('legacy_', id, '@placeholder.local')
    WHERE email IS NULL OR email = '';

-- 6. Make email NOT NULL (unique key already exists from initial schema)
ALTER TABLE users
    MODIFY COLUMN email VARCHAR(200) NOT NULL;

-- 7. Add gender column
--    Skip this statement if the column already exists.
ALTER TABLE users
    ADD COLUMN gender ENUM('male','female','prefer_not_to_say') NULL AFTER username;
