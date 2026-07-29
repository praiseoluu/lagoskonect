-- 026_create_platform_settings.sql
-- Key/value store for platform-wide feature flags.
-- Seeded with safe defaults.

CREATE TABLE IF NOT EXISTS `platform_settings` (
    `key`        VARCHAR(100) NOT NULL,
    `value`      VARCHAR(500) NOT NULL DEFAULT '1',
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed defaults
INSERT INTO `platform_settings` (`key`, `value`) VALUES
    ('maintenance_mode',   '0'),
    ('allow_registrations','1'),
    ('chat_enabled',       '1'),
    ('reels_enabled',      '1'),
    ('adverts_enabled',    '1')
ON DUPLICATE KEY UPDATE `key` = `key`;
