-- 016_create_reel_reports.sql
-- Allows citizens to report reels with a reason.
-- One report per reel per user (enforced by unique key).
-- Admin can dismiss (status=dismissed) or resolve by deleting the reel (status=resolved).

CREATE TABLE IF NOT EXISTS `reel_reports` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `reel_id`    VARCHAR(20)  NOT NULL,
    `user_id`    INT          NOT NULL,
    `reason`     VARCHAR(100) NOT NULL,
    `details`    TEXT         NULL,
    `status`     ENUM('pending','dismissed','resolved') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_reel_user` (`reel_id`, `user_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_reel_id` (`reel_id`),
    CONSTRAINT `fk_rr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
