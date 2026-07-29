-- 022_extend_adverts_table.sql
-- Adds internal_note, cloudinary_id, sets AUTO_INCREMENT to 100001.

ALTER TABLE `adverts`
    ADD COLUMN `internal_note`  TEXT         NULL AFTER `description`,
    ADD COLUMN `cloudinary_id`  VARCHAR(300) NULL AFTER `image_url`;

ALTER TABLE `adverts` AUTO_INCREMENT = 100001;
