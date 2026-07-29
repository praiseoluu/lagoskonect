ALTER TABLE users
    ADD COLUMN referral_code VARCHAR(20) NULL AFTER username,
    ADD COLUMN referred_by_user_id INT NULL AFTER referral_code,
    ADD COLUMN referral_count INT NOT NULL DEFAULT 0 AFTER referred_by_user_id,
    ADD UNIQUE KEY uq_users_referral_code (referral_code),
    ADD KEY idx_users_referred_by (referred_by_user_id);

UPDATE users
SET referral_code = CONCAT('LK', UPPER(SUBSTRING(MD5(CONCAT(id, '-', email)), 1, 8)))
WHERE referral_code IS NULL;

CREATE TABLE IF NOT EXISTS referral_contest_settings (
                                                         id TINYINT NOT NULL PRIMARY KEY,
                                                         title VARCHAR(150) NOT NULL,
    description VARCHAR(500) NOT NULL,
    prize_first VARCHAR(150) NOT NULL,
    prize_second VARCHAR(150) NOT NULL,
    prize_third VARCHAR(150) NOT NULL,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO referral_contest_settings
(id, title, description, prize_first, prize_second, prize_third, is_active)
VALUES
    (1, 'Lagos Konect Referral Contest',
     'Invite friends to join Lagos Konect. The top three verified referrers win prizes.',
     '1st prize', '2nd prize', '3rd prize', TRUE)
    ON DUPLICATE KEY UPDATE title = VALUES(title);