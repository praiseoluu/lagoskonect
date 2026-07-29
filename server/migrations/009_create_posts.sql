-- 009_create_posts.sql
CREATE TABLE IF NOT EXISTS `posts` (
    `id`            INT          NOT NULL AUTO_INCREMENT,
    `user_id`       INT          NOT NULL,
    `user_name`     VARCHAR(100) NOT NULL,
    `avatar_url`    VARCHAR(500) NULL,
    `lga_id`        INT          NOT NULL,
    `lga_name`      VARCHAR(100) NOT NULL,
    `text`          TEXT         NOT NULL,
    `media_url`     VARCHAR(500) NULL,
    `status`        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    `likes`         INT          NOT NULL DEFAULT 0,
    `moderated_at`  DATETIME     NULL,
    `moderated_by`  INT          NULL,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_posts_lga_status`  (`lga_id`, `status`, `created_at` DESC),
    INDEX `idx_posts_user_status` (`user_id`, `status`, `created_at` DESC),
    CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_posts_lga`  FOREIGN KEY (`lga_id`)  REFERENCES `lgas`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
