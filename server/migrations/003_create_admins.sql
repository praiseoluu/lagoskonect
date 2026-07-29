-- 003_create_admins.sql
CREATE TABLE IF NOT EXISTS `admins` (
    `id`          INT          NOT NULL AUTO_INCREMENT,
    `name`        VARCHAR(100) NOT NULL,
    `email`       VARCHAR(200) NOT NULL,
    `password`    VARCHAR(255) NOT NULL,
    `role`        ENUM('super_admin','admin','moderator') NOT NULL DEFAULT 'admin',
    `avatar_url`  VARCHAR(500) NULL,
    `handle`      VARCHAR(100) NULL,
    `status`      ENUM('active','suspended') NOT NULL DEFAULT 'active',
    `last_login`  DATETIME     NULL,
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_admins_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
