<?php
/**
 * NewsletterController
 * =====================
 * Handles public newsletter subscriptions.
 *
 * POST /newsletter/subscribe  — save email + send confirmation
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

        // Upsert — if already subscribed just re-send confirmation
        $stmt = $db->prepare(
            'INSERT INTO newsletter_subscribers (email, subscribed_at, confirmed)
             VALUES (:email, NOW(), 0)
             ON DUPLICATE KEY UPDATE subscribed_at = subscribed_at'
        );
        $stmt->execute([':email' => $email]);

        // Attempt to send a confirmation email (non-fatal on failure)
        $this->_sendConfirmation($email);

        Response::json(['subscribed' => true]);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private function _sendConfirmation(string $email): void {
        $siteName = 'Lagos Konect';
        $subject  = "You're subscribed to {$siteName}!";

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
          <p style="margin:0;color:#888;font-size:13px;">
            If you didn\'t subscribe, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#999;font-size:12px;">
            &copy; ' . date('Y') . ' ' . htmlspecialchars($siteName, ENT_QUOTES) . ' &mdash; Your Local Government, Connected.
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
            // Log but don't fail the request
            error_log('[NewsletterController] Failed to send confirmation to ' . $email . ': ' . $e->getMessage());
        }
    }
}
