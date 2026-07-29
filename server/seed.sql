-- ADM Connect — End-to-End Test Data Seed
-- =========================================
-- ⚠  DEVELOPMENT / STAGING USE ONLY — delete before production.
-- Import via phpMyAdmin: Import tab → choose this file → Go
--
-- LGAs are NOT touched — assumes they are already seeded.
--
-- Test credentials
-- ────────────────
-- Super admin  aliyu@admconnect.com      Admin@1234
-- Admin        fatima@admconnect.com     Admin@1234
-- Citizen 1    abdullahi@adm.test        Citizen@1234   Yola North LGA
-- Citizen 2    zainab@adm.test           Citizen@1234   Numan LGA
-- Citizen 3    kabiru@adm.test           Citizen@1234   Mubi North LGA
-- Citizen 4    maryam@adm.test           Citizen@1234   Yola South LGA
-- Citizen 5    usman@adm.test            Citizen@1234   Ganye LGA

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE reel_subscriptions;
TRUNCATE TABLE reel_reports;
TRUNCATE TABLE reel_comments;
TRUNCATE TABLE reel_likes;
TRUNCATE TABLE reel_lga_targets;
TRUNCATE TABLE notifications;
TRUNCATE TABLE chat_reports;
TRUNCATE TABLE lga_chat_messages;
TRUNCATE TABLE chat_last_read;
TRUNCATE TABLE advert_lga_targets;
TRUNCATE TABLE adverts;
TRUNCATE TABLE news_lga_targets;
TRUNCATE TABLE news;
TRUNCATE TABLE reels;
TRUNCATE TABLE users;
TRUNCATE TABLE admins;
TRUNCATE TABLE banned_words;

SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ADMINS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO admins (id, name, email, password, role, region, handle, status) VALUES
(100001, 'Aliyu Mohammed',  'aliyu@admconnect.com',  '$2y$12$6EKsAV7.DZFHpN0uECJHyuGTA7MMV97u8z3CdJPs.t2ra8KdXmcp2', 'super_admin', NULL, 'aliyu_m',  'active'),
(100002, 'Fatima Hassan',   'fatima@admconnect.com', '$2y$12$6EKsAV7.DZFHpN0uECJHyuGTA7MMV97u8z3CdJPs.t2ra8KdXmcp2', 'admin', 'central', 'fatima_h', 'active');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CITIZENS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO users (id, name, username, email, phone, gender, password, lga_id, lga_name, region, city, state, dob, avatar_url, role, is_verified, status, has_seen_welcome,
  notif_official, notif_community, notif_lga_alerts, notif_new_login, notif_reel_likes, notif_reel_comments, notif_breaking_news, created_at) VALUES
(100001, 'Abdullahi Musa', 'abdullahi_m', 'abdullahi@adm.test', '+2348031234001', 'male',   '$2y$12$odQO4mVtpn/tXJbYIOHrL.8GGEQ63xzz4EI9PjydHuVrvfzhnJj5y', 1, 'Yola North', 'central', 'Yola',    'Lagos State', '1992-04-15', 'https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs', 'citizen', 1, 'active', 1, 1,1,1,1,1,1,1, NOW()),
(100002, 'Zainab Usman',   'zainab_u',   'zainab@adm.test',   '+2348031234002', 'female', '$2y$12$odQO4mVtpn/tXJbYIOHrL.8GGEQ63xzz4EI9PjydHuVrvfzhnJj5y', 2, 'Numan',      'south',  'Numan',    'Lagos State', '1996-08-22', 'https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k', 'citizen', 1, 'active', 1, 1,1,1,1,1,1,1, NOW()),
(100003, 'Kabiru Ibrahim', 'kabiru_i',   'kabiru@adm.test',   '+2348031234003', 'male',   '$2y$12$odQO4mVtpn/tXJbYIOHrL.8GGEQ63xzz4EI9PjydHuVrvfzhnJj5y', 3, 'Mubi North',  'north',  'Mubi',    'Lagos State', '1990-01-30', 'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU', 'citizen', 1, 'active', 1, 1,1,1,1,1,1,1, NOW()),
(100004, 'Maryam Sani',    'maryam_s',   'maryam@adm.test',   '+2348031234004', 'female', '$2y$12$odQO4mVtpn/tXJbYIOHrL.8GGEQ63xzz4EI9PjydHuVrvfzhnJj5y', 4, 'Yola South',  'central','Yola',    'Lagos State', '1998-11-05', 'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI', 'citizen', 1, 'active', 1, 1,1,1,1,1,1,1, NOW()),
(100005, 'Usman Tukur',    'usman_t',    'usman@adm.test',    '+2348031234005', 'male',   '$2y$12$odQO4mVtpn/tXJbYIOHrL.8GGEQ63xzz4EI9PjydHuVrvfzhnJj5y', 5, 'Ganye',       'south',  'Ganye',   'Lagos State', '1994-06-18', 'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY', 'citizen', 1, 'active', 1, 1,1,1,1,1,1,1, NOW());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. NEWS
-- LGA groupings (all 34 covered):
--   A – Northern border : 2,7,8,9,10,25
--   B – Eastern cluster : 12,13,15,20,22,24,32
--   C – Funtua zone     : 3,4,16,19,33
--   D – Dutsin-Ma zone  : 5,23,28,29,30,31
--   E – Katsina metro   : 1,14,17,18,34
--   F – Western cluster : 6,11,21,26,27
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO news (id, slug, title, summary, body, category, breaking, is_headline, target_all_lgas, status, image_url, author_id, lga_id, lga_name, delivery_push, delivery_email, published_at, created_at) VALUES

-- ALL-LGA (4)
(100001, 'governor-digital-literacy-launch',
 'Governor Radda Launches KatsinaTech 2025 Digital Literacy Drive',
 '50,000 Katsina youth across all 34 LGAs to receive free digital skills training.',
 '<p>Governor Dikko Umar Radda today launched KatsinaTech 2025 at Government House, Katsina. The initiative equips 50,000 young residents with web development, data analysis, and digital marketing skills. Training centres will operate in every LGA headquarters starting next month.</p>',
 'Technology', 1, 1, 1, 'published', 'https://picsum.photos/id/180/800/450.jpg',
 100001, NULL, NULL, 1, 0, NOW() - INTERVAL 4 DAY, NOW()),

(100002, 'meningitis-vaccination-statewide',
 'Free Meningitis Vaccination Campaign Begins Monday Across All LGAs',
 'Katsina State Ministry of Health launches emergency vaccination drive in all 34 LGAs.',
 '<p>The Katsina State Ministry of Health has announced a state-wide free meningitis vaccination campaign commencing Monday. Mobile health teams will visit every LGA headquarters and major wards. Citizens aged 2–30 are strongly encouraged to participate. The campaign runs for three weeks.</p>',
 'Health', 1, 0, 1, 'published', 'https://picsum.photos/id/509/800/450.jpg',
 100002, NULL, NULL, 1, 0, NOW() - INTERVAL 3 DAY, NOW()),

(100003, 'state-scholarship-applications-open',
 'Katsina Scholarship Board Opens 2025/2026 Applications — Deadline 31 Aug',
 'Scholarships for undergraduate, postgraduate, and overseas study now available to all Katsina indigenes.',
 '<p>The Katsina State Scholarship Board has opened applications for the 2025/2026 session. Awards cover Nigerian universities, polytechnics, colleges of education, and limited overseas postgraduate slots. Minimum requirement: five WAEC/NECO credits including English and Maths. Apply at the Board portal before August 31st.</p>',
 'Education', 0, 0, 1, 'published', 'https://picsum.photos/id/20/800/450.jpg',
 100002, NULL, NULL, 1, 0, NOW() - INTERVAL 2 DAY, NOW()),

(100004, 'gubernatorial-quarterly-address',
 'Governor''s Q2 Address: ₦12 Billion Infrastructure Budget on Track',
 'Governor Radda delivers mid-year briefing on infrastructure, security, and economic development.',
 '<p>In his second quarter address, Governor Dikko Umar Radda confirmed that ₦12 billion in infrastructure expenditure is progressing as scheduled. Key milestones include the Katsina–Jibia dual carriageway at 60% completion, 14 rehabilitated roads across the state, and the commissioning of two new primary health centres in Daura and Funtua LGAs.</p>',
 'Politics', 0, 1, 1, 'published', 'https://picsum.photos/id/365/800/450.jpg',
 100001, NULL, NULL, 1, 0, NOW() - INTERVAL 1 DAY, NOW()),

-- GROUPED (6)
(100005, 'northern-border-road-upgrade',
 'Federal Government Approves Road Upgrade for Six Northern Border LGAs',
 'Daura, Jibia, Kaita, Mashi, Zango, and Mai''Adua to benefit from ₦4.2 billion road grant.',
 '<p>The Federal Ministry of Works has approved a ₦4.2 billion road rehabilitation grant covering the six LGAs that share an international border with Niger Republic. The Daura–Kongolam–Katsina Highway is first on the list, followed by the Zango–Mashi trunk road. Construction is expected to begin in Q4.</p>',
 'Infrastructure', 0, 0, 0, 'published', 'https://picsum.photos/id/317/800/450.jpg',
 100001, NULL, NULL, 1, 0, NOW() - INTERVAL 5 DAY, NOW()),

(100006, 'eastern-cluster-agricultural-extension',
 'Agricultural Extension Officers Deployed to Seven Eastern LGAs',
 'Baure, Bindawa, Dan Musa, Ingawa, Kankia, Kusada, and Sandamu get dedicated farm advisers.',
 '<p>The Katsina State Agricultural Development Authority (KTARDA) has deployed a new cohort of agricultural extension officers to seven eastern LGAs. Each officer is responsible for up to 200 registered farming households. Training on improved groundnut varieties and soil conservation techniques begins this week.</p>',
 'Agriculture', 0, 0, 0, 'published', 'https://picsum.photos/id/145/800/450.jpg',
 100001, NULL, NULL, 1, 0, NOW() - INTERVAL 6 DAY, NOW()),

(100007, 'funtua-zone-water-project',
 'New Borehole Network to Serve 120,000 Residents in Funtua Zone',
 'Funtua, Malumfashi, Dandume, Faskari, and Bakori to get 45 new boreholes by December.',
 '<p>A World Bank-funded rural water supply project will install 45 solar-powered boreholes across five LGAs in the Funtua zone. The ₦2.1 billion project is implemented by the Katsina State Rural Water Supply and Sanitation Agency (RUWASSA) and is expected to benefit approximately 120,000 rural residents who currently rely on seasonal streams.</p>',
 'Infrastructure', 0, 0, 0, 'published', 'https://picsum.photos/id/137/800/450.jpg',
 100002, NULL, NULL, 1, 0, NOW() - INTERVAL 5 DAY, NOW()),

(100008, 'dutsin-ma-zone-youth-employment',
 'Youth Employment Initiative Launched in Dutsin-Ma Zone',
 'Dutsin-Ma, Kurfi, Musawa, Rimi, Sabuwa, and Safana benefit from 1,200 apprenticeship places.',
 '<p>Under the Federal Government''s NSIP Youth Employment Programme, 1,200 apprenticeship placements have been allocated to six LGAs in the Dutsin-Ma zone. Trades covered include electrical installation, welding, tailoring, and phone repair. Registration opens at each LGA secretariat from Monday.</p>',
 'Economy', 0, 0, 0, 'published', 'https://picsum.photos/id/96/800/450.jpg',
 100002, NULL, NULL, 1, 0, NOW() - INTERVAL 4 DAY, NOW()),

(100009, 'katsina-metro-flood-warning',
 'Emergency Flood Alert: Metro LGAs Urged to Clear Drainage Channels',
 'Katsina, Batagarawa, Charanchi, Danja, and Dutsi on yellow flood watch for the coming week.',
 '<p>The Katsina State Emergency Management Agency (SEMA) has issued a yellow flood watch for five LGAs in the Katsina metropolitan cluster. Residents are urged to clear drainage channels and avoid building on waterways. The Nigeria Meteorological Agency (NiMet) projects above-average rainfall in the region through mid-August.</p>',
 'Security', 1, 0, 0, 'published', 'https://picsum.photos/id/252/800/450.jpg',
 100001, NULL, NULL, 1, 0, NOW() - INTERVAL 16 HOUR, NOW()),

(100010, 'western-cluster-security-patrol',
 'Joint Security Patrol Intensified in Kankara, Batsari, Kafur, Mani, and Matazu',
 'Army, Police, and Vigilante group launch coordinated 30-day patrol in western Katsina.',
 '<p>Following a directive from the Katsina State Security Council, a joint patrol operation codenamed "Operation Clear Road West" has been launched across five western LGAs. The 30-day operation involves Nigerian Army troops, Police Mobile Force, and Local Vigilante groups. Residents are asked to report suspicious movements via the Katsina Security Hotline: 0800-KATSINA.</p>',
 'Security', 1, 0, 0, 'published', 'https://picsum.photos/id/429/800/450.jpg',
 100001, NULL, NULL, 1, 0, NOW() - INTERVAL 8 HOUR, NOW()),

-- LGA-SPECIFIC (11 + 1 draft)
(100011, 'katsina-road-completion',
 '14 Road Projects Reach Completion Ahead of Schedule in Katsina LGA',
 '47 km of roads across Katsina metropolis now complete, 6 more underway.',
 '<p>The Katsina State Ministry of Works confirmed 14 of 20 road rehabilitation projects in Katsina LGA are complete. Areas covered include Tudun Wada, Kofar Kaura, and Unguwar Alkali. The remaining six projects target Kofar Marusa and Yanduna wards and are expected to wrap up by September.</p>',
 'Infrastructure', 1, 0, 0, 'published', 'https://picsum.photos/id/317/800/450.jpg',
 100001, 1, 'Katsina', 1, 0, NOW() - INTERVAL 7 DAY, NOW()),

(100012, 'daura-heritage-festival-2025',
 'Daura International Heritage Festival Returns — October 10–12',
 'The annual festival celebrating the Bayajidda legend returns with cultural exhibitions and international guests.',
 '<p>The Daura International Heritage Festival will hold October 10–12 at the Daura Emirate grounds. This year''s edition features a new archaeology exhibition showcasing finds from the ancient Daura walled city, traditional horse display (Durbar), and a cultural trade fair. International guests from Niger, Mali, and the diaspora are expected.</p>',
 'Culture', 0, 0, 0, 'published', 'https://picsum.photos/id/484/800/450.jpg',
 100002, 2, 'Daura', 1, 0, NOW() - INTERVAL 3 DAY, NOW()),

(100013, 'funtua-agricultural-fair',
 '12th Annual Funtua Agricultural & Trade Fair — Registration Now Open',
 'October 15–18 at Funtua Trade Centre. Over 200 exhibitors expected.',
 '<p>The Funtua Local Government Agricultural Development Office announces the 12th Annual Agricultural and Trade Fair, October 15–18 at the Funtua Trade Centre. Exhibitors include cotton farmers, groundnut cooperatives, and input suppliers. A special livestock auction is scheduled for October 17. Register before September 30 at the LGA Secretariat.</p>',
 'Agriculture', 0, 0, 0, 'published', 'https://picsum.photos/id/145/800/450.jpg',
 100001, 3, 'Funtua', 1, 0, NOW() - INTERVAL 5 HOUR, NOW()),

(100014, 'malumfashi-textile-revival',
 'Malumfashi Textile Factory Revival: 800 Jobs Available',
 'The long-dormant Malumfashi Textile Mill to reopen under new management in Q4.',
 '<p>The Katsina State Government and a Lagos-based consortium have finalised a concession agreement to reopen the Malumfashi Textile Mill, dormant since 2009. The first phase will create 800 direct jobs. Governor Radda described the deal as "the most significant private investment in Malumfashi in two decades." Recruitment begins October.</p>',
 'Economy', 0, 0, 0, 'published', 'https://picsum.photos/id/404/800/450.jpg',
 100002, 4, 'Malumfashi', 1, 0, NOW() - INTERVAL 2 DAY, NOW()),

(100015, 'dutsin-ma-fudma-expansion',
 'FUDMA Gets ₦800 Million Federal Grant for Campus Expansion',
 'Federal University Dutsin-Ma to build two new faculties and a 1,000-bed hostel.',
 '<p>Federal University Dutsin-Ma (FUDMA) has received an ₦800 million Tertiary Education Trust Fund (TETFund) grant for a major campus expansion. Construction of the new Faculty of Engineering building and a Faculty of Environmental Sciences block begins in September. A 1,000-bed student hostel is also part of the project.</p>',
 'Education', 0, 0, 0, 'published', 'https://picsum.photos/id/250/800/450.jpg',
 100001, 5, 'Dutsin-Ma', 1, 0, NOW() - INTERVAL 4 DAY, NOW()),

(100016, 'jibia-border-trade-revival',
 'Jibia Border Customs Post Records ₦2.1 Billion in August Revenue',
 'Record monthly collection at the Jibia border crossing as livestock trade surges.',
 '<p>The Jibia Area Command of the Nigeria Customs Service recorded ₦2.1 billion in August — its highest monthly collection on record. The surge is attributed to increased cattle and goat exports to Niger Republic following the new bilateral livestock trade framework signed in June. The figure represents a 34% year-on-year increase.</p>',
 'Economy', 0, 0, 0, 'published', 'https://picsum.photos/id/338/800/450.jpg',
 100002, 7, 'Jibia', 1, 0, NOW() - INTERVAL 1 DAY, NOW()),

(100017, 'kankara-solar-farm-commissioning',
 'Kankara 20MW Solar Farm Commissioned — 15,000 Homes to Benefit',
 'Katsina''s second utility-scale solar power project officially goes live.',
 '<p>Governor Radda commissioned the Kankara 20-megawatt solar power project on Wednesday, the second utility-scale solar farm in Katsina State. The project, financed through the Presidential Artisanal Gold Mining Initiative fund, will supply power to approximately 15,000 homes in Kankara and neighbouring Batsari LGAs. Connection to the national grid is expected within six weeks.</p>',
 'Technology', 0, 0, 0, 'published', 'https://picsum.photos/id/96/800/450.jpg',
 100001, 6, 'Kankara', 1, 0, NOW() - INTERVAL 20 HOUR, NOW()),

(100018, 'baure-irrigation-scheme',
 'Baure Fadama Irrigation Scheme: 3,000 Hectares Brought Under Cultivation',
 'New irrigation infrastructure opens large-scale dry-season farming in Baure.',
 '<p>The Lower Rima and Niger River Basins Development Authority has completed Phase 2 of the Baure Fadama Irrigation Scheme, bringing 3,000 hectares of land under perennial irrigation for the first time. Participating farmers will grow rice, maize, and vegetables during the dry season, providing year-round income for an estimated 4,500 households.</p>',
 'Agriculture', 0, 0, 0, 'published', 'https://picsum.photos/id/292/800/450.jpg',
 100002, 12, 'Baure', 1, 0, NOW() - INTERVAL 5 DAY, NOW()),

(100019, 'mashi-primary-health-centre',
 'New Primary Health Centre Opens in Mashi — Serving 30,000 Residents',
 'The 12-bed facility is the first new health centre in Mashi LGA in 18 years.',
 '<p>A brand-new 12-bed primary health centre equipped with a maternity wing, laboratory, and pharmacy was commissioned in Mashi LGA on Friday. The ₦180 million project was funded by the Basic Healthcare Provision Fund (BHCPF). The facility is expected to serve approximately 30,000 residents from Mashi town and surrounding villages, reducing the nearest referral distance from 45 km to 8 km.</p>',
 'Health', 0, 0, 0, 'published', 'https://picsum.photos/id/509/800/450.jpg',
 100001, 9, 'Mashi', 1, 0, NOW() - INTERVAL 6 DAY, NOW()),

(100020, 'zango-youth-football-league',
 'Zango FA League Season Kicks Off with 16 Teams',
 'The Zango Football Association launches its most competitive league season yet.',
 '<p>Sixteen youth teams from across Zango LGA kicked off the 2025 FA League season at the Zango Township Stadium on Saturday. The competition, funded by a community development levy, features players aged 16–25. The winner earns automatic entry into the Katsina State FA League qualifiers. Matches every Saturday and Sunday until November.</p>',
 'Sports', 0, 0, 0, 'published', 'https://picsum.photos/id/122/800/450.jpg',
 100002, 10, 'Zango', 1, 0, NOW() - INTERVAL 2 DAY, NOW()),

(100021, 'rimi-community-forest-programme',
 'Rimi LGA Launches 10,000-Tree Community Forest Programme',
 'Schools, youth clubs, and ward councils to plant and maintain 10,000 trees across Rimi.',
 '<p>Rimi LGA has launched a community-driven afforestation drive targeting 10,000 trees by December 2025. The programme is coordinated by the Rimi Environmental Committee in partnership with the Katsina State Forestry Department. Each participating ward is responsible for a 200-tree nursery. Drought-resistant species including neem, dawadawa, and gmelina are being prioritised.</p>',
 'Environment', 0, 0, 0, 'published', 'https://picsum.photos/id/137/800/450.jpg',
 100001, 29, 'Rimi', 1, 0, NOW() - INTERVAL 3 DAY, NOW()),

(100022, 'draft-malumfashi-census',
 '[DRAFT] Malumfashi Population Estimates — Internal Working Document',
 'Awaiting verification from NPC before publication.',
 '<p>Draft — not approved for release.</p>',
 'Official', 0, 0, 0, 'draft', NULL,
 100002, 4, 'Malumfashi', 1, 0, NULL, NOW());

-- news_lga_targets (grouped articles)
INSERT IGNORE INTO news_lga_targets (news_id, lga_id) VALUES
-- Group A – Northern border (100005)
(100005,2),(100005,7),(100005,8),(100005,9),(100005,10),(100005,25),
-- Group B – Eastern cluster (100006)
(100006,12),(100006,13),(100006,15),(100006,20),(100006,22),(100006,24),(100006,32),
-- Group C – Funtua zone (100007)
(100007,3),(100007,4),(100007,16),(100007,19),(100007,33),
-- Group D – Dutsin-Ma zone (100008)
(100008,5),(100008,23),(100008,28),(100008,29),(100008,30),(100008,31),
-- Group E – Katsina metro (100009)
(100009,1),(100009,14),(100009,17),(100009,18),(100009,34),
-- Group F – Western cluster (100010)
(100010,6),(100010,11),(100010,21),(100010,26),(100010,27),
-- LGA-specific articles
(100011,1),(100012,2),(100013,3),(100014,4),(100015,5),
(100016,7),(100017,6),(100018,12),(100019,9),(100020,10),(100021,29);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADVERTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO adverts (id, title, advertiser, description, cta_label, cta_url, image_url, type, status, target_all_lgas, start_date, end_date, created_at) VALUES

-- BANNER — all LGAs
(100001,'Katsina Agricultural Bank — Harvest Loan Scheme','Katsina State Agricultural Development Bank',
 'Low-interest farming loans available to all registered farmers. Apply before the planting season.',
 'Apply Now','https://admconnect.com','https://picsum.photos/id/292/800/400.jpg',
 'banner','active',1, CURDATE() - INTERVAL 7 DAY, CURDATE() + INTERVAL 60 DAY, NOW()),

(100002,'FUDMA — Admissions 2025/2026 Open','Federal University Dutsin-Ma',
 'Undergraduate and postgraduate admissions now open. Apply via JAMB CAPS.',
 'Check Status','https://admconnect.com','https://picsum.photos/id/250/800/400.jpg',
 'banner','active',1, CURDATE() - INTERVAL 3 DAY, CURDATE() + INTERVAL 90 DAY, NOW()),

(100003,'MTN Katsina — Double Data Every Friday','MTN Nigeria',
 'Enjoy 2× data on all recharge amounts every Friday. Dial *131*1# to activate.',
 'Activate Now','https://admconnect.com','https://picsum.photos/id/96/800/400.jpg',
 'banner','active',1, CURDATE(), CURDATE() + INTERVAL 30 DAY, NOW()),

(100004,'Invest in Katsina Free Trade Zone','Katsina State Investment Promotion Agency',
 'Industrial land with tax holidays and full infrastructure support. Download the prospectus.',
 'Download Prospectus','https://admconnect.com','https://picsum.photos/id/338/800/400.jpg',
 'banner','active',1, CURDATE() - INTERVAL 14 DAY, CURDATE() + INTERVAL 45 DAY, NOW()),

-- BANNER — LGA-specific
(100005,'Katsina City Mall — Grand Opening','Katsina City Mall Ltd',
 'Opening October 1st. 120 shops, cinema, food court. First 500 visitors get a free gift.',
 'Get Directions','https://admconnect.com','https://picsum.photos/id/404/800/400.jpg',
 'banner','active',0, CURDATE() - INTERVAL 2 DAY, CURDATE() + INTERVAL 28 DAY, NOW()),

(100006,'Daura Heritage Festival 2025 — Book Your Stay','Daura Emirate Hotel',
 'Official accommodation partner for the Daura International Heritage Festival. Book early.',
 'Book Now','https://admconnect.com','https://picsum.photos/id/484/800/400.jpg',
 'banner','active',0, CURDATE(), CURDATE() + INTERVAL 40 DAY, NOW()),

-- BANNER — group of LGAs
(100007,'Funtua Zone Cooperative Bank — Join Today','Funtua Zone Cooperative Credit Society',
 'Serving farmers and traders in Funtua, Malumfashi, Bakori, Dandume, and Faskari. Low-rate loans.',
 'Join the Co-op','https://admconnect.com','https://picsum.photos/id/145/800/400.jpg',
 'banner','active',0, CURDATE() - INTERVAL 5 DAY, CURDATE() + INTERVAL 55 DAY, NOW()),

-- INTERSTITIAL — all LGAs
(100008,'Register to Vote — 2027 Governorship Election','Independent National Electoral Commission (INEC)',
 'Continuous Voter Registration is ongoing. Visit your nearest INEC office or use the INEC portal.',
 'Register Online','https://admconnect.com','https://picsum.photos/id/365/800/600.jpg',
 'interstitial','active',1, CURDATE() - INTERVAL 10 DAY, CURDATE() + INTERVAL 180 DAY, NOW()),

(100009,'Katsina Anti-Drug Campaign — Say No to Tramadol','National Drug Law Enforcement Agency (NDLEA)',
 'The misuse of prescription drugs is destroying lives. Report drug abuse: 0800-NDLEA-00.',
 'Learn More','https://admconnect.com','https://picsum.photos/id/509/800/600.jpg',
 'interstitial','active',1, CURDATE(), CURDATE() + INTERVAL 120 DAY, NOW()),

-- INTERSTITIAL — group of LGAs
(100010,'Northern LGA Trade Fair — Daura, October 20–22','Daura LGA Commerce & Industry Board',
 'The Northern Katsina Trade Fair brings together buyers and sellers from 6 border LGAs.',
 'Register as Exhibitor','https://admconnect.com','https://picsum.photos/id/429/800/600.jpg',
 'interstitial','active',0, CURDATE() - INTERVAL 1 DAY, CURDATE() + INTERVAL 25 DAY, NOW()),

-- NEWS type — all LGAs
(100011,'Katsina State Health Insurance — Enrol Free Before September','Katsina State Contributory Health Management Agency',
 'All civil servants and their families are entitled to free enrolment. Deadline September 30.',
 'Enrol Now','https://admconnect.com','https://picsum.photos/id/122/800/300.jpg',
 'news','active',1, CURDATE() - INTERVAL 4 DAY, CURDATE() + INTERVAL 35 DAY, NOW()),

(100012,'Glo Katsina Special — ₦200 Recharge Gets ₦500 Value','Glo Mobile Nigeria',
 'Exclusive offer for Katsina subscribers. Buy ₦200 airtime and get ₦500 value till Sunday.',
 'Buy Airtime','https://admconnect.com','https://picsum.photos/id/96/800/300.jpg',
 'news','active',1, CURDATE(), CURDATE() + INTERVAL 7 DAY, NOW()),

-- NEWS type — LGA-specific
(100013,'Malumfashi Textile Mill Jobs — Apply Before August 31','Malumfashi Textile Concession Partners Ltd',
 '800 jobs in weaving, dyeing, quality control, and administration. Applicants must be Malumfashi indigenes.',
 'Download Form','https://admconnect.com','https://picsum.photos/id/252/800/300.jpg',
 'news','active',0, CURDATE() - INTERVAL 2 DAY, CURDATE() + INTERVAL 14 DAY, NOW()),

-- FEED type — all LGAs
(100014,'Airtel Katsina — 10GB for ₦1,000 Monthly Plan','Airtel Nigeria',
 'Get 10GB valid for 30 days for just ₦1,000. Dial *141*1# to activate on any Airtel line.',
 'Activate','https://admconnect.com','https://picsum.photos/id/484/800/400.jpg',
 'feed','active',1, CURDATE(), CURDATE() + INTERVAL 30 DAY, NOW()),

(100015,'Katsina Teachers Recruitment — 2,000 Positions Available','Katsina State Universal Basic Education Board (SUBEB)',
 'Teaching positions open across all 34 LGAs. Minimum qualification: NCE. Apply at SUBEB office.',
 'Apply Now','https://admconnect.com','https://picsum.photos/id/20/800/400.jpg',
 'feed','active',1, CURDATE() - INTERVAL 3 DAY, CURDATE() + INTERVAL 60 DAY, NOW()),

-- FEED type — group of LGAs
(100016,'Dutsin-Ma Zone Cooperative Fair — September 28','Dutsin-Ma LGA Commerce Office',
 'A one-day market for agricultural cooperatives in Dutsin-Ma, Kurfi, Musawa, Rimi, Sabuwa, and Safana.',
 'Get Directions','https://admconnect.com','https://picsum.photos/id/317/800/400.jpg',
 'feed','active',0, CURDATE() - INTERVAL 6 DAY, CURDATE() + INTERVAL 20 DAY, NOW()),

-- PAUSED / EXPIRED for UI testing
(100017,'[Paused] Katsina Book Fair 2024','Katsina State Library Board',
 'Annual book fair paused pending venue confirmation.',
 'Learn More','https://admconnect.com', NULL,
 'banner','paused',1, CURDATE() - INTERVAL 60 DAY, CURDATE() + INTERVAL 30 DAY, NOW()),

(100018,'[Expired] Eid-el-Kabir Greetings 2024','Government House Katsina',
 'Wishing all citizens Eid Mubarak.',
 NULL,'https://admconnect.com','https://picsum.photos/id/122/800/400.jpg',
 'banner','expired',1, CURDATE() - INTERVAL 365 DAY, CURDATE() - INTERVAL 300 DAY, NOW());

-- advert_lga_targets for non-all-lga ads
INSERT IGNORE INTO advert_lga_targets (advert_id, lga_id) VALUES
-- 100005: Katsina metro
(100005,1),(100005,14),(100005,17),(100005,18),(100005,34),
-- 100006: Daura + border
(100006,2),(100006,7),(100006,8),(100006,9),(100006,10),(100006,25),
-- 100007: Funtua zone
(100007,3),(100007,4),(100007,16),(100007,19),(100007,33),
-- 100010: Northern border
(100010,2),(100010,7),(100010,8),(100010,9),(100010,10),(100010,25),
-- 100013: Malumfashi specific
(100013,4),
-- 100016: Dutsin-Ma zone
(100016,5),(100016,23),(100016,28),(100016,29),(100016,30),(100016,31);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REELS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO reels (reel_id, lga_id, lga_name, target_all_lgas, is_admin, caption, hashtags, video_url, cloudinary_id, thumbnail_url, views, likes, comment_count, author_id, author_name, author_handle, author_avatar_url, status, allow_comments, published_at, created_at) VALUES

-- Abdullahi (Katsina LGA 1)
('reel_001',1,'Katsina',0,0,'Sunrise over Katsina city 🌅 The beauty of the North. #Katsina #NorthernNigeria','["Katsina","NorthernNigeria","Sunrise"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4','seed/sample_0.mp4',
 'https://picsum.photos/id/10/640/360.jpg?hmac=CrRjsHrAuJhCbm7bzOtL8VVtAomW-VTsGS0z7-AeL0g',
 142,18,3,100001,'abdullahi_m','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs',
 'published',1, NOW() - INTERVAL 7 DAY, NOW()),

('reel_002',NULL,NULL,1,0,'Proud to be Katsina! Our governor is working hard for all of us 💪 #KatsinaTech #Nigeria','["KatsinaTech","Nigeria","Proud"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4','seed/sample_3.mp4',
 'https://picsum.photos/id/180/640/360.jpg?hmac=2dNNJf6sL7I-0aHEFNkBNBDMJfBYovuECxnJhFxVH5Y',
 67,9,1,100001,'abdullahi_m','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs',
 'published',1, NOW() - INTERVAL 3 DAY, NOW()),

-- Zainab (Daura LGA 2)
('reel_003',2,'Daura',0,0,'Daura — the cradle of Hausa civilisation 🏰 #Daura #History #HausaKingdoms','["Daura","History","HausaKingdoms"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4','seed/sample_1.mp4',
 'https://picsum.photos/id/28/640/360.jpg?hmac=3ESnpVeqUUCCpxoMpA0QvJjVlpVRpWsHpHcEVWABRWM',
 88,11,2,100002,'zainab_u','zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k',
 'published',1, NOW() - INTERVAL 5 DAY, NOW()),

('reel_004',NULL,NULL,1,0,'Sisters in agriculture! Women farmers of Katsina are feeding the nation 🌾 #WomenInAgriculture','["WomenInAgriculture","Katsina","FarmHer"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4','seed/sample_4.mp4',
 'https://picsum.photos/id/230/640/360.jpg?hmac=c3UqkEJi3Bl2KV62pVKjK-A26pUbMJH9F8t-SXobwsM',
 201,24,4,100002,'zainab_u','zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k',
 'published',1, NOW() - INTERVAL 2 DAY, NOW()),

-- Kabiru (Funtua LGA 3)
('reel_005',3,'Funtua',0,0,'Cotton harvest season has arrived in Funtua! 🌿 #Funtua #Cotton #Agriculture','["Funtua","Cotton","Agriculture"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4','seed/sample_2.mp4',
 'https://picsum.photos/id/137/640/360.jpg?hmac=pSa3GXHJ0z5-LRKOmUuL8JIRVMXSdXXHp5n52NJFyBo',
 53,7,1,100003,'kabiru_i','kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU',
 'published',1, NOW() - INTERVAL 4 DAY, NOW()),

('reel_006',NULL,NULL,1,0,'The youth of Katsina are ready. No more excuses — let''s build together 💯 #KatsinaYouth','["KatsinaYouth","NorthernNigeria","BuiltByUs"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4','seed/sample_5.mp4',
 'https://picsum.photos/id/292/640/360.jpg?hmac=m_MqPSmFMlSmzBbIXfNRHo7mWGNW3cEEIaVWLH-c2e0',
 109,14,2,100003,'kabiru_i','kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU',
 'published',1, NOW() - INTERVAL 1 DAY, NOW()),

-- Maryam (Katsina LGA 1)
('reel_007',1,'Katsina',0,0,'Katsina market day — the colours, the energy, the people! ❤️ #KatsinaMarket','["KatsinaMarket","Katsina","NorthLife"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4','seed/sample_6.mp4',
 'https://picsum.photos/id/317/640/360.jpg?hmac=wPb0g1wCnk1oIlFIcjmh3F1bMIPWFtJDxDHipfXB4gg',
 44,6,1,100004,'maryam_s','maryam_s','https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI',
 'published',1, NOW() - INTERVAL 6 DAY, NOW()),

('reel_008',2,'Daura',0,0,'Visiting Daura — every Hausa person''s spiritual homeland 🕌 #Daura #Travel','["Daura","Travel","Heritage"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4','seed/sample_10.mp4',
 'https://picsum.photos/id/484/640/360.jpg?hmac=wX-4ZsPtFg5SLVmxSbxJgH3Z_LhGWYIGTz5gZEaLjHI',
 61,8,0,100004,'maryam_s','maryam_s','https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI',
 'published',1, NOW() - INTERVAL 3 DAY, NOW()),

-- Usman (Malumfashi LGA 4)
('reel_009',4,'Malumfashi',0,0,'The old textile mill days are coming back to Malumfashi! 800 jobs! 🎉 #Malumfashi #Jobs','["Malumfashi","Jobs","Textiles"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4','seed/sample_7.mp4',
 'https://picsum.photos/id/338/640/360.jpg?hmac=r3Ys5P-Rr7E38gvFFlSKGb-RYdnsBw9EiOsTdVMvZMw',
 178,21,3,100005,'usman_t','usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY',
 'published',1, NOW() - INTERVAL 2 DAY, NOW()),

('reel_010',NULL,NULL,1,0,'A message from Malumfashi to the world — we''re on the map! 🗺️ #Katsina #Malumfashi','["Katsina","Malumfashi","Rise"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4','seed/sample_11.mp4',
 'https://picsum.photos/id/509/640/360.jpg?hmac=XjJLr2dAnV0nBBKaHFblxBQk7UvXEW62wYMIPpEFJcg',
 39,5,1,100005,'usman_t','usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY',
 'published',1, NOW() - INTERVAL 14 HOUR, NOW()),

-- Admin reels
('reel_011',NULL,NULL,1,1,'KTG Connect official reel: Katsina 2025 development highlights 🏛️ #KatsinaGovernment','["KatsinaGovernment","Development","2025"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4','seed/sample_8.mp4',
 'https://picsum.photos/id/365/640/360.jpg?hmac=7x1vZVn4T8iNTW0ZbDxrRNqiMPME_1Zby0QQwFb5u9w',
 512,45,6,100001,'aliyu_m','aliyu_m',NULL,
 'published',1, NOW() - INTERVAL 10 DAY, NOW()),

('reel_012',1,'Katsina',0,1,'Katsina Road Rehabilitation Progress — official update from the Ministry of Works 🚧','["Infrastructure","Katsina","Works"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4','seed/sample_9.mp4',
 'https://picsum.photos/id/429/640/360.jpg?hmac=AkjA0J5Xq8sKXHo4wWf1cZPgUkdWp3FZ-j2k2lOCFpc',
 387,32,4,100001,'aliyu_m','aliyu_m',NULL,
 'published',1, NOW() - INTERVAL 7 DAY, NOW()),

('reel_013',NULL,NULL,1,1,'KTG Connect turns 1 year! Thank you Katsina State 🎂 #KTGConnect #Anniversary','["KTGConnect","Anniversary","Katsina"]',
 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4','seed/sample_12.mp4',
 'https://picsum.photos/id/122/640/360.jpg?hmac=Vj9sECBBkLpRZf-0e2YxLJLp_e3X1Wdl3k9Yj_6DRUI',
 643,58,8,100001,'aliyu_m','aliyu_m',NULL,
 'published',1, NOW() - INTERVAL 5 DAY, NOW());

-- reel_lga_targets
INSERT IGNORE INTO reel_lga_targets (reel_id, lga_id) VALUES
('reel_001',1),('reel_003',2),('reel_005',3),
('reel_007',1),('reel_008',2),('reel_009',4),('reel_012',1);

-- ── Reel likes ────────────────────────────────────────────────────────────────

INSERT IGNORE INTO reel_likes (reel_id, user_id) VALUES
('reel_001',100002),('reel_001',100003),('reel_001',100004),
('reel_003',100001),('reel_003',100004),
('reel_004',100001),('reel_004',100003),('reel_004',100005),
('reel_005',100001),
('reel_006',100002),('reel_006',100004),
('reel_009',100001),('reel_009',100002),('reel_009',100003),
('reel_011',100001),('reel_011',100002),('reel_011',100003),('reel_011',100004),('reel_011',100005),
('reel_013',100001),('reel_013',100002),('reel_013',100003);

-- ── Reel comments ─────────────────────────────────────────────────────────────

INSERT INTO reel_comments (reel_id, user_id, user_name, avatar_url, text, created_at) VALUES
('reel_001',100002,'zainab_u',  'https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','Subhanallah! Katsina is so beautiful 🌅', NOW() - INTERVAL 6 DAY + INTERVAL 10 MINUTE),
('reel_001',100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','I live here and never get tired of this view ❤️', NOW() - INTERVAL 5 DAY),
('reel_001',100003,'kabiru_i',  'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Makes me miss home, I''m in Funtua 😂', NOW() - INTERVAL 5 DAY + INTERVAL 1 HOUR),
('reel_003',100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Daura is historic wallahi. Every Nigerian should visit 🏰', NOW() - INTERVAL 4 DAY),
('reel_003',100005,'usman_t',   'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Beautiful! The Emir''s palace is incredible', NOW() - INTERVAL 4 DAY + INTERVAL 30 MINUTE),
('reel_004',100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Our women are the backbone of this state. Proud! 💪', NOW() - INTERVAL 1 DAY + INTERVAL 15 MINUTE),
('reel_004',100003,'kabiru_i',  'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','My mother is a cotton farmer. She will love this 🌾', NOW() - INTERVAL 1 DAY + INTERVAL 33 MINUTE),
('reel_004',100005,'usman_t',   'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Mashallah. Hard work deserves recognition', NOW() - INTERVAL 1 DAY + INTERVAL 50 MINUTE),
('reel_004',100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','This made my day! Shared with my group 🙌', NOW() - INTERVAL 18 HOUR),
('reel_009',100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','800 jobs is massive wallahi. Katsina is moving!', NOW() - INTERVAL 1 DAY + INTERVAL 8 MINUTE),
('reel_009',100002,'zainab_u',  'https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','My cousin applied already! Hope they call him 🙏', NOW() - INTERVAL 1 DAY + INTERVAL 41 MINUTE),
('reel_009',100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','This is the best news from Malumfashi in years!', NOW() - INTERVAL 1 DAY + INTERVAL 66 MINUTE),
('reel_011',100002,'zainab_u',  'https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','Thank you KTG Connect team! This app is so useful', NOW() - INTERVAL 9 DAY),
('reel_011',100003,'kabiru_i',  'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Keep up the great work. Katsina first!', NOW() - INTERVAL 9 DAY + INTERVAL 16 MINUTE),
('reel_011',100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','Alhamdulillah for progress 🤲', NOW() - INTERVAL 9 DAY + INTERVAL 33 MINUTE),
('reel_011',100005,'usman_t',   'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','I tell all my people to download this app', NOW() - INTERVAL 9 DAY + INTERVAL 58 MINUTE),
('reel_011',100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Proud to be part of this community', NOW() - INTERVAL 9 DAY + INTERVAL 83 MINUTE),
('reel_013',100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Happy anniversary! Long may you serve Katsina 🎂', NOW() - INTERVAL 4 DAY),
('reel_013',100002,'zainab_u',  'https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','One year already? Time flies. Best app in the North!', NOW() - INTERVAL 4 DAY + INTERVAL 20 MINUTE),
('reel_013',100003,'kabiru_i',  'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','🎉🎉🎉 Congratulations KTG Connect team!', NOW() - INTERVAL 4 DAY + INTERVAL 40 MINUTE);

-- ── Reel subscriptions ────────────────────────────────────────────────────────

INSERT IGNORE INTO reel_subscriptions (follower_id, target_id) VALUES
(100002,100001),(100003,100001),(100004,100001),(100005,100001),
(100001,100002),(100004,100002),(100005,100002),
(100001,100003),(100002,100003),
(100001,100004),(100003,100004),
(100001,100005),(100002,100005);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CHAT MESSAGES (5 LGA chats)
-- ─────────────────────────────────────────────────────────────────────────────

-- LGA 1 — Katsina (12 messages)
INSERT INTO lga_chat_messages (lga_id, user_id, user_name, avatar_url, text, reactions, created_at) VALUES
(1,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Assalamu alaikum Katsina community! 🙏','{"👋":[100004,100002]}', NOW() - INTERVAL 10 DAY),
(1,100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','Wa alaikum salam! Great to have this space for our LGA','{"❤️":[100001]}', NOW() - INTERVAL 10 DAY + INTERVAL 5 MINUTE),
(1,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Did everyone see the news about the road construction? Tudun Wada is nearly done!','{"🎉":[100004]}', NOW() - INTERVAL 9 DAY),
(1,100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','Finally! That road has been a problem for 2 years. Insha''Allah they finish properly 😅',NULL, NOW() - INTERVAL 9 DAY + INTERVAL 10 MINUTE),
(1,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Anyone registering for the KatsinaTech digital training? I heard top performers get laptops.','{"🔥":[100004]}', NOW() - INTERVAL 7 DAY),
(1,100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','Yes I registered yesterday. The venue is at Government Tech Hub. Starts Monday.',NULL, NOW() - INTERVAL 7 DAY + INTERVAL 15 MINUTE),
(1,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','@maryam_s good luck! Which track are you doing?',NULL, NOW() - INTERVAL 7 DAY + INTERVAL 20 MINUTE),
(1,100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','Digital marketing. You?',NULL, NOW() - INTERVAL 7 DAY + INTERVAL 25 MINUTE),
(1,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Web development. Maybe we can study together 😄','{"😂":[100004]}', NOW() - INTERVAL 7 DAY + INTERVAL 30 MINUTE),
(1,100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','Haha sure! Just don''t distract me 😂','{"😂":[100001]}', NOW() - INTERVAL 7 DAY + INTERVAL 35 MINUTE),
(1,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Flood alert from SEMA — please clear your drainage channels before the rains this week.','{"⚠️":[100004]}', NOW() - INTERVAL 2 DAY),
(1,100004,'maryam_s',  'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','Shared in the family group. Everyone be careful please 🙏',NULL, NOW() - INTERVAL 2 DAY + INTERVAL 5 MINUTE);

-- LGA 2 — Daura (10 messages)
INSERT INTO lga_chat_messages (lga_id, user_id, user_name, avatar_url, text, reactions, created_at) VALUES
(2,100002,'zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','Salam Daura community! This platform is mashallah 🌟','{"👍":[100005]}', NOW() - INTERVAL 8 DAY),
(2,100005,'usman_t', 'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Wa alaikum salam. Great initiative. Reminder: town hall next Friday at Emir''s Palace grounds.','{"📢":[100002]}', NOW() - INTERVAL 8 DAY + INTERVAL 10 MINUTE),
(2,100002,'zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','Will it be live streamed? Not everyone can attend physically.',NULL, NOW() - INTERVAL 8 DAY + INTERVAL 15 MINUTE),
(2,100005,'usman_t', 'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Yes! The LGA secretariat confirmed it will be on this platform.','{"🎉":[100002]}', NOW() - INTERVAL 8 DAY + INTERVAL 20 MINUTE),
(2,100002,'zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','Excellent. The Daura Heritage Festival is coming up too — Oct 10–12. Who is going?','{"🙋":[100005]}', NOW() - INTERVAL 5 DAY),
(2,100005,'usman_t', 'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','I''m going with my family. The Durbar is the highlight every year 🏇',NULL, NOW() - INTERVAL 5 DAY + INTERVAL 10 MINUTE),
(2,100002,'zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','The archaeology exhibition is new this year. Very excited to see the ancient finds.',NULL, NOW() - INTERVAL 5 DAY + INTERVAL 20 MINUTE),
(2,100005,'usman_t', 'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','True history. Daura is the oldest of the Hausa states. We must preserve it.','{"🤝":[100002]}', NOW() - INTERVAL 5 DAY + INTERVAL 33 MINUTE),
(2,100002,'zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','Good morning Daura 🌅 Anyone know if the new borehole near Yan Gandu ward is working?',NULL, NOW() - INTERVAL 2 DAY),
(2,100005,'usman_t', 'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Yes! Tested it yesterday. Clean water alhamdulillah. RUWASSA did a good job this time.','{"🙏":[100002]}', NOW() - INTERVAL 2 DAY + INTERVAL 15 MINUTE);

-- LGA 3 — Funtua (8 messages)
INSERT INTO lga_chat_messages (lga_id, user_id, user_name, avatar_url, text, reactions, created_at) VALUES
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Salam Funtua! Good to have our own community space 🌾','{}', NOW() - INTERVAL 6 DAY),
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Agricultural fair registration closes September 30th! Don''t miss it.','{}', NOW() - INTERVAL 5 DAY),
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Cotton prices are good this season. Traders from Kano coming in large numbers.','{}', NOW() - INTERVAL 4 DAY),
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','New borehole network — 9 boreholes in Funtua. Which wards are getting them? Anyone know?',NULL, NOW() - INTERVAL 3 DAY),
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Found out: Sabon Gari, Kofar Yandaka, Unguwar Rimi, and Karofi wards confirmed.','{"👍":[]}', NOW() - INTERVAL 3 DAY + INTERVAL 1 HOUR),
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','KTARDA extension officers arrived in Funtua ward today. Improved groundnut seeds available.',NULL, NOW() - INTERVAL 2 DAY),
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Anyone attended the extension training? Worth it?',NULL, NOW() - INTERVAL 1 DAY),
(3,100003,'kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Morning Funtua 🌅 Trade fair in 3 weeks. Let''s make Funtua proud!','{"🎉":[]}', NOW() - INTERVAL 6 HOUR);

-- LGA 4 — Malumfashi (8 messages)
INSERT INTO lga_chat_messages (lga_id, user_id, user_name, avatar_url, text, reactions, created_at) VALUES
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Salam Malumfashi people! 🎉','{"👋":[]}', NOW() - INTERVAL 5 DAY),
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','The textile mill news is massive! 800 jobs — Malumfashi is back!','{"🔥":[]}', NOW() - INTERVAL 4 DAY),
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Do you need to be a Malumfashi indigene to apply? The ad says yes.',NULL, NOW() - INTERVAL 4 DAY + INTERVAL 10 MINUTE),
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Confirmed: you need LGA indigene certificate. Get it from the local government secretariat.','{"✅":[]}', NOW() - INTERVAL 4 DAY + INTERVAL 50 MINUTE),
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Applications close August 31st. Less than 2 weeks left. Move fast!','{"⚡":[]}', NOW() - INTERVAL 3 DAY),
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Water project update: Sabuwa ward borehole commissioned. Solar pump working fine.','{"💧":[]}', NOW() - INTERVAL 2 DAY),
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Malumfashi youth should attend the KatsinaTech training. Free and certificates given.',NULL, NOW() - INTERVAL 1 DAY),
(4,100005,'usman_t','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY','Good morning Malumfashi 🌄 Another day to build our community. Let''s go!',NULL, NOW() - INTERVAL 8 HOUR);

-- LGA 5 — Dutsin-Ma (7 messages)
INSERT INTO lga_chat_messages (lga_id, user_id, user_name, avatar_url, text, reactions, created_at) VALUES
(5,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Visiting Dutsin-Ma for the cooperative fair. Beautiful town mashallah.','{"❤️":[]}', NOW() - INTERVAL 3 DAY),
(5,100003,'kabiru_i',  'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Welcome! FUDMA campus is very impressive. The expansion project will make it even better.',NULL, NOW() - INTERVAL 3 DAY + INTERVAL 10 MINUTE),
(5,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Youth employment programme here is a good initiative. 1,200 apprenticeships!','{"💪":[]}', NOW() - INTERVAL 3 DAY + INTERVAL 30 MINUTE),
(5,100003,'kabiru_i',  'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Registration is open at the LGA secretariat. Trades include electrical and phone repair.',NULL, NOW() - INTERVAL 3 DAY + INTERVAL 41 MINUTE),
(5,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Which trade is most in demand here? Asking for a young family member.',NULL, NOW() - INTERVAL 2 DAY),
(5,100003,'kabiru_i',  'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','Phone repair and tailoring fill up fastest. Electrical is also popular. Apply early.','{"👍":[100001]}', NOW() - INTERVAL 2 DAY + INTERVAL 20 MINUTE),
(5,100001,'abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','Jazakallahu khairan. He will apply for electrical. 🙏','{"🤲":[100003]}', NOW() - INTERVAL 2 DAY + INTERVAL 33 MINUTE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO notifications (user_id, category, priority, title, body, actor_name, actor_avatar_url, link_to, is_read, created_at) VALUES

-- Official — breaking news (all users)
(100001,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',NULL,NULL,'/news/meningitis-vaccination-statewide',0, NOW() - INTERVAL 3 DAY),
(100002,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',NULL,NULL,'/news/meningitis-vaccination-statewide',1, NOW() - INTERVAL 3 DAY),
(100003,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',NULL,NULL,'/news/meningitis-vaccination-statewide',0, NOW() - INTERVAL 3 DAY),
(100004,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',NULL,NULL,'/news/meningitis-vaccination-statewide',1, NOW() - INTERVAL 3 DAY),
(100005,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',NULL,NULL,'/news/meningitis-vaccination-statewide',0, NOW() - INTERVAL 3 DAY),

-- Official — headline
(100001,'Official','normal','📰 Headline: Governor''s Q2 Address','₦12 billion infrastructure budget on track. Read the full address.',NULL,NULL,'/news/gubernatorial-quarterly-address',0, NOW() - INTERVAL 1 DAY),
(100003,'Official','normal','📰 Headline: Governor''s Q2 Address','₦12 billion infrastructure budget on track. Read the full address.',NULL,NULL,'/news/gubernatorial-quarterly-address',0, NOW() - INTERVAL 1 DAY),
(100005,'Official','normal','📰 Headline: Governor''s Q2 Address','₦12 billion infrastructure budget on track. Read the full address.',NULL,NULL,'/news/gubernatorial-quarterly-address',0, NOW() - INTERVAL 1 DAY),

-- Official — LGA-specific news
(100001,'Official','normal','New Katsina LGA News','14 road projects complete ahead of schedule in Katsina LGA.',NULL,NULL,'/news/katsina-road-completion',1, NOW() - INTERVAL 7 DAY),
(100004,'Official','normal','New Katsina LGA News','14 road projects complete ahead of schedule in Katsina LGA.',NULL,NULL,'/news/katsina-road-completion',0, NOW() - INTERVAL 7 DAY),
(100002,'Official','normal','New Daura LGA News','Daura International Heritage Festival returns October 10–12.',NULL,NULL,'/news/daura-heritage-festival-2025',0, NOW() - INTERVAL 3 DAY),
(100005,'Official','normal','New Malumfashi LGA News','800 jobs at Malumfashi Textile Mill — recruitment begins October.',NULL,NULL,'/news/malumfashi-textile-revival',0, NOW() - INTERVAL 2 DAY),

-- Community — reel likes
(100001,'Community','normal','zainab_u liked your reel','zainab_u liked your reel: "Sunrise over Katsina city 🌅"','zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','/reels',1, NOW() - INTERVAL 6 DAY + INTERVAL 11 MINUTE),
(100001,'Community','normal','kabiru_i liked your reel','kabiru_i liked your reel: "Sunrise over Katsina city 🌅"','kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','/reels',1, NOW() - INTERVAL 6 DAY + INTERVAL 23 MINUTE),
(100001,'Community','normal','maryam_s liked your reel','maryam_s liked your reel: "Sunrise over Katsina city 🌅"','maryam_s','https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','/reels',0, NOW() - INTERVAL 6 DAY + INTERVAL 35 MINUTE),
(100002,'Community','normal','abdullahi_m liked your reel','abdullahi_m liked your reel: "Daura — the cradle of Hausa civilisation 🏰"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',0, NOW() - INTERVAL 4 DAY + INTERVAL 8 MINUTE),
(100002,'Community','normal','maryam_s liked your reel','maryam_s liked your reel: "Sisters in agriculture 🌾"','maryam_s','https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI','/reels',0, NOW() - INTERVAL 1 DAY + INTERVAL 3 MINUTE),
(100003,'Community','normal','abdullahi_m liked your reel','abdullahi_m liked your reel: "Cotton harvest season has arrived 🌿"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',1, NOW() - INTERVAL 3 DAY),
(100005,'Community','normal','abdullahi_m liked your reel','abdullahi_m liked your reel: "The old textile mill days are coming back! 🎉"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',0, NOW() - INTERVAL 1 DAY + INTERVAL 15 MINUTE),
(100005,'Community','normal','zainab_u liked your reel','zainab_u liked your reel: "Malumfashi to the world 🗺️"','zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','/reels',0, NOW() - INTERVAL 12 HOUR),

-- Community — reel comments
(100001,'Community','normal','zainab_u commented on your reel','zainab_u: "Subhanallah! Katsina is so beautiful 🌅"','zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','/reels',1, NOW() - INTERVAL 6 DAY + INTERVAL 13 MINUTE),
(100001,'Community','normal','kabiru_i commented on your reel','kabiru_i: "Makes me miss home, I''m in Funtua 😂"','kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','/reels',0, NOW() - INTERVAL 5 DAY + INTERVAL 62 MINUTE),
(100002,'Community','normal','abdullahi_m commented on your reel','abdullahi_m: "Daura is historic wallahi. Every Nigerian should visit 🏰"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',1, NOW() - INTERVAL 4 DAY + INTERVAL 2 MINUTE),
(100005,'Community','normal','abdullahi_m commented on your reel','abdullahi_m: "800 jobs is massive wallahi. Katsina is moving!"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',0, NOW() - INTERVAL 1 DAY + INTERVAL 10 MINUTE),

-- Community — new reel from subscribed author
(100002,'Community','normal','abdullahi_m posted a new reel','abdullahi_m: "Proud to be Katsina! Our governor is working hard 💪"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',0, NOW() - INTERVAL 3 DAY + INTERVAL 2 MINUTE),
(100003,'Community','normal','abdullahi_m posted a new reel','abdullahi_m: "Proud to be Katsina! Our governor is working hard 💪"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',1, NOW() - INTERVAL 3 DAY + INTERVAL 2 MINUTE),
(100004,'Community','normal','abdullahi_m posted a new reel','abdullahi_m: "Proud to be Katsina! Our governor is working hard 💪"','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',0, NOW() - INTERVAL 3 DAY + INTERVAL 2 MINUTE),
(100001,'Community','normal','zainab_u posted a new reel','zainab_u: "Sisters in agriculture! 🌾"','zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','/reels',1, NOW() - INTERVAL 2 DAY + INTERVAL 3 MINUTE),
(100001,'Community','normal','kabiru_i posted a new reel','kabiru_i: "The youth of Katsina are ready 💯"','kabiru_i','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU','/reels',0, NOW() - INTERVAL 1 DAY + INTERVAL 2 MINUTE),

-- Security Alert — login notifications
(100001,'Security Alert','normal','New login to your account','Your account was accessed from a new device in Katsina. If this wasn''t you, change your password.',NULL,NULL,'/settings',1, NOW() - INTERVAL 5 DAY),
(100002,'Security Alert','normal','New login to your account','Your account was accessed from a new device in Daura. If this wasn''t you, change your password.',NULL,NULL,'/settings',1, NOW() - INTERVAL 4 DAY),
(100003,'Security Alert','normal','New login to your account','New sign-in detected for your KTG Connect account.',NULL,NULL,'/settings',0, NOW() - INTERVAL 3 DAY),

-- Event — community events
(100001,'Event','normal','Katsina LGA Town Hall — Friday 10am','Monthly community meeting at LGA Secretariat main hall. All residents welcome.',NULL,NULL,'/news',0, NOW() - INTERVAL 2 DAY),
(100002,'Event','normal','Daura Heritage Festival — Oct 10–12','Official preview and schedule for the Daura International Heritage Festival.',NULL,NULL,'/news/daura-heritage-festival-2025',0, NOW() - INTERVAL 3 DAY),
(100003,'Event','normal','Funtua Agricultural Fair — Registrations Close Sep 30','Last chance to register as an exhibitor for the 12th Annual Funtua Agric Fair.',NULL,NULL,'/news/funtua-agricultural-fair',0, NOW() - INTERVAL 5 HOUR),
(100005,'Event','normal','Malumfashi Job Fair — September 15','Youth employment briefing for Malumfashi Textile Mill positions. Venue: LGA Secretariat Hall.',NULL,NULL,'/news/malumfashi-textile-revival',0, NOW() - INTERVAL 1 DAY),

-- Community — subscription confirmations
(100002,'Community','normal','abdullahi_m subscribed to your reels','abdullahi_m will be notified when you post new reels.','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',1, NOW() - INTERVAL 2 DAY),
(100001,'Community','normal','zainab_u subscribed to your reels','zainab_u will be notified when you post new reels.','zainab_u','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k','/reels',0, NOW() - INTERVAL 1 DAY),
(100003,'Community','normal','abdullahi_m subscribed to your reels','abdullahi_m will be notified when you post new reels.','abdullahi_m','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs','/reels',0, NOW() - INTERVAL 3 DAY);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. BANNED WORDS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO banned_words (word) VALUES ('testslur'),('badword1'),('badword2'),('spamword');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. PLATFORM SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO platform_settings (`key`, `value`) VALUES
  ('maintenance_mode','0'),
  ('allow_registrations','1'),
  ('chat_enabled','1'),
  ('reels_enabled','1'),
  ('adverts_enabled','1')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
-- Counts
--   Admins:        2   (super_admin + admin)
--   Citizens:      5   (Katsina ×2, Daura, Funtua, Malumfashi)
--   News:         22   (4 all-LGA · 6 grouped · 11 LGA-specific · 1 draft)
--   Adverts:      18   (banner ×7 · interstitial ×3 · news ×3 · feed ×3 · paused/expired ×2)
--   Reels:        13   (citizens ×10 · admin ×3)
--   Reel likes:   22
--   Reel comments:20
--   Subscriptions:13
--   Chat msgs:    45   (Katsina·Daura·Funtua·Malumfashi·Dutsin-Ma)
--   Notifications:40+  (Official·Community·Security·Event)
--
-- Credentials
--   Super admin   aliyu@ktgconnect.com    Admin@1234
--   Admin         fatima@ktgconnect.com   Admin@1234
--   Citizen 1     abdullahi@ktg.test      Citizen@1234   Katsina
--   Citizen 2     zainab@ktg.test         Citizen@1234   Daura
--   Citizen 3     kabiru@ktg.test         Citizen@1234   Funtua
--   Citizen 4     maryam@ktg.test         Citizen@1234   Katsina
--   Citizen 5     usman@ktg.test          Citizen@1234   Malumfashi
--
-- ⚠  Delete server/seed.sql before going to production.
