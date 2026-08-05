-- 045_add_kyc_bank_fields.sql
-- Adds bank account details and identity document fields to citizens.
-- Used for paying referral rewards and activity bonuses.

ALTER TABLE `users`
    ADD COLUMN `bank_name`           VARCHAR(100) NULL AFTER `bio`,
    ADD COLUMN `bank_account_number` VARCHAR(30)  NULL AFTER `bank_name`,
    ADD COLUMN `bank_account_name`   VARCHAR(100) NULL AFTER `bank_account_number`,
    ADD COLUMN `id_type`             VARCHAR(50)  NULL AFTER `bank_account_name`,
    ADD COLUMN `id_document_url`     VARCHAR(500) NULL AFTER `id_type`;
