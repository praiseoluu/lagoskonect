-- Migration 042: Add unsubscribe token to newsletter_subscribers
-- Adds a unique token used in one-click unsubscribe links,
-- and a timestamp to record when someone unsubscribed.

ALTER TABLE newsletter_subscribers
    ADD COLUMN unsubscribe_token VARCHAR(64)  NULL     DEFAULT NULL AFTER confirmed,
    ADD COLUMN unsubscribed_at   DATETIME     NULL     DEFAULT NULL AFTER unsubscribe_token,
    ADD UNIQUE KEY uq_unsubscribe_token (unsubscribe_token);

-- Back-fill tokens for any existing rows
UPDATE newsletter_subscribers
SET unsubscribe_token = SHA2(CONCAT(email, RAND(), id), 256)
WHERE unsubscribe_token IS NULL;
