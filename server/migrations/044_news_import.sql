-- 044_news_import.sql
-- Supports importing articles from World News API into the news desk.
--
-- Nothing here publishes anything on its own. Fetched articles live only in
-- the cache table until an admin approves one, at which point a normal row is
-- created in `news` the same way the manual editor creates it.

-- Lets us recognise an article we have already seen, so an approved or
-- dismissed item never reappears in the review list.
ALTER TABLE `news`
    ADD COLUMN IF NOT EXISTS `external_id`     VARCHAR(64)  NULL DEFAULT NULL AFTER `source_name`,
    ADD COLUMN IF NOT EXISTS `external_source` VARCHAR(50)  NULL DEFAULT NULL AFTER `external_id`;

-- Plain index, not unique: an admin may legitimately want to re-import an
-- article after deleting the first copy, and a unique key would block that.
CREATE INDEX IF NOT EXISTS `idx_news_external_id` ON `news` (`external_id`);

-- Cached upstream responses. The free tier allows very few calls per day, so
-- every fetch for a given country + date is served from here until it expires
-- or an admin explicitly asks to refresh.
CREATE TABLE IF NOT EXISTS `news_import_cache` (
    `cache_key`  VARCHAR(120) NOT NULL,
    `payload`    LONGTEXT     NOT NULL,
    `fetched_at` DATETIME     NOT NULL,
    `expires_at` DATETIME     NOT NULL,
    PRIMARY KEY (`cache_key`),
    KEY `idx_import_cache_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Articles an admin has explicitly rejected. Kept so they stay hidden on
-- every later fetch of the same day.
CREATE TABLE IF NOT EXISTS `news_import_dismissed` (
    `external_id` VARCHAR(64) NOT NULL,
    `admin_id`    INT         NULL DEFAULT NULL,
    `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`external_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per day recording how many upstream calls were spent, so the
-- daily budget can be enforced before a request is ever sent.
CREATE TABLE IF NOT EXISTS `news_import_usage` (
    `usage_date`   DATE     NOT NULL,
    `calls`        INT      NOT NULL DEFAULT 0,
    `last_call_at` DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (`usage_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
