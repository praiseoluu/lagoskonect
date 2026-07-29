-- 017_extend_users_table.sql
-- Adds extended profile fields to the users table.
-- Updates AUTO_INCREMENT to start from 100001 so IDs are always 6 digits.
-- Adds must_change_password flag for admin-created accounts.

ALTER TABLE `users`
    ADD COLUMN `dob`                  DATE         NULL AFTER `email`,
    ADD COLUMN `city`                 VARCHAR(100) NULL AFTER `lga_name`,
    ADD COLUMN `state`                VARCHAR(100) NOT NULL DEFAULT 'Lagos State' AFTER `city`,
    ADD COLUMN `address`              VARCHAR(255) NULL AFTER `state`,
    ADD COLUMN `must_change_password` BOOLEAN      NOT NULL DEFAULT FALSE AFTER `address`;

-- Bump AUTO_INCREMENT so new IDs start at 100001
-- (existing rows keep their current IDs)
ALTER TABLE `users` AUTO_INCREMENT = 100001;
