-- 001_create_lgas.sql
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `lgas`;

CREATE TABLE `lgas` (
                        `id`         INT          NOT NULL AUTO_INCREMENT,
                        `name`       VARCHAR(100) NOT NULL,
                        `state`      VARCHAR(100) NOT NULL DEFAULT 'Lagos',
                        `region`     ENUM('west','central','east') NOT NULL,
                        `is_capital` BOOLEAN      NOT NULL DEFAULT FALSE,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `uq_lga_name` (`name`),
                        INDEX `idx_lgas_region` (`region`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
