-- 018_extend_news_table.sql
-- Adds headline, scheduling, delivery channel fields to news table.
-- Sets AUTO_INCREMENT to 100001 for consistent ID formatting.

ALTER TABLE `news`
    ADD COLUMN `is_headline`    BOOLEAN      NOT NULL DEFAULT FALSE AFTER `breaking`,
    ADD COLUMN `scheduled_at`   DATETIME     NULL     AFTER `published_at`,
    ADD COLUMN `delivery_push`  BOOLEAN      NOT NULL DEFAULT TRUE  AFTER `scheduled_at`,
    ADD COLUMN `delivery_sms`   BOOLEAN      NOT NULL DEFAULT FALSE AFTER `delivery_push`,
    ADD COLUMN `delivery_email` BOOLEAN      NOT NULL DEFAULT FALSE AFTER `delivery_sms`;

-- Only one article should be headline at a time.
-- Enforced in PHP, not DB, for flexibility.

-- Bump AUTO_INCREMENT to match citizen ID format
ALTER TABLE `news` AUTO_INCREMENT = 100001;

-- Add index for scheduled articles query
CREATE INDEX `idx_news_scheduled` ON `news` (`status`, `scheduled_at`);

-- Add index for headline lookup
CREATE INDEX `idx_news_headline` ON `news` (`is_headline`, `status`);
