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
        return in_array($d, ['resend', 'mail', 'log'], true) ? $d : 'mail';
    }

    private static function fromName(): string {
        return getenv('RESEND_FROM_NAME') ?: 'Lagos Konect';
    }

    private static function fromEmail(): string {
        return getenv('RESEND_FROM_EMAIL') ?: 'noreply@lagoskonect.com';
    }

    private static function supportEmail(): string {
        return getenv('SUPPORT_EMAIL') ?: 'support@lagoskonect.com';
    }

    private static function appUrl(): string {
        $base = getenv('BASE_URL') ?: 'https://lagoskonect.com';
        return rtrim(preg_replace('#/api/v1$#', '', $base), '/');
    }

    // ── Public API ────────────────────────────────────────────────────────

    public static function sendOtp(string $toEmail, string $toName, string $otp, string $type = 'verification'): bool {
        $subject = $type === 'identity'
            ? 'Your Lagos Konect identity verification code'
            : 'Verify your Lagos Konect account';

        $html = self::otpTemplate($toName, $otp, $type);

        return self::send($toEmail, $subject, $html);
    }

    public static function sendNewsAlert(string $toEmail, string $toName, string $title, string $summary, string $url): bool {
        $escapedTitle   = htmlspecialchars($title,   ENT_QUOTES, 'UTF-8');
        $escapedSummary = htmlspecialchars($summary, ENT_QUOTES, 'UTF-8');
        $escapedUrl     = htmlspecialchars($url,     ENT_QUOTES, 'UTF-8');
        $escapedName    = htmlspecialchars($toName,  ENT_QUOTES, 'UTF-8');
        $support        = htmlspecialchars(self::supportEmail(), ENT_QUOTES, 'UTF-8');
        $appUrl         = htmlspecialchars(self::appUrl(),       ENT_QUOTES, 'UTF-8');

        $html = self::wrap("Breaking News Alert", <<<HTML
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#068927;">Local News</p>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a150c;line-height:1.3;">{$escapedTitle}</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">{$escapedSummary}</p>
          <a href="{$escapedUrl}"
             style="display:inline-block;background:#068927;color:#ffffff;text-decoration:none;
                    padding:13px 28px;border-radius:8px;font-size:14px;font-weight:600;
                    letter-spacing:.01em;">
            Read Full Article →
          </a>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
            Hi {$escapedName}, you're receiving this because you enabled breaking news alerts
            for your LGA. You can update your preferences in
            <a href="{$appUrl}/settings/notifications" style="color:#068927;text-decoration:none;">notification settings</a>.
          </p>
        HTML, $support, $appUrl);

        return self::send($toEmail, "Breaking: {$title}", $html);
    }

    /**
     * Core send — dispatches to the configured driver.
     */
    public static function send(string $to, string $subject, string $html, ?string $text = null): bool {
        switch (self::driver()) {
            case 'resend':
                return self::sendViaResend($to, $subject, $html, $text);
            case 'log':
                return self::sendViaLog($to, $subject);
            default:
                return self::sendViaMail($to, $subject, $html, $text);
        }
    }

    // ── Drivers ───────────────────────────────────────────────────────────

    /**
     * Development driver — records the email in the PHP error log and sends
     * nothing. Local machines have no MTA, so mail() blocks for seconds trying
     * to reach localhost:25 on every request that sends anything. Set
     * MAIL_DRIVER=log in server/.env to avoid that entirely.
     */
    private static function sendViaLog(string $to, string $subject): bool {
        error_log("[Email:log] would send to {$to} — {$subject}");
        return true;
    }

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

        // Silenced: a missing/unreachable MTA makes mail() emit a warning, and
        // with display_errors on that warning is printed into the response body
        // ahead of the JSON, breaking every client that parses it. Failure is
        // already reported through the return value and the log below.
        $result = @mail($to, $encodedSubject, $body, $headers);

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

    // ── Templates ─────────────────────────────────────────────────────────

    private static function otpTemplate(string $name, string $otp, string $type): string {
        $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
        $escapedOtp  = htmlspecialchars($otp,  ENT_QUOTES, 'UTF-8');
        $support     = htmlspecialchars(self::supportEmail(), ENT_QUOTES, 'UTF-8');
        $appUrl      = htmlspecialchars(self::appUrl(),       ENT_QUOTES, 'UTF-8');

        if ($type === 'identity') {
            $headline  = 'Verify your identity';
            $subtext   = 'Use the code below to confirm it\'s really you. It expires in <strong>10 minutes</strong>.';
        } else {
            $headline  = 'You\'re almost in!';
            $subtext   = 'Use the code below to verify your phone number and activate your account. It expires in <strong>10 minutes</strong>.';
        }

        $body = <<<HTML
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#068927;">
            Account Security
          </p>
          <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#0a150c;line-height:1.25;">
            {$headline}
          </h1>
          <p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.7;">
            Hi <strong>{$escapedName}</strong>,
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">
            {$subtext}
          </p>

          <!-- OTP box -->
          <div style="background:#f0faf2;border:1.5px dashed #068927;border-radius:12px;
                      padding:28px 20px;text-align:center;margin-bottom:28px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.1em;
                      text-transform:uppercase;color:#6b7280;">Your verification code</p>
            <span style="font-size:42px;font-weight:800;letter-spacing:.22em;color:#068927;
                         font-variant-numeric:tabular-nums;">{$escapedOtp}</span>
          </div>

          <!-- Warning -->
          <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;
                      padding:14px 16px;margin-bottom:28px;">
            <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
              <strong>Never share this code.</strong> Lagos Konect will never ask for your
              verification code by phone, WhatsApp, or email.
            </p>
          </div>

          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
            Didn't request this code? You can safely ignore this email — your account is still secure.
            If something seems wrong, contact us at
            <a href="mailto:{$support}" style="color:#068927;text-decoration:none;">{$support}</a>.
          </p>
        HTML;

        return self::wrap($type === 'identity' ? 'Identity Verification' : 'Verify Your Account', $body, $support, $appUrl);
    }

    /**
     * Shared email shell — header logo, card body, footer.
     *
     * @param string $previewText  Short text shown in inbox preview (after subject)
     * @param string $cardBody     Inner HTML placed inside the white card
     * @param string $support      Support email address
     * @param string $appUrl       Base URL for links
     */
    private static function wrap(string $previewText, string $cardBody, string $support, string $appUrl): string {
        $year           = date('Y');
        $escapedPreview = htmlspecialchars($previewText, ENT_QUOTES, 'UTF-8');
        $escapedSupport = htmlspecialchars($support,     ENT_QUOTES, 'UTF-8');
        $escapedAppUrl  = htmlspecialchars($appUrl,      ENT_QUOTES, 'UTF-8');

        // Table-based logo — SVG is not supported in Gmail/Outlook; a <td> with
        // background-color renders correctly in every major email client.
        $logo = '<table cellpadding="0" cellspacing="0" role="presentation" style="display:inline-table;vertical-align:middle;margin-right:10px;"><tr><td style="background:#068927;border-radius:9px;width:36px;height:36px;text-align:center;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;font-size:16px;font-weight:800;color:#ffffff;line-height:1;padding:0;">LK</td></tr></table>';

        return <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="color-scheme" content="light">
          <meta name="supported-color-schemes" content="light">
          <!--[if mso]>
          <noscript>
            <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
          </noscript>
          <![endif]-->
          <title>{$escapedPreview}</title>
          <style>
            @media only screen and (max-width:600px) {
              .outer  { padding: 16px 0 !important; }
              .card   { border-radius: 0 !important; margin: 0 !important; }
              .inner  { padding: 28px 20px !important; }
              .footer { padding: 20px !important; }
            }
          </style>
        </head>
        <body style="margin:0;padding:0;background:#f3f4f6;-webkit-font-smoothing:antialiased;">

          <!-- Preview text (hidden) -->
          <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{$escapedPreview}&nbsp;‌&zwnj;‌&zwnj;‌&zwnj;‌&zwnj;‌&zwnj;‌&zwnj;‌&zwnj;‌&zwnj;‌&zwnj;‌&zwnj;</div>

          <table class="outer" width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#f3f4f6;padding:40px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="max-width:560px;">

                  <!-- Logo header -->
                  <tr>
                    <td style="padding:0 0 24px;">
                      <a href="{$escapedAppUrl}" style="text-decoration:none;display:inline-flex;align-items:center;">
                        {$logo}
                        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                                     font-size:18px;font-weight:700;color:#0a150c;vertical-align:middle;
                                     letter-spacing:-.01em;">Lagos Konect</span>
                      </a>
                    </td>
                  </tr>

                  <!-- Card -->
                  <tr>
                    <td class="card"
                        style="background:#ffffff;border-radius:16px;
                               box-shadow:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);
                               overflow:hidden;">

                      <!-- Green accent bar -->
                      <div style="height:4px;background:linear-gradient(90deg,#068927 0%,#0aaa33 100%);"></div>

                      <!-- Body -->
                      <div class="inner" style="padding:36px 40px;">
                        {$cardBody}
                      </div>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td class="footer" style="padding:28px 8px 8px;">
                      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td align="center"
                              style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                                     font-size:12px;color:#9ca3af;line-height:1.7;text-align:center;">
                            <p style="margin:0 0 6px;">
                              Lagos Konect — Your Local Government, Connected.
                            </p>
                            <p style="margin:0 0 6px;">
                              Questions? Email us at
                              <a href="mailto:{$escapedSupport}"
                                 style="color:#068927;text-decoration:none;">{$escapedSupport}</a>
                            </p>
                            <p style="margin:0;color:#d1d5db;">
                              © {$year} Lagos Konect. All rights reserved.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>

        </body>
        </html>
        HTML;
    }
}
