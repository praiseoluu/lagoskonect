-- 014_oauth.sql
-- Adds Google OAuth support.
-- oauth_states: short-lived CSRF state tokens
-- users.google_id: links a user account to their Google account

ALTER TABLE `users`
    ADD COLUMN `google_id` VARCHAR(100) NULL UNIQUE
    AFTER `two_fa_enabled`;

CREATE TABLE IF NOT EXISTS `oauth_states` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `state`      VARCHAR(64)  NOT NULL,
    `provider`   VARCHAR(20)  NOT NULL DEFAULT 'google',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_state` (`state`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
