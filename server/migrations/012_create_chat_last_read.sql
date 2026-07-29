-- 012_create_chat_last_read.sql
-- Tracks the last message each user has read in each LGA chat.
-- Used to compute unread message counts without per-message read receipts.

CREATE TABLE IF NOT EXISTS `chat_last_read` (
    `user_id`         INT      NOT NULL,
    `lga_id`          INT      NOT NULL,
    `last_message_id` INT      NOT NULL DEFAULT 0,
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `lga_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
