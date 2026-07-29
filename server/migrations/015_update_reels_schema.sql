-- 015_update_reels_schema.sql
-- Removes title (no titles on reels like TikTok)
-- Makes description nullable (caption is the only text field)
-- Adds is_admin column to distinguish admin vs citizen reels
-- Adds cloudinary_public_id for media management

ALTER TABLE `reels`
    MODIFY COLUMN `title`       VARCHAR(300) NULL,
    MODIFY COLUMN `description` TEXT         NULL,
    ADD COLUMN   `is_admin`     BOOLEAN      NOT NULL DEFAULT FALSE AFTER `target_all_lgas`,
    ADD COLUMN   `cloudinary_id` VARCHAR(200) NULL AFTER `video_url`;

-- Update existing reels to mark them as admin reels
UPDATE `reels` SET `is_admin` = 1;
