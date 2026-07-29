-- Track login/OTP attempts per identifier and IP for rate limiting and lockout
CREATE TABLE IF NOT EXISTS auth_attempts (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    identifier   VARCHAR(255)    NOT NULL,
    ip_address   VARCHAR(45)     NOT NULL,
    attempt_type VARCHAR(20)     NOT NULL DEFAULT 'login',
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_identifier_type (identifier(100), attempt_type),
    KEY idx_ip_type         (ip_address, attempt_type),
    KEY idx_created         (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
