-- 024_extend_lgas_table.sql
-- Adds chairman_name, updated_at to lgas table.
-- Sets AUTO_INCREMENT to 100001.
-- Adds unique constraint on name to prevent duplicates.

ALTER TABLE `lgas`
    ADD COLUMN `chairman_name` VARCHAR(200) NULL AFTER `is_capital`,
    ADD COLUMN `updated_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP AFTER `chairman_name`;

ALTER TABLE `lgas` AUTO_INCREMENT = 100001;
