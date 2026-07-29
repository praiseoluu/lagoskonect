<?php
/**
 * Lagos Konect — End-to-End Test Data Seed
 * =========================================
 * ⚠  DEVELOPMENT / STAGING USE ONLY — delete before production.
 *
 * Usage (CLI): php server/seed.php
 * Usage (web): GET /server/seed.php
 *
 * LGAs are NOT touched — assumes they are already seeded.
 *
 * Test credentials
 * ────────────────
 * Super admin  superadmin@lagkonnect.com   Admin@1234
 * Admin        admin@lagkonnect.com        Admin@1234
 * Citizen 1    emeka@lag.test              Citizen@1234   Alimosho (West)
 * Citizen 2    fatima@lag.test             Citizen@1234   Surulere (Central)
 * Citizen 3    taiwo@lag.test              Citizen@1234   Ikorodu (East)
 * Citizen 4    ngozi@lag.test              Citizen@1234   Lagos Island (Central)
 * Citizen 5    babatunde@lag.test          Citizen@1234   Badagry (West)
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '1');
require_once __DIR__ . '/config/database.php';

$db = Database::connect();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function q(PDO $db, string $sql, array $p = []): void { $db->prepare($sql)->execute($p); }
function h(string $pw): string { return password_hash($pw, PASSWORD_BCRYPT); }
function ts(int $offset = 0): string { return date('Y-m-d H:i:s', time() + $offset); }

$W = fn(string $s) => print($s . "\n");

// ── Truncate (LGAs preserved) ──────────────────────────────────────────────
$W('Truncating…');
$db->exec('SET FOREIGN_KEY_CHECKS=0');
foreach ([
    'reel_subscriptions','reel_reports','reel_comments','reel_likes',
    'reel_lga_targets','notifications','chat_reports','lga_chat_messages',
    'chat_last_read','advert_lga_targets','adverts','news_lga_targets',
    'news','reels','users','admins','banned_words',
] as $t) { $db->exec("TRUNCATE TABLE `{$t}`"); }
$db->exec('SET FOREIGN_KEY_CHECKS=1');

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADMINS
// ─────────────────────────────────────────────────────────────────────────────
$W('Admins…');
$ap = h('Admin@1234');
q($db,'INSERT INTO admins (id,name,email,password,role,handle,status) VALUES (?,?,?,?,?,?,?)',
  [100001,'Chidi Okafor','superadmin@lagkonnect.com',$ap,'super_admin','chidi_o','active']);
q($db,'INSERT INTO admins (id,name,email,password,role,handle,status) VALUES (?,?,?,?,?,?,?)',
  [100002,'Blessing Eze','admin@lagkonnect.com',$ap,'admin','blessing_e','active']);

// ─────────────────────────────────────────────────────────────────────────────
// 2. CITIZENS
// [id, name, username, email, phone, gender, lga_id, lga_name, city, region, dob, avatar]
// ─────────────────────────────────────────────────────────────────────────────
$W('Citizens…');
$cp = h('Citizen@1234');
$citizens = [
  //  id      name                  uname        email                 phone              gender  lgaId  lgaName        city        region     dob           avatar
  [100001,'Chukwuemeka Obi',    'emeka_o',   'emeka@lag.test',    '+2348031234001','male',     3,'Alimosho',    'Lagos',    'west',    '1992-04-15','https://picsum.photos/id/1005/200/200.jpg'],
  [100002,'Fatima Bello',       'fatima_b',  'fatima@lag.test',   '+2348031234002','female',  15,'Surulere',    'Lagos',    'central', '1996-08-22','https://picsum.photos/id/1011/200/200.jpg'],
  [100003,'Taiwo Adeyemi',      'taiwo_a',   'taiwo@lag.test',    '+2348031234003','male',    18,'Ikorodu',     'Ikorodu',  'east',    '1990-01-30','https://picsum.photos/id/1012/200/200.jpg'],
  [100004,'Ngozi Eze',          'ngozi_e',   'ngozi@lag.test',    '+2348031234004','female',  13,'Lagos Island','Lagos',    'central', '1998-11-05','https://picsum.photos/id/1027/200/200.jpg'],
  [100005,'Babatunde Salami',   'baba_s',    'babatunde@lag.test','+2348031234005','male',     5,'Badagry',     'Badagry',  'west',    '1994-06-18','https://picsum.photos/id/1074/200/200.jpg'],
];
$us = $db->prepare('INSERT INTO users (id,name,username,email,phone,gender,password,lga_id,lga_name,region,
  city,state,dob,avatar_url,role,is_verified,status,has_seen_welcome,
  notif_official,notif_community,notif_lga_alerts,notif_new_login,
  notif_reel_likes,notif_reel_comments,notif_breaking_news,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
foreach ($citizens as [$id,$name,$uname,$email,$phone,$gender,$lgaId,$lgaName,$city,$region,$dob,$avatar]) {
  $us->execute([$id,$name,$uname,$email,$phone,$gender,$cp,$lgaId,$lgaName,$region,
    $city,'Lagos State',$dob,$avatar,'citizen',1,'active',1,1,1,1,1,1,1,1,ts()]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NEWS
// LGA groupings (all 20 covered):
//   W  – Lagos West  : 1,2,3,4,5,6,7,8,9,10
//   C  – Lagos Central: 11,12,13,14,15
//   E  – Lagos East  : 16,17,18,19,20
//   WM – Mainland West cluster  : 1,3,7,8     (Agege, Alimosho, Ikeja, Mushin)
//   IS – Island/coastal cluster : 11,12,13,17  (Apapa, Eti-Osa, Lagos Island, Ibeju-Lekki)
//   OE – Outer East cluster     : 16,18,20     (Epe, Ikorodu, Shomolu)
// ─────────────────────────────────────────────────────────────────────────────
$W('News…');

$newsStmt = $db->prepare('INSERT INTO news
  (id,slug,title,summary,body,category,breaking,is_headline,target_all_lgas,status,
   image_url,author_id,lga_id,lga_name,delivery_push,delivery_email,published_at,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

$nid = 100001;
$news = [
  // ── ALL-LGA articles (4) ─────────────────────────────────────────────────
  [$nid++,'governor-lga-empowerment-fund',
   'Governor Sanwo-Olu Launches ₦10 Billion LGA Empowerment Fund',
   '5,000 residents across all 20 Lagos LGAs to receive business starter grants.',
   '<p>Governor Babajide Sanwo-Olu today unveiled a ₦10 billion empowerment fund at Lagos House, Alausa. Each of the 20 LGAs will receive allocations for business starter grants, vocational training, and market infrastructure. Disbursements begin Q3. Citizens can register via their LGA Secretariat or through the Lagos Konect platform.</p>',
   'Economy',1,1,1,'published','https://picsum.photos/id/180/800/450.jpg',100001,null,null,ts(-86400*4)],

  [$nid++,'lagos-free-health-screening',
   'Free Health Screening for 1 Million Lagos Residents — Starts Monday',
   'Lagos State Ministry of Health deploys mobile clinics to all 20 LGAs.',
   '<p>The Lagos State Ministry of Health has announced a state-wide free health screening exercise covering blood pressure, diabetes, HIV, and malaria. Mobile clinics will visit every LGA headquarters and major bus terminals. Citizens aged 18 and above are strongly encouraged to participate. The exercise runs for four weeks across all 20 LGAs.</p>',
   'Health',1,0,1,'published','https://picsum.photos/id/509/800/450.jpg',100002,null,null,ts(-86400*3)],

  [$nid++,'lagos-scholarship-2025',
   'Lagos State Scholarship Board Opens 2025/2026 Applications — Deadline 30 Sep',
   'Scholarships for undergraduate, postgraduate, and technical education open to all Lagos indigenes.',
   '<p>The Lagos State Scholarship Board has opened applications for the 2025/2026 academic session. Awards cover universities, polytechnics, colleges of education, and vocational programmes. Minimum requirement: five WAEC/NECO credits including English and Mathematics. Apply at the Board portal or any LGA Secretariat before September 30.</p>',
   'Education',0,0,1,'published','https://picsum.photos/id/20/800/450.jpg',100002,null,null,ts(-86400*2)],

  [$nid++,'lagos-traffic-management-update',
   'Lagos State Releases New Traffic Management Plan for All LGAs',
   'LASTMA and LAMATA unveil coordinated road decongestion strategy.',
   '<p>The Lagos State Traffic Management Authority (LASTMA) and Lagos Metropolitan Area Transport Authority (LAMATA) have jointly released a comprehensive traffic management plan targeting the 20 most congested corridors across all LGAs. The plan includes dedicated BRT extensions, no-parking enforcement zones, and new pedestrian bridges. Implementation begins in phases across all senatorial districts.</p>',
   'Infrastructure',0,1,1,'published','https://picsum.photos/id/365/800/450.jpg',100001,null,null,ts(-86400*1)],

  // ── GROUPED articles ─────────────────────────────────────────────────────
  [$nid++,'west-lga-road-rehabilitation',
   'Lagos West LGAs Get ₦6 Billion Road Rehabilitation Package',
   'Agege, Alimosho, Ikeja, Mushin, and surrounding LGAs to benefit from major road upgrade.',
   '<p>The Lagos State Ministry of Works has approved a ₦6 billion road rehabilitation programme for the ten LGAs in Lagos West Senatorial District. Key corridors include the Agege Motor Road, Oshodi–Apapa Expressway service roads, and the Badagry Express expansion. Work is expected to begin in Q4 and run through to Q2 next year.</p>',
   'Infrastructure',0,0,0,'published','https://picsum.photos/id/317/800/450.jpg',100001,null,null,ts(-86400*5)],

  [$nid++,'island-coastal-flood-alert',
   'Flood Alert: Island and Coastal LGAs Urged to Prepare — Yellow Watch Issued',
   'Apapa, Eti-Osa, Lagos Island, and Ibeju-Lekki on yellow flood watch this week.',
   '<p>The Lagos State Emergency Management Agency (LASEMA) has issued a yellow flood watch for four coastal LGAs as the Atlantic swell season peaks. Residents are urged to clear drainage channels, avoid building on waterways, and keep emergency numbers on hand. NiMet projects above-average rainfall through mid-August. LASEMA hotline: 112.</p>',
   'Security',1,0,0,'published','https://picsum.photos/id/252/800/450.jpg',100001,null,null,ts(-3600*16)],

  [$nid++,'east-lga-agric-extension',
   'Agricultural Extension Officers Deployed to Epe, Ikorodu, and Shomolu',
   'Lagos State ADP sends fresh cohort of farm advisers to outer East LGAs.',
   '<p>The Lagos State Agricultural Development Programme (ADP) has deployed a new cohort of extension officers to three eastern LGAs. Each officer supports up to 150 farming households. Training on improved cassava varieties, poultry management, and soil conservation begins this week. This initiative is part of the Lagos Food Security 2025 action plan.</p>',
   'Agriculture',0,0,0,'published','https://picsum.photos/id/145/800/450.jpg',100001,null,null,ts(-86400*6)],

  [$nid++,'mainland-youth-employment',
   'Youth Employment Initiative for Mainland West — 2,000 Apprenticeship Places',
   'Agege, Alimosho, Ikeja, and Mushin to benefit from federal-state skills programme.',
   '<p>Under the Federal Government\'s NSIP Youth Employment Programme in partnership with Lagos State, 2,000 apprenticeship placements have been allocated to four mainland LGAs. Trades covered include electrical installation, welding, fashion design, and ICT. Registration opens at each LGA Secretariat from Monday morning.</p>',
   'Economy',0,0,0,'published','https://picsum.photos/id/96/800/450.jpg',100002,null,null,ts(-86400*4)],

  // ── LGA-SPECIFIC articles (12) ───────────────────────────────────────────
  [$nid++,'ikeja-road-projects-complete',
   '12 Road Projects Reach Completion Ahead of Schedule in Ikeja LGA',
   '38 km of roads across Ikeja now rehabilitated; 4 more projects underway.',
   '<p>The Lagos State Ministry of Works confirmed that 12 of 16 road rehabilitation projects in Ikeja LGA are complete, covering Allen Avenue, Toyin Street, and CMD Road corridors. The remaining four projects are in Oregun and Ojodu wards and are expected to wrap up by October. Residents have commended the reduced travel times.</p>',
   'Infrastructure',1,0,0,'published','https://picsum.photos/id/317/800/450.jpg',100001,7,'Ikeja',ts(-86400*7)],

  [$nid++,'badagry-slave-route-heritage',
   'Badagry Slave Route Heritage Festival Returns — November 14–16',
   'Annual festival celebrating Atlantic heritage returns with cultural exhibitions and diaspora guests.',
   '<p>The Badagry Slave Route Heritage Festival returns November 14–16 at the Badagry Heritage Museum. This year\'s edition features a new exhibition on the trans-Atlantic slave trade, a cultural regatta on the Badagry Creek, and a diaspora evening welcoming guests from Brazil, the UK, and the United States. Admission is free for Lagos residents with valid ID.</p>',
   'Culture',0,0,0,'published','https://picsum.photos/id/484/800/450.jpg',100002,5,'Badagry',ts(-86400*3)],

  [$nid++,'surulere-national-stadium-upgrade',
   'National Stadium Surulere Gets ₦2.5 Billion Upgrade — Works Begin October',
   'Federal Government approves major renovation of track, stands, and facilities.',
   '<p>The Federal Ministry of Youth and Sports has approved a ₦2.5 billion renovation of the National Stadium in Surulere. Works will cover the athletics track resurfacing, VIP stands refurbishment, and upgrading of the pitch irrigation system. The stadium will remain partially open during works. Completion target is Q2 next year ahead of the Lagos 2026 sports festival.</p>',
   'Sports',0,0,0,'published','https://picsum.photos/id/122/800/450.jpg',100001,15,'Surulere',ts(-3600*5)],

  [$nid++,'ikorodu-rice-cooperative-expansion',
   'Ikorodu Rice Farmers Cooperative Expands — 1,200 Hectares Under Irrigation',
   'Lagos State co-funds dry-season farming infrastructure in Ikorodu.',
   '<p>The Lagos State Ministry of Agriculture has co-funded Phase 2 of the Ikorodu Fadama Rice Irrigation Scheme, bringing 1,200 hectares of farmland under perennial irrigation. Participating farmers will produce rice, maize, and vegetables year-round. The scheme is expected to benefit 3,000 farming households and reduce Lagos\'s dependency on out-of-state rice imports.</p>',
   'Agriculture',0,0,0,'published','https://picsum.photos/id/292/800/450.jpg',100002,18,'Ikorodu',ts(-86400*5)],

  [$nid++,'epe-resort-investment',
   'Epe Resort Corridor: ₦4.2 Billion Private Investment Secured',
   'Three new eco-resorts to create 600 jobs along the Epe waterfront.',
   '<p>The Lagos State Investment Promotion Agency (LASIPA) has announced that three private investors have committed ₦4.2 billion to develop eco-resorts along the Epe waterfront. The projects will collectively create 600 direct jobs in hospitality, boat transport, and artisanal fishing. Construction begins Q1 next year. The Lekki–Epe Expressway extension is a key enabler.</p>',
   'Economy',0,0,0,'published','https://picsum.photos/id/338/800/450.jpg',100002,16,'Epe',ts(-86400*1)],

  [$nid++,'ibeju-lekki-dangote-jobs',
   'Dangote Refinery Announces 800 Community Recruitment Openings in Ibeju-Lekki',
   'Ibeju-Lekki indigenes to be prioritised for entry-level and technical roles.',
   '<p>The Dangote Petroleum Refinery has announced 800 community recruitment openings targeting residents of Ibeju-Lekki LGA. Roles span security, logistics, catering, laboratory assistance, and basic technical operations. Minimum qualification for most roles is O\'Level. Applications open at the Ibeju-Lekki LGA Secretariat from Monday; deadline is August 31.</p>',
   'Economy',0,0,0,'published','https://picsum.photos/id/404/800/450.jpg',100001,17,'Ibeju-Lekki',ts(-3600*20)],

  [$nid++,'alimosho-market-renovation',
   'Alimosho Celebrates Completion of Egbeda Market Renovation',
   'Renovated market to serve 5,000 traders with improved sanitation and stalls.',
   '<p>The Alimosho Local Government Council formally commissioned the renovated Egbeda International Market on Saturday. The ₦320 million project, jointly funded by the LGA and Lagos State Government, upgrades 2,400 stalls, installs solar-powered street lights, and creates dedicated waste management bays. Over 5,000 traders are expected to return to the market by month-end.</p>',
   'Infrastructure',0,0,0,'published','https://picsum.photos/id/137/800/450.jpg',100001,3,'Alimosho',ts(-86400*3)],

  [$nid++,'lagos-island-eko-bridge-closure',
   '[DRAFT] Eko Bridge Partial Closure — Impact Assessment',
   'Awaiting final LASG engineering report before publication.',
   '<p>Draft — not approved for release.</p>',
   'Infrastructure',0,0,0,'draft',null,100002,13,'Lagos Island',null],
];

foreach ($news as $n) {
  $newsStmt->execute([
    $n[0],$n[1],$n[2],$n[3],$n[4],$n[5],$n[6],$n[7],$n[8],$n[9],
    $n[10],$n[11],$n[12],$n[13],1,0,$n[14] ?? null,ts(),
  ]);
}

// news_lga_targets (grouped + specific)
$nlt = $db->prepare('INSERT IGNORE INTO news_lga_targets (news_id, lga_id) VALUES (?,?)');
// Group W – Lagos West (news id 100005)
foreach ([1,2,3,4,5,6,7,8,9,10] as $l) $nlt->execute([100005,$l]);
// Group IS – Island/coastal (100006)
foreach ([11,12,13,17] as $l) $nlt->execute([100006,$l]);
// Group OE – Outer East (100007)
foreach ([16,18,20] as $l) $nlt->execute([100007,$l]);
// Group WM – Mainland West (100008)
foreach ([1,3,7,8] as $l) $nlt->execute([100008,$l]);
// LGA-specific
foreach ([
  [100009,7],[100010,5],[100011,15],[100012,18],
  [100013,16],[100014,17],[100015,3],[100016,13],
] as [$newsId,$lgaId]) $nlt->execute([$newsId,$lgaId]);

// ─────────────────────────────────────────────────────────────────────────────
// 4. ADVERTS
// ─────────────────────────────────────────────────────────────────────────────
$W('Adverts…');
$ad = $db->prepare('INSERT INTO adverts
  (id,title,advertiser,description,cta_label,cta_url,image_url,type,status,
   target_all_lgas,start_date,end_date,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');

$sDate = date('Y-m-d',strtotime('-7 days'));
$eDate = date('Y-m-d',strtotime('+60 days'));

$adverts = [
  // ── BANNER — all LGAs ────────────────────────────────────────────────────
  [100001,'Lagos State Agricultural Loan — Apply Before Planting Season',
   'Lagos State Employment Trust Fund (LSETF)',
   'Low-interest farming and food business loans for Lagos residents. Apply online or at your LGA.',
   'Apply Now','https://lagoskonect.com',
   'https://picsum.photos/id/292/800/400.jpg','banner','active',1,$sDate,$eDate],

  [100002,'UNILAG 2025/2026 Postgraduate Admissions Open',
   'University of Lagos',
   'Apply for full-time, part-time, and distance learning postgraduate programmes. Deadline October 15.',
   'Apply Now','https://lagoskonect.com',
   'https://picsum.photos/id/250/800/400.jpg','banner','active',1,
   date('Y-m-d',strtotime('-3 days')),date('Y-m-d',strtotime('+90 days'))],

  [100003,'MTN Lagos — Double Data Every Weekend',
   'MTN Nigeria',
   'Enjoy 2× data on all recharge amounts every Saturday and Sunday. Dial *131*1# to activate.',
   'Activate Now','https://lagoskonect.com',
   'https://picsum.photos/id/96/800/400.jpg','banner','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+30 days'))],

  [100004,'Invest in Lagos Free Trade Zone — Lekki',
   'Lagos State Free Trade Zone Authority',
   'Industrial land with tax holidays, full infrastructure, and port access. Download prospectus.',
   'Download Prospectus','https://lagoskonect.com',
   'https://picsum.photos/id/338/800/400.jpg','banner','active',1,
   date('Y-m-d',strtotime('-14 days')),date('Y-m-d',strtotime('+45 days'))],

  // ── BANNER — LGA-specific ────────────────────────────────────────────────
  [100005,'Ikeja City Mall — Eid Shopping Festival',
   'Ikeja City Mall Management',
   'Up to 40% off at over 100 stores this Eid season. Free parking for Lagos Konect users.',
   'Get Directions','https://lagoskonect.com',
   'https://picsum.photos/id/404/800/400.jpg','banner','active',0,
   date('Y-m-d',strtotime('-2 days')),date('Y-m-d',strtotime('+28 days'))],

  [100006,'Badagry Heritage Festival 2025 — Book Your Stay',
   'Badagry Beach Hotel & Resorts',
   'Official accommodation partner. Family packages from ₦35,000/night. Book early.',
   'Book Now','https://lagoskonect.com',
   'https://picsum.photos/id/484/800/400.jpg','banner','active',0,
   date('Y-m-d'),date('Y-m-d',strtotime('+40 days'))],

  // ── BANNER — LGA group ───────────────────────────────────────────────────
  [100007,'Lagos Island Cooperative Microfinance — Join Today',
   'Lagos Island & Mainland Cooperative Credit Society',
   'Serving traders and SMEs in Apapa, Eti-Osa, Lagos Island, and Mainland. Low-rate loans.',
   'Join the Co-op','https://lagoskonect.com',
   'https://picsum.photos/id/145/800/400.jpg','banner','active',0,
   date('Y-m-d',strtotime('-5 days')),date('Y-m-d',strtotime('+55 days'))],

  // ── INTERSTITIAL — all LGAs ──────────────────────────────────────────────
  [100008,'Register to Vote — 2027 Governorship Election',
   'Independent National Electoral Commission (INEC)',
   'Continuous Voter Registration is ongoing. Visit your nearest INEC office or use the INEC portal.',
   'Register Online','https://lagoskonect.com',
   'https://picsum.photos/id/365/800/600.jpg','interstitial','active',1,
   date('Y-m-d',strtotime('-10 days')),date('Y-m-d',strtotime('+180 days'))],

  [100009,'Lagos State Road Safety Campaign — Wear Your Seatbelt',
   'Lagos State Traffic Management Authority (LASTMA)',
   'Road crashes are preventable. Always buckle up and obey traffic signals.',
   'Learn More','https://lagoskonect.com',
   'https://picsum.photos/id/509/800/600.jpg','interstitial','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+120 days'))],

  // ── INTERSTITIAL — LGA group ─────────────────────────────────────────────
  [100010,'Lagos East Trade & Investment Forum — Epe, October 25–26',
   'Epe LGA Commerce & Industry Board',
   'The annual East Lagos Trade Forum connects investors with local businesses across 5 eastern LGAs.',
   'Register as Exhibitor','https://lagoskonect.com',
   'https://picsum.photos/id/429/800/600.jpg','interstitial','active',0,
   date('Y-m-d',strtotime('-1 day')),date('Y-m-d',strtotime('+25 days'))],

  // ── NEWS type — all LGAs ────────────────────────────────────────────────
  [100011,'Lagos State Health Insurance — Enrol Free Before October',
   'Lagos State Health Management Agency (LASHMA)',
   'All Lagos residents are entitled to enrol free. Deadline October 31.',
   'Enrol Now','https://lagoskonect.com',
   'https://picsum.photos/id/122/800/300.jpg','news','active',1,
   date('Y-m-d',strtotime('-4 days')),date('Y-m-d',strtotime('+35 days'))],

  [100012,'Glo Lagos — ₦200 Recharge Gets ₦500 Value',
   'Glo Mobile Nigeria',
   'Exclusive offer for Lagos subscribers. Recharge ₦200 and get ₦500 value till Sunday.',
   'Buy Airtime','https://lagoskonect.com',
   'https://picsum.photos/id/96/800/300.jpg','news','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+7 days'))],

  // ── NEWS type — LGA-specific ─────────────────────────────────────────────
  [100013,'Dangote Refinery Jobs — Apply Before August 31',
   'Dangote Petroleum Refinery & Petrochemicals Ltd',
   '800 positions open to Ibeju-Lekki indigenes. Download the application form at the LGA Secretariat.',
   'Download Form','https://lagoskonect.com',
   'https://picsum.photos/id/252/800/300.jpg','news','active',0,
   date('Y-m-d',strtotime('-2 days')),date('Y-m-d',strtotime('+14 days'))],

  // ── FEED type — all LGAs ────────────────────────────────────────────────
  [100014,'Airtel Lagos — 10GB for ₦1,000 Monthly Plan',
   'Airtel Nigeria',
   'Get 10GB valid for 30 days for ₦1,000. Dial *141*1# to activate on any Airtel line.',
   'Activate','https://lagoskonect.com',
   'https://picsum.photos/id/484/800/400.jpg','feed','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+30 days'))],

  [100015,'Lagos Teachers Recruitment — 3,000 Positions Available',
   'Lagos State Universal Basic Education Board (SUBEB)',
   'Teaching positions across all 20 LGAs. Minimum qualification: NCE. Apply at SUBEB office.',
   'Apply Now','https://lagoskonect.com',
   'https://picsum.photos/id/20/800/400.jpg','feed','active',1,
   date('Y-m-d',strtotime('-3 days')),date('Y-m-d',strtotime('+60 days'))],

  // ── FEED type — LGA group ────────────────────────────────────────────────
  [100016,'Lagos East Farmers\' Market — October 5',
   'Lagos East Agricultural Cooperative Union',
   'One-day market for farm produce in Epe, Ikorodu, Kosofe, Shomolu, and Ibeju-Lekki.',
   'Get Directions','https://lagoskonect.com',
   'https://picsum.photos/id/317/800/400.jpg','feed','active',0,
   date('Y-m-d',strtotime('-6 days')),date('Y-m-d',strtotime('+20 days'))],

  // ── PAUSED / EXPIRED for UI testing ─────────────────────────────────────
  [100017,'[Paused] Lagos Book Festival 2024',
   'Lagos State Library Board',
   'Annual book festival paused pending venue confirmation.',
   'Learn More','https://lagoskonect.com',
   null,'banner','paused',1,
   date('Y-m-d',strtotime('-60 days')),date('Y-m-d',strtotime('+30 days'))],

  [100018,'[Expired] Eid-el-Kabir Greetings 2024',
   'Government House Lagos',
   'Wishing all Lagos citizens Eid Mubarak.',
   null,'https://lagoskonect.com',
   'https://picsum.photos/id/122/800/400.jpg','banner','expired',1,
   date('Y-m-d',strtotime('-365 days')),date('Y-m-d',strtotime('-300 days'))],
];

foreach ($adverts as $a) {
  $ad->execute([...$a, ts()]);
}

// advert_lga_targets for non-all-lga ads
$alt = $db->prepare('INSERT IGNORE INTO advert_lga_targets (advert_id, lga_id) VALUES (?,?)');
foreach ([1,2,3,4,5,6,7,8,9,10] as $l) $alt->execute([100005,$l]); // Ikeja (West)
foreach ([2,7,8,9,10,25] as $l) $alt->execute([100006,$l]); // Badagry (West)
foreach ([11,12,13,14]    as $l) $alt->execute([100007,$l]); // Island group
foreach ([16,17,18,19,20] as $l) $alt->execute([100010,$l]); // East group
$alt->execute([100013,17]);                                    // Ibeju-Lekki specific
foreach ([16,17,18,19,20] as $l) $alt->execute([100016,$l]);  // East farmers

// ─────────────────────────────────────────────────────────────────────────────
// 5. REELS
// ─────────────────────────────────────────────────────────────────────────────
$W('Reels…');

$videos = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
];

$thumbs = [
  'https://picsum.photos/id/10/640/360.jpg',
  'https://picsum.photos/id/28/640/360.jpg',
  'https://picsum.photos/id/137/640/360.jpg',
  'https://picsum.photos/id/180/640/360.jpg',
  'https://picsum.photos/id/230/640/360.jpg',
  'https://picsum.photos/id/292/640/360.jpg',
  'https://picsum.photos/id/317/640/360.jpg',
  'https://picsum.photos/id/338/640/360.jpg',
  'https://picsum.photos/id/365/640/360.jpg',
  'https://picsum.photos/id/429/640/360.jpg',
  'https://picsum.photos/id/484/640/360.jpg',
  'https://picsum.photos/id/509/640/360.jpg',
  'https://picsum.photos/id/122/640/360.jpg',
];

$citizenAvatars = [
  100001=>'https://picsum.photos/id/1005/200/200.jpg',
  100002=>'https://picsum.photos/id/1011/200/200.jpg',
  100003=>'https://picsum.photos/id/1012/200/200.jpg',
  100004=>'https://picsum.photos/id/1027/200/200.jpg',
  100005=>'https://picsum.photos/id/1074/200/200.jpg',
];

// [reel_id, is_admin, lga_id, lga_name, target_all, caption, hashtags, author_id, author_uname, thumb_idx, video_idx, likes, comments, views, published_offset_sec]
$reels = [
  // ── Emeka (citizen, Alimosho LGA 3) ─────────────────────────────────────
  ['reel_001',0,3,'Alimosho',0,'Morning traffic on the Egbeda–Idimu road 🚗 This is Lagos! #Lagos #AlimoshoLGA #LagosTraffic',
   ['Lagos','AlimoshoLGA','LagosTraffic'],100001,'emeka_o',0,0,18,3,142,ts(-86400*7)],
  ['reel_002',0,null,null,1,'Proud to call Lagos home! The hustle is real but the reward is realer 💪 #Lagos #LagosLife',
   ['Lagos','LagosLife','Hustle'],100001,'emeka_o',3,1,9,1,67,ts(-86400*3)],

  // ── Fatima (citizen, Surulere LGA 15) ───────────────────────────────────
  ['reel_003',0,15,'Surulere',0,'National Stadium Surulere — a Lagos icon getting its glow-up! 🏟️ #Surulere #Lagos #Sports',
   ['Surulere','Lagos','Sports'],100002,'fatima_b',1,2,11,2,88,ts(-86400*5)],
  ['reel_004',0,null,null,1,'Women in business! The women of Lagos are feeding the economy 💼🌺 #WomenInBusiness #Lagos',
   ['WomenInBusiness','Lagos','LagosWomen'],100002,'fatima_b',4,3,24,4,201,ts(-86400*2)],

  // ── Taiwo (citizen, Ikorodu LGA 18) ─────────────────────────────────────
  ['reel_005',0,18,'Ikorodu',0,'Rice harvest season in Ikorodu! 🌾 Our farmers are the backbone of Lagos food supply. #Ikorodu #Agriculture',
   ['Ikorodu','Agriculture','FarmLagos'],100003,'taiwo_a',2,4,7,1,53,ts(-86400*4)],
  ['reel_006',0,null,null,1,'The youth of Lagos East are rising! Education + hustle = results 💯 #LagosEast #EastLagos',
   ['LagosEast','EastLagos','YouthRising'],100003,'taiwo_a',5,0,14,2,109,ts(-86400*1)],

  // ── Ngozi (citizen, Lagos Island LGA 13) ────────────────────────────────
  ['reel_007',0,13,'Lagos Island',0,'Lagos Island at sunset — there is nowhere like this on earth ❤️ #LagosIsland #Lagos #Eko',
   ['LagosIsland','Lagos','Eko'],100004,'ngozi_e',6,1,6,1,44,ts(-86400*6)],
  ['reel_008',0,12,'Eti-Osa',0,'Victoria Island at night ✨ The heartbeat of Nigeria\'s economy. #VictoriaIsland #Lagos #EtiOsa',
   ['VictoriaIsland','Lagos','EtiOsa'],100004,'ngozi_e',10,2,8,0,61,ts(-86400*3)],

  // ── Babatunde (citizen, Badagry LGA 5) ──────────────────────────────────
  ['reel_009',0,5,'Badagry',0,'Badagry Slave Route — history every Nigerian must know 🕊️ #Badagry #History #NeverForget',
   ['Badagry','History','NeverForget'],100005,'baba_s',7,3,21,3,178,ts(-86400*2)],
  ['reel_010',0,null,null,1,'From Badagry to the world — we are on the map! 🗺️ #Lagos #Badagry #WestLagos',
   ['Lagos','Badagry','WestLagos'],100005,'baba_s',11,4,5,1,39,ts(-3600*14)],

  // ── Admin reels (is_admin=1) ─────────────────────────────────────────────
  ['reel_011',1,null,null,1,'Lagos Konect official: Lagos 2025 development highlights 🏛️ #LagosKonect #LagosGovt',
   ['LagosKonect','LagosGovt','Development'],100001,'chidi_o',8,0,45,6,512,ts(-86400*10)],
  ['reel_012',1,7,'Ikeja',0,'Ikeja Road Rehabilitation Progress — official update from the Ministry of Works 🚧 #Ikeja #Infrastructure',
   ['Infrastructure','Ikeja','Works'],100001,'chidi_o',9,1,32,4,387,ts(-86400*7)],
  ['reel_013',1,null,null,1,'Lagos Konect turns 1 year! Thank you Lagos State 🎂 #LagosKonect #Anniversary #Lagos',
   ['LagosKonect','Anniversary','Lagos'],100001,'chidi_o',12,2,58,8,643,ts(-86400*5)],
];

$rStmt = $db->prepare('INSERT INTO reels
  (reel_id,lga_id,lga_name,target_all_lgas,is_admin,caption,hashtags,video_url,cloudinary_id,
   thumbnail_url,views,likes,comment_count,author_id,author_name,author_handle,
   author_avatar_url,status,allow_comments,published_at,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

foreach ($reels as $r) {
  [$rid,$isAdmin,$lgaId,$lgaName,$targetAll,$caption,$hashtags,
   $authorId,$authorUname,$thumbIdx,$vidIdx,$likes,$commentCount,$views,$pubAt] = $r;
  $rStmt->execute([
    $rid,$lgaId,$lgaName,$targetAll,$isAdmin,$caption,json_encode($hashtags),
    $videos[$vidIdx % count($videos)],'seed/sample_'.$thumbIdx.'.mp4',
    $thumbs[$thumbIdx % count($thumbs)],
    $views,$likes,$commentCount,
    $authorId,$authorUname,$authorUname,$citizenAvatars[$authorId] ?? null,
    'published',1,$pubAt,ts(),
  ]);
}

// reel_lga_targets for LGA-specific reels
$rlt = $db->prepare('INSERT IGNORE INTO reel_lga_targets (reel_id,lga_id) VALUES (?,?)');
$rlt->execute(['reel_001',3]);   // Alimosho
$rlt->execute(['reel_003',15]);  // Surulere
$rlt->execute(['reel_005',18]);  // Ikorodu
$rlt->execute(['reel_007',13]);  // Lagos Island
$rlt->execute(['reel_008',12]);  // Eti-Osa
$rlt->execute(['reel_009',5]);   // Badagry
$rlt->execute(['reel_012',7]);   // Ikeja

// ── Reel likes ────────────────────────────────────────────────────────────
$W('Reel likes…');
$lk = $db->prepare('INSERT IGNORE INTO reel_likes (reel_id,user_id) VALUES (?,?)');
foreach ([
  ['reel_001',100002],['reel_001',100003],['reel_001',100004],
  ['reel_003',100001],['reel_003',100004],
  ['reel_004',100001],['reel_004',100003],['reel_004',100005],
  ['reel_005',100001],
  ['reel_006',100002],['reel_006',100004],
  ['reel_009',100001],['reel_009',100002],['reel_009',100003],
  ['reel_011',100001],['reel_011',100002],['reel_011',100003],['reel_011',100004],['reel_011',100005],
  ['reel_013',100001],['reel_013',100002],['reel_013',100003],
] as [$rid,$uid]) $lk->execute([$rid,$uid]);

// ── Reel comments ─────────────────────────────────────────────────────────
$W('Reel comments…');
$cm = $db->prepare('INSERT INTO reel_comments (reel_id,user_id,user_name,avatar_url,text,created_at)
  VALUES (?,?,?,?,?,?)');
$comments = [
  ['reel_001',100002,'fatima_b',   $citizenAvatars[100002],'This is every morning in Lagos 😂 But we love it!',ts(-86400*6+600)],
  ['reel_004',100004,'ngozi_e',   $citizenAvatars[100004],'Lagos women are unstoppable! Represent 💃',ts(-86400*5)],
  ['reel_001',100003,'taiwo_a',   $citizenAvatars[100003],'That traffic is mild actually 😂 Try Ikorodu road!',ts(-86400*5+3600)],
  ['reel_003',100001,'emeka_o',   $citizenAvatars[100001],'The stadium upgrade is overdue. Good news! 🙌',ts(-86400*4)],
  ['reel_003',100005,'baba_s',    $citizenAvatars[100005],'Surulere is a classic Lagos LGA. Love this.',ts(-86400*4+1800)],
  ['reel_004',100001,'emeka_o',   $citizenAvatars[100001],'Our women carry this city on their backs. Respect 💪',ts(-86400*1+900)],
  ['reel_004',100003,'taiwo_a',   $citizenAvatars[100003],'My mother is a market woman in Ikorodu. She deserves this recognition 🌺',ts(-86400*1+2000)],
  ['reel_004',100005,'baba_s',    $citizenAvatars[100005],'Lagos women — the true MVPs. Period.',ts(-86400*1+3000)],
  ['reel_009',100001,'emeka_o',   $citizenAvatars[100001],'Every Nigerian needs to visit Badagry. Our history 🕊️',ts(-86400*1+500)],
  ['reel_009',100002,'fatima_b',  $citizenAvatars[100002],'This gave me chills. Thank you for sharing this history.',ts(-86400*1+2500)],
  ['reel_009',100004,'ngozi_e',   $citizenAvatars[100004],'Badagry is a sacred place. We must never forget 🙏',ts(-86400*1+4000)],
  ['reel_011',100002,'fatima_b',  $citizenAvatars[100002],'Thank you Lagos Konect team! This app keeps getting better.',ts(-86400*9)],
  ['reel_011',100003,'taiwo_a',   $citizenAvatars[100003],'The best civic app in Nigeria. Ikorodu is proud to be part of this.',ts(-86400*9+1000)],
  ['reel_011',100004,'ngozi_e',   $citizenAvatars[100004],'Lagos Konect is the future of community engagement 🔥',ts(-86400*9+2000)],
  ['reel_011',100005,'baba_s',    $citizenAvatars[100005],'I tell everyone in Badagry to download this app. No joke.',ts(-86400*9+3500)],
  ['reel_011',100001,'emeka_o',   $citizenAvatars[100001],'Proud to be an early user of this platform 🙌',ts(-86400*9+5000)],
  ['reel_013',100001,'emeka_o',   $citizenAvatars[100001],'Happy anniversary! You have changed how we connect with our LGAs 🎂',ts(-86400*4)],
  ['reel_013',100002,'fatima_b',  $citizenAvatars[100002],'One year already? Time flies. Keep building for Lagos! 🏙️',ts(-86400*4+1200)],
  ['reel_013',100003,'taiwo_a',   $citizenAvatars[100003],'🎉🎉 Congratulations Lagos Konect team! Ikorodu loves you!',ts(-86400*4+2400)],
];
foreach ($comments as $c) $cm->execute($c);

// ── Reel subscriptions ────────────────────────────────────────────────────
$W('Subscriptions…');
$sub = $db->prepare('INSERT IGNORE INTO reel_subscriptions (follower_id,target_id) VALUES (?,?)');
foreach ([
  [100002,100001],[100003,100001],[100004,100001],[100005,100001], // all follow emeka
  [100001,100002],[100004,100002],[100005,100002],                  // follow fatima
  [100001,100003],[100002,100003],                                  // follow taiwo
  [100001,100004],[100003,100004],                                  // follow ngozi
  [100001,100005],[100002,100005],                                  // follow babatunde
] as [$f,$t]) $sub->execute([$f,$t]);

// ─────────────────────────────────────────────────────────────────────────────
// 6. CHAT MESSAGES (5 LGA chats)
// ─────────────────────────────────────────────────────────────────────────────
$W('Chat messages…');
$msg = $db->prepare('INSERT INTO lga_chat_messages
  (lga_id,user_id,user_name,avatar_url,text,reactions,created_at)
  VALUES (?,?,?,?,?,?,?)');

function chat(PDO $db, $stmt, int $lgaId, array $msgs): void {
  foreach ($msgs as $m) $stmt->execute([$lgaId, ...$m]);
}

$av = $citizenAvatars;

// LGA 3 — Alimosho (12 messages)
chat($db, $msg, 3, [
  [100001,'emeka_o',$av[100001],'Good morning Alimosho community! 🙏',json_encode(['👋'=>[100004,100002]]),ts(-86400*10)],
  [100004,'ngozi_e',$av[100004],'Morning! Happy to have this space for our LGA. Alimosho is massive, we need this.',json_encode(['❤️'=>[100001]]),ts(-86400*10+300)],
  [100001,'emeka_o',$av[100001],'Did anyone see the news about the Egbeda Market renovation? Looking really good!',json_encode(['🎉'=>[100004]]),ts(-86400*9)],
  [100004,'ngozi_e',$av[100004],'Yes! Finally. That market was overdue for a facelift. My aunt trades there.',null,ts(-86400*9+600)],
  [100001,'emeka_o',$av[100001],'Anyone applying for the Lagos empowerment fund? I heard Alimosho gets a big allocation.',json_encode(['🔥'=>[100004]]),ts(-86400*7)],
  [100004,'ngozi_e',$av[100004],'I submitted my form yesterday at the LGA Secretariat. The process was smooth.',null,ts(-86400*7+900)],
  [100001,'emeka_o',$av[100001],'Good to hear! Which category did you apply under?',null,ts(-86400*7+1200)],
  [100004,'ngozi_e',$av[100004],'SME grant — I want to expand my fabric business.',null,ts(-86400*7+1500)],
  [100001,'emeka_o',$av[100001],'Nice one! I went for vocational training support. Let us hustle 💪',json_encode(['💪'=>[100004]]),ts(-86400*7+1800)],
  [100004,'ngozi_e',$av[100004],'Alimosho people always put in the work 💯',json_encode(['💯'=>[100001]]),ts(-86400*7+2100)],
  [100001,'emeka_o',$av[100001],'Flood advisory from LASEMA — please clear your drainage before the rains this week.',json_encode(['⚠️'=>[100004]]),ts(-86400*2)],
  [100004,'ngozi_e',$av[100004],'Shared in our street group chat. Everyone please take note 🙏',null,ts(-86400*2+300)],
]);

// LGA 5 — Badagry (10 messages)
chat($db, $msg, 5, [
  [100005,'baba_s',$av[100005],'Good morning Badagry community! Beautiful place, beautiful people 🌊',json_encode(['👍'=>[100001]]),ts(-86400*8)],
  [100001,'emeka_o',$av[100001],'Badagry is one of the most historic places in Nigeria. Glad to be here.',json_encode(['🕊️'=>[100005]]),ts(-86400*8+600)],
  [100005,'baba_s',$av[100005],'The Heritage Festival is November 14–16! Who is coming?',json_encode(['🙋'=>[100001]]),ts(-86400*5)],
  [100001,'emeka_o',$av[100001],'I will be there with my family. The slave route tour is always moving.',null,ts(-86400*5+600)],
  [100005,'baba_s',$av[100005],'This year they added a new exhibition. Very excited.',null,ts(-86400*5+1200)],
  [100001,'emeka_o',$av[100001],'The eco-resort investments are great news for Badagry. More jobs!',json_encode(['🎉'=>[100005]]),ts(-86400*5+2000)],
  [100005,'baba_s',$av[100005],'We have been waiting for investment like this for a long time.',json_encode(['🙏'=>[100001]]),ts(-86400*4)],
  [100001,'emeka_o',$av[100001],'The road to Badagry needs serious work though. LASG should fix it first.',null,ts(-86400*3)],
  [100005,'baba_s',$av[100005],'100% agreed. Good morning Badagry 🌅 Let us make today count!',null,ts(-86400*2)],
  [100001,'emeka_o',$av[100001],'Good morning! Badagry people are resilient. Nothing stops us 💪',json_encode(['💪'=>[100005]]),ts(-86400*2+900)],
]);

// LGA 15 — Surulere (8 messages)
chat($db, $msg, 15, [
  [100002,'fatima_b',$av[100002],'Hello Surulere! This platform is amazing 🌟',json_encode(['👋'=>[]]),ts(-86400*6)],
  [100002,'fatima_b',$av[100002],'Stadium upgrade news is great. Surulere deserves it!',json_encode(['📣'=>[]]),ts(-86400*5)],
  [100002,'fatima_b',$av[100002],'The National Arts Theatre is also getting a glow-up. Lagos Central is rising!',json_encode(['🏛️'=>[]]),ts(-86400*4)],
  [100002,'fatima_b',$av[100002],'Which wards are covered by the LASHMA free health screening? Anyone know?',null,ts(-86400*3)],
  [100002,'fatima_b',$av[100002],'Found out: all wards in Surulere are covered. Go to the LGA Secretariat health unit.',json_encode(['👍'=>[]]),ts(-86400*3+3600)],
  [100002,'fatima_b',$av[100002],'Surulere is the cultural heart of Lagos. Proud to live here 🎭',null,ts(-86400*2)],
  [100002,'fatima_b',$av[100002],'Anyone going to the Lagos East Trade Forum? Might be useful for small businesses.',null,ts(-86400*1)],
  [100002,'fatima_b',$av[100002],'Good morning Surulere 🌅 Another great day in the best LGA in Lagos!',json_encode(['🎉'=>[]]),ts(-3600*6)],
]);

// LGA 13 — Lagos Island (8 messages)
chat($db, $msg, 13, [
  [100004,'ngozi_e',$av[100004],'Lagos Island community — hello! 🌊',json_encode(['👋'=>[]]),ts(-86400*5)],
  [100004,'ngozi_e',$av[100004],'The Eko Bridge partial closure news — anyone affected by the alternate routes?',json_encode(['🤔'=>[]]),ts(-86400*4)],
  [100004,'ngozi_e',$av[100004],'I take the ferry from CMS to VI. Honestly faster than the bridge most days.',json_encode(['⚡'=>[]]),ts(-86400*4+600)],
  [100004,'ngozi_e',$av[100004],'LSETF SME grant — Lagos Island traders should definitely apply.',json_encode(['✅'=>[]]),ts(-86400*3)],
  [100004,'ngozi_e',$av[100004],'Deadline for applications is still open. Go to the Island Secretariat.',json_encode(['📢'=>[]]),ts(-86400*3+3000)],
  [100004,'ngozi_e',$av[100004],'Balogun Market is the heartbeat of Lagos Island. Forever iconic 🧡',null,ts(-86400*2)],
  [100004,'ngozi_e',$av[100004],'Lagos Island youth — apply for the NSIP apprenticeship. Free skill training.',null,ts(-86400*1)],
  [100004,'ngozi_e',$av[100004],'Good morning Lagos Island 🌅 Let\'s go!',null,ts(-3600*8)],
]);

// LGA 18 — Ikorodu (7 messages)
chat($db, $msg, 18, [
  [100003,'taiwo_a',$av[100003],'Ikorodu community, good morning! 🌾',json_encode(['❤️'=>[]]),ts(-86400*3)],
  [100001,'emeka_o',$av[100001],'Ikorodu is an underrated gem. The rice farms here are incredible!',null,ts(-86400*3+600)],
  [100003,'taiwo_a',$av[100003],'The irrigation scheme expansion is huge for us. 1,200 hectares! 🌾',json_encode(['💪'=>[]]),ts(-86400*3+1800)],
  [100001,'emeka_o',$av[100001],'3,000 households will benefit. That is serious impact.',null,ts(-86400*3+2500)],
  [100003,'taiwo_a',$av[100003],'Ikorodu road needs attention though. That is our biggest challenge.',null,ts(-86400*2)],
  [100001,'emeka_o',$av[100001],'True. The road is a shame for such a productive LGA. Raise it on Lagos Konect.',json_encode(['👍'=>[100003]]),ts(-86400*2+1200)],
  [100003,'taiwo_a',$av[100003],'Will do! Good morning everyone — Ikorodu stands strong 🙏',json_encode(['🤲'=>[100001]]),ts(-86400*2+2000)],
]);

// ─────────────────────────────────────────────────────────────────────────────
// 7. NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
$W('Notifications…');
$notif = $db->prepare('INSERT INTO notifications
  (user_id,category,priority,title,body,actor_name,actor_avatar_url,link_to,is_read,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)');

$notifs = [
  // Official — breaking news (all users)
  [100001,'Official','high','🔴 BREAKING: Free Health Screening Starts Monday','Mobile clinics deployed across all 20 Lagos LGAs. Visit your nearest health unit.',null,null,'/news/lagos-free-health-screening',0,ts(-86400*3)],
  [100002,'Official','high','🔴 BREAKING: Free Health Screening Starts Monday','Mobile clinics deployed across all 20 Lagos LGAs. Visit your nearest health unit.',null,null,'/news/lagos-free-health-screening',1,ts(-86400*3)],
  [100003,'Official','high','🔴 BREAKING: Free Health Screening Starts Monday','Mobile clinics deployed across all 20 Lagos LGAs. Visit your nearest health unit.',null,null,'/news/lagos-free-health-screening',0,ts(-86400*3)],
  [100004,'Official','high','🔴 BREAKING: Free Health Screening Starts Monday','Mobile clinics deployed across all 20 Lagos LGAs. Visit your nearest health unit.',null,null,'/news/lagos-free-health-screening',1,ts(-86400*3)],
  [100005,'Official','high','🔴 BREAKING: Free Health Screening Starts Monday','Mobile clinics deployed across all 20 Lagos LGAs. Visit your nearest health unit.',null,null,'/news/lagos-free-health-screening',0,ts(-86400*3)],

  // Official — headline
  [100001,'Official','normal','📰 Headline: Traffic Management Plan Released','LASTMA and LAMATA unveil Lagos-wide road decongestion strategy.',null,null,'/news/lagos-traffic-management-update',0,ts(-86400*1)],
  [100003,'Official','normal','📰 Headline: Traffic Management Plan Released','LASTMA and LAMATA unveil Lagos-wide road decongestion strategy.',null,null,'/news/lagos-traffic-management-update',0,ts(-86400*1)],
  [100005,'Official','normal','📰 Headline: Traffic Management Plan Released','LASTMA and LAMATA unveil Lagos-wide road decongestion strategy.',null,null,'/news/lagos-traffic-management-update',0,ts(-86400*1)],

  // Official — LGA-specific news
  [100001,'Official','normal','New Alimosho LGA News','Egbeda Market renovation complete — 5,000 traders to return.',null,null,'/news/alimosho-market-renovation',1,ts(-86400*7)],
  [100005,'Official','normal','New Badagry LGA News','Badagry Heritage Festival returns November 14–16.',null,null,'/news/badagry-slave-route-heritage',0,ts(-86400*3)],
  [100002,'Official','normal','New Surulere LGA News','National Stadium gets ₦2.5 billion upgrade — works begin October.',null,null,'/news/surulere-national-stadium-upgrade',0,ts(-86400*2)],
  [100003,'Official','normal','New Ikorodu LGA News','Ikorodu Rice Cooperative Scheme: 1,200 hectares now under irrigation.',null,null,'/news/ikorodu-rice-cooperative-expansion',0,ts(-86400*5)],

  // Community — reel likes
  [100001,'Community','normal','fatima_b liked your reel','fatima_b liked your reel: "Morning traffic on the Egbeda–Idimu road 🚗"','fatima_b',$av[100002],'/reels',1,ts(-86400*6+700)],
  [100001,'Community','normal','taiwo_a liked your reel','taiwo_a liked your reel: "Morning traffic on the Egbeda–Idimu road 🚗"','taiwo_a',$av[100003],'/reels',1,ts(-86400*6+1400)],
  [100001,'Community','normal','ngozi_e liked your reel','ngozi_e liked your reel: "Morning traffic on the Egbeda–Idimu road 🚗"','ngozi_e',$av[100004],'/reels',0,ts(-86400*6+2100)],
  [100002,'Community','normal','emeka_o liked your reel','emeka_o liked your reel: "National Stadium Surulere 🏟️"','emeka_o',$av[100001],'/reels',0,ts(-86400*4+500)],
  [100002,'Community','normal','ngozi_e liked your reel','ngozi_e liked your reel: "Women in business! 💼🌺"','ngozi_e',$av[100004],'/reels',0,ts(-86400*1+200)],
  [100003,'Community','normal','emeka_o liked your reel','emeka_o liked your reel: "Rice harvest season in Ikorodu 🌾"','emeka_o',$av[100001],'/reels',1,ts(-86400*3)],
  [100005,'Community','normal','emeka_o liked your reel','emeka_o liked your reel: "Badagry Slave Route 🕊️"','emeka_o',$av[100001],'/reels',0,ts(-86400*1+900)],

  // Community — reel comments
  [100001,'Community','normal','fatima_b commented on your reel','fatima_b: "This is every morning in Lagos 😂 But we love it!"','fatima_b',$av[100002],'/reels',1,ts(-86400*6+800)],
  [100001,'Community','normal','taiwo_a commented on your reel','taiwo_a: "That traffic is mild actually 😂 Try Ikorodu road!"','taiwo_a',$av[100003],'/reels',0,ts(-86400*5+3700)],
  [100002,'Community','normal','emeka_o commented on your reel','emeka_o: "The stadium upgrade is overdue. Good news! 🙌"','emeka_o',$av[100001],'/reels',1,ts(-86400*4+100)],
  [100005,'Community','normal','emeka_o commented on your reel','emeka_o: "Every Nigerian needs to visit Badagry 🕊️"','emeka_o',$av[100001],'/reels',0,ts(-86400*1+600)],

  // Community — new reels from subscribed authors
  [100002,'Community','normal','emeka_o posted a new reel','emeka_o: "Proud to call Lagos home! 💪"','emeka_o',$av[100001],'/reels',0,ts(-86400*3+100)],
  [100003,'Community','normal','emeka_o posted a new reel','emeka_o: "Proud to call Lagos home! 💪"','emeka_o',$av[100001],'/reels',1,ts(-86400*3+100)],
  [100004,'Community','normal','emeka_o posted a new reel','emeka_o: "Proud to call Lagos home! 💪"','emeka_o',$av[100001],'/reels',0,ts(-86400*3+100)],
  [100001,'Community','normal','fatima_b posted a new reel','fatima_b: "Women in business! 💼🌺"','fatima_b',$av[100002],'/reels',1,ts(-86400*2+200)],
  [100001,'Community','normal','taiwo_a posted a new reel','taiwo_a: "The youth of Lagos East are rising! 💯"','taiwo_a',$av[100003],'/reels',0,ts(-86400*1+100)],

  // Security Alert — login notifications
  [100001,'Security Alert','normal','New login to your account','Your account was accessed from a new device in Lagos. If this wasn\'t you, change your password.',null,null,'/settings',1,ts(-86400*5)],
  [100002,'Security Alert','normal','New login to your account','Your account was accessed from a new device in Lagos. If this wasn\'t you, change your password.',null,null,'/settings',1,ts(-86400*4)],
  [100003,'Security Alert','normal','New login to your account','New sign-in detected for your Lagos Konect account.',null,null,'/settings',0,ts(-86400*3)],

  // Event — community events
  [100001,'Event','normal','Alimosho LGA Town Hall — Friday 10am','Monthly community meeting at LGA Secretariat main hall. All residents welcome.',null,null,'/news',0,ts(-86400*2)],
  [100005,'Event','normal','Badagry Heritage Festival — Nov 14–16','Official preview and schedule for the Badagry Slave Route Heritage Festival 2025.',null,null,'/news/badagry-slave-route-heritage',0,ts(-86400*3)],
  [100002,'Event','normal','Surulere Stadium Upgrade — Community Briefing Sep 30','Open day at National Stadium for Surulere residents to view renovation plans.',null,null,'/news/surulere-national-stadium-upgrade',0,ts(-3600*5)],
  [100003,'Event','normal','Ikorodu Farmers Cooperative Meeting — September 20','Quarterly meeting for registered members of the Ikorodu Rice Cooperative.',null,null,'/news/ikorodu-rice-cooperative-expansion',0,ts(-86400*1)],

  // Community — subscription confirmations
  [100002,'Community','normal','emeka_o subscribed to your reels','emeka_o will be notified when you post new reels.','emeka_o',$av[100001],'/reels',1,ts(-86400*2)],
  [100001,'Community','normal','fatima_b subscribed to your reels','fatima_b will be notified when you post new reels.','fatima_b',$av[100002],'/reels',0,ts(-86400*1)],
  [100003,'Community','normal','emeka_o subscribed to your reels','emeka_o will be notified when you post new reels.','emeka_o',$av[100001],'/reels',0,ts(-86400*3)],
];

foreach ($notifs as $n) $notif->execute($n);

// ─────────────────────────────────────────────────────────────────────────────
// 8. BANNED WORDS
// ─────────────────────────────────────────────────────────────────────────────
$W('Banned words…');
$bw = $db->prepare('INSERT IGNORE INTO banned_words (word) VALUES (?)');
foreach (['testslur','badword1','badword2','spamword'] as $w) $bw->execute([$w]);

// ─────────────────────────────────────────────────────────────────────────────
// 9. PLATFORM SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
$W('Platform settings…');
$ps = $db->prepare('INSERT INTO platform_settings (`key`,`value`) VALUES (?,?)
  ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)');
foreach ([
  ['maintenance_mode','0'],['allow_registrations','1'],
  ['chat_enabled','1'],['reels_enabled','1'],['adverts_enabled','1'],
] as [$k,$v]) $ps->execute([$k,$v]);

// ─────────────────────────────────────────────────────────────────────────────
// Done
// ─────────────────────────────────────────────────────────────────────────────
$W('');
$W('✅  Seed complete.');
$W('');
$W('Counts');
$W('  Admins:        2   (super_admin + admin)');
$W('  Citizens:      5   (Alimosho/West, Surulere/Central, Ikorodu/East, Lagos Island/Central, Badagry/West)');
$W('  News:         17   (4 all-LGA · 4 grouped · 8 LGA-specific · 1 draft)');
$W('  Adverts:      18   (banner ×7 · interstitial ×3 · news ×3 · feed ×3 · paused/expired ×2)');
$W('  Reels:        13   (citizens ×10 · admin ×3)');
$W('  Reel likes:   22');
$W('  Reel comments:19');
$W('  Subscriptions:13');
$W('  Chat msgs:    45   (Alimosho·Badagry·Surulere·Lagos Island·Ikorodu)');
$W('  Notifications:37+  (Official·Community·Security·Event)');
$W('');
$W('Credentials');
$W('  Super admin   superadmin@lagkonnect.com   Admin@1234');
$W('  Admin         admin@lagkonnect.com        Admin@1234');
$W('  Citizen 1     emeka@lag.test              Citizen@1234   Alimosho (West)');
$W('  Citizen 2     fatima@lag.test             Citizen@1234   Surulere (Central)');
$W('  Citizen 3     taiwo@lag.test              Citizen@1234   Ikorodu (East)');
$W('  Citizen 4     ngozi@lag.test              Citizen@1234   Lagos Island (Central)');
$W('  Citizen 5     babatunde@lag.test          Citizen@1234   Badagry (West)');
$W('');
$W('⚠  Delete server/seed.php before going to production.');
