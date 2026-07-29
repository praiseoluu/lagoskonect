-- 006_create_reels.sql

CREATE TABLE IF NOT EXISTS `reels` (
    `id`               INT          NOT NULL AUTO_INCREMENT,
    `reel_id`          VARCHAR(20)  NOT NULL,
    `lga_id`           INT          NULL,
    `lga_name`         VARCHAR(100) NULL,
    `target_all_lgas`  BOOLEAN      NOT NULL DEFAULT FALSE,
    `title`            VARCHAR(300) NOT NULL,
    `description`      TEXT         NULL,
    `caption`          VARCHAR(500) NULL,
    `hashtags`         JSON         NULL,
    `video_url`        VARCHAR(500) NULL,
    `thumbnail_url`    VARCHAR(500) NULL,
    `duration`         INT          NOT NULL DEFAULT 0,
    `views`            INT          NOT NULL DEFAULT 0,
    `likes`            INT          NOT NULL DEFAULT 0,
    `shares`           INT          NOT NULL DEFAULT 0,
    `comment_count`    INT          NOT NULL DEFAULT 0,
    `author_id`        INT          NULL,
    `author_name`      VARCHAR(100) NULL,
    `author_handle`    VARCHAR(100) NULL,
    `author_avatar_url` VARCHAR(500) NULL,
    `status`           ENUM('draft','published','paused') NOT NULL DEFAULT 'draft',
    `published_at`     DATETIME     NULL,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_reel_id` (`reel_id`),
    INDEX `idx_reels_lga_status`   (`lga_id`, `status`),
    INDEX `idx_reels_published_at` (`published_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reel_likes` (
    `reel_id`    VARCHAR(20) NOT NULL,
    `user_id`    INT         NOT NULL,
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`reel_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reel_comments` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `reel_id`    VARCHAR(20)  NOT NULL,
    `user_id`    INT          NOT NULL,
    `user_name`  VARCHAR(100) NOT NULL,
    `avatar_url` VARCHAR(500) NULL,
    `text`       TEXT         NOT NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_reel_comments_reel_id` (`reel_id`),
    INDEX `idx_reel_comments_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;