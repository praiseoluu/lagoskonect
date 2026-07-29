-- seeds/posts_and_adverts.sql

-- ── Community Posts ───────────────────────────────────────────────────────
-- Seed approved posts for Ikeja (lga_id=11) and Alimosho (lga_id=3).
-- user_id references must exist from users.sql.

INSERT INTO `posts`
    (`id`, `user_id`, `user_name`, `avatar_url`, `lga_id`, `lga_name`,
     `text`, `media_url`, `status`, `likes`, `created_at`)
VALUES
(1, 1, 'Adaeze Okonkwo', NULL, 11, 'Ikeja',
 'Has anyone else noticed that the drainage on Salvation Road is getting worse? I reported it to the LGA office last week but no response yet. Please help amplify this. #Ikeja #Drainage',
 NULL, 'approved', 24, '2025-05-13 09:00:00'),

(2, 4, 'Chukwuemeka Eze', NULL, 11, 'Ikeja',
 'The new road work on Allen Avenue is already making a difference. Traffic flow improved noticeably this morning. Great to see LGA delivering!',
 NULL, 'approved', 18, '2025-05-12 07:30:00'),

(3, 1, 'Adaeze Okonkwo', NULL, 11, 'Ikeja',
 'Attended the free healthcare screening at LASUTH today. The process was smooth and the staff were professional. Kudos to Ikeja LGA health team!',
 NULL, 'approved', 31, '2025-05-11 14:00:00'),

(4, 4, 'Chukwuemeka Eze', NULL, 11, 'Ikeja',
 'Street lights on Toyin Street have been out for three nights. I''ve raised a support ticket but hoping for faster resolution. Anyone else affected?',
 NULL, 'approved', 15, '2025-05-10 20:00:00'),

(5, 2, 'Emeka Nwosu', NULL, 3, 'Alimosho',
 'The groundbreaking for the Alimosho Central Market was an exciting moment for our community. Looking forward to the market being completed by year end!',
 NULL, 'approved', 42, '2025-05-09 11:00:00'),

(6, 2, 'Emeka Nwosu', NULL, 3, 'Alimosho',
 'Community meeting this Saturday at 10am at the Alimosho Local Council Hall. Agenda: new market development, road repairs, and waste management. All welcome.',
 NULL, 'approved', 29, '2025-05-08 16:00:00'),

-- Pending post (not yet moderated — should NOT appear in citizen feed)
(7, 1, 'Adaeze Okonkwo', NULL, 11, 'Ikeja',
 'I want to propose a neighbourhood clean-up day for the third Saturday of every month. Who is interested in joining? Let''s make Ikeja cleaner together!',
 NULL, 'pending', 0, '2025-05-13 11:30:00');

-- ── Adverts ───────────────────────────────────────────────────────────────

INSERT INTO `adverts`
    (`id`, `title`, `advertiser`, `description`, `cta_label`, `cta_url`,
     `image_url`, `type`, `status`, `target_all_lgas`, `created_at`, `updated_at`)
VALUES
(1, 'Ikeja Trade Fair 2025',
 'Ikeja Chamber of Commerce',
 'Enrollment is now open for traders, artisans, and SME owners. Showcase your products to over 50,000 visitors.',
 'Register Now', '#',
 'https://picsum.photos/seed/advert1/600/200',
 'banner', 'active', 1, NOW(), NOW()),

(2, 'Lagos Tech Summit - June 2025',
 'Lagos Innovation Hub',
 'Connect with tech leaders, investors, and startups at Lagos Tech Summit 2025.',
 'Get Tickets', 'https://gn128.com/tech-summit',
 'https://picsum.photos/seed/advert2/600/200',
 'banner', 'active', 1, NOW(), NOW()),

(3, 'Free Skills Training - Apply Now',
 'Lagos State Employment Trust Fund',
 'Applications open for free digital skills, fashion, and trades training programmes across all LGAs.',
 'Apply Now', 'https://gn128.com/skills-training',
 'https://picsum.photos/seed/advert3/600/200',
 'banner', 'active', 1, NOW(), NOW());
