-- 007_create_chat_messages.sql

CREATE TABLE IF NOT EXISTS `lga_chat_messages` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `lga_id`     INT          NOT NULL,
    `user_id`    INT          NOT NULL,
    `user_name`  VARCHAR(100) NOT NULL,
    `avatar_url` VARCHAR(500) NULL,
    `text`       TEXT         NULL,
    `media_url`  VARCHAR(500) NULL,
    `file_url`   VARCHAR(500) NULL,
    `file_name`  VARCHAR(200) NULL,
    `file_size`  VARCHAR(30)  NULL,
    `reactions`  JSON         NULL,
    `reply_to`   JSON         NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_chat_lga_created` (`lga_id`, `created_at` ASC),
    CONSTRAINT `fk_chat_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_chat_lga`  FOREIGN KEY (`lga_id`)  REFERENCES `lgas`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: store chat invite records
CREATE TABLE IF NOT EXISTS `chat_invites` (
    `id`           INT         NOT NULL AUTO_INCREMENT,
    `invited_by`   INT         NOT NULL,
    `phone`        VARCHAR(20) NOT NULL,
    `lga_id`       INT         NOT NULL,
    `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_invite_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
