-- seeds/reels.sql
-- Seed reels from mock data. author_id references admins table.
--   lga_id=11  Yola North  (central) — state capital
--   lga_id=8   Gombi        (central)
-- reel_id strings match api/_mockData.js exactly.

INSERT INTO `reels`
    (`reel_id`, `lga_id`, `lga_name`, `target_all_lgas`, `title`, `description`, `caption`,
     `hashtags`, `video_url`, `thumbnail_url`, `duration`, `views`, `likes`, `shares`,
     `comment_count`, `author_id`, `author_name`, `author_handle`, `author_avatar_url`,
     `status`, `published_at`, `created_at`, `updated_at`)
VALUES

('reel_a3f9k2', 11, 'Yola North', 0,
 'Lagos State Development Update',
 'LGA Chairman speaks directly to residents about the ongoing drainage project at the Yola North community centre.',
 'Lagos State Development Update 2026. #LagosConnect #YolaNorth',
 '["#LagosConnect","#YolaNorth","#Lagos"]',
 NULL, 'https://picsum.photos/seed/reel-a3f9k2/600/375',
 252, 12400, 2400, 482, 156,
 101, 'LagKonnect News', '@lagos_council', NULL,
 'published', '2025-05-13 12:00:00', '2025-05-13 10:00:00', NOW()),

('reel_b7m1x5', 11, 'Yola North', 0,
 'Yola North Town Hall Highlights — May 2025',
 'Key takeaways from the May 2025 town hall meeting with LGA officials on infrastructure and community development.',
 'Town Hall highlights from Yola North. Your voice matters. #LagosConnect #TownHall',
 '["#LagosConnect","#TownHall","#YolaNorth"]',
 NULL, 'https://picsum.photos/seed/reel-b7m1x5/600/375',
 145, 8920, 1200, 310, 89,
 101, 'LagKonnect News', '@lagos_council', NULL,
 'published', '2025-05-12 14:00:00', '2025-05-12 11:00:00', NOW()),

('reel_c2p8n7', 11, 'Yola North', 0,
 'Free Healthcare Outreach — Yola North',
 'Behind-the-scenes footage from the free healthcare outreach at the Yola North General Hospital.',
 'Free healthcare is here! Visit the state hospital today. #LagosConnect #Health #YolaNorth',
 '["#LagosConnect","#Health","#YolaNorth"]',
 NULL, 'https://picsum.photos/seed/reel-c2p8n7/600/375',
 198, 6100, 890, 201, 44,
 101, 'LagKonnect News', '@lagos_health', NULL,
 'published', '2025-05-11 09:00:00', '2025-05-10 16:00:00', NOW()),

('reel_d5q3r1', 8, 'Gombi', 0,
 'Gombi Central Market Ground-Breaking',
 'Watch the official ground-breaking ceremony for the new Gombi central market. A landmark moment for commerce in the LGA.',
 'New market coming to Gombi! Ground broken today. #LagosConnect #Gombi',
 '["#LagosConnect","#Gombi","#Central"]',
 NULL, 'https://picsum.photos/seed/reel-d5q3r1/600/375',
 90, 5610, 720, 178, 37,
 101, 'LagKonnect News', '@lagos_council', NULL,
 'published', '2025-05-10 09:00:00', '2025-05-09 15:00:00', NOW()),

('reel_e9w4t6', 8, 'Gombi', 0,
 'Solar Panels Installation Begins in Gombi',
 'Solar panels installation begins across Gombi communities, bringing reliable electricity to off-grid households.',
 'Solar energy is coming to your neighbourhood. #LagosConnect #Solar',
 '["#LagosConnect","#Solar","#Gombi"]',
 NULL, 'https://picsum.photos/seed/reel-e9w4t6/600/375',
 115, 4280, 560, 134, 28,
 101, 'LagKonnect News', '@lagos_power', NULL,
 'published', '2025-05-09 11:00:00', '2025-05-08 14:00:00', NOW()),

('reel_f1k7y3', 11, 'Yola North', 0,
 'Yola North Budget Transparency Session 2026',
 'Budget transparency session — residents asked tough questions and got direct answers from the LGA finance office.',
 'Your LGA budget explained. Watch and share. #LagosConnect #Budget2026',
 '["#LagosConnect","#Budget2026","#YolaNorth"]',
 NULL, 'https://picsum.photos/seed/reel-f1k7y3/600/375',
 173, 3900, 445, 99, 19,
 101, 'LagKonnect News', '@lagos_finance', NULL,
 'published', '2025-05-08 14:00:00', '2025-05-07 10:00:00', NOW()),

('reel_g8h2j4', 11, 'Yola North', 0,
 'Yola North Road Resurfacing Update — Week 1',
 'Progress report on the Yola North road resurfacing project. The main market access road is 30% complete.',
 'Week 1 of the Yola North road project. Coming together! #LagosConnect #YolaNorth #Roads',
 '["#LagosConnect","#YolaNorth","#Roads"]',
 NULL, 'https://picsum.photos/seed/reel-g8h2j4/600/375',
 88, 3200, 410, 92, 18,
 101, 'LagKonnect News', '@lagos_works', NULL,
 'published', '2025-05-07 09:00:00', '2025-05-06 15:00:00', NOW());
