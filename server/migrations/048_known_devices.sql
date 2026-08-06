-- 048_known_devices.sql
-- Remembers which devices a citizen has already signed in from.
--
-- The "New sign-in to your account" alert fired on every single login, so the
-- notification list filled with identical security warnings for the ordinary
-- act of logging in. An alert that fires when nothing is wrong is worse than
-- no alert: people learn to ignore it, and the one that matters is ignored too.
--
-- With this table a sign-in is only remarkable when it comes from a device the
-- account has not been seen on before.

CREATE TABLE IF NOT EXISTS `user_devices` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     INT          NOT NULL,

    -- sha256 of the user agent, salted per user so the same hash cannot be
    -- correlated across accounts. Fixed 64 chars.
    `device_hash` CHAR(64)     NOT NULL,

    -- Kept for display only ("Chrome on Windows"), never for matching.
    `user_agent`  VARCHAR(400) NULL DEFAULT NULL,
    `label`       VARCHAR(120) NULL DEFAULT NULL,

    -- Last address seen. Deliberately NOT part of the match: mobile networks
    -- reassign addresses constantly, and matching on it would recreate the
    -- every-login alert this table exists to stop.
    `last_ip`     VARCHAR(45)  NULL DEFAULT NULL,

    `first_seen_at` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_seen_at`  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    -- One row per user per device, and the lookup path on every login.
    UNIQUE KEY `uq_user_device` (`user_id`, `device_hash`),
    KEY `idx_user_devices_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
