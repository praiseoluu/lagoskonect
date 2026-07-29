-- seeds/users.sql
-- Seed users matching the mock data credentials and Lagos LGA assignments.
--
-- LGA assignments (must match api/_mockData.js):
--   id=1  Adaeze Okonkwo    → lga_id=7  Ikeja        (west)
--   id=2  Emeka Nwosu       → lga_id=8  Mushin        (west)
--   id=3  Fatima Bello      → lga_id=15 Surulere      (central)
--   id=4  Chukwuemeka Eze   → lga_id=12 Eti-Osa       (central)
--   id=5  Ngozi Adeyemi     → lga_id=18 Ikorodu        (east)
--   id=6  Segun Lawal       → lga_id=11 Apapa          (central)
--   id=7  Amina Yusuf       → lga_id=3  Alimosho       (west)
--   id=8  Obinna Obi        → lga_id=16 Epe            (east)
--
-- Passwords (plaintext → bcrypt hash, cost 10):
--   citizen1, citizen2, citizen3, citizen4, citizen5,
--
--
-- ⚠️  Replace the $2y$... values with freshly generated bcrypt hashes:
--
--    <?php
--    $passwords = [
--        'citizen1', 'citizen2', 'citizen_suspended', 'citizen3',
--        'citizen4', 'citizen_pending', 'citizen5', 'no_login_placeholder'
--    ];
--    foreach ($passwords as $p) {
--        echo "$p => " . password_hash($p, PASSWORD_BCRYPT) . "\n";
--    }

SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `users`
(`id`, `name`, `username`, `gender`, `email`, `phone`, `password`,
 `lga_id`, `lga_name`, `region`, `role`, `is_verified`, `status`,
 `has_seen_welcome`, `profile_visibility`, `two_fa_enabled`,
 `notif_official`, `notif_community`, `notif_lga_alerts`,
 `created_at`, `updated_at`)
VALUES
    (1, 'Adaeze Okonkwo',  'adaeze_okonkwo',  NULL, 'adaeze@lagkonnect.com',       '+2348031234567', '$2a$12$WEfpAp0spM0ZBTuCYWPhyujUopw0qZWzOGu8wE71sK35TzYsiDk0q', 7,  'Ikeja',    'west',   'citizen', 1, 'active',    1, 'public', 0, 1, 1, 0, '2024-11-15 09:23:00', NOW()),
    (2, 'Emeka Nwosu',     'emeka_nwosu',     NULL, 'emeka.nwosu@lagkonnect.com',   '+2348059876543', '$2a$12$7Zg1Dd58LkthXw4lEXLaDu4ZjKoBjkPM90CLikekmiaPcIXizBdYe', 8,  'Mushin',   'west',   'citizen', 1, 'active',    0, 'public', 0, 1, 1, 0, '2024-12-01 11:00:00', NOW()),
    (3, 'Fatima Bello',    'fatima_bello',    NULL, 'fatima.bello@lagkonnect.com',  '+2348121112233', '$2a$12$0s9NErD8Z34D19uyyLDlOuHVxpm11pssIPXIzhrI1FKXmLdBhuE2K', 15, 'Surulere', 'central', 'citizen', 0, 'active', 0, 'public', 0, 1, 1, 0, '2025-01-20 16:45:00', NOW()),
    (4, 'Chukwuemeka Eze', 'chukwuemeka_eze', NULL, 'emeka@example.com',            '+2347045556677', '$2a$12$7nJyS7kEcrxr.WdhN6jJg.4uNRRmyCGhQ19GbUngYI0RuEoPuElbW', 12, 'Eti-Osa',  'central', 'citizen', 1, 'active',    1, 'public', 0, 1, 1, 0, '2025-02-05 08:15:00', NOW()),
    (5, 'Ngozi Adeyemi',   'ngozi_adeyemi',   NULL, 'ngozi.adeyemi@lagkonnect.com', '+2348167778899', '$2a$12$YU/gk5Y1EDIB7CFmOtvxBuzRsMsuCwhAFn/4uCnLOoK.hfXHT4JJe', 18, 'Ikorodu',  'east',   'citizen', 1, 'active',    1, 'public', 0, 1, 1, 0, '2025-03-10 13:30:00', NOW()),
    (6, 'Segun Lawal',     'segun_lawal',     NULL, 'segun.lawal@lagkonnect.com',   '+2348033334455', '$2a$12$uvDatjGhjG5iID9bldQaVu9i9ofeD3tNQvULfO7h9XEpTyKELfpXe', 11, 'Apapa',    'central', 'citizen', 0, 'active',   0, 'public', 0, 1, 1, 0, '2025-04-01 10:00:00', NOW()),
    (7, 'Amina Yusuf',     'amina_yusuf',     NULL, 'amina@example.com',            '+2347011122233', '$2a$12$hAW7E3jP9UC8Ae1vP4IWz..owR7oYrLQUmANjDuzhIAUtimPCKWTK', 3,  'Alimosho', 'west',   'citizen', 1, 'active',    1, 'public', 0, 1, 1, 0, '2025-01-08 09:00:00', NOW()),
    (8, 'Obinna Obi',      'obinna_obi',      NULL, 'obinna.obi@lagkonnect.com',    '+2348099988877', '$2a$12$dp67VBzFugwaFmJ37i45XOwwOUJRFhkHspH000f3tMQoTGWwKknX2', 16, 'Epe',      'east',   'citizen', 1, 'active',    1, 'public', 0, 1, 1, 0, '2024-10-30 14:20:00', NOW());

SET FOREIGN_KEY_CHECKS = 1;
