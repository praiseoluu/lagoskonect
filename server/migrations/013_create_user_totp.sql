-- 013_create_user_totp.sql
-- Stores TOTP secrets for users who enable authenticator app 2FA.
-- The secret is a base32-encoded random string shared between the
-- server and the user's authenticator app.
-- backup_codes stores one-time use emergency codes (JSON array).

CREATE TABLE IF NOT EXISTS `user_totp` (
    `user_id`      INT          NOT NULL,
    `secret`       VARCHAR(64)  NOT NULL,
    `backup_codes` JSON         NULL,
    `verified`     BOOLEAN      NOT NULL DEFAULT FALSE,
    `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_totp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add totp_method column to users so we know which 2FA type is active
-- 'none' | 'sms' | 'totp'
ALTER TABLE `users`
    ADD COLUMN `totp_method` ENUM('none','sms','totp') NOT NULL DEFAULT 'none'
    AFTER `two_fa_enabled`;
