<?php
/**
 * NewsletterController
 * =====================
 * Handles public newsletter subscriptions and unsubscribes.
 *
 * POST /newsletter/subscribe    — save email + send confirmation with unsubscribe link
 * POST /newsletter/unsubscribe  — mark email as unsubscribed via one-click token
 */

require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validator.php';
require_once __DIR__ . '/../utils/EmailService.php';
require_once __DIR__ . '/../config/database.php';

class NewsletterController {

    // ── POST /newsletter/subscribe ────────────────────────────────────────

    public function subscribe(): void {
        $body  = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = trim($body['email'] ?? '');

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('VALIDATION_ERROR', 'A valid email address is required.', 422);
            return;
        }

        $db = Database::connect();

        // Generate a unique unsubscribe token
        $token = bin2hex(random_bytes(32));

        // Upsert — if already subscribed just re-send confirmation (keep existing token)
        $stmt = $db->prepare(
            'INSERT INTO newsletter_subscribers (email, subscribed_at, confirmed, unsubscribe_token)
             VALUES (:email, NOW(), 0, :token)
             ON DUPLICATE KEY UPDATE
               subscribed_at     = subscribed_at,
               unsubscribed_at   = NULL,
               unsubscribe_token = IF(unsubscribe_token IS NULL, :token2, unsubscribe_token)'
        );
        $stmt->execute([
            ':email'  => $email,
            ':token'  => $token,
            ':token2' => $token,
        ]);

        // Fetch the actual token stored (may differ if row already existed)
        $row = $db->prepare('SELECT unsubscribe_token FROM newsletter_subscribers WHERE email = :email');
        $row->execute([':email' => $email]);
        $storedToken = $row->fetchColumn() ?: $token;

        $this->_sendConfirmation($email, $storedToken);

        Response::json(['subscribed' => true]);
    }

    // ── POST /newsletter/unsubscribe ──────────────────────────────────────

    public function unsubscribe(): void {
        $body  = json_decode(file_get_contents('php://input'), true) ?? [];
        $token = trim($body['token'] ?? '');

        if (!$token) {
            Response::error('VALIDATION_ERROR', 'An unsubscribe token is required.', 422);
            return;
        }

        $db   = Database::connect();
        $stmt = $db->prepare(
            'SELECT id, unsubscribed_at FROM newsletter_subscribers WHERE unsubscribe_token = :token LIMIT 1'
        );
        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$row) {
            Response::error('NOT_FOUND', 'Invalid or expired unsubscribe link.', 404);
            return;
        }

        $alreadyUnsubscribed = !empty($row['unsubscribed_at']);

        if (!$alreadyUnsubscribed) {
            $upd = $db->prepare(
                'UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE id = :id'
            );
            $upd->execute([':id' => $row['id']]);
        }

        Response::json([
            'unsubscribed'         => true,
            'alreadyUnsubscribed'  => $alreadyUnsubscribed,
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private function _sendConfirmation(string $email, string $unsubscribeToken): void {
        $siteName    = 'Lagos Konect';
        $subject     = "You're subscribed to {$siteName}!";
        $frontendUrl = rtrim(getenv('FRONTEND_URL') ?: 'https://lagoskonect.com', '/');
        $unsubUrl    = $frontendUrl . '/newsletter/unsubscribe?token=' . urlencode($unsubscribeToken);

        $html = '
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:560px;">
        <tr><td style="background:#068927;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">' . htmlspecialchars($siteName, ENT_QUOTES) . '</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;font-size:18px;color:#111;">Welcome to the newsletter!</h2>
          <p style="margin:0 0 16px;color:#444;line-height:1.6;">
            Thanks for subscribing to <strong>' . htmlspecialchars($siteName, ENT_QUOTES) . '</strong>.
            You\'ll receive local government news and updates for your LGA directly in your inbox.
          </p>
          <p style="margin:0 0 24px;color:#888;font-size:13px;">
            If you didn\'t subscribe, you can safely ignore this email or click the unsubscribe link below.
          </p>
          <a href="' . htmlspecialchars($unsubUrl, ENT_QUOTES) . '"
             style="display:inline-block;padding:10px 22px;background:#068927;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Visit Lagos Konect
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 6px;color:#999;font-size:12px;">
            &copy; ' . date('Y') . ' ' . htmlspecialchars($siteName, ENT_QUOTES) . ' &mdash; Your Local Government, Connected.
          </p>
          <p style="margin:0;font-size:12px;">
            <a href="' . htmlspecialchars($unsubUrl, ENT_QUOTES) . '"
               style="color:#999;text-decoration:underline;">
              Unsubscribe from this newsletter
            </a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>';

        try {
            EmailService::send($email, $subject, $html);
        } catch (\Throwable $e) {
            error_log('[NewsletterController] Failed to send confirmation to ' . $email . ': ' . $e->getMessage());
        }
    }
}
