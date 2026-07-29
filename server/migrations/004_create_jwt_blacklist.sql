-- 004_create_jwt_blacklist.sql
CREATE TABLE IF NOT EXISTS `jwt_blacklist` (
    `id`          INT         NOT NULL AUTO_INCREMENT,
    `token_hash`  VARCHAR(64) NOT NULL,
    `expires_at`  DATETIME    NOT NULL,
    `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_token_hash` (`token_hash`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
