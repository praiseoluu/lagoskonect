ALTER TABLE `news`
    ADD COLUMN IF NOT EXISTS `external_id`     VARCHAR(64)  NULL DEFAULT NULL AFTER `source_name`,
    ADD COLUMN IF NOT EXISTS `external_source` VARCHAR(50)  NULL DEFAULT NULL AFTER `external_id`;

CREATE INDEX IF NOT EXISTS `idx_news_external_id` ON `news` (`external_id`);

CREATE TABLE IF NOT EXISTS `news_import_cache` (
                                                   `cache_key`  VARCHAR(120) NOT NULL,
    `payload`    LONGTEXT     NOT NULL,
    `fetched_at` DATETIME     NOT NULL,
    `expires_at` DATETIME     NOT NULL,
    PRIMARY KEY (`cache_key`),
    KEY `idx_import_cache_expires` (`expires_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `news_import_dismissed` (
                                                       `external_id` VARCHAR(64) NOT NULL,
    `admin_id`    INT         NULL DEFAULT NULL,
    `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`external_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `news_import_usage` (
                                                   `usage_date`   DATE     NOT NULL,
                                                   `calls`        INT      NOT NULL DEFAULT 0,
                                                   `last_call_at` DATETIME NULL DEFAULT NULL,
                                                   PRIMARY KEY (`usage_date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
