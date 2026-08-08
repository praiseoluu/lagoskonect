-- 049_reel_comment_replies.sql
-- Threaded replies for reel comments (TikTok-style, two levels deep).
--
--   parent_id    NULL for a top-level comment; otherwise the id of the
--                top-level comment this reply hangs under. Replies to a reply
--                are flattened onto the same thread (like TikTok), so parent_id
--                always points at a ROOT comment, never at another reply.
--   reply_count  denormalised count of replies, kept only on root comments so
--                the list can show "View N replies" without a COUNT per row.

ALTER TABLE `reel_comments`
    ADD COLUMN `parent_id`   INT NULL DEFAULT NULL AFTER `user_id`,
    ADD COLUMN `reply_count` INT NOT NULL DEFAULT 0 AFTER `text`,
    ADD INDEX  `idx_reel_comments_parent` (`parent_id`, `created_at`);
