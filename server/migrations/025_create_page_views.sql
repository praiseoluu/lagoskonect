-- 025_create_page_views.sql
-- Lightweight event log for tracking citizen page visits.
-- Powers the Weekly Traffic chart on the Analytics page.
-- Rows are cheap — just user_id, page slug, and timestamp.

CREATE TABLE IF NOT EXISTS `page_views` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `user_id`    INT          NULL,
    `page`       VARCHAR(200) NOT NULL,
    `lga_id`     INT          NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_pv_created` (`created_at`),
    INDEX `idx_pv_lga`     (`lga_id`),
    INDEX `idx_pv_user`    (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
