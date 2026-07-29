-- 027_extend_user_notif_prefs.sql
-- Adds granular notification preference columns to the users table.

ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `notif_new_login`     BOOLEAN NOT NULL DEFAULT TRUE  AFTER `notif_lga_alerts`,
    ADD COLUMN IF NOT EXISTS `notif_reel_likes`    BOOLEAN NOT NULL DEFAULT TRUE  AFTER `notif_new_login`,
    ADD COLUMN IF NOT EXISTS `notif_reel_comments` BOOLEAN NOT NULL DEFAULT TRUE  AFTER `notif_reel_likes`,
    ADD COLUMN IF NOT EXISTS `notif_breaking_news` BOOLEAN NOT NULL DEFAULT TRUE  AFTER `notif_reel_comments`;
