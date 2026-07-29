-- 010_create_adverts.sql

CREATE TABLE IF NOT EXISTS `adverts` (
    `id`               INT          NOT NULL AUTO_INCREMENT,
    `title`            VARCHAR(200) NOT NULL,
    `advertiser`       VARCHAR(200) NOT NULL,
    `description`      TEXT         NULL,
    `cta_label`        VARCHAR(100) NULL,
    `cta_url`          VARCHAR(500) NULL,
    `image_url`        VARCHAR(500) NULL,
    `type`             ENUM('banner','interstitial') NOT NULL DEFAULT 'banner',
    `status`           ENUM('active','paused','expired') NOT NULL DEFAULT 'active',
    `target_all_lgas`  BOOLEAN      NOT NULL DEFAULT TRUE,
    `start_date`       DATE         NULL,
    `end_date`         DATE         NULL,
    `impressions`      INT          NOT NULL DEFAULT 0,
    `clicks`           INT          NOT NULL DEFAULT 0,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_adverts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `advert_lga_targets` (
    `advert_id` INT NOT NULL,
    `lga_id`    INT NOT NULL,
    PRIMARY KEY (`advert_id`, `lga_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;