-- 036_add_region_columns.sql
-- Add region column to users and admins tables for Lagos State senatorial districts.

-- Add region column to users table
ALTER TABLE `users`
ADD COLUMN `region` ENUM('west', 'central', 'east') NULL DEFAULT NULL AFTER `lga_name`,
ADD INDEX `idx_users_region` (`region`);

-- Add region column to admins table
ALTER TABLE `admins`
ADD COLUMN `region` ENUM('west', 'central', 'east') NULL DEFAULT NULL AFTER `role`,
ADD INDEX `idx_admins_region` (`region`);
