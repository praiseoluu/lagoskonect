-- 045_referral_withdrawals.sql
-- Lets citizens cash out referral earnings and gives admins a queue to work.
--
-- Referral earnings are derived, not stored: referral_count multiplied by the
-- per-referral rate. There is no ledger to debit, so "the balance goes down"
-- has to mean "subtract what has been requested or already paid". That is what
-- this table records, and why a pending request reserves its amount straight
-- away: without that, someone could submit the same balance twice before an
-- admin has processed either.

-- Where the money should be sent. Kept on the user so it survives payouts and
-- can be reused for the next request.
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `payout_bank_name`       VARCHAR(120) NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `payout_account_number`  VARCHAR(20)  NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `payout_account_name`    VARCHAR(150) NULL DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `withdrawal_requests` (
    `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`        INT          NOT NULL,
    `amount`         DECIMAL(12,2) NOT NULL,

    -- Snapshot of the destination as it was when the request was made. If the
    -- citizen later edits their saved account, an already-submitted request
    -- must still show the admin the details they are actually paying to.
    `bank_name`      VARCHAR(120) NOT NULL,
    `account_number` VARCHAR(20)  NOT NULL,
    `account_name`   VARCHAR(150) NOT NULL,

    `status`         ENUM('pending','paid','rejected') NOT NULL DEFAULT 'pending',
    `admin_note`     VARCHAR(500) NULL DEFAULT NULL,
    `payment_reference` VARCHAR(120) NULL DEFAULT NULL,

    `requested_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `processed_at`   DATETIME     NULL DEFAULT NULL,
    `processed_by`   INT          NULL DEFAULT NULL,   -- admins.id

    PRIMARY KEY (`id`),
    KEY `idx_withdrawal_user`   (`user_id`),
    KEY `idx_withdrawal_status` (`status`, `requested_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
