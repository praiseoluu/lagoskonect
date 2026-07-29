-- Upgrade OTP storage: plaintext 4-digit -> SHA-256 hash of 6-digit OTP
ALTER TABLE users
    CHANGE COLUMN otp_code otp_hash VARCHAR(64) NULL DEFAULT NULL;
