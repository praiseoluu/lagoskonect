-- seeds/lgas.sql
-- All 20 Lagos State LGAs organised by Senatorial District (region).
-- IDs match the mock data in api/_mockData.js exactly.
-- Ikeja (id=7) is the state capital LGA.

INSERT INTO `lgas` (`id`, `name`, `state`, `region`, `is_capital`) VALUES
-- ── Lagos West (Senatorial District) ─────────────────────────────────────
(1,  'Agege',            'Lagos', 'north',   FALSE),
(2,  'Ajeromi-Ifelodun', 'Lagos', 'north',   FALSE),
(3,  'Alimosho',         'Lagos', 'north',   FALSE),
(4,  'Amuwo-Odofin',     'Lagos', 'north',   FALSE),
(5,  'Badagry',          'Lagos', 'north',   FALSE),
(6,  'Ifako-Ijaiye',     'Lagos', 'north',   FALSE),
(7,  'Ikeja',            'Lagos', 'north',   TRUE),    -- state capital
(8,  'Mushin',           'Lagos', 'north',   FALSE),
(9,  'Ojo',              'Lagos', 'north',   FALSE),
(10, 'Oshodi-Isolo',     'Lagos', 'north',   FALSE),

-- ── Lagos Central (Senatorial District) ──────────────────────────────────
(11, 'Apapa',            'Lagos', 'central', FALSE),
(12, 'Eti-Osa',          'Lagos', 'central', FALSE),
(13, 'Lagos Island',     'Lagos', 'central', FALSE),
(14, 'Lagos Mainland',   'Lagos', 'central', FALSE),
(15, 'Surulere',         'Lagos', 'central', FALSE),

-- ── Lagos East (Senatorial District) ─────────────────────────────────────
(16, 'Epe',              'Lagos', 'south',   FALSE),
(17, 'Ibeju-Lekki',      'Lagos', 'south',   FALSE),
(18, 'Ikorodu',          'Lagos', 'south',   FALSE),
(19, 'Kosofe',           'Lagos', 'south',   FALSE),
(20, 'Shomolu',          'Lagos', 'south',   FALSE);
