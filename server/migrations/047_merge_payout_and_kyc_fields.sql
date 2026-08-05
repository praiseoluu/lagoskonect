-- 047_merge_payout_and_kyc_fields.sql
-- Reconciles two sets of bank columns that arrived independently.
--
-- 045 added payout_bank_name / payout_account_number / payout_account_name for
-- referral withdrawals. 046 added bank_name / bank_account_number /
-- bank_account_name alongside the identity fields, and the citizen Settings
-- page already writes to those. Two sources of truth means a citizen could
-- fill in their account under Settings and still be told to add one before
-- withdrawing, or be paid to a stale account they thought they had replaced.
--
-- bank_* wins because the Settings page is already writing there. Anything a
-- citizen saved through the payout panel is copied across first so nobody
-- loses details they had already entered, and only then are the duplicates
-- removed.

-- Make sure both sets exist before touching either: 046 uses plain ADD COLUMN,
-- so it may not have been applied everywhere yet.
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `bank_name`           VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS `bank_account_number` VARCHAR(30)  NULL,
    ADD COLUMN IF NOT EXISTS `bank_account_name`   VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS `id_type`             VARCHAR(50)  NULL,
    ADD COLUMN IF NOT EXISTS `id_document_url`     VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS `payout_bank_name`      VARCHAR(120) NULL,
    ADD COLUMN IF NOT EXISTS `payout_account_number` VARCHAR(20)  NULL,
    ADD COLUMN IF NOT EXISTS `payout_account_name`   VARCHAR(150) NULL;

-- Carry over anything only the payout panel knows about.
UPDATE `users`
   SET `bank_name`           = COALESCE(NULLIF(`bank_name`, ''),           `payout_bank_name`),
       `bank_account_number` = COALESCE(NULLIF(`bank_account_number`, ''), `payout_account_number`),
       `bank_account_name`   = COALESCE(NULLIF(`bank_account_name`, ''),   `payout_account_name`)
 WHERE `payout_account_number` IS NOT NULL AND `payout_account_number` <> '';

ALTER TABLE `users`
    DROP COLUMN IF EXISTS `payout_bank_name`,
    DROP COLUMN IF EXISTS `payout_account_number`,
    DROP COLUMN IF EXISTS `payout_account_name`;
