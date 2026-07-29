<?php

declare(strict_types=1);

// ── Bootstrap ─────────────────────────────────────────────────────────────

require_once __DIR__ . '/config/env.php';      // must be first — loads .env
require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/jwt.php';
require_once __DIR__ . '/utils/Response.php';
require_once __DIR__ . '/utils/Validator.php';
require_once __DIR__ . '/utils/JWT.php';
require_once __DIR__ . '/utils/Paginator.php';
require_once __DIR__ . '/middleware/auth.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/LgaController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/NewsController.php';
require_once __DIR__ . '/controllers/ReelController.php';
require_once __DIR__ . '/controllers/ChatController.php';
require_once __DIR__ . '/controllers/NotificationController.php';
require_once __DIR__ . '/controllers/AdvertController.php';
require_once __DIR__ . '/controllers/AdminChatController.php';
require_once __DIR__ . '/utils/WhatsAppService.php';
require_once __DIR__ . '/utils/EmailService.php';
require_once __DIR__ . '/controllers/EventsController.php';
require_once __DIR__ . '/utils/TOTP.php';
require_once __DIR__ . '/config/oauth.php';
require_once __DIR__ . '/config/s3.php';
require_once __DIR__ . '/utils/S3.php';
require_once __DIR__ . '/controllers/GoogleOAuthController.php';
require_once __DIR__ . '/controllers/AdminAuthController.php';
require_once __DIR__ . '/controllers/AdminAnalyticsController.php';
require_once __DIR__ . '/controllers/AdminUserController.php';
require_once __DIR__ . '/controllers/AdminNewsController.php';
require_once __DIR__ . '/controllers/AdminReelController.php';
require_once __DIR__ . '/controllers/ModerationController.php';
require_once __DIR__ . '/controllers/AdminAdvertController.php';
require_once __DIR__ . '/controllers/AdminLgaController.php';
require_once __DIR__ . '/controllers/AdminManagementController.php';
require_once __DIR__ . '/controllers/PlatformSettingsController.php';
require_once __DIR__ . '/utils/Settings.php';
require_once __DIR__ . '/utils/NotificationService.php';
require_once __DIR__ . '/controllers/AdminAnalyticsController.php';
require_once __DIR__ . '/controllers/TwoFactorController.php';
require_once __DIR__ . '/controllers/ReferralController.php';
require_once __DIR__ . '/controllers/NewsletterController.php';

// ── CORS + Content-Type ───────────────────────────────────────────────────

setCorsHeaders();
header('Content-Type: application/json; charset=UTF-8');

// ── Parse request ─────────────────────────────────────────────────────────

$method  = $_SERVER['REQUEST_METHOD'];
$rawPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip /api/v1 prefix
$path = preg_replace('#^/server/api/v1#', '', $rawPath);
$path = rtrim($path, '/');
if ($path === '') $path = '/';

// ── Global maintenance mode check ────────────────────────────────────────
// Block all citizen-facing routes when maintenance mode is on.
// Admin routes and auth endpoints are exempt.
$_exemptPaths = ['/auth/login', '/auth/register', '/auth/verify-phone', '/auth/resend-otp', '/auth/forgot-password', '/auth/verify-identity', '/auth/reset-password', '/auth/logout', '/auth/sse-token', '/admin/auth/login', '/admin/auth/logout', '/adverts/public'];
if (
    !str_starts_with($path, '/admin') &&
    !in_array($path, $_exemptPaths) &&
    Settings::is('maintenance_mode')
) {
    Response::error('MAINTENANCE', 'The platform is currently under maintenance. Please try again later.', 503);
}

// ── Router ────────────────────────────────────────────────────────────────

try {

    // ── Media proxy (private S3 bucket — serves pre-signed redirect) ─────
    if ($path === '/media' && $method === 'GET') {
        $key = trim($_GET['key'] ?? '');
        if (!$key) Response::error('VALIDATION_ERROR', 'Missing key parameter.', 422);
        // Sanitise: disallow path traversal
        if (str_contains($key, '..') || str_starts_with($key, '/')) {
            Response::error('VALIDATION_ERROR', 'Invalid key.', 422);
        }
        $presigned = S3::presignedGetUrl($key, 3600);
        header_remove('Content-Type');
        header('Location: ' . $presigned, true, 302);
        header('Cache-Control: public, max-age=1800'); // cache redirect for 30 min
        exit;

    // ── AUTH ──────────────────────────────────────────────────────────────
    } elseif ($path === '/auth/login' && $method === 'POST') {
        (new AuthController())->login();

    } elseif ($path === '/auth/register' && $method === 'POST') {
        (new AuthController())->register();

    } elseif ($path === '/auth/verify-phone' && $method === 'POST') {
        (new AuthController())->verifyPhone();

    } elseif ($path === '/auth/resend-otp' && $method === 'POST') {
        (new AuthController())->resendOtp();

    } elseif ($path === '/auth/forgot-password' && $method === 'POST') {
        (new AuthController())->forgotPassword();

    } elseif ($path === '/auth/verify-identity' && $method === 'POST') {
        (new AuthController())->verifyIdentity();

    } elseif ($path === '/auth/reset-password' && $method === 'POST') {
        (new AuthController())->resetPassword();

    } elseif ($path === '/auth/logout' && $method === 'POST') {
        (new AuthController())->logout();

    } elseif ($path === '/referrals/me' && $method === 'GET') {
        (new ReferralController())->getMine();

    } elseif ($path === '/newsletter/subscribe' && $method === 'POST') {
        (new NewsletterController())->subscribe();

    } elseif ($path === '/referrals/my-code' && $method === 'GET') {
        (new ReferralController())->getMyCode();

    } elseif ($path === '/referrals/my-history' && $method === 'GET') {
        (new ReferralController())->getMyHistory();

    } elseif ($path === '/referrals/contest' && $method === 'GET') {
        (new ReferralController())->getContest();

    } elseif ($method === 'GET' && $path === '/auth/sse-token') {
        $payload = requireAuth();
        $token   = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', time() + 60);
        $db      = Database::connect();
        $stmt    = $db->prepare(
            "INSERT INTO sse_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
        );
        $stmt->execute([$payload['userId'], hash('sha256', $token), $expires]);
        // Clean up expired tokens opportunistically
        $db->exec("DELETE FROM sse_tokens WHERE expires_at < NOW()");
        Response::json(['token' => $token]);

    // ── LGAs ─────────────────────────────────────────────────────────────
    } elseif ($path === '/lgas' && $method === 'GET') {
        (new LgaController())->getAll();

    // ── USERS ─────────────────────────────────────────────────────────────
    } elseif ($path === '/users/me' && $method === 'GET') {
        (new UserController())->getProfile();

    } elseif ($path === '/users/me' && $method === 'PATCH') {
        (new UserController())->updateProfile();

    } elseif ($path === '/users/me/avatar' && $method === 'POST') {
        (new UserController())->uploadAvatar();

    } elseif ($path === '/users/me/password' && $method === 'PATCH') {
        (new UserController())->updatePassword();

    } elseif ($path === '/users/me/welcome-seen' && $method === 'POST') {
        (new UserController())->welcomeSeen();

    } elseif ($path === '/users/me/privacy' && $method === 'PATCH') {
        (new UserController())->updatePrivacy();

    } elseif ($path === '/users/me/notif-prefs' && $method === 'PATCH') {
        (new UserController())->updateNotifPrefs();

    } elseif ($path === '/users/me/username' && $method === 'PATCH') {
        (new UserController())->updateUsername();

    } elseif (preg_match('#^/users/profile/([a-zA-Z0-9_\-]{3,30})$#', $path, $m) && $method === 'GET') {
        (new UserController())->getPublicProfile($m[1]);

    // ── NEWS ──────────────────────────────────────────────────────────────
    } elseif ($path === '/news' && $method === 'GET') {
        (new NewsController())->getForLGA();

    } elseif (preg_match('#^/news/([a-z0-9\-]+)$#', $path, $m) && $method === 'GET') {
        (new NewsController())->getBySlug($m[1]);

    // ── REELS ─────────────────────────────────────────────────────────────
    } elseif ($path === '/reels' && $method === 'GET') {
        (new ReelController())->getForLGA();

    } elseif (preg_match('#^/reels/by/(\d+)$#', $path, $m) && $method === 'GET') {
        (new ReelController())->getByUser((int) $m[1]);

    } elseif ($path === '/reels/upload' && $method === 'POST') {
        // Citizen reel upload — multipart/form-data, NOT JSON
        header_remove('Content-Type');
        (new ReelController())->upload();

    } elseif (preg_match('#^/reels/([a-z0-9_]+)/subscription$#', $path, $m) && $method === 'GET') {
        (new ReelController())->getSubscription($m[1]);

    } elseif (preg_match('#^/reels/([a-z0-9_]+)/subscribe$#', $path, $m) && $method === 'POST') {
        (new ReelController())->subscribe($m[1]);

    } elseif (preg_match('#^/reels/([a-z0-9_]+)/subscribe$#', $path, $m) && $method === 'DELETE') {
        (new ReelController())->unsubscribe($m[1]);

    } elseif (preg_match('#^/reels/([a-z0-9_]+)/like$#', $path, $m) && $method === 'POST') {
        (new ReelController())->toggleLike($m[1]);

    } elseif (preg_match('#^/reels/([a-z0-9_]+)/comments$#', $path, $m) && $method === 'GET') {
        (new ReelController())->getComments($m[1]);

    } elseif (preg_match('#^/reels/([a-z0-9_]+)/comments$#', $path, $m) && $method === 'POST') {
        (new ReelController())->addComment($m[1]);

    } elseif (preg_match('#^/reels/([a-z0-9_]+)$#', $path, $m) && $method === 'DELETE') {
        (new ReelController())->deleteOwn($m[1]);

    } elseif (preg_match('#^/reels/([a-z0-9_]+)$#', $path, $m) && $method === 'GET') {
        (new ReelController())->getByReelId($m[1]);

    // ── CHAT ─────────────────────────────────────────────────────────────
    } elseif ($path === '/chat/previews' && $method === 'GET') {
        (new ChatController())->getPreviews();

    } elseif ($path === '/chat/messages' && $method === 'GET') {
        (new ChatController())->getMessages();

    } elseif ($path === '/chat/messages' && $method === 'POST') {
        (new ChatController())->sendMessage();

    } elseif ($path === '/chat/online-count' && $method === 'GET') {
        (new ChatController())->getOnlineCount();

    } elseif (preg_match('#^/chat/messages/(\d+)$#', $path, $m) && $method === 'PATCH') {
        (new ChatController())->editMessage((int) $m[1]);

    } elseif (preg_match('#^/chat/messages/(\d+)$#', $path, $m) && $method === 'DELETE') {
        (new ChatController())->deleteMessage((int) $m[1]);

    } elseif (preg_match('#^/chat/messages/(\d+)/reactions$#', $path, $m) && $method === 'POST') {
        (new ChatController())->toggleReaction((int) $m[1]);

    } elseif ($path === '/chat/unread-count' && $method === 'GET') {
        (new ChatController())->getUnreadCount();

    } elseif ($path === '/chat/mark-read' && $method === 'POST') {
        (new ChatController())->markRead();

    } elseif ($path === '/chat/invite' && $method === 'POST') {
        (new ChatController())->inviteMember();

    } elseif ($path === '/chat/members' && $method === 'GET') {
        (new ChatController())->getMembers();

    } elseif ($path === '/chat/upload' && $method === 'POST') {
        header_remove('Content-Type');
        (new ChatController())->uploadFile();

    } elseif ($path === '/chat/report' && $method === 'POST') {
        (new ChatController())->reportMessage();

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────
    } elseif ($path === '/notifications' && $method === 'GET') {
        (new NotificationController())->getForUser();

    } elseif ($path === '/notifications/read-all' && in_array($method, ['PATCH', 'POST'])) {
        (new NotificationController())->markAllRead();

    } elseif ($path === '/notifications/unread-count' && $method === 'GET') {
        (new NotificationController())->getUnreadCount();

    } elseif (preg_match('#^/notifications/(\d+)/read$#', $path, $m) && $method === 'PATCH') {
        (new NotificationController())->markRead((int) $m[1]);

    // ── ADVERTS ───────────────────────────────────────────────────────────
    } elseif ($path === '/adverts/public' && $method === 'GET') {
        (new AdvertController())->getPublic();

    } elseif ($path === '/adverts' && $method === 'GET') {
        (new AdvertController())->getForLGA();

    // ── Admin Auth ───────────────────────────────────────────────────────────
    } elseif ($path === '/admin/auth/login' && $method === 'POST') {
        (new AdminAuthController())->login();

    } elseif ($path === '/admin/auth/logout' && $method === 'POST') {
        (new AdminAuthController())->logout();

    // ── Google OAuth ──────────────────────────────────────────────────────────
    } elseif ($path === '/auth/oauth/google/redirect' && $method === 'GET') {
        (new GoogleOAuthController())->redirect();

    } elseif ($path === '/auth/oauth/google/callback' && $method === 'GET') {
        // Override JSON content-type for this redirect endpoint
        header_remove('Content-Type');
        (new GoogleOAuthController())->callback();

    // ── 2FA ──────────────────────────────────────────────────────────────────
    } elseif ($path === '/auth/2fa/status' && $method === 'GET') {
        (new TwoFactorController())->getStatus();

    } elseif ($path === '/auth/2fa/setup' && $method === 'POST') {
        (new TwoFactorController())->setup();

    } elseif ($path === '/auth/2fa/confirm' && $method === 'POST') {
        (new TwoFactorController())->confirm();

    } elseif ($path === '/auth/2fa/validate' && $method === 'POST') {
        (new TwoFactorController())->validate();

    } elseif ($path === '/auth/2fa/disable' && $method === 'POST') {
        (new TwoFactorController())->disable();

    } elseif ($path === '/auth/2fa/backup' && $method === 'POST') {
        (new TwoFactorController())->useBackupCode();

    // ── SSE ─────────────────────────────────────────────────────────────────
    } elseif ($path === '/events/stream' && $method === 'GET') {
        // SSE: don't set JSON content-type — EventsController sets text/event-stream
        (new EventsController())->stream();

    // ── Admin Analytics ──────────────────────────────────────────────────────
    } elseif ($path === '/admin/analytics/metrics' && $method === 'GET') {
        (new AdminAnalyticsController())->getMetrics();

    } elseif ($path === '/admin/analytics/insights' && $method === 'GET') {
        (new AdminAnalyticsController())->getInsights();

    } elseif ($path === '/admin/analytics/top-lgas' && $method === 'GET') {
        (new AdminAnalyticsController())->getTopLGAs();

    } elseif ($path === '/admin/analytics/flagged' && $method === 'GET') {
        (new AdminAnalyticsController())->getFlagged();

    } elseif (preg_match('#^/admin/analytics/flagged/(\d+)/dismiss$#', $path, $m) && $method === 'PATCH') {
        (new AdminAnalyticsController())->dismissReport((int) $m[1]);

    // ── Reel reports (citizen) ────────────────────────────────────────────────
    } elseif (preg_match('#^/reels/([a-z0-9_]+)/report$#', $path, $m) && $method === 'POST') {
        (new ReelController())->reportReel($m[1]);

    // ── Admin User Management ────────────────────────────────────────────────
    } elseif ($path === '/admin/users' && $method === 'GET') {
        (new AdminUserController())->list();

    } elseif ($path === '/admin/users' && $method === 'POST') {
        (new AdminUserController())->create();

    } elseif (preg_match('#^/admin/users/(\d+)$#', $path, $m) && $method === 'GET') {
        (new AdminUserController())->getById((int) $m[1]);

    } elseif (preg_match('#^/admin/users/(\d+)$#', $path, $m) && $method === 'PATCH') {
        (new AdminUserController())->update((int) $m[1]);

    } elseif (preg_match('#^/admin/users/(\d+)/status$#', $path, $m) && $method === 'PATCH') {
        (new AdminUserController())->setStatus((int) $m[1]);

    // ── Change password (admin-created accounts) ──────────────────────────────
    } elseif ($path === '/auth/change-password' && $method === 'POST') {
        (new AuthController())->changePassword();

    // ── Admin News ────────────────────────────────────────────────────────────
    } elseif ($path === '/admin/news' && $method === 'GET') {
        (new AdminNewsController())->list();

    } elseif ($path === '/admin/news/metrics' && $method === 'GET') {
        (new AdminNewsController())->metrics();

    } elseif ($path === '/admin/news/reach' && $method === 'POST') {
        (new AdminNewsController())->estimateReach();

    } elseif ($path === '/admin/news/upload-image' && $method === 'POST') {
        (new AdminNewsController())->uploadImage();

    } elseif ($path === '/admin/news' && $method === 'POST') {
        (new AdminNewsController())->create();

    } elseif (preg_match('#^/admin/news/(\d+)$#', $path, $m) && $method === 'GET') {
        (new AdminNewsController())->getById((int) $m[1]);

    } elseif (preg_match('#^/admin/news/(\d+)$#', $path, $m) && $method === 'PATCH') {
        (new AdminNewsController())->update((int) $m[1]);

    } elseif (preg_match('#^/admin/news/(\d+)$#', $path, $m) && $method === 'DELETE') {
        (new AdminNewsController())->delete((int) $m[1]);

    } elseif (preg_match('#^/admin/news/(\d+)/pause$#', $path, $m) && $method === 'PATCH') {
        (new AdminNewsController())->togglePause((int) $m[1]);

    } elseif (preg_match('#^/admin/news/(\d+)/publish$#', $path, $m) && $method === 'PATCH') {
        (new AdminNewsController())->publish((int) $m[1]);

    } elseif (preg_match('#^/admin/news/(\d+)/headline$#', $path, $m) && $method === 'PATCH') {
        (new AdminNewsController())->setHeadline((int) $m[1]);

    // ── Admin Reels ──────────────────────────────────────────────────────────────
    } elseif ($path === '/admin/reels' && $method === 'GET') {
        (new AdminReelController())->list();

    } elseif ($path === '/admin/reels/metrics' && $method === 'GET') {
        (new AdminReelController())->metrics();

    } elseif ($path === '/admin/reels/upload' && $method === 'POST') {
        (new AdminReelController())->uploadVideo();

    } elseif ($path === '/admin/reels/reach' && $method === 'POST') {
        (new AdminReelController())->estimateReach();

    } elseif ($path === '/admin/reels' && $method === 'POST') {
        (new AdminReelController())->create();

    } elseif (preg_match('#^/admin/reels/([\w]+)$#', $path, $m) && $method === 'GET') {
        (new AdminReelController())->getById($m[1]);

    } elseif (preg_match('#^/admin/reels/([\w]+)$#', $path, $m) && $method === 'PATCH') {
        (new AdminReelController())->update($m[1]);

    } elseif (preg_match('#^/admin/reels/([\w]+)$#', $path, $m) && $method === 'DELETE') {
        (new AdminReelController())->delete($m[1]);

    } elseif (preg_match('#^/admin/reels/([\w]+)/pause$#', $path, $m) && $method === 'PATCH') {
        (new AdminReelController())->togglePause($m[1]);

    // ── Content Moderation ───────────────────────────────────────────────────
    } elseif ($path === '/admin/moderation' && $method === 'GET') {
        (new ModerationController())->list();

    } elseif ($path === '/admin/moderation/metrics' && $method === 'GET') {
        (new ModerationController())->metrics();

    } elseif (preg_match('#^/admin/moderation/([\w]+)/dismiss$#', $path, $m) && $method === 'PATCH') {
        (new ModerationController())->dismiss($m[1]);

    } elseif (preg_match('#^/admin/moderation/([\w]+)/takedown$#', $path, $m) && $method === 'PATCH') {
        (new ModerationController())->takedown($m[1]);

    // ── Adverts ──────────────────────────────────────────────────────────────
    } elseif ($path === '/adverts' && $method === 'GET') {
        (new AdvertController())->getForLGA();

    } elseif (preg_match('#^/adverts/(\d+)/click$#', $path, $m) && $method === 'POST') {
        (new AdminAdvertController())->recordClick((int) $m[1]);

    } elseif ($path === '/admin/adverts' && $method === 'GET') {
        (new AdminAdvertController())->list();

    } elseif ($path === '/admin/adverts/metrics' && $method === 'GET') {
        (new AdminAdvertController())->metrics();

    } elseif ($path === '/admin/adverts/upload' && $method === 'POST') {
        (new AdminAdvertController())->uploadBanner();

    } elseif ($path === '/admin/adverts' && $method === 'POST') {
        (new AdminAdvertController())->create();

    } elseif (preg_match('#^/admin/adverts/(\d+)$#', $path, $m) && $method === 'GET') {
        (new AdminAdvertController())->getById((int) $m[1]);

    } elseif (preg_match('#^/admin/adverts/(\d+)$#', $path, $m) && $method === 'PATCH') {
        (new AdminAdvertController())->update((int) $m[1]);

    } elseif (preg_match('#^/admin/adverts/(\d+)$#', $path, $m) && $method === 'DELETE') {
        (new AdminAdvertController())->delete((int) $m[1]);

    } elseif (preg_match('#^/admin/adverts/(\d+)/pause$#', $path, $m) && $method === 'PATCH') {
        (new AdminAdvertController())->togglePause((int) $m[1]);

    // ── Admin LGAs ───────────────────────────────────────────────────────────
    } elseif ($path === '/admin/lgas/metrics' && $method === 'GET') {
        (new AdminLgaController())->metrics();

    } elseif ($path === '/admin/lgas/export' && $method === 'GET') {
        (new AdminLgaController())->export();

    } elseif ($path === '/admin/lgas' && $method === 'GET') {
        (new AdminLgaController())->list();

    } elseif ($path === '/admin/lgas' && $method === 'POST') {
        (new AdminLgaController())->create();

    } elseif (preg_match('#^/admin/lgas/(\d+)$#', $path, $m) && $method === 'PATCH') {
        (new AdminLgaController())->update((int) $m[1]);

    } elseif (preg_match('#^/admin/lgas/(\d+)/merge$#', $path, $m) && $method === 'POST') {
        (new AdminLgaController())->merge((int) $m[1]);

    // ── Analytics ────────────────────────────────────────────────────────────
    // Dashboard endpoints
    } elseif ($path === '/admin/analytics/metrics' && $method === 'GET') {
        (new AdminAnalyticsController())->getMetrics();

    } elseif ($path === '/admin/analytics/insights' && $method === 'GET') {
        (new AdminAnalyticsController())->getInsights();

    } elseif ($path === '/admin/analytics/top-lgas' && $method === 'GET') {
        (new AdminAnalyticsController())->getTopLGAs();

    } elseif ($path === '/admin/analytics/flagged' && $method === 'GET') {
        (new AdminAnalyticsController())->getFlagged();

    } elseif (preg_match('#^/admin/analytics/flagged/(\d+)$#', $path, $m) && $method === 'PATCH') {
        (new AdminAnalyticsController())->dismissReport((int) $m[1]);

    // Analytics page endpoints
    } elseif ($path === '/admin/analytics/overview' && $method === 'GET') {
        (new AdminAnalyticsController())->overview();

    } elseif ($path === '/admin/analytics/weekly' && $method === 'GET') {
        (new AdminAnalyticsController())->weekly();

    } elseif ($path === '/admin/analytics/topics' && $method === 'GET') {
        (new AdminAnalyticsController())->topics();

    } elseif ($path === '/admin/analytics/lga-heatmap' && $method === 'GET') {
        (new AdminAnalyticsController())->lgaHeatmap();

    } elseif ($path === '/admin/analytics/export' && $method === 'GET') {
        (new AdminAnalyticsController())->export();

    } elseif ($path === '/data/visit' && $method === 'POST') {
        (new AdminAnalyticsController())->recordPageview();

    // ── Traffic ──────────────────────────────────────────────────────────────
    } elseif ($path === '/admin/traffic/metrics' && $method === 'GET') {
        (new AdminAnalyticsController())->trafficMetrics();

    } elseif ($path === '/admin/traffic/daily' && $method === 'GET') {
        (new AdminAnalyticsController())->trafficDaily();

    } elseif ($path === '/admin/traffic/logs' && $method === 'GET') {
        (new AdminAnalyticsController())->trafficLogs();

    } elseif ($path === '/admin/traffic/top-lgas' && $method === 'GET') {
        (new AdminAnalyticsController())->trafficTopLgas();

    // ── Platform Settings ────────────────────────────────────────────────────
    } elseif ($path === '/admin/platform-settings' && $method === 'GET') {
        (new PlatformSettingsController())->get();

    } elseif ($path === '/admin/platform-settings' && $method === 'PATCH') {
        (new PlatformSettingsController())->update();

    // ── Admin Management ─────────────────────────────────────────────────────
    } elseif ($path === '/admin/me' && $method === 'GET') {
        (new AdminManagementController())->getMe();

    } elseif ($path === '/admin/me' && $method === 'PATCH') {
        (new AdminManagementController())->updateMe();

    } elseif ($path === '/admin/me/password' && $method === 'PATCH') {
        (new AdminManagementController())->changeMyPassword();

    } elseif ($path === '/admin/team' && $method === 'GET') {
        (new AdminManagementController())->listTeam();

    } elseif ($path === '/admin/team' && $method === 'POST') {
        (new AdminManagementController())->createTeamMember();

    } elseif (preg_match('#^/admin/team/(\d+)/role$#', $path, $m) && $method === 'PATCH') {
        (new AdminManagementController())->updateRole((int) $m[1]);

    } elseif (preg_match('#^/admin/team/(\d+)/status$#', $path, $m) && $method === 'PATCH') {
        (new AdminManagementController())->updateStatus((int) $m[1]);

    } elseif (preg_match('#^/admin/team/(\d+)$#', $path, $m) && $method === 'GET') {
        (new AdminManagementController())->getTeamMember((int) $m[1]);

    } elseif (preg_match('#^/admin/team/(\d+)$#', $path, $m) && $method === 'PATCH') {
        (new AdminManagementController())->updateTeamMember((int) $m[1]);

    } elseif (preg_match('#^/admin/team/(\d+)$#', $path, $m) && $method === 'DELETE') {
        (new AdminManagementController())->removeTeamMember((int) $m[1]);

    // ── Admin Chat ───────────────────────────────────────────────────────────
    } elseif ($path === '/admin/chat/lgas' && $method === 'GET') {
        (new AdminChatController())->getLgas();

    } elseif ($path === '/admin/chat/stats' && $method === 'GET') {
        (new AdminChatController())->getStats();

    } elseif ($path === '/admin/chat/reports' && $method === 'GET') {
        (new AdminChatController())->getReports();

    } elseif (preg_match('#^/admin/chat/reports/(\d+)/resolve$#', $path, $m) && $method === 'POST') {
        (new AdminChatController())->resolveReport((int) $m[1]);

    } elseif ($path === '/admin/chat/messages' && $method === 'GET') {
        (new AdminChatController())->getMessages();

    } elseif ($path === '/admin/chat/messages' && $method === 'POST') {
        (new AdminChatController())->sendMessage();

    } elseif ($path === '/admin/chat/upload' && $method === 'POST') {
        (new AdminChatController())->uploadFile();

    } elseif (preg_match('#^/admin/chat/messages/(\d+)/flag$#', $path, $m) && $method === 'POST') {
        (new AdminChatController())->flagMessage((int) $m[1]);

    } elseif (preg_match('#^/admin/chat/messages/(\d+)/reactions$#', $path, $m) && $method === 'POST') {
        (new AdminChatController())->toggleReaction((int) $m[1]);

    } elseif (preg_match('#^/admin/chat/messages/(\d+)$#', $path, $m) && $method === 'DELETE') {
        (new AdminChatController())->deleteMessage((int) $m[1]);

    } elseif (preg_match('#^/admin/chat/lgas/(\d+)/messages$#', $path, $m) && $method === 'DELETE') {
        (new AdminChatController())->clearMessages((int) $m[1]);

    } elseif (preg_match('#^/admin/chat/warn/(\d+)$#', $path, $m) && $method === 'POST') {
        (new AdminChatController())->warnUser((int) $m[1]);

    } elseif ($path === '/admin/chat/members' && $method === 'GET') {
        (new AdminChatController())->getMembers();

    } elseif ($path === '/admin/chat/banned-words' && $method === 'GET') {
        (new AdminChatController())->getBannedWords();

    } elseif ($path === '/admin/referrals/leaderboard' && $method === 'GET') {
        (new ReferralController())->getLeaderboard();

    } elseif ($path === '/admin/referrals/stats' && $method === 'GET') {
        (new ReferralController())->getStats();

    } elseif ($path === '/admin/chat/banned-words' && $method === 'POST') {
        (new AdminChatController())->addBannedWord();

    } elseif (preg_match('#^/admin/chat/banned-words/(\d+)$#', $path, $m) && $method === 'DELETE') {
        (new AdminChatController())->deleteBannedWord((int) $m[1]);

    // ── Cron ──────────────────────────────────────────────────────────────────
    } elseif ($path === '/cron/publish-scheduled' && $method === 'GET') {
        // No auth middleware — protected by CRON_SECRET query param
        (new AdminNewsController())->publishScheduled();

    // ── 404 ───────────────────────────────────────────────────────────────
    } else {
        Response::error('NOT_FOUND', "No route matches {$method} {$path}", 404);
    }

} catch (PDOException $e) {
    error_log('DB Error: ' . $e->getMessage());
    Response::error('DB_ERROR', 'A database error occurred.', 500);
} catch (Throwable $e) {
    error_log('Server Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    Response::error('SERVER_ERROR', 'An unexpected error occurred.', 500);
}