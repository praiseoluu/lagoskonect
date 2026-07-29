-- 008_create_notifications.sql
CREATE TABLE IF NOT EXISTS `notifications` (
    `id`               INT          NOT NULL AUTO_INCREMENT,
    `user_id`          INT          NOT NULL,
    `category`         ENUM('Official','Community','Security Alert','Event') NOT NULL DEFAULT 'Official',
    `priority`         ENUM('normal','high') NOT NULL DEFAULT 'normal',
    `title`            VARCHAR(200) NOT NULL,
    `body`             TEXT         NOT NULL,
    `actor_name`       VARCHAR(100) NULL,
    `actor_avatar_url` VARCHAR(500) NULL,
    `link_to`          VARCHAR(200) NULL,
    `is_read`          BOOLEAN      NOT NULL DEFAULT FALSE,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_notif_user_read_created` (`user_id`, `is_read`, `created_at` DESC),
    CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
