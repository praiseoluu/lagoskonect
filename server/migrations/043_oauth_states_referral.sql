-- 043_oauth_states_referral.sql
-- Store referral code in oauth_states so Google OAuth users
-- can be linked to their referrer.

ALTER TABLE oauth_states
    ADD COLUMN referral_code VARCHAR(20) NULL AFTER provider;