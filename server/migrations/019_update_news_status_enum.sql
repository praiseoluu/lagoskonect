-- 019_update_news_status_enum.sql
-- Adds 'paused' and 'scheduled' to the news status ENUM.
-- 'paused' = published but temporarily hidden from citizens.
-- 'scheduled' = queued for auto-publish at scheduled_at datetime.

ALTER TABLE `news`
    MODIFY COLUMN `status`
        ENUM('draft','published','archived','paused','scheduled')
        NOT NULL DEFAULT 'draft';
