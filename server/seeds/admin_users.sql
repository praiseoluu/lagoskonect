-- seeds/admin_users.sql
-- Admin accounts for Lagos Connect.
-- Duplicate rows (101–108) collapsed to the canonical four (101–104)
-- using @adm.gov.ng domain. Regions assigned per senatorial district.
--
-- Plaintext passwords:
--   admin1      → Musa Ibrahim (admin, central)
--   admin2      → Hauwa Gidado (admin, south)
--   staff1      → Bello Umar   (admin, north)
--   superadmin  → Aisha Kefas  (super_admin, all regions → NULL)
--
-- ⚠️  Replace the $2y$... values with freshly generated bcrypt hashes:
--
--    <?php
--    foreach (['admin1','admin2','staff1','superadmin'] as $p) {
--        echo "$p => " . password_hash($p, PASSWORD_BCRYPT) . "\n";
--    }

INSERT INTO `admins`
(`id`, `name`, `phone`, `state`, `city`,
 `email`, `password`, `role`, `region`, `status`, `created_at`, `updated_at`)
VALUES
    (101, 'Musa Ibrahim',  '+2348000000101', 'Lagos', 'Yola',
     'admin@adm.gov.ng',
     '$2y$10$nNyYSphXPYn99Cu1cSB08.jY58N6On2Th/ptp0rlCLSr8GU/qfU6e',
     'admin', 'central', 'active', NOW(), NOW()),
    (102, 'Hauwa Gidado',  '+2348000000102', 'Lagos', 'Numan',
     'chidi@adm.gov.ng',
     '$2y$10$b4078yOO4FBtIs9zuJPyJupE3EVvAEoYkymk5VuhyK0tmvW6cjt.e',
     'admin', 'south', 'active', NOW(), NOW()),
    (103, 'Bello Umar',    '+2348000000103', 'Lagos', 'Mubi',
     'blessing@adm.gov.ng',
     '$2y$10$7954JaiLLluW1ZtOrYYTKuje6kR57x4c5u8K6RxwP7iFINxVRbV8O',
     'admin', 'north', 'active', NOW(), NOW()),
    (104, 'Aisha Kefas',   '+2348000000104', 'Lagos', 'Yola',
     'superadmin@adm.gov.ng',
     '$2y$10$BOMAK20UY.oU3biu08vrlOO9sVXPMWTa80FmTXA02YoY13DU9uK7G',
     'super_admin', NULL, 'active', NOW(), NOW());