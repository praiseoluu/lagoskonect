-- 030_chat_messages_nullable_user_id.sql
-- Allow admin-sent messages to have no associated citizen user.
-- The FK constraint must be dropped first, then the column made nullable,
-- then the FK re-added with NULL allowed (FK ignores NULL values).

ALTER TABLE `lga_chat_messages`
    DROP FOREIGN KEY `fk_chat_user`;

ALTER TABLE `lga_chat_messages`
    MODIFY COLUMN `user_id` INT NULL DEFAULT NULL;

ALTER TABLE `lga_chat_messages`
    ADD CONSTRAINT `fk_chat_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
