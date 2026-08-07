/**
 * Lagos Konect — Mock Data & API Helpers
 * ============================================================
 * Shared between client.js and auth.js.
 * This file has NO imports from client.js or auth.js,
 * which is what breaks the circular dependency.
 *
 * Exports:
 *   MOCK            — all fixture data (users, admins, lgas, …)
 *   MOCK_DELAY_MS   — default simulated latency
 *   MOCK_SLOW_MS    — slow operation latency
 *   _delay()        — returns a Promise that resolves after ms
 *   _ok()           — wraps data in a success envelope
 *   _err()          — wraps code+message in an error envelope
 *   _requireRole()  — UX-level role guard (reads from store)
 *   _paginate()     — slices an array into a page
 */

import { store } from '../core/store.js?v=20260806h';

// ─── Config ───────────────────────────────────────────────────────────────

export const MOCK_DELAY_MS = 350;
export const MOCK_SLOW_MS = 800;

// ─── Mock Data Fixtures ───────────────────────────────────────────────────

export const MOCK = {
  // ── LGAs ────────────────────────────────────────────────────────────
  // Lagos State LGAs organized by Senatorial Districts
  lgas: [
    // Lagos West
    { id: 1,  name: 'Agege',            state: 'Lagos', region: 'west'   },
    { id: 2,  name: 'Ajeromi-Ifelodun', state: 'Lagos', region: 'west'   },
    { id: 3,  name: 'Alimosho',         state: 'Lagos', region: 'west'   },
    { id: 4,  name: 'Amuwo-Odofin',     state: 'Lagos', region: 'west'   },
    { id: 5,  name: 'Badagry',          state: 'Lagos', region: 'west'   },
    { id: 6,  name: 'Ifako-Ijaiye',     state: 'Lagos', region: 'west'   },
    { id: 7,  name: 'Ikeja',            state: 'Lagos', region: 'west'   },
    { id: 8,  name: 'Mushin',           state: 'Lagos', region: 'west'   },
    { id: 9,  name: 'Ojo',              state: 'Lagos', region: 'west'   },
    { id: 10, name: 'Oshodi-Isolo',     state: 'Lagos', region: 'west'   },
    // Lagos Central
    { id: 11, name: 'Apapa',            state: 'Lagos', region: 'central' },
    { id: 12, name: 'Eti-Osa',          state: 'Lagos', region: 'central' },
    { id: 13, name: 'Lagos Island',     state: 'Lagos', region: 'central' },
    { id: 14, name: 'Lagos Mainland',   state: 'Lagos', region: 'central' },
    { id: 15, name: 'Surulere',         state: 'Lagos', region: 'central' },
    // Lagos East
    { id: 16, name: 'Epe',              state: 'Lagos', region: 'east'   },
    { id: 17, name: 'Ibeju-Lekki',      state: 'Lagos', region: 'east'   },
    { id: 18, name: 'Ikorodu',          state: 'Lagos', region: 'east'   },
    { id: 19, name: 'Kosofe',           state: 'Lagos', region: 'east'   },
    { id: 20, name: 'Shomolu',          state: 'Lagos', region: 'east'   },
  ],

  // ── Users ────────────────────────────────────────────────────────────
  //
  // TEST CREDENTIALS (citizen role)
  // ┌──────────────────────────────────────────────────────────┐
  // │  Name             │ Identifier            │ Password     │
  // ├──────────────────────────────────────────────────────────┤
  // │  Adaeze Okonkwo   │ +2348031234567        │ citizen1     │
  // │  Emeka Nwosu      │ +2348059876543        │ citizen2     │
  // │  Chukwuemeka Eze  │ emeka@example.com     │ citizen3     │
  // │  Ngozi Adeyemi    │ +2348167778899        │ citizen4     │
  // │  Amina Yusuf      │ amina@example.com     │ citizen5     │
  // └──────────────────────────────────────────────────────────┘
  //
  // NOTE: Fatima Bello (id:3) is suspended → ACCOUNT_SUSPENDED
  //       Segun Lawal  (id:6) is pending   → UNVERIFIED_PHONE
  //
  users: [
    {
      id: 1, name: 'Adaeze Okonkwo',
      phone: '+2348031234567', email: null,
      password: 'citizen1', gender: 'female',
      lgaId: 7, lgaName: 'Ikeja', avatarUrl: null,
      role: 'citizen', isVerified: true, status: 'active', has_seen_welcome: true, isOnline: true,
      profileVisibility: 'public', twoFaEnabled: false,
      notifPrefs: { official: true, community: true, lgaAlerts: false },
      createdAt: '2024-11-15T09:23:00Z', lastSeen: '2025-05-10T14:00:00Z',
    },
    {
      id: 2, name: 'Emeka Nwosu',
      phone: '+2348059876543', email: null,
      password: 'citizen2', gender: 'male',
      lgaId: 8, lgaName: 'Mushin', avatarUrl: null,
      role: 'citizen', isVerified: true, status: 'active', has_seen_welcome: false, isOnline: true,
      createdAt: '2024-12-01T11:00:00Z', lastSeen: '2025-05-09T08:30:00Z',
    },
    {
      id: 3, name: 'Fatima Bello',
      phone: '+2348121112233', email: null,
      password: 'citizen_suspended', gender: 'female',
      lgaId: 15, lgaName: 'Surulere', avatarUrl: null,
      role: 'citizen', isVerified: false, status: 'suspended', has_seen_welcome: false,
      createdAt: '2025-01-20T16:45:00Z', lastSeen: '2025-04-22T10:00:00Z',
    },
    {
      id: 4, name: 'Chukwuemeka Eze',
      phone: '+2347045556677', email: 'emeka@example.com',
      password: 'citizen3', gender: 'male',
      lgaId: 12, lgaName: 'Eti-Osa', avatarUrl: null,
      role: 'citizen', isVerified: true, status: 'active', has_seen_welcome: true, isOnline: false,
      createdAt: '2025-02-05T08:15:00Z', lastSeen: '2025-05-11T19:00:00Z',
    },
    {
      id: 5, name: 'Ngozi Adeyemi',
      phone: '+2348167778899', email: null,
      password: 'citizen4', gender: 'female',
      lgaId: 18, lgaName: 'Ikorodu', avatarUrl: null,
      role: 'citizen', isVerified: true, status: 'active', has_seen_welcome: true, isOnline: true,
      createdAt: '2025-03-10T13:30:00Z', lastSeen: '2025-05-12T07:45:00Z',
    },
    {
      id: 6, name: 'Segun Lawal',
      phone: '+2348033334455', email: null,
      password: 'citizen_pending', gender: 'male',
      lgaId: 11, lgaName: 'Apapa', avatarUrl: null,
      role: 'citizen', isVerified: false, status: 'pending', has_seen_welcome: false,
      createdAt: '2025-04-01T10:00:00Z', lastSeen: '2025-04-01T10:05:00Z',
    },
    {
      id: 7, name: 'Amina Yusuf',
      phone: '+2347011122233', email: 'amina@example.com',
      password: 'citizen5', gender: 'female',
      lgaId: 3, lgaName: 'Alimosho', avatarUrl: null,
      role: 'citizen', isVerified: true, status: 'active', has_seen_welcome: true, isOnline: false,
      createdAt: '2025-01-08T09:00:00Z', lastSeen: '2025-05-13T12:00:00Z',
    },
    {
      id: 8, name: 'Obinna Obi',
      phone: '+2348099988877', email: null,
      password: 'citizen_nologin', gender: 'male',
      lgaId: 16, lgaName: 'Epe', avatarUrl: null,
      role: 'citizen', isVerified: true, status: 'active', has_seen_welcome: true,
      createdAt: '2024-10-30T14:20:00Z', lastSeen: '2025-05-08T16:30:00Z',
    },
  ],

  // ── Admins ───────────────────────────────────────────────────────────
  //
  // TEST CREDENTIALS (admin / lga_staff roles)
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │  Name                 │ Identifier           │ Password  │ Role     │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │  Oluwaseun Adeyemi    │ admin@afx.gov.ng     │ admin1    │ admin    │
  // │  Chidi Okafor         │ chidi@afx.gov.ng     │ admin2    │ admin    │
  // │  Blessing Eze         │ blessing@afx.gov.ng  │ staff1    │ lga_staff│
  // └─────────────────────────────────────────────────────────────────────┘
  //
  admins: [
    {
      id: 101, name: 'Oluwaseun Adeyemi',
      phone: '+2348000000101', email: 'admin@afx.gov.ng',
      password: 'admin1', role: 'admin',
      avatarUrl: null, lastLogin: '2025-05-13T08:00:00Z',
    },
    {
      id: 102, name: 'Chidi Okafor',
      phone: '+2348000000102', email: 'chidi@afx.gov.ng',
      password: 'admin2', role: 'admin',
      avatarUrl: null, lastLogin: '2025-05-12T14:30:00Z',
    },
    {
      id: 103, name: 'Blessing Eze',
      phone: '+2348000000103', email: 'blessing@afx.gov.ng',
      password: 'staff1', role: 'lga_staff',
      avatarUrl: null, lastLogin: '2025-05-11T09:15:00Z',
    },
  ],

  // ── News Headlines ───────────────────────────────────────────────────

  // ── Reels ────────────────────────────────────────────────────────────
  // reelId: alphanumeric generated ID (authentic-looking, matches backend pattern)
  // authorAvatarUrl: from admin profile — null falls back to initials avatar
  // hashtags: array of strings shown in caption overlay on detail page
  // shares: share count shown alongside likes and comments on detail page
  reels: [
    {
      reelId: 'reel_a3f9k2', lgaId: 11, lgaName: 'Apapa',
      title: 'Lagos State Development Update',
      description: 'LGA Chairman speaks directly to residents about the ongoing drainage project at the community centre.',
      caption: 'Lagos development update 2026. #LagosConnect #Apapa',
      hashtags: ['#LagosConnect', '#Lagos', '#Apapa'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-a3f9k2/600/375',
      duration: 252, views: 12400, likes: 2400, shares: 482, commentCount: 156,
      targetAllLGAs: false, status: 'published',
      authorId: 101, authorName: 'Nigeria Stories',
      authorHandle: '@lagos_council',
      authorAvatarUrl: null,
      publishedAt: '2025-05-13T12:00:00Z', createdAt: '2025-05-13T10:00:00Z',
    },
    {
      reelId: 'reel_b7m1x5', lgaId: 11, lgaName: 'Apapa',
      title: 'Town Hall Meeting Highlights',
      description: 'Key takeaways from the May 2025 town hall meeting with LGA officials on infrastructure.',
      caption: 'Town Hall highlights from Apapa. Your voice matters. #LagosConnect #TownHall',
      hashtags: ['#LagosConnect', '#TownHall', '#Apapa'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-b7m1x5/600/375',
      duration: 145, views: 8920, likes: 1200, shares: 310, commentCount: 89,
      targetAllLGAs: false, status: 'published',
      authorId: 102, authorName: 'Nigeria Stories',
      authorHandle: '@lagos_council',
      authorAvatarUrl: null,
      publishedAt: '2025-05-12T14:00:00Z', createdAt: '2025-05-12T11:00:00Z',
    },
    {
      reelId: 'reel_c2p8n7', lgaId: 11, lgaName: 'Apapa',
      title: 'Free Healthcare Outreach',
      description: 'Behind-the-scenes footage from the free healthcare outreach at the state hospital.',
      caption: 'Free healthcare is here! Visit the state hospital today. #LagosConnect #Health #Apapa',
      hashtags: ['#LagosConnect', '#Health', '#Apapa'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-c2p8n7/600/375',
      duration: 198, views: 6100, likes: 890, shares: 201, commentCount: 44,
      targetAllLGAs: false, status: 'published',
      authorId: 101, authorName: 'Nigeria Stories',
      authorHandle: '@lagos_health',
      authorAvatarUrl: null,
      publishedAt: '2025-05-11T09:00:00Z', createdAt: '2025-05-10T16:00:00Z',
    },
    {
      reelId: 'reel_d5q3r1', lgaId: 8, lgaName: 'Mushin',
      title: 'Mushin Market Groundbreaking',
      description: 'Watch the official ground-breaking ceremony for the new Mushin central market.',
      caption: 'New market coming to Mushin! Ground broken today. #LagosConnect #Mushin',
      hashtags: ['#LagosConnect', '#Mushin', '#Central'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-d5q3r1/600/375',
      duration: 90, views: 5610, likes: 720, shares: 178, commentCount: 37,
      targetAllLGAs: false, status: 'published',
      authorId: 101, authorName: 'Nigeria Stories',
      authorHandle: '@mushin_news',
      authorAvatarUrl: null,
      publishedAt: '2025-05-10T09:00:00Z', createdAt: '2025-05-09T15:00:00Z',
    },
    {
      reelId: 'reel_e9w4t6', lgaId: 8, lgaName: 'Mushin',
      title: 'Solar Energy Project Launch',
      description: 'Solar panels installation begins across Mushin communities.',
      caption: 'Solar energy is coming to your neighbourhood. #LagosConnect #Solar',
      hashtags: ['#LagosConnect', '#Solar', '#Mushin'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-e9w4t6/600/375',
      duration: 115, views: 4280, likes: 560, shares: 134, commentCount: 28,
      targetAllLGAs: false, status: 'published',
      authorId: 102, authorName: 'Nigeria Stories',
      authorHandle: '@lagos_power',
      authorAvatarUrl: null,
      publishedAt: '2025-05-09T11:00:00Z', createdAt: '2025-05-08T14:00:00Z',
    },
    {
      reelId: 'reel_f1k7y3', lgaId: 11, lgaName: 'Apapa',
      title: 'Budget Transparency Session',
      description: 'Budget transparency session — residents asked tough questions.',
      caption: 'Your LGA budget explained. Watch and share. #LagosConnect #Budget2026',
      hashtags: ['#LagosConnect', '#Budget2026', '#Apapa'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-f1k7y3/600/375',
      duration: 173, views: 3900, likes: 445, shares: 99, commentCount: 19,
      targetAllLGAs: false, status: 'published',
      authorId: 103, authorName: 'Nigeria Stories',
      authorHandle: '@lagos_finance',
      authorAvatarUrl: null,
      publishedAt: '2025-05-08T14:00:00Z', createdAt: '2025-05-07T10:00:00Z',
    },
    {
      reelId: 'reel_g8h2j4', lgaId: 11, lgaName: 'Apapa',
      title: 'Apapa Road Resurfacing Update — Week 1',
      description: 'Progress report on the Apapa road resurfacing project. Main road is 30% complete.',
      caption: 'Week 1 of the Apapa road project. Coming together! #LagosConnect #Apapa #Roads',
      hashtags: ['#LagosConnect', '#Apapa', '#Roads'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-g8h2j4/600/375',
      duration: 88, views: 3200, likes: 410, shares: 92, commentCount: 18,
      targetAllLGAs: false, status: 'published',
      authorId: 102, authorName: 'Nigeria Stories', authorHandle: '@apapa_updates',
      authorAvatarUrl: null, publishedAt: '2025-05-12T10:00:00Z', createdAt: '2025-05-12T09:00:00Z',
    },
    {
      reelId: 'reel_h5k9m3', lgaId: null, lgaName: null,
      title: 'Free Medical Outreach Day 2 — Highlights',
      description: 'Day 2 of the free medical outreach at the state hospital. Over 800 residents attended.',
      caption: 'Day 2 of free healthcare outreach. Over 800 served! #LagosConnect #Health',
      hashtags: ['#LagosConnect', '#Health', '#Lagos'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-h5k9m3/600/375',
      duration: 120, views: 2900, likes: 380, shares: 88, commentCount: 14,
      targetAllLGAs: true, status: 'published',
      authorId: 101, authorName: 'Nigeria Stories', authorHandle: '@lagos_health',
      authorAvatarUrl: null, publishedAt: '2025-05-11T14:00:00Z', createdAt: '2025-05-11T13:00:00Z',
    },
    {
      reelId: 'reel_i3n7p1', lgaId: 11, lgaName: 'Apapa',
      title: 'Apapa Digital Skills Training — Graduation Day',
      description: 'Over 200 youth graduated from the first cohort of the Apapa Digital Skills Programme.',
      caption: '200 youth graduated today! The future is digital. #LagosConnect #ICT #Youth',
      hashtags: ['#LagosConnect', '#ICT', '#Youth', '#Apapa'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-i3n7p1/600/375',
      duration: 155, views: 2600, likes: 330, shares: 75, commentCount: 22,
      targetAllLGAs: false, status: 'published',
      authorId: 103, authorName: 'Nigeria Stories', authorHandle: '@apapa_youth',
      authorAvatarUrl: null, publishedAt: '2025-05-10T11:00:00Z', createdAt: '2025-05-10T10:00:00Z',
    },
    {
      reelId: 'reel_j6q4r8', lgaId: null, lgaName: null,
      title: 'Lagos Transport: Behind the Scenes',
      description: 'An inside look at how the Lagos transport system operates daily to move thousands of commuters.',
      caption: 'Behind the scenes of Lagos transport. Thousands moved daily. #LagosConnect #Transport',
      hashtags: ['#LagosConnect', '#Transport', '#Lagos'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-j6q4r8/600/375',
      duration: 178, views: 2400, likes: 298, shares: 67, commentCount: 11,
      targetAllLGAs: true, status: 'published',
      authorId: 102, authorName: 'Nigeria Stories', authorHandle: '@lagos_transport',
      authorAvatarUrl: null, publishedAt: '2025-05-09T09:00:00Z', createdAt: '2025-05-09T08:00:00Z',
    },
    {
      reelId: 'reel_k1s5t2', lgaId: 8, lgaName: 'Mushin',
      title: 'Mushin Market Groundbreaking Ceremony',
      description: 'Official groundbreaking ceremony for the new Mushin Central Market.',
      caption: 'Breaking ground for the new Mushin Central Market! #LagosConnect #Mushin',
      hashtags: ['#LagosConnect', '#Mushin', '#Economy'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-k1s5t2/600/375',
      duration: 95, views: 2100, likes: 265, shares: 58, commentCount: 33,
      targetAllLGAs: false, status: 'published',
      authorId: 101, authorName: 'Nigeria Stories', authorHandle: '@mushin_news',
      authorAvatarUrl: null, publishedAt: '2025-05-08T11:00:00Z', createdAt: '2025-05-08T10:00:00Z',
    },
    {
      reelId: 'reel_l4u8v6', lgaId: null, lgaName: null,
      title: 'Lagos Flood Warning System Demo',
      description: 'Emergency management demonstrates the new IoT-based flood early warning system installed across LGAs.',
      caption: 'Stay safe with the new flood warning system. #LagosConnect #Safety #Lagos',
      hashtags: ['#LagosConnect', '#Safety', '#Lagos'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-l4u8v6/600/375',
      duration: 132, views: 1900, likes: 243, shares: 54, commentCount: 9,
      targetAllLGAs: true, status: 'published',
      authorId: 102, authorName: 'Nigeria Stories', authorHandle: '@lagos_sema',
      authorAvatarUrl: null, publishedAt: '2025-05-07T13:00:00Z', createdAt: '2025-05-07T12:00:00Z',
    },
    {
      reelId: 'reel_m7w3x9', lgaId: 11, lgaName: 'Apapa',
      title: 'Apapa Solar Street Lights — Installation Begins',
      description: 'Solar-powered street lights are being installed on 15 roads across Apapa starting this week.',
      caption: 'Solar street lights coming to Apapa! No more dark roads. #LagosConnect #Solar',
      hashtags: ['#LagosConnect', '#Solar', '#Apapa'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-m7w3x9/600/375',
      duration: 108, views: 1800, likes: 220, shares: 48, commentCount: 16,
      targetAllLGAs: false, status: 'published',
      authorId: 103, authorName: 'Nigeria Stories', authorHandle: '@apapa_updates',
      authorAvatarUrl: null, publishedAt: '2025-05-06T10:00:00Z', createdAt: '2025-05-06T09:00:00Z',
    },
    {
      reelId: 'reel_n2y7z5', lgaId: null, lgaName: null,
      title: 'Youth Entrepreneurship Fund — Application Guide',
      description: 'Step-by-step guide on how to apply for the Lagos State Youth Entrepreneurship Fund.',
      caption: 'How to apply for the ₦5B youth fund. Watch and share! #LagosConnect #Youth',
      hashtags: ['#LagosConnect', '#Youth', '#Entrepreneurship'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-n2y7z5/600/375',
      duration: 187, views: 1700, likes: 198, shares: 44, commentCount: 27,
      targetAllLGAs: true, status: 'published',
      authorId: 101, authorName: 'Nigeria Stories', authorHandle: '@lagos_youthfund',
      authorAvatarUrl: null, publishedAt: '2025-05-05T14:00:00Z', createdAt: '2025-05-05T13:00:00Z',
    },
    {
      reelId: 'reel_o9a4b7', lgaId: 11, lgaName: 'Apapa',
      title: 'Chairman Visits Medical Outreach — Day 3',
      description: 'The Apapa LGA Chairman personally visited the medical outreach to speak with residents.',
      caption: 'Chairman on ground at medical outreach. #LagosConnect #Apapa #Health',
      hashtags: ['#LagosConnect', '#Apapa', '#Health'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-o9a4b7/600/375',
      duration: 74, views: 1600, likes: 188, shares: 39, commentCount: 12,
      targetAllLGAs: false, status: 'published',
      authorId: 102, authorName: 'Nigeria Stories', authorHandle: '@apapa_council',
      authorAvatarUrl: null, publishedAt: '2025-05-04T11:00:00Z', createdAt: '2025-05-04T10:00:00Z',
    },
    {
      reelId: 'reel_p5c1d3', lgaId: null, lgaName: null,
      title: 'Lagos Clean Water Project — Phase 2 Update',
      description: 'Site inspection of the Phase 2 Water Renewal Project currently underway in 3 LGAs.',
      caption: 'Clean water is coming! Phase 2 update. #LagosConnect #Water #Lagos',
      hashtags: ['#LagosConnect', '#Water', '#Lagos'],
      videoUrl: null, thumbnailUrl: 'https://picsum.photos/seed/reel-p5c1d3/600/375',
      duration: 143, views: 1500, likes: 172, shares: 36, commentCount: 8,
      targetAllLGAs: true, status: 'published',
      authorId: 103, authorName: 'Nigeria Stories', authorHandle: '@lagos_water',
      authorAvatarUrl: null, publishedAt: '2025-05-03T09:00:00Z', createdAt: '2025-05-03T08:00:00Z',
    },
  ],

  // ── Trending News ────────────────────────────────────────────────────
  // Sorted by publishedAt desc. First item = hero on the Trending page.
  //
  // Admin schema alignment:
  //   title        → headline title
  //   body         → rich HTML content (headings, bold, lists, links — from admin editor)
  //   summary      → plain-text excerpt shown on cards (auto-generated or manual)
  //   imageUrl     → media upload (thumbnail)
  //   classification → tags array (shown as the category badge on cards)
  //   breaking     → boolean (triggers push/SMS/email alerts; shows BREAKING badge)
  //   sourceUrl    → optional external source link
  //   sourceName   → display name for source link
  //   targetAllLGAs → broadcast to all LGAs (vs lgaId-specific)
  //   status       → 'active' | 'paused' | 'draft'
  news: [
    {
      id: 1,
      lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'governor-of-lagos-state-commits-to-empower-local-indigenes',
      title: 'Governor of Lagos State Commits to Empower Local Indigenes',
      summary: 'Official updates from the administration regarding regional economic development and social welfare initiatives aimed at sustainable growth.',
      body: `<h2>A New Era of Empowerment</h2>
<p>The Lagos State Governor made a landmark commitment to empower local indigenes across all 21 LGAs, announcing a comprehensive package of social welfare and economic development programs. The initiative, backed by federal support, is expected to reach over <strong>2 million residents</strong> in the first phase.</p>
<h3>Skills Training &amp; Small Business</h3>
<p>Plans to support comprehensive vocational programs and micro-grants for local entrepreneurs. Over <strong>50,000 youths</strong> are expected to benefit from the training centres to be established in each LGA.</p>
<ul>
  <li>Digital skills and ICT training</li>
  <li>Fashion design and tailoring</li>
  <li>Welding, carpentry and construction trades</li>
  <li>Agro-processing and food production</li>
</ul>
<h3>Community Livelihood Improvement</h3>
<p>Aims to enhance basic infrastructure and access to markets for rural agricultural communities. A special <em>Rural Access Roads Fund</em> of ₦12 billion has been set aside for the 2025–2026 fiscal year.</p>
<blockquote>&#8220;Every resident of Lagos deserves dignity, opportunity, and a seat at the table of our state&#8217;s prosperity.&#8221; — Governor, Lagos State</blockquote>`,
      imageUrl: 'https://picsum.photos/seed/trending-gov/800/500',
      classification: ['Official Announcement'],
      category: 'Official Announcement',
      breaking: true,
      sourceUrl: 'https://example.com/news/1', sourceName: 'Lagos State Government Portal',
      status: 'active', views: 9821,
      publishedAt: '2025-05-13T06:00:00Z', createdAt: '2025-05-13T06:00:00Z',
    },
    {
      id: 2,
      lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'new-solar-initiative-launches-across-lagos-lgas',
      title: 'New Solar Initiative Launches Across Lagos LGAs',
      summary: 'The administration launches a region-wide renewable energy project to power 50 rural communities with clean energy by Q4 2025.',
      body: `<h2>Clean Energy for All</h2>
<p>Lagos State has announced a major solar energy rollout targeting underserved communities across all local government areas. The project, funded through a <strong>public-private partnership</strong>, will install solar micro-grids serving approximately <strong>50 rural communities</strong>.</p>
<p>The initiative is part of the state&#8217;s broader <em>Green Lagos 2030</em> agenda and aligns with Nigeria&#8217;s commitment to the Paris Agreement on climate change.</p>
<h3>Key Project Details</h3>
<ul>
  <li>500 solar panels installed per community</li>
  <li>24-hour power supply for health centres and schools</li>
  <li>Local technicians to be trained for maintenance</li>
</ul>`,
      imageUrl: 'https://picsum.photos/seed/trending-solar/800/500',
      classification: ['Environment'],
      category: 'Environment',
      breaking: false,
      sourceUrl: 'https://example.com/news/2', sourceName: 'Lagos Energy Commission',
      status: 'active', views: 7654,
      publishedAt: '2025-05-12T08:00:00Z', createdAt: '2025-05-12T08:00:00Z',
    },
    {
      id: 3,
      lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'secondary-school-scholarship-programme-opens-applications',
      title: 'Secondary School Scholarship Programme Opens Applications',
      summary: 'A new merit-based scholarship fund has been established to support high-achieving students from low-income households across Lagos.',
      body: `<h2>Investing in the Future</h2>
<p>The Lagos State Ministry of Education has officially opened applications for the <strong>2025 Secondary School Scholarship Programme</strong>. The fund will support <strong>500 students</strong> with full tuition coverage and monthly stipends of ₦15,000.</p>
<h3>Eligibility Criteria</h3>
<ul>
  <li>Must be enrolled in a public secondary school in Lagos State</li>
  <li>Minimum CGPA of 3.5 or equivalent grade average</li>
  <li>Household income below ₦150,000 per month</li>
  <li>Must not be a beneficiary of any other government scholarship</li>
</ul>
<h3>How to Apply</h3>
<p>Applications are available online at the Lagos State Education Portal. Deadline is <strong>June 30, 2025</strong>. Shortlisted candidates will be contacted for an interview.</p>`,
      imageUrl: 'https://picsum.photos/seed/trending-school/800/500',
      classification: ['Education'],
      category: 'Education',
      breaking: false,
      sourceUrl: 'https://example.com/news/3', sourceName: 'Lagos State Ministry of Education',
      status: 'active', views: 6210,
      publishedAt: '2025-05-11T10:00:00Z', createdAt: '2025-05-11T10:00:00Z',
    },
    {
      id: 4,
      lgaId: 11, lgaName: 'Apapa', targetAllLGAs: false,
      slug: 'budget-transparency-town-hall-scheduled-for-june',
      title: 'Budget Transparency Town Hall Scheduled for June',
      summary: 'Citizens are invited to participate in the upcoming virtual town hall to review the proposed 2026 LGA budget and provide feedback.',
      body: `<h2>Your Voice in the Budget</h2>
<p>In a move toward greater fiscal transparency, Apapa LGA has announced a <strong>virtual town hall session</strong> to present and discuss the proposed 2026 budget. Citizens can submit questions in advance via the Lagos Konect platform.</p>
<p>The session will be hosted on <em>June 14, 2025</em> at 10:00 AM and streamed live on the Lagos Konect Reels section.</p>
<h3>Topics to be Covered</h3>
<ul>
  <li>Infrastructure and road maintenance allocation</li>
  <li>Health and education budget breakdown</li>
  <li>Security and environmental sanitation</li>
  <li>Community development projects</li>
</ul>
<p>Residents are encouraged to attend and hold their representatives accountable. <strong>Pre-register on Lagos Konect</strong> to receive reminders and submit questions ahead of time.</p>`,
      imageUrl: 'https://picsum.photos/seed/trending-budget/800/500',
      classification: ['Engagement'],
      category: 'Engagement',
      breaking: false,
      sourceUrl: 'https://example.com/news/4', sourceName: 'Apapa LGA Secretariat',
      status: 'active', views: 5432,
      publishedAt: '2025-05-10T09:00:00Z', createdAt: '2025-05-10T09:00:00Z',
    },
    {
      id: 5,
      lgaId: 8, lgaName: 'Mushin', targetAllLGAs: false,
      slug: 'gombi-records-lowest-crime-rate-in-five-years',
      title: 'Mushin Records Lowest Crime Rate in Five Years',
      summary: 'Lagos State Police Command releases quarterly report showing significant drop in reported incidents across Mushin.',
      body: `<h2>Safer Streets in Mushin</h2>
<p>The Q1 2025 security report from the <strong>Lagos State Police Command</strong> highlights Mushin as the most improved LGA in terms of crime reduction. Community policing initiatives and CCTV installations are credited for the improvement.</p>
<h3>Key Statistics</h3>
<ul>
  <li>Armed robbery incidents down <strong>62%</strong> year-on-year</li>
  <li>Petty theft reduced by <strong>48%</strong></li>
  <li>Emergency response time improved from 18 minutes to <strong>7 minutes</strong></li>
</ul>
<p>The police command attributed the improvement to the <em>Community Safety Partnership</em> programme which trained over 800 community vigilantes in the past year.</p>`,
      imageUrl: 'https://picsum.photos/seed/trending-crime/800/500',
      classification: ['Security'],
      category: 'Security',
      breaking: false,
      sourceUrl: 'https://example.com/news/5', sourceName: 'Lagos State Police Command',
      status: 'active', views: 4100,
      publishedAt: '2025-05-09T11:00:00Z', createdAt: '2025-05-09T11:00:00Z',
    },
    {
      id: 6,
      lgaId: 11, lgaName: 'Apapa', targetAllLGAs: false,
      slug: 'power-restoration-18-hour-daily-supply-plan-takes-effect',
      title: 'Power Restoration: 18-Hour Daily Supply Plan Takes Effect',
      summary: 'LASD announces new power distribution schedule guaranteeing minimum 18 hours of daily electricity supply to Apapa residents.',
      body: `<h2>Light at the End of the Tunnel</h2>
<p>Lagos State Electricity Distribution Company (<strong>LASD</strong>) has commenced implementation of a new load management schedule designed to guarantee at least <strong>18 hours of electricity supply per day</strong> to residential and commercial customers in the Apapa district.</p>
<p>The new schedule takes effect from <em>May 15, 2025</em> and will be reviewed quarterly based on generation capacity from the national grid.</p>
<h3>Distribution Schedule</h3>
<ul>
  <li>Residential zones: 6 AM – 12 AM (18 hours)</li>
  <li>Commercial zones: 24-hour supply (priority grid)</li>
  <li>Maintenance window: 12 AM – 6 AM</li>
</ul>`,
      imageUrl: 'https://picsum.photos/seed/trending-power/800/500',
      classification: ['Utilities'],
      category: 'Utilities',
      breaking: false,
      sourceUrl: 'https://example.com/news/6', sourceName: 'Lagos State Electricity Distribution Company',
      status: 'active', views: 3870,
      publishedAt: '2025-05-08T14:00:00Z', createdAt: '2025-05-08T14:00:00Z',
    },
    {
      id: 7, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-state-water-project-phase-2-launch',
      title: 'Lagos State Water Project Phase 2 Launched',
      summary: 'The second phase of the Lagos Water Renewal Project will bring potable water to 12 additional LGAs.',
      body: `<h2>Clean Water for All</h2><p>The Lagos State Ministry of Environment has officially launched Phase 2 of the Water Renewal Project, covering 12 underserved LGAs with new pipe networks and treatment facilities.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend7/800/500', classification: ['Infrastructure'], category: 'Infrastructure', breaking: false,
      sourceUrl: 'https://example.com/news/7', sourceName: 'Lagos State Ministry of Environment',
      status: 'active', views: 3200, publishedAt: '2025-05-07T08:00:00Z', createdAt: '2025-05-07T08:00:00Z',
    },
    {
      id: 8, lgaId: 11, lgaName: 'Apapa', targetAllLGAs: false,
      slug: 'yola-road-resurfacing-project-commences',
      title: 'Apapa Road Resurfacing Project Commences',
      summary: 'Seven major roads in Apapa are set to be resurfaced over the next 60 days as part of the urban renewal drive.',
      body: `<h2>Smoother Roads Ahead</h2><p>The Apapa LGA Secretariat has announced commencement of the road resurfacing project covering seven arterial roads including the main highway, Apapa-Oshodi road, and other key streets.</p><ul><li>Main Highway</li><li>Apapa-Oshodi Road</li><li>Wharf Road Bypass</li><li>Market Road</li></ul>`,
      imageUrl: 'https://picsum.photos/seed/trend8/800/500', classification: ['Infrastructure'], category: 'Infrastructure', breaking: false,
      sourceUrl: 'https://example.com/news/8', sourceName: 'Apapa LGA Secretariat',
      status: 'active', views: 2900, publishedAt: '2025-05-06T10:00:00Z', createdAt: '2025-05-06T10:00:00Z',
    },
    {
      id: 9, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-free-wifi-zones-expansion-2025',
      title: 'Lagos Expands Free Public Wi-Fi to 50 New Locations',
      summary: 'The Lagos Smart State initiative will deploy free high-speed public Wi-Fi across 50 new locations in Q3 2025.',
      body: `<h2>Digital Lagos</h2><p>As part of the Smart Lagos initiative, the state government has announced free public Wi-Fi deployment to 50 additional locations including bus terminals, markets, and community centres.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend9/800/500', classification: ['Technology'], category: 'Technology', breaking: false,
      sourceUrl: 'https://example.com/news/9', sourceName: 'Lagos Smart State Office',
      status: 'active', views: 2700, publishedAt: '2025-05-05T12:00:00Z', createdAt: '2025-05-05T12:00:00Z',
    },
    {
      id: 10, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-health-insurance-scheme-new-beneficiaries',
      title: 'Lagos Health Insurance Scheme Enrolls 100,000 New Beneficiaries',
      summary: 'The Lagos State Health Management Agency has enrolled 100,000 new low-income residents into the state health insurance scheme.',
      body: `<h2>Healthcare for Everyone</h2><p>LASHMA has announced the successful enrollment of 100,000 additional beneficiaries under the Lagos State Health Insurance Scheme, bringing total coverage to over 800,000 residents.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend10/800/500', classification: ['Health'], category: 'Health', breaking: false,
      sourceUrl: 'https://example.com/news/10', sourceName: 'LASHMA',
      status: 'active', views: 2500, publishedAt: '2025-05-04T09:00:00Z', createdAt: '2025-05-04T09:00:00Z',
    },
    {
      id: 11, lgaId: 3, lgaName: 'Alimosho', targetAllLGAs: false,
      slug: 'alimosho-new-market-construction-begins',
      title: 'Alimosho New Central Market Construction Begins',
      summary: 'Ground has finally been broken on the long-awaited Alimosho Central Market, which will accommodate over 2,000 traders.',
      body: `<h2>A Market for the People</h2><p>After months of anticipation, construction of the new Alimosho Central Market has officially commenced. The facility will host 2,000 stalls and include modern sanitation, cold storage, and security infrastructure.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend11/800/500', classification: ['Economy'], category: 'Economy', breaking: false,
      sourceUrl: 'https://example.com/news/11', sourceName: 'Alimosho LGA Secretariat',
      status: 'active', views: 2200, publishedAt: '2025-05-03T11:00:00Z', createdAt: '2025-05-03T11:00:00Z',
    },
    {
      id: 12, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-brt-expansion-six-new-routes',
      title: 'Lagos BRT Network Expands With Six New Routes',
      summary: 'The Lagos Bus Rapid Transit network will add six new routes connecting underserved communities to commercial districts.',
      body: `<h2>Better Public Transport</h2><p>LAMATA has announced the addition of six new BRT routes to the existing network, covering areas including Badagry, Ikorodu, and Epe corridors.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend12/800/500', classification: ['Infrastructure'], category: 'Infrastructure', breaking: false,
      sourceUrl: 'https://example.com/news/12', sourceName: 'LAMATA',
      status: 'active', views: 2100, publishedAt: '2025-05-02T14:00:00Z', createdAt: '2025-05-02T14:00:00Z',
    },
    {
      id: 13, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-state-flood-early-warning-system',
      title: 'Lagos Deploys Flood Early Warning System Across 12 LGAs',
      summary: 'A new flood early warning system using IoT sensors will alert residents up to 6 hours before flooding events.',
      body: `<h2>Protecting Lives</h2><p>The Lagos State Emergency Management Agency has deployed a network of IoT water-level sensors across 12 flood-prone LGAs. The system sends SMS and app alerts up to 6 hours before predicted flooding.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend13/800/500', classification: ['Environment'], category: 'Environment', breaking: true,
      sourceUrl: 'https://example.com/news/13', sourceName: 'LASEMA',
      status: 'active', views: 1900, publishedAt: '2025-05-01T08:00:00Z', createdAt: '2025-05-01T08:00:00Z',
    },
    {
      id: 14, lgaId: 11, lgaName: 'Ikeja', targetAllLGAs: false,
      slug: 'ikeja-community-policing-volunteers-recruited',
      title: 'Ikeja Recruits 500 Community Policing Volunteers',
      summary: 'Ikeja LGA has recruited and trained 500 community policing volunteers to support safety across 20 wards.',
      body: `<h2>Community Safety First</h2><p>In a landmark security initiative, Ikeja LGA has recruited and completed basic training for 500 community policing volunteers. The volunteers will work alongside police officers in all 20 wards.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend14/800/500', classification: ['Security'], category: 'Security', breaking: false,
      sourceUrl: 'https://example.com/news/14', sourceName: 'Ikeja LGA Security Committee',
      status: 'active', views: 1700, publishedAt: '2025-04-30T10:00:00Z', createdAt: '2025-04-30T10:00:00Z',
    },
    {
      id: 15, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-state-youth-entrepreneurship-fund-2025',
      title: 'Lagos State Launches ₦5 Billion Youth Entrepreneurship Fund',
      summary: 'Young entrepreneurs aged 18-35 can now apply for grants of up to ₦500,000 under the new state fund.',
      body: `<h2>Investing in Youth</h2><p>The Lagos State Employment Trust Fund has launched a ₦5 billion youth entrepreneurship scheme. Grants of up to ₦500,000 are available for businesses in tech, agriculture, fashion, and food processing sectors.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend15/800/500', classification: ['Economy'], category: 'Economy', breaking: false,
      sourceUrl: 'https://example.com/news/15', sourceName: 'LSETF',
      status: 'active', views: 1600, publishedAt: '2025-04-29T09:00:00Z', createdAt: '2025-04-29T09:00:00Z',
    },
    {
      id: 16, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'state-wide-vaccination-drive-june-2025',
      title: 'Lagos State Vaccination Drive Targets 2 Million Residents in June',
      summary: 'A state-wide vaccination campaign for typhoid, hepatitis B, and meningitis will run across all LGAs in June.',
      body: `<h2>Public Health Drive</h2><p>The Lagos State Ministry of Health will conduct a free vaccination campaign from June 1–30, targeting 2 million residents. Vaccines will be administered at all primary health centres and designated community points.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend16/800/500', classification: ['Health'], category: 'Health', breaking: false,
      sourceUrl: 'https://example.com/news/16', sourceName: 'Lagos State Ministry of Health',
      status: 'active', views: 1500, publishedAt: '2025-04-28T12:00:00Z', createdAt: '2025-04-28T12:00:00Z',
    },
    {
      id: 17, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-free-school-meals-programme-expansion',
      title: 'Lagos Free School Meals Programme Expands to 800 Schools',
      summary: 'The Lagos Home Grown School Feeding Programme now covers 800 public primary schools across all 20 LGAs.',
      body: `<h2>Feeding the Future</h2><p>Over 400,000 pupils will receive one free nutritious meal daily under the expanded programme.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend17/800/500', classification: ['Education'], category: 'Education', breaking: false,
      sourceUrl: 'https://example.com/news/17', sourceName: 'Lagos State Ministry of Education',
      status: 'active', views: 1400, publishedAt: '2025-04-27T09:00:00Z', createdAt: '2025-04-27T09:00:00Z',
    },
    {
      id: 18, lgaId: 11, lgaName: 'Ikeja', targetAllLGAs: false,
      slug: 'ikeja-waste-management-new-collection-schedule',
      title: 'Ikeja Announces New Twice-Weekly Waste Collection',
      summary: 'Waste collection in Ikeja LGA updated to twice weekly — Tuesdays and Fridays — across all 20 wards.',
      body: `<h2>Cleaner Ikeja</h2><p>Following resident complaints, Ikeja LGA has contracted additional waste collection trucks. Collections now happen every Tuesday and Friday.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend18/800/500', classification: ['Environment'], category: 'Environment', breaking: false,
      sourceUrl: 'https://example.com/news/18', sourceName: 'Ikeja LGA Environmental Services',
      status: 'active', views: 1300, publishedAt: '2025-04-26T10:00:00Z', createdAt: '2025-04-26T10:00:00Z',
    },
    {
      id: 19, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-transport-workers-salary-increase-2025',
      title: 'Lagos Public Transport Workers to Receive 30% Pay Rise',
      summary: 'Bus drivers and conductors in the public transport network will receive a 30% pay increase effective June 1.',
      body: `<h2>Fair Pay for Workers</h2><p>Following negotiations with the Lagos State Transport Workers Union, a 30% salary increase for all public transport workers takes effect June 1, 2025.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend19/800/500', classification: ['Economy'], category: 'Economy', breaking: false,
      sourceUrl: 'https://example.com/news/19', sourceName: 'Lagos State Ministry of Labour',
      status: 'active', views: 1200, publishedAt: '2025-04-25T11:00:00Z', createdAt: '2025-04-25T11:00:00Z',
    },
    {
      id: 20, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-women-empowerment-fund-applications-open-2025',
      title: 'Lagos Women Empowerment Fund Opens Applications',
      summary: 'Women-owned businesses can apply for grants of up to ₦1 million under the 2025 Lagos State Women Empowerment Fund.',
      body: `<h2>Empowering Women</h2><p>The Lagos State Women Affairs Ministry has opened applications for the 2025 Women Empowerment Fund. Grants of up to ₦1 million are available for women-owned businesses.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend20/800/500', classification: ['Economy'], category: 'Economy', breaking: false,
      sourceUrl: 'https://example.com/news/20', sourceName: 'Lagos State Ministry of Women Affairs',
      status: 'active', views: 1100, publishedAt: '2025-04-24T09:00:00Z', createdAt: '2025-04-24T09:00:00Z',
    },
    {
      id: 21, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-15-new-community-recycling-centres',
      title: 'Lagos Opens 15 New Community Recycling Centres',
      summary: 'Residents can now drop off recyclables at 15 new community recycling points managed by LAWMA across Lagos.',
      body: `<h2>Greener Lagos</h2><p>LAWMA has opened 15 new community recycling centres. Residents can drop off plastic, paper, glass, and e-waste for free recycling.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend21/800/500', classification: ['Environment'], category: 'Environment', breaking: false,
      sourceUrl: 'https://example.com/news/21', sourceName: 'LAWMA',
      status: 'active', views: 1000, publishedAt: '2025-04-23T10:00:00Z', createdAt: '2025-04-23T10:00:00Z',
    },
    {
      id: 22, lgaId: 11, lgaName: 'Ikeja', targetAllLGAs: false,
      slug: 'ikeja-12-primary-schools-renovation-complete',
      title: 'Ikeja LGA Completes Renovation of 12 Primary Schools',
      summary: 'Twelve public primary schools in Ikeja now have new classrooms, libraries, computer labs, and sanitation facilities.',
      body: `<h2>Better Learning Environments</h2><p>All 12 schools in the Ikeja LGA school renovation programme are now complete, featuring new classrooms, libraries, computer labs, and modern toilets.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend22/800/500', classification: ['Education'], category: 'Education', breaking: false,
      sourceUrl: 'https://example.com/news/22', sourceName: 'Ikeja LGA Education Desk',
      status: 'active', views: 950, publishedAt: '2025-04-22T11:00:00Z', createdAt: '2025-04-22T11:00:00Z',
    },
    {
      id: 23, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-online-permit-portal-7-day-processing',
      title: 'Lagos Online Permit Portal Cuts Processing Time to 7 Days',
      summary: 'The new integrated portal for business and building permits reduces processing time from 30 days to just 7 working days.',
      body: `<h2>Digital Government Services</h2><p>The Lagos State Land Bureau has launched an integrated online portal for business registration, building permits, and event licences. Average processing time drops from 30 to 7 working days.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend23/800/500', classification: ['Governance'], category: 'Governance', breaking: false,
      sourceUrl: 'https://example.com/news/23', sourceName: 'Lagos State Land Bureau',
      status: 'active', views: 900, publishedAt: '2025-04-21T09:00:00Z', createdAt: '2025-04-21T09:00:00Z',
    },
    {
      id: 24, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-25-community-sports-facilities-renovation',
      title: 'Lagos Renovates 25 Community Sports Facilities',
      summary: 'Twenty-five football pitches, basketball courts, and swimming pools across Lagos will be upgraded to international standards.',
      body: `<h2>Sports for All</h2><p>The Lagos State Sports Commission has commenced renovation of 25 community sports facilities across all 20 LGAs.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend24/800/500', classification: ['Engagement'], category: 'Engagement', breaking: false,
      sourceUrl: 'https://example.com/news/24', sourceName: 'Lagos State Sports Commission',
      status: 'active', views: 850, publishedAt: '2025-04-20T10:00:00Z', createdAt: '2025-04-20T10:00:00Z',
    },
    {
      id: 25, lgaId: null, lgaName: null, targetAllLGAs: true,
      slug: 'lagos-senior-citizens-monthly-stipend-programme',
      title: 'Lagos Launches ₦10,000 Monthly Stipend for Senior Citizens',
      summary: 'Residents aged 65 and above who meet income criteria will receive a ₦10,000 monthly stipend under the new Senior Citizens Support Programme.',
      body: `<h2>Caring for Our Elders</h2><p>The Lagos State Ministry of Establishment has launched the Senior Citizens Support Programme. Eligible residents aged 65+ can register from May 30.</p>`,
      imageUrl: 'https://picsum.photos/seed/trend25/800/500', classification: ['Governance'], category: 'Governance', breaking: false,
      sourceUrl: 'https://example.com/news/25', sourceName: 'Lagos State Ministry of Establishment',
      status: 'active', views: 800, publishedAt: '2025-04-19T11:00:00Z', createdAt: '2025-04-19T11:00:00Z',
    },
  ],

  // ── Notifications ─────────────────────────────────────────────────────
  // category: 'Official' | 'Community' | 'Security Alert' | 'Event'
  // priority: 'high' | 'normal'
  // actorName / actorAvatarUrl: for Community notifications that show a user avatar
  // linkTo: optional internal route to navigate to on click
  notifications: [
    {
      id: 1, userId: 1,
      category: 'Official', priority: 'high',
      title: 'New City Infrastructure Proposal',
      body: 'The District 4 planning committee has released the draft for the new Emerald Green Belt expansion. Review the impact report now.',
      actorName: null, actorAvatarUrl: null,
      linkTo: '/trending', isRead: false,
      createdAt: '2025-05-13T10:00:00Z',
    },
    {
      id: 2, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Sarah J. replied to your post',
      body: '"I completely agree with your point about the park lighting. We should definitely bring this up at the next meeting!"',
      actorName: 'Sarah J.', actorAvatarUrl: null,
      linkTo: '/chat', isRead: false,
      createdAt: '2025-05-13T07:00:00Z',
    },
    {
      id: 3, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Musa Lamidi. replied to your post',
      body: '"I completely agree with your point about the park lighting. We should definitely bring this up at the next meeting!"',
      actorName: 'Musa Lamidi', actorAvatarUrl: null,
      linkTo: '/chat', isRead: false,
      createdAt: '2025-05-13T07:00:00Z',
    },
    {
      id: 4, userId: 1,
      category: 'Security Alert', priority: 'high',
      title: 'New login detected',
      body: 'Your account was accessed from a new device in LGA 2, OR. If this wasn\'t you, please secure your account.',
      actorName: null, actorAvatarUrl: null,
      linkTo: '/settings', isRead: true,
      createdAt: '2025-05-12T14:00:00Z',
    },
    {
      id: 5, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Local Cleanup Event starts in 1 hour',
      body: 'Join 42 neighbors at the Central Plaza. Don\'t forget to bring gloves!',
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-12T09:00:00Z',
    },
    {
      id: 6, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'Healthcare Programme Registration Open',
      body: 'Registration for the Ikeja Free Healthcare Initiative is now open. Visit the Events page to register.',
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-10T09:15:00Z',
    },
    {
      id: 7, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'New Street Lighting Policy Announced',
      body: "All residential streets in Ikeja will receive solar-powered lighting by Q4 2025. Residents are advised to report faulty units via Lagos Konect.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/trending', isRead: false,
      createdAt: '2025-05-12T08:00:00Z',
    },
    {
      id: 8, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Chidi O. liked your post',
      body: "Great point about the drainage issue on your street.",
      actorName: 'Chidi O', actorAvatarUrl: null,
      linkTo: '/chat', isRead: false,
      createdAt: '2025-05-11T09:00:00Z',
    },
    {
      id: 9, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Town Hall Meeting Tomorrow',
      body: "The Ikeja Q3 budget review town hall holds tomorrow at 10am. Register now to attend virtually via Lagos Konect.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: false,
      createdAt: '2025-05-10T10:00:00Z',
    },
    {
      id: 10, userId: 1,
      category: 'Official', priority: 'high',
      title: 'Emergency Water Supply Notice',
      body: "Water supply will be interrupted in zones 3–7 on May 20 for 6 hours due to maintenance work on the main pipeline.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/trending', isRead: true,
      createdAt: '2025-05-09T11:00:00Z',
    },
    {
      id: 11, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Fatima Y. replied to your post',
      body: "Has anyone contacted the LGA office directly about this? I'd suggest escalating through Lagos Konect.",
      actorName: 'Fatima Y', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-05-08T12:00:00Z',
    },
    {
      id: 12, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Free Legal Aid Clinic — Tomorrow',
      body: "Free legal aid is available at the Ikeja Community Centre tomorrow from 9am to 3pm. First come, first served.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-07T13:00:00Z',
    },
    {
      id: 13, userId: 1,
      category: 'Security Alert', priority: 'high',
      title: 'Scam Alert: Fake LGA Officials',
      body: "Residents are warned about individuals posing as LGA officials and collecting unauthorized levies. Report all suspicious activity immediately.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/settings', isRead: true,
      createdAt: '2025-05-06T14:00:00Z',
    },
    {
      id: 14, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'Waste Collection Schedule Updated',
      body: "The waste collection schedule for Ikeja LGA has been updated. Collections now happen every Tuesday and Friday.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-05T15:00:00Z',
    },
    {
      id: 15, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Ngozi A. commented on your post',
      body: "This is exactly the kind of community action we need.Well done for speaking up!",
      actorName: 'Ngozi A', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-05-04T16:00:00Z',
    },
    {
      id: 16, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Digital Skills Training Registration Closes Friday',
      body: "Only 20 spots remain for the July cohort of the Ikeja Digital Skills Programme. Register before Friday.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-03T17:00:00Z',
    },
    {
      id: 17, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'New Health Centre Opens in Ward 5',
      body: "A new primary health care centre has opened in Ward 5, Ikeja. Services include maternal care, immunisation, and general outpatient.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/trending', isRead: true,
      createdAt: '2025-05-02T18:00:00Z',
    },
    {
      id: 18, userId: 1,
      category: 'Security Alert', priority: 'normal',
      title: 'Power Outage Scheduled',
      body: "EKEDC will carry out maintenance on the Ikeja East feeder on May 22 from 8am to 5pm. Prepare accordingly.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T19:00:00Z',
    },
    {
      id: 19, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Amina Y. replied to your post',
      body: "I completely agree.The LGA needs to hear from more residents on this.",
      actorName: 'Amina Y', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-05-01T08:00:00Z',
    },
    {
      id: 20, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Youth Summit Registration Open',
      body: "The Annual Ikeja Youth Empowerment Summit holds on June 15. Register now at the Events page to secure your spot.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T09:00:00Z',
    },
    {
      id: 21, userId: 1,
      category: 'Official', priority: 'high',
      title: 'Road Closure Notice: Oba Akran Avenue',
      body: "Oba Akran Avenue will be closed from May 25 to June 5 for emergency drainage repairs. Use alternative routes.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/trending', isRead: true,
      createdAt: '2025-05-01T10:00:00Z',
    },
    {
      id: 22, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Marcus T. liked your comment',
      body: "Your comment on the Waste Management thread received a new like.",
      actorName: 'Marcus T', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-05-01T11:00:00Z',
    },
    {
      id: 23, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Community Clean-up — Saturday 7am',
      body: "Join your neighbours for the monthly community clean-up. Gloves and bags provided. Meet at the Ikeja Town Hall.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T12:00:00Z',
    },
    {
      id: 24, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'LGA Budget Summary Published',
      body: "The Q2 2025 Ikeja LGA budget summary is now available for public review on the Lagos Konect portal.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/trending', isRead: true,
      createdAt: '2025-05-01T13:00:00Z',
    },
    {
      id: 25, userId: 1,
      category: 'Security Alert', priority: 'high',
      title: 'Flooding Risk: Moderate Alert',
      body: "The Ikeja flood early warning system has issued a moderate flooding alert for low-lying areas near Agege Motor Road.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T14:00:00Z',
    },
    {
      id: 26, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Abdul B. replied to your post',
      body: "Can we get this added to the next town hall agenda? I think it needs broader attention.",
      actorName: 'Abdul B', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-05-01T15:00:00Z',
    },
    {
      id: 27, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Free Eye Screening — Ikeja LGA Hall',
      body: "Free eye screening and glasses distribution holds at the Ikeja LGA Hall on June 3. No registration required.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T16:00:00Z',
    },
    {
      id: 28, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'Traffic Light Repairs Completed',
      body: "All 12 faulty traffic light units in Ikeja have been repaired and are now fully operational.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T17:00:00Z',
    },
    {
      id: 29, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Emeka N. commented on the community chat',
      body: "Anyone know when the new market in Alimosho is expected to open to traders?",
      actorName: 'Emeka N', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-05-01T18:00:00Z',
    },
    {
      id: 30, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Women in Leadership Forum',
      body: "A free forum for women in civic leadership holds at the Ikeja LGA multipurpose hall on June 7 at 10am.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T19:00:00Z',
    },
    {
      id: 31, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'New Online Portal for Permits',
      body: "Residents can now apply for building permits, event permits, and business licenses online through the new LGA portal.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T08:00:00Z',
    },
    {
      id: 32, userId: 1,
      category: 'Security Alert', priority: 'normal',
      title: 'Neighbourhood Watch Alert',
      body: "An increase in motorcycle theft has been reported in the Oregun area. Secure your vehicles and report suspicious activity.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/settings', isRead: true,
      createdAt: '2025-05-01T09:00:00Z',
    },
    {
      id: 33, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Khadijat J. liked your post',
      body: "Your post about the Allen Avenue road works received a new like.",
      actorName: 'Khadijat J', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-05-01T10:00:00Z',
    },
    {
      id: 34, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Civic Townhall Q3 — Register Now',
      body: "The Q3 2025 Ikeja Civic Townhall is scheduled for July 15 at 10am. Register on Lagos Konect to attend and submit questions.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T11:00:00Z',
    },
    {
      id: 35, userId: 1,
      category: 'Official', priority: 'normal',
      title: 'Property Tax Payment Deadline Extended',
      body: "The 2025 property tax payment deadline has been extended from June 30 to July 31. Pay via the LGA portal or designated banks.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-05-01T12:00:00Z',
    },
    {
      id: 36, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Elena B. replied to your comment',
      body: "I spoke to someone at the LGA office.They said the project is now fully funded and will start in August.",
      actorName: 'Elena B', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-04-13T13:00:00Z',
    },
    {
      id: 37, userId: 1,
      category: 'Official', priority: 'high',
      title: 'Environmental Sanitation Day — May 31',
      body: "Monthly environmental sanitation holds on May 31 from 7am to 10am. Movement is restricted during this period across all LGAs.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-04-12T14:00:00Z',
    },
    {
      id: 38, userId: 1,
      category: 'Event', priority: 'normal',
      title: 'Agricultural Fair — Ikeja LGA',
      body: "The annual Ikeja Agricultural Fair showcasing local food produce and farming innovations holds June 20–22.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/home', isRead: true,
      createdAt: '2025-04-11T15:00:00Z',
    },
    {
      id: 39, userId: 1,
      category: 'Community', priority: 'normal',
      title: 'Garuba I. replied to your post',
      body: "The flooding issue is really serious.I've been reporting it for months with no response.",
      actorName: 'Garuba I', actorAvatarUrl: null,
      linkTo: '/chat', isRead: true,
      createdAt: '2025-04-10T16:00:00Z',
    },
    {
      id: 40, userId: 1,
      category: 'Security Alert', priority: 'normal',
      title: 'Account Security Reminder',
      body: "We noticed you haven't updated your password in over 90 days. Keep your Lagos Konect account secure.",
      actorName: null, actorAvatarUrl: null,
      linkTo: '/settings', isRead: true,
      createdAt: '2025-04-09T17:00:00Z',
    },
  ],

  // ── Chat / Support Tickets ────────────────────────────────────────────
  chatTickets: [
    {
      id: 1, userId: 1, userName: 'Adaeze Okonkwo', lgaId: 11,
      subject: 'Drainage issue on my street',
      lastMessage: 'The flooding has gotten worse since the last rain.',
      status: 'open', priority: 'high',
      messageCount: 4, createdAt: '2025-05-11T10:00:00Z', updatedAt: '2025-05-13T08:30:00Z',
    },
    {
      id: 2, userId: 2, userName: 'Emeka Nwosu', lgaId: 3,
      subject: 'When is the market being built?',
      lastMessage: 'I heard the groundbreaking was done but no work is ongoing.',
      status: 'active', priority: 'medium',
      messageCount: 7, createdAt: '2025-05-09T14:00:00Z', updatedAt: '2025-05-12T11:00:00Z',
    },
    {
      id: 3, userId: 5, userName: 'Ngozi Adeyemi', lgaId: 20,
      subject: 'Street light out for 3 weeks',
      lastMessage: 'Nobody has come to fix it. It is dangerous at night.',
      status: 'flagged', priority: 'high',
      messageCount: 2, createdAt: '2025-05-07T09:00:00Z', updatedAt: '2025-05-07T09:45:00Z',
    },
    {
      id: 4, userId: 7, userName: 'Amina Yusuf', lgaId: 5,
      subject: 'Thank you for quick response',
      lastMessage: 'The road has been fixed. Thank you very much.',
      status: 'resolved', priority: 'low',
      messageCount: 9, createdAt: '2025-04-28T08:00:00Z', updatedAt: '2025-05-05T10:00:00Z',
    },
  ],

  // ── Chat Messages ─────────────────────────────────────────────────────
  chatMessages: {
    1: [
      { id: 1, ticketId: 1, senderId: 1, senderName: 'Adaeze Okonkwo', senderRole: 'citizen', message: 'Hello, I want to report a drainage problem on my street.', createdAt: '2025-05-11T10:00:00Z' },
      { id: 2, ticketId: 1, senderId: 102, senderName: 'Chidi Okafor', senderRole: 'admin', message: 'Hello Adaeze! Can you provide your street name and nearest landmark?', createdAt: '2025-05-11T10:05:00Z' },
      { id: 3, ticketId: 1, senderId: 1, senderName: 'Adaeze Okonkwo', senderRole: 'citizen', message: 'Salvation Road, close to the LASUTH gate. The drainage channel is blocked.', createdAt: '2025-05-11T10:08:00Z' },
      { id: 4, ticketId: 1, senderId: 1, senderName: 'Adaeze Okonkwo', senderRole: 'citizen', message: 'The flooding has gotten worse since the last rain.', createdAt: '2025-05-13T08:30:00Z' },
    ],
  },

  // ── Adverts ──────────────────────────────────────────────────────────
  adverts: [
    {
      id: 1, title: 'Ikeja Trade Fair 2025', advertiser: 'Ikeja Chamber of Commerce',
      description: 'Enrollment open for traders and business owners.',
      ctaLabel: 'Register Now', ctaUrl: '#',
      imageUrl: 'https://picsum.photos/seed/advert1/400/220',
      targetLgaIds: [11], status: 'active', type: 'banner',
      impressions: 14500, clicks: 892, startDate: '2025-05-01', endDate: '2025-05-31',
      createdAt: '2025-04-28T09:00:00Z',
    },
    {
      id: 2, title: 'Lagos State Skills Acquisition Programme', advertiser: 'Lagos State Government',
      description: 'Free digital and vocational training for residents aged 18–40.',
      ctaLabel: 'Learn More', ctaUrl: '#',
      imageUrl: 'https://picsum.photos/seed/advert2/400/220',
      targetLgaIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      status: 'active', type: 'banner',
      impressions: 98210, clicks: 7650, startDate: '2025-04-15', endDate: '2025-06-15',
      createdAt: '2025-04-10T11:00:00Z',
    },
    {
      id: 3, title: 'AfriHealth Insurance — Free Enrollment', advertiser: 'AfriHealth Ltd',
      imageUrl: null, targetLgaIds: [8, 9, 11], status: 'active', type: 'interstitial',
      impressions: 4200, clicks: 310, startDate: '2025-05-10', endDate: '2025-06-10',
      createdAt: '2025-05-08T14:00:00Z',
    },
  ],

  // ── Analytics ────────────────────────────────────────────────────────
  adminMetrics: {
    totalUsers: 84203, activeUsersToday: 12841,
    newUsersThisWeek: 1203, newUsersLastWeek: 987,
    totalNewsPublished: 342, totalReelsPublished: 118,
    totalChatTickets: 4821, openTickets: 94,
    resolvedTickets: 4727, avgTicketResolutionHours: 6.4,
    totalAdverts: 12, activeAdverts: 7,
  },


  // ── Events ───────────────────────────────────────────────────────────
  // Two types: 'enrollment' (ICT Training style) and 'upcoming' (Civic Townhall style)
  events: [
    {
      id: 1, lgaId: 11, lgaName: 'Ikeja',
      type: 'enrollment',
      title: 'ICT Training 2025',
      description: 'Enrollment open for urban centers. Learn digital skills and boost your employability.',
      imageUrl: null, category: 'Education',
      enrollmentOpen: true, enrollmentDeadline: '2025-06-15',
      eventDate: '2025-07-01', location: 'Ikeja LGA Hall, Computer Room A',
      targetAllLGAs: false, status: 'published',
      authorId: 101, authorName: 'Oluwaseun Adeyemi',
      createdAt: '2025-05-01T09:00:00Z',
    },
    {
      id: 2, lgaId: 11, lgaName: 'Ikeja',
      type: 'upcoming',
      title: 'Civic Townhall Q3',
      description: 'Join the discussion. Residents are invited to engage with LGA officials on key community issues.',
      imageUrl: null, category: 'Governance',
      enrollmentOpen: false, enrollmentDeadline: null,
      eventDate: '2025-07-15', location: 'Ikeja Town Hall',
      targetAllLGAs: false, status: 'published',
      authorId: 102, authorName: 'Chidi Okafor',
      createdAt: '2025-05-05T10:00:00Z',
    },
    {
      id: 3, lgaId: null, lgaName: null,
      type: 'upcoming',
      title: 'Lagos State Digital Economy Summit',
      description: 'State-wide summit on technology and civic innovation.',
      imageUrl: null, category: 'Technology',
      enrollmentOpen: true, enrollmentDeadline: '2025-06-30',
      eventDate: '2025-08-10', location: 'Eko Convention Centre, Lagos',
      targetAllLGAs: true, status: 'published',
      authorId: 101, authorName: 'Oluwaseun Adeyemi',
      createdAt: '2025-05-08T11:00:00Z',
    },
  ],

  // ── Community Posts ───────────────────────────────────────────────────
  posts: [
    {
      id: 1, userId: 1, userName: 'Adaeze Okonkwo', avatarUrl: null,
      lgaId: 11, lgaName: 'Ikeja',
      text: 'The drainage on Salvation Road is still blocked. It\'s been 3 weeks since I reported it. Can anyone advise on how to escalate?',
      mediaUrl: null, status: 'approved', likes: 12,
      createdAt: '2025-05-12T08:30:00Z',
    },
    {
      id: 2, userId: 4, userName: 'Chukwuemeka Eze', avatarUrl: null,
      lgaId: 11, lgaName: 'Ikeja',
      text: 'Attended the free medical outreach at LASUTH yesterday. Excellent service. Well done to the LGA team!',
      mediaUrl: null, status: 'approved', likes: 34,
      createdAt: '2025-05-11T14:00:00Z',
    },
    {
      id: 3, userId: 2, userName: 'Emeka Nwosu', avatarUrl: null,
      lgaId: 3, lgaName: 'Alimosho',
      text: 'When is the new market going to be open? The groundbreaking was months ago and nothing is happening.',
      mediaUrl: null, status: 'approved', likes: 8,
      createdAt: '2025-05-10T09:00:00Z',
    },
    {
      id: 4, userId: 5, userName: 'Ngozi Adeyemi', avatarUrl: null,
      lgaId: 20, lgaName: 'Surulere',
      text: 'Street light on our block has been out for 3 weeks. Very dangerous at night.',
      mediaUrl: null, status: 'pending', likes: 0,
      createdAt: '2025-05-13T07:00:00Z',
    },
    {
      id: 5, userId: 1, userName: 'Adaeze Okonkwo', avatarUrl: null,
      lgaId: 11, lgaName: 'Ikeja',
      text: 'The new BRT stop on Obafemi Awolowo Way is a game changer for commuters in this area. Cut my travel time by 40 minutes.',
      mediaUrl: null, status: 'approved', likes: 28,
      createdAt: '2025-05-09T11:00:00Z',
    },
    {
      id: 6, userId: 1, userName: 'Adaeze Okonkwo', avatarUrl: null,
      lgaId: 11, lgaName: 'Ikeja',
      text: 'Attended the budget review town hall yesterday. Happy to see 30% allocated to infrastructure. But when will the Oregun road be fixed?',
      mediaUrl: null, status: 'approved', likes: 45,
      createdAt: '2025-05-07T09:30:00Z',
    },
    {
      id: 7, userId: 1, userName: 'Adaeze Okonkwo', avatarUrl: null,
      lgaId: 11, lgaName: 'Ikeja',
      text: 'Is there any update on the Ikeja solar street lights project? The installation crew was here last week but haven\'t returned.',
      mediaUrl: null, status: 'pending', likes: 0,
      createdAt: '2025-05-13T15:00:00Z',
    },
  ],

  // ── Reel Comments ─────────────────────────────────────────────────────
  // Keyed by reelId
  // ── Reel Comments ─────────────────────────────────────────────────────
  // Keyed by reelId (alphanumeric). avatarUrl null = initials fallback.
  reelComments: {
    'reel_a3f9k2': [
      { id: 1, reelId: 'reel_a3f9k2', userId: 1, userName: 'Marcus Thomas', avatarUrl: null, text: 'This is exactly what the South District needs. Hopefully the implementation phase includes local student volunteers!', createdAt: '2025-05-13T11:45:00Z' },
      { id: 2, reelId: 'reel_a3f9k2', userId: 4, userName: 'Abdul Badal', avatarUrl: null, text: 'Can we get a map of the specific planting locations? My neighborhood is quite heat-stressed.', createdAt: '2025-05-13T12:00:00Z' },
      { id: 3, reelId: 'reel_a3f9k2', userId: 2, userName: 'Aliyah Kofo', avatarUrl: null, text: 'Can we get a map of the specific planting locations? My neighborhood is quite heat-stressed.', createdAt: '2025-05-13T12:05:00Z' },
      { id: 4, reelId: 'reel_a3f9k2', userId: 5, userName: 'Khadijat Jinadu', avatarUrl: null, text: 'This is exactly what the South District needs. Hopefully the implementation phase includes local student volunteers!', createdAt: '2025-05-13T12:30:00Z' },
      { id: 5, reelId: 'reel_a3f9k2', userId: 7, userName: 'Elena Bisola', avatarUrl: null, text: 'Can we get a map of the specific planting locations? My neighborhood is quite heat-stressed.', createdAt: '2025-05-13T12:45:00Z' },
      { id: 6, reelId: 'reel_a3f9k2', userId: 8, userName: 'Garuba Ibrahim', avatarUrl: null, text: 'Can we get a map of the specific planting locations? My neighborhood is quite heat-stressed.', createdAt: '2025-05-13T13:00:00Z' },
    ],
    'reel_b7m1x5': [
      { id: 1, reelId: 'reel_b7m1x5', userId: 5, userName: 'Ngozi Adeyemi', avatarUrl: null, text: 'Great summary. Wish I was there.', createdAt: '2025-05-12T16:00:00Z' },
    ],
    'reel_c2p8n7': [],
    'reel_d5q3r1': [],
    'reel_e9w4t6': [],
    'reel_f1k7y3': [],
  },

  // ── LGA Group Chat Messages ────────────────────────────────────────────
  // Keyed by lgaId. Persistent, supports text, images, files.
  // reactions: { emoji: [userId, ...] }
  // replyTo: { id, userName, text } — quoted reply preview
  lgaChatMessages: {
    11: [
      {
        id: 1, lgaId: 11, userId: 2, userName: 'Ayo Balogun', avatarUrl: null,
        text: 'Has anyone heard about the new waste management schedule for Phase 1? I heard they\'re moving collections to Tuesdays.',
        mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
        reactions: {}, replyTo: null, createdAt: '2025-05-13T10:42:00Z'
      },
      {
        id: 2, lgaId: 11, userId: 4, userName: 'Musa Bello', avatarUrl: null,
        text: 'Yes, Ayo! The councillor confirmed it during the Urban Planning meeting yesterday. It\'s part of the new \'Green LGA 1\' initiative. 🌿',
        mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
        reactions: { '👍': [1, 5, 7, 8, 3, 6, 2, 4, 9, 10, 11, 12] }, replyTo: null, createdAt: '2025-05-13T10:45:00Z'
      },
      {
        id: 3, lgaId: 11, userId: 1, userName: 'Adaeze Okonkwo', avatarUrl: null,
        text: 'That\'s great news.Do we have a digital copy of the full schedule? I\'d like to share it with my neighbors on LGA 1 Road.',
        mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
        reactions: {}, replyTo: { id: 2, userName: 'Musa Bello', text: 'Yes, Ayo! The councillor confirmed it...' }, createdAt: '2025-05-13T11:02:00Z'
      },
      {
        id: 4, lgaId: 11, userId: 5, userName: 'Fatima Yusuf', avatarUrl: null,
        text: 'I\'m uploading the PDF to the Resources tab now.Give it a minute! Also, the town hall meeting on Friday will discuss the new street lighting project.',
        mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
        reactions: {}, replyTo: null, createdAt: '2025-05-13T11:05:00Z'
      },
      {
        id: 5, lgaId: 11, userId: 5, userName: 'Fatima Yusuf', avatarUrl: null,
        text: null, mediaUrl: null,
        fileUrl: '/assets/mock/LGA1_Waste_Mgt_2026.pdf',
        fileName: 'LGA1_Waste_Mgt_2026.pdf', fileSize: '2.4 MB',
        reactions: {}, replyTo: null, createdAt: '2025-05-13T11:05:30Z'
      },
    ],
    3: [
      {
        id: 1, lgaId: 3, userId: 2, userName: 'Emeka Nwosu', avatarUrl: null,
        text: 'Alimosho people, when is the market opening?',
        mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
        reactions: {}, replyTo: null, createdAt: '2025-05-12T10:00:00Z'
      },
    ],
  },

  // ── Support Tickets (admin chat) ──────────────────────────────────────
  supportTickets: [
    {
      id: 1, userId: 1, userName: 'Adaeze Okonkwo', lgaId: 11,
      subject: 'Drainage issue on my street',
      lastMessage: 'The flooding has gotten worse since the last rain.',
      status: 'open', priority: 'high',
      messageCount: 4, createdAt: '2025-05-11T10:00:00Z', updatedAt: '2025-05-13T08:30:00Z',
    },
    {
      id: 2, userId: 2, userName: 'Emeka Nwosu', lgaId: 3,
      subject: 'When is the market being built?',
      lastMessage: 'I heard the groundbreaking was done but no work is ongoing.',
      status: 'active', priority: 'medium',
      messageCount: 7, createdAt: '2025-05-09T14:00:00Z', updatedAt: '2025-05-12T11:00:00Z',
    },
    {
      id: 3, userId: 5, userName: 'Ngozi Adeyemi', lgaId: 20,
      subject: 'Street light out for 3 weeks',
      lastMessage: 'Nobody has come to fix it. It is dangerous at night.',
      status: 'flagged', priority: 'high',
      messageCount: 2, createdAt: '2025-05-07T09:00:00Z', updatedAt: '2025-05-07T09:45:00Z',
    },
    {
      id: 4, userId: 7, userName: 'Amina Yusuf', lgaId: 5,
      subject: 'Thank you for quick response',
      lastMessage: 'The road has been fixed. Thank you very much.',
      status: 'resolved', priority: 'low',
      messageCount: 9, createdAt: '2025-04-28T08:00:00Z', updatedAt: '2025-05-05T10:00:00Z',
    },
  ],

  // ── Support Messages (admin chat) ─────────────────────────────────────
  // Keyed by ticketId
  supportMessages: {
    1: [
      { id: 1, ticketId: 1, senderId: 1, senderName: 'Adaeze Okonkwo', senderRole: 'citizen', text: 'Hello, I want to report a drainage problem on my street.', createdAt: '2025-05-11T10:00:00Z' },
      { id: 2, ticketId: 1, senderId: 102, senderName: 'Chidi Okafor', senderRole: 'admin', text: 'Hello Adaeze! Thank you for reaching out. Can you provide your street name and nearest landmark?', createdAt: '2025-05-11T10:05:00Z' },
      { id: 3, ticketId: 1, senderId: 1, senderName: 'Adaeze Okonkwo', senderRole: 'citizen', text: 'Salvation Road, close to the LASUTH gate. The drainage channel is blocked.', createdAt: '2025-05-11T10:08:00Z' },
      { id: 4, ticketId: 1, senderId: 1, senderName: 'Adaeze Okonkwo', senderRole: 'citizen', text: 'The flooding has gotten worse since the last rain.', createdAt: '2025-05-13T08:30:00Z' },
    ],
  },

  trafficData: {
    daily: [
      { date: '2025-05-07', pageViews: 34200, uniqueVisitors: 12100 },
      { date: '2025-05-08', pageViews: 38900, uniqueVisitors: 13400 },
      { date: '2025-05-09', pageViews: 31200, uniqueVisitors: 11800 },
      { date: '2025-05-10', pageViews: 42100, uniqueVisitors: 15200 },
      { date: '2025-05-11', pageViews: 39800, uniqueVisitors: 14300 },
      { date: '2025-05-12', pageViews: 28400, uniqueVisitors: 10900 },
      { date: '2025-05-13', pageViews: 45600, uniqueVisitors: 16800 },
    ],
    topLGAs: [
      { lgaId: 11, lgaName: 'Ikeja', sessions: 18420 },
      { lgaId: 3, lgaName: 'Alimosho', sessions: 14830 },
      { lgaId: 8, lgaName: 'Eti-Osa', sessions: 11200 },
      { lgaId: 20, lgaName: 'Surulere', sessions: 9840 },
      { lgaId: 15, lgaName: 'Lagos Mainland', sessions: 8320 },
    ],
    deviceBreakdown: { mobile: 74, desktop: 19, tablet: 7 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Simulates network latency */
export const _delay = (ms = MOCK_DELAY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Wraps data in a success envelope */
export const _ok = (data, meta = {}) => ({ data, meta });

/** Wraps an error in an error envelope */
export const _err = (code, message) => ({ error: { code, message } });

/**
 * Validates that the current session has the required role.
 * UX-only guard — server enforces the same rules on every API call.
 */
export function _requireRole(requiredRole) {
  if (!store.isAuthenticated) {
    return _err('UNAUTHENTICATED', 'You must be logged in to perform this action.');
  }
  if (store.role !== requiredRole) {
    return _err('FORBIDDEN', 'You do not have permission to perform this action.');
  }
  return null;
}

/** Paginates an array */
export function _paginate(arr, page = 1, perPage = 20) {
  const total = arr.length;
  const totalPages = Math.ceil(total / perPage);
  const offset = (page - 1) * perPage;
  const items = arr.slice(offset, offset + perPage);
  return { items, meta: { page, perPage, total, totalPages } };
}