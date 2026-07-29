-- seeds/notifications.sql
-- Seed notifications for user id=1 (Adaeze Okonkwo, Yola North, central region).
-- user_id=1 must already exist from users.sql seed.

INSERT INTO `notifications`
    (`id`, `user_id`, `category`, `priority`, `title`, `body`,
     `actor_name`, `actor_avatar_url`, `link_to`, `is_read`, `created_at`)
VALUES
(1,  1, 'Official',       'high',   'New Yola North Infrastructure Proposal',
     'The Yola North planning committee has released the draft for the new drainage and road resurfacing project. Review the impact report now.',
     NULL, NULL, '/trending', 0, '2025-05-13 10:00:00'),

(2,  1, 'Community',      'normal', 'Hauwa replied to your post',
     '"I completely agree with your point about the market road. We should definitely bring this up at the next town hall meeting!"',
     'Hauwa B.', NULL, '/chat', 0, '2025-05-13 07:00:00'),

(3,  1, 'Community',      'normal', 'Ibrahim Lawan replied to your post',
     '"I completely agree with your point about the market road. We should definitely bring this up at the next meeting!"',
     'Ibrahim Lawan', NULL, '/chat', 0, '2025-05-13 07:00:00'),

(4,  1, 'Security Alert', 'high',   'New login detected',
     'Your account was accessed from a new device. If this wasn\'t you, please secure your account immediately.',
     NULL, NULL, '/settings', 1, '2025-05-12 14:00:00'),

(5,  1, 'Event',          'normal', 'Local Cleanup Event starts in 1 hour',
     'Join 42 neighbours at the Yola North Central Plaza. Don\'t forget to bring gloves!',
     NULL, NULL, '/home', 1, '2025-05-12 09:00:00'),

(6,  1, 'Official',       'normal', 'Healthcare Programme Registration Open',
     'Registration for the Yola North Free Healthcare Initiative is now open. Visit the Events page to register.',
     NULL, NULL, '/home', 1, '2025-05-10 09:15:00'),

(7,  1, 'Official',       'normal', 'New Street Lighting Policy Announced',
     'All residential streets in Yola North will receive solar-powered lighting by Q4 2025. Residents are advised to report faulty units via LagKonnect.',
     NULL, NULL, '/trending', 0, '2025-05-12 08:00:00'),

(8,  1, 'Community',      'normal', 'Chukwuemeka Eze liked your post',
     'Great point about the drainage issue on your street.',
     'Chukwuemeka E.', NULL, '/chat', 0, '2025-05-11 09:00:00'),

(9,  1, 'Event',          'normal', 'Town Hall Meeting Tomorrow',
     'The Yola North Q3 budget review town hall holds tomorrow at 10am. Register now to attend virtually via LagKonnect.',
     NULL, NULL, '/home', 0, '2025-05-10 10:00:00'),

(10, 1, 'Official',       'high',   'Emergency Water Supply Notice',
     'Water supply will be interrupted in zones 3–7 on May 20 for 6 hours due to maintenance on the Yola main pipeline.',
     NULL, NULL, '/trending', 1, '2025-05-09 11:00:00'),

(11, 1, 'Community',      'normal', 'Fatima B. replied to your post',
     'Has anyone contacted the LGA office directly about this? I\'d suggest escalating through LagKonnect.',
     'Fatima B.', NULL, '/chat', 1, '2025-05-08 12:00:00'),

(12, 1, 'Event',          'normal', 'Free Legal Aid Clinic — Tomorrow',
     'Free legal aid is available at the Yola North Community Centre tomorrow from 9am to 3pm. First come, first served.',
     NULL, NULL, '/home', 1, '2025-05-07 13:00:00'),

(13, 1, 'Security Alert', 'high',   'Scam Alert: Fake LGA Officials',
     'Residents are warned about individuals posing as LGA officials and collecting unauthorised levies. Report all suspicious activity immediately.',
     NULL, NULL, '/settings', 1, '2025-05-06 14:00:00'),

(14, 1, 'Official',       'normal', 'Waste Collection Schedule Updated',
     'The waste collection schedule for Yola North LGA has been updated. Collections now happen every Tuesday and Friday.',
     NULL, NULL, '/home', 1, '2025-05-05 15:00:00'),

(15, 1, 'Community',      'normal', 'Ngozi A. commented on your post',
     'This is exactly the kind of community action we need. Well done for speaking up!',
     'Ngozi A.', NULL, '/chat', 1, '2025-05-04 16:00:00'),

(16, 1, 'Event',          'normal', 'Digital Skills Training Registration Closes Friday',
     'Only 20 spots remain for the July cohort of the Yola Digital Skills Programme. Register before Friday.',
     NULL, NULL, '/home', 1, '2025-05-03 17:00:00'),

(17, 1, 'Official',       'normal', 'New Health Centre Opens in Ward 5',
     'A new primary health care centre has opened in Ward 5, Yola North. Services include maternal care, immunisation, and general outpatient.',
     NULL, NULL, '/trending', 1, '2025-05-02 18:00:00'),

(18, 1, 'Security Alert', 'normal', 'Power Outage Scheduled',
     'AEDC will carry out maintenance on the Yola North East feeder on May 22 from 8am to 5pm. Prepare accordingly.',
     NULL, NULL, '/trending', 1, '2025-05-01 17:00:00');
