-- 021_extend_reel_reports.sql
-- Adds admin moderation fields to reel_reports table.

ALTER TABLE `reel_reports`
    ADD COLUMN `admin_note`     VARCHAR(255) NULL AFTER `status`,
    ADD COLUMN `resolved_at`    DATETIME     NULL AFTER `admin_note`,
    ADD COLUMN `resolved_by`    INT          NULL AFTER `resolved_at`;

-- Index for fast pending lookup
CREATE INDEX `idx_reel_reports_status` ON `reel_reports` (`status`);
