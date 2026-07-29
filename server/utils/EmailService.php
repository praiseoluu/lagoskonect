<?php

/**
 * EmailService — Transactional email sender.
 *
 * Driver selection (set MAIL_DRIVER in server/.env):
 *   mail   → PHP's built-in mail() via the server's MTA (cPanel/Exim). Default.
 *   resend → Resend REST API (requires verified domain at resend.com/domains).
 *
 * For cPanel hosting, leave MAIL_DRIVER unset or set it to "mail".
 * The FROM address should be a mailbox that exists (or is catch-all) on the
 * hosting account so Exim accepts outgoing mail without SPF/DKIM issues.
 */
class EmailService {

    private static function driver(): string {
        $d = strtolower(trim(getenv('MAIL_DRIVER') ?: 'mail'));
        return in_array($d, ['resend', 'mail'], true) ? $d : 'mail';
    }

    private static function fromName(): string {
        return getenv('RESEND_FROM_NAME') ?: 'LagKonnect';
    }

    private static function fromEmail(): string {
        return getenv('RESEND_FROM_EMAIL') ?: 'noreply@lagkonnect.com';
    }

    // ── Public API ────────────────────────────────────────────────────────

    public static function sendOtp(string $toEmail, string $toName, string $otp, string $type = 'verification'): bool {
        $subject = $type === 'identity'
            ? 'Your LagKonnect identity verification code'
            : 'Your LagKonnect verification code';

        $html = self::otpTemplate($toName, $otp, $type);

        return self::send($toEmail, $subject, $html);
    }

    public static function sendNewsAlert(string $toEmail, string $toName, string $title, string $summary, string $url): bool {
        $escapedTitle   = htmlspecialchars($title,   ENT_QUOTES, 'UTF-8');
        $escapedSummary = htmlspecialchars($summary, ENT_QUOTES, 'UTF-8');
        $escapedUrl     = htmlspecialchars($url,     ENT_QUOTES, 'UTF-8');
        $escapedName    = htmlspecialchars($toName,  ENT_QUOTES, 'UTF-8');

        $html = <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f4;font-family:system-ui,sans-serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <div style="background:#1a7a3c;padding:28px 32px;">
              <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">LagKonnect</p>
            </div>
            <div style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#0a1a0d;line-height:1.3;">{$escapedTitle}</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#4a6a4e;line-height:1.6;">{$escapedSummary}</p>
              <a href="{$escapedUrl}" style="display:inline-block;background:#1a7a3c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Read Full Article →</a>
              <p style="margin:32px 0 0;font-size:13px;color:#8aaa8e;">Hi {$escapedName}, this alert was sent based on your LagKonnect notification preferences.</p>
            </div>
          </div>
        </body>
        </html>
        HTML;

        return self::send($toEmail, "New update: {$title}", $html);
    }

    /**
     * Core send — dispatches to the configured driver.
     */
    public static function send(string $to, string $subject, string $html, ?string $text = null): bool {
        return self::driver() === 'resend'
            ? self::sendViaResend($to, $subject, $html, $text)
            : self::sendViaMail($to, $subject, $html, $text);
    }

    // ── Drivers ───────────────────────────────────────────────────────────

    /**
     * PHP mail() — uses the server's local MTA (cPanel/Exim).
     * Works out of the box on any cPanel hosting account.
     */
    private static function sendViaMail(string $to, string $subject, string $html, ?string $text = null): bool {
        $fromName  = self::fromName();
        $fromEmail = self::fromEmail();

        $boundary = '----=_Part_' . md5(uniqid('', true));

        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "From: {$fromName} <{$fromEmail}>\r\n";
        $headers .= "Reply-To: {$fromEmail}\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";

        if ($text) {
            // Multipart: plain + HTML
            $headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";

            $body  = "--{$boundary}\r\n";
            $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            $body .= quoted_printable_encode($text) . "\r\n\r\n";
            $body .= "--{$boundary}\r\n";
            $body .= "Content-Type: text/html; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            $body .= quoted_printable_encode($html) . "\r\n\r\n";
            $body .= "--{$boundary}--";
        } else {
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $headers .= "Content-Transfer-Encoding: quoted-printable\r\n";
            $body = quoted_printable_encode($html);
        }

        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

        $result = mail($to, $encodedSubject, $body, $headers);

        if (!$result) {
            error_log("[Email] mail() failed sending to {$to}");
        }

        return $result;
    }

    /**
     * Resend REST API — requires RESEND_API_KEY and a verified sender domain.
     */
    private static function sendViaResend(string $to, string $subject, string $html, ?string $text = null): bool {
        $key = getenv('RESEND_API_KEY') ?: '';
        if (!$key) {
            error_log('[Email] MAIL_DRIVER=resend but RESEND_API_KEY is not set.');
            return false;
        }

        $fromName  = self::fromName();
        $fromEmail = self::fromEmail();

        $payload = [
            'from'    => "{$fromName} <{$fromEmail}>",
            'to'      => [$to],
            'subject' => $subject,
            'html'    => $html,
        ];
        if ($text) {
            $payload['text'] = $text;
        }

        $caBundle = self::caBundle();
        $sslOpts  = $caBundle
            ? [CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_CAINFO => $caBundle]
            : [CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2];

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, $sslOpts + [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $key,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            error_log("[Email] Resend cURL error: {$curlErr}");
            return false;
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            error_log("[Email] Resend API error {$httpCode}: {$response}");
            return false;
        }

        return true;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static function caBundle(): string {
        $envPath = getenv('CURL_CA_BUNDLE');
        if ($envPath && file_exists($envPath)) {
            return $envPath;
        }

        $candidates = [
            'C:/xampp/php/extras/ssl/cacert.pem',
            'C:/xampp/apache/bin/cacert.pem',
            '/etc/ssl/certs/ca-certificates.crt',
            '/etc/pki/tls/certs/ca-bundle.crt',
            '/etc/ssl/ca-bundle.pem',
            ini_get('curl.cainfo') ?: '',
        ];

        foreach ($candidates as $path) {
            if ($path && file_exists($path)) {
                return $path;
            }
        }

        return '';
    }

    private static function otpTemplate(string $name, string $otp, string $type): string {
        $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
        $escapedOtp  = htmlspecialchars($otp,  ENT_QUOTES, 'UTF-8');
        $purpose     = $type === 'identity' ? 'verify your identity' : 'verify your account';

        return <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f4;font-family:system-ui,sans-serif;">
          <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <div style="background:#1a7a3c;padding:28px 32px;">
              <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">LagKonnect</p>
            </div>
            <div style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:22px;color:#0a1a0d;">Hi {$escapedName},</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#4a6a4e;line-height:1.6;">Use the code below to {$purpose}. This code expires in 10 minutes.</p>
              <div style="background:#f0f7f1;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
                <span style="font-size:36px;font-weight:800;letter-spacing:.18em;color:#1a7a3c;">{$escapedOtp}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#8aaa8e;">If you didn't request this code, you can safely ignore this email. Do not share it with anyone.</p>
            </div>
          </div>
        </body>
        </html>
        HTML;
    }
}
