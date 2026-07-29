-- seeds/chat_messages.sql
-- Seed LGA group chat messages for Ikeja (lga_id=11) and Alimosho (lga_id=3).

INSERT INTO `lga_chat_messages`
    (`id`, `lga_id`, `user_id`, `user_name`, `avatar_url`,
     `text`, `media_url`, `file_url`, `file_name`, `file_size`,
     `reactions`, `reply_to`, `created_at`)
VALUES

-- ── Ikeja chat ─────────────────────────────────────────────────────────────

(1, 11, 2, 'Ayo Balogun', NULL,
 'Has anyone heard about the new waste management schedule for Phase 1? I heard they''re moving collections to Tuesdays.',
 NULL, NULL, NULL, NULL, '{}', NULL, '2025-05-13 10:42:00'),

(2, 11, 4, 'Musa Bello', NULL,
 'Yes, Ayo! The councillor confirmed it during the Urban Planning meeting yesterday. It''s part of the new ''Green LGA 1'' initiative. 🌿',
 NULL, NULL, NULL, NULL,
 '{"👍": [1, 5, 7, 8]}',
 NULL, '2025-05-13 10:45:00'),

(3, 11, 1, 'Adaeze Okonkwo', NULL,
 'That''s great news. Do we have a digital copy of the full schedule? I''d like to share it with my neighbors.',
 NULL, NULL, NULL, NULL, '{}',
 '{"id": 2, "userName": "Musa Bello", "text": "Yes, Ayo! The councillor confirmed it..."}',
 '2025-05-13 11:02:00'),

(4, 11, 5, 'Fatima Yusuf', NULL,
 'I''m uploading the PDF to the Resources tab now. Give it a minute! Also, the town hall meeting on Friday will discuss the new street lighting project.',
 NULL, NULL, NULL, NULL, '{}', NULL, '2025-05-13 11:05:00'),

(5, 11, 5, 'Fatima Yusuf', NULL,
 NULL, NULL,
 '/assets/mock/LGA1_Waste_Mgt_2026.pdf',
 'LGA1_Waste_Mgt_2026.pdf', '2.4 MB',
 '{}', NULL, '2025-05-13 11:05:30'),

-- ── Alimosho chat ──────────────────────────────────────────────────────────

(6, 3, 2, 'Emeka Nwosu', NULL,
 'Alimosho people, when is the new market officially opening? Any updates?',
 NULL, NULL, NULL, NULL, '{}', NULL, '2025-05-12 10:00:00'),

(7, 3, 8, 'Obinna Obi', NULL,
 'I heard end of Q3 2025, but nothing official yet. The construction started last week though.',
 NULL, NULL, NULL, NULL, '{}', NULL, '2025-05-12 10:15:00');
