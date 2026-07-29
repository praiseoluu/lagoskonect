-- 038_add_message_edited_at.sql
-- Adds edited_at column to lga_chat_messages to track when a citizen edits their message.

ALTER TABLE `lga_chat_messages`
    ADD COLUMN IF NOT EXISTS `edited_at` DATETIME NULL DEFAULT NULL;
