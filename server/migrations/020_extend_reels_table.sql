-- 020_extend_reels_table.sql
-- Adds delivery channels, allow_comments, updates status ENUM,
-- sets AUTO_INCREMENT to 100001, and creates reel_lga_targets junction table.

-- Extend reels table
ALTER TABLE `reels`
    ADD COLUMN `delivery_push`  BOOLEAN NOT NULL DEFAULT TRUE  AFTER `status`,
    ADD COLUMN `delivery_sms`   BOOLEAN NOT NULL DEFAULT FALSE AFTER `delivery_push`,
    ADD COLUMN `delivery_email` BOOLEAN NOT NULL DEFAULT FALSE AFTER `delivery_sms`,
    ADD COLUMN `allow_comments` BOOLEAN NOT NULL DEFAULT TRUE  AFTER `delivery_email`;

ALTER TABLE `reels`
    MODIFY COLUMN `status`
        ENUM('draft','published','paused') NOT NULL DEFAULT 'draft';

ALTER TABLE `reels` AUTO_INCREMENT = 100001;

CREATE TABLE IF NOT EXISTS `reel_lga_targets` (
    `id`      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `reel_id` VARCHAR(64)  NOT NULL,
    `lga_id`  INT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_reel_lga` (`reel_id`, `lga_id`),
    KEY `idx_reel_id` (`reel_id`),
    KEY `idx_lga_id`  (`lga_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
