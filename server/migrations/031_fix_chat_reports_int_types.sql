-- Fix signedness mismatch: chat_reports used INT UNSIGNED but referenced
-- tables (lga_chat_messages, users, admins) all use signed INT.

ALTER TABLE `chat_reports`
  MODIFY COLUMN `message_id`  INT NOT NULL,
  MODIFY COLUMN `reporter_id` INT NOT NULL,
  MODIFY COLUMN `resolved_by` INT NULL DEFAULT NULL;
