-- 029_create_chat_reports.sql
-- Tracks citizen-reported chat messages and admin resolutions

CREATE TABLE IF NOT EXISTS `chat_reports` (
    `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `message_id`      INT UNSIGNED    NOT NULL,
    `reporter_id`     INT UNSIGNED    NOT NULL,
    `reason`          VARCHAR(100)    NOT NULL,
    `status`          ENUM('pending','resolved') NOT NULL DEFAULT 'pending',
    `resolution`      ENUM('warned','deleted','dismissed') NULL,
    `resolution_note` VARCHAR(500)    NULL,
    `resolved_by`     INT UNSIGNED    NULL COMMENT 'admin id',
    `resolved_at`     DATETIME        NULL,
    `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_message_id`  (`message_id`),
    KEY `idx_reporter_id` (`reporter_id`),
    KEY `idx_status`      (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
