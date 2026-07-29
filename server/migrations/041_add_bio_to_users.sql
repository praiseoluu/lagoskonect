-- 041_add_bio_to_users.sql
-- Adds a short bio field to citizen profiles
-- Used by the onboarding flow (step 3) and the profile settings page.

ALTER TABLE `users`
    ADD COLUMN `bio` VARCHAR(160) NULL AFTER `address`;