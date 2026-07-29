<?php

/**
 * WhatsAppService — Meta Cloud API wrapper.
 *
 * Sends WhatsApp messages via the official Meta Business Cloud API.
 * All credentials are read from environment variables (set in server/.env).
 *
 * How to obtain credentials (see server/.env.example for step-by-step):
 *   1. Create a Meta Developer app with the WhatsApp product.
 *   2. Add/verify a phone number → copy the Phone Number ID.
 *   3. Create a System User in Business Manager → generate a permanent token.
 *   4. Create and get approval for message templates in WhatsApp Manager.
 */
class WhatsAppService {

    private static function phoneNumberId(): string {
        return getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '';
    }

    private static function accessToken(): string {
        return getenv('WHATSAPP_ACCESS_TOKEN') ?: '';
    }

    private static function apiVersion(): string {
        return getenv('WHATSAPP_API_VERSION') ?: 'v19.0';
    }

    private static function baseUrl(): string {
        return 'https://graph.facebook.com/' . self::apiVersion() . '/' . self::phoneNumberId() . '/messages';
    }

    /**
     * Send an OTP code to a phone number via a pre-approved WhatsApp template.
     *
     * The template must have exactly one variable component ({{1}}) = the OTP code.
     * Template language is assumed to be en_US; change if needed.
     *
     * @param string $phone  E.164 format, e.g. +2348012345678
     * @param string $otp    The OTP string to send
     * @return bool          True if the API accepted the message
     */
    public static function sendOtp(string $phone, string $otp): bool {
        $templateName = getenv('WHATSAPP_OTP_TEMPLATE') ?: 'afx_otp';

        $payload = [
            'messaging_product' => 'whatsapp',
            'to'                => ltrim($phone, '+'),
            'type'              => 'template',
            'template'          => [
                'name'       => $templateName,
                'language'   => ['code' => 'en_US'],
                'components' => [
                    [
                        'type'       => 'body',
                        'parameters' => [
                            ['type' => 'text', 'text' => $otp],
                        ],
                    ],
                ],
            ],
        ];

        return self::post($payload);
    }

    /**
     * Send a community invite link via a pre-approved WhatsApp template.
     *
     * The template must have one variable component ({{1}}) = the signup URL.
     *
     * @param string $phone    E.164 format
     * @param string $signupUrl  Full URL to the signup page (may include pre-filled LGA)
     * @return bool
     */
    public static function sendInvite(string $phone, string $signupUrl): bool {
        $templateName = getenv('WHATSAPP_INVITE_TEMPLATE') ?: 'afx_invite';

        $payload = [
            'messaging_product' => 'whatsapp',
            'to'                => ltrim($phone, '+'),
            'type'              => 'template',
            'template'          => [
                'name'       => $templateName,
                'language'   => ['code' => 'en_US'],
                'components' => [
                    [
                        'type'       => 'body',
                        'parameters' => [
                            ['type' => 'text', 'text' => $signupUrl],
                        ],
                    ],
                ],
            ],
        ];

        return self::post($payload);
    }

    private static function caBundle(): string {
        $envPath = getenv('CURL_CA_BUNDLE');
        if ($envPath && file_exists($envPath)) {
            return $envPath;
        }
        foreach ([
            'C:/xampp/php/extras/ssl/cacert.pem',
            'C:/xampp/apache/bin/cacert.pem',
            '/etc/ssl/certs/ca-certificates.crt',
            '/etc/pki/tls/certs/ca-bundle.crt',
            '/etc/ssl/ca-bundle.pem',
            ini_get('curl.cainfo') ?: '',
        ] as $path) {
            if ($path && file_exists($path)) {
                return $path;
            }
        }
        return '';
    }

    /**
     * Internal helper — POSTs JSON to the Meta Cloud API.
     */
    private static function post(array $payload): bool {
        $token = self::accessToken();
        $url   = self::baseUrl();

        if (!$token || !self::phoneNumberId()) {
            error_log('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
            return false;
        }

        $ch = curl_init($url);
        $caBundle = self::caBundle();
        $sslOpts  = $caBundle
            ? [CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_CAINFO => $caBundle]
            : [CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2];
        curl_setopt_array($ch, $sslOpts + [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            error_log("[WhatsApp] cURL error: {$curlErr}");
            return false;
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            error_log("[WhatsApp] API error {$httpCode}: {$response}");
            return false;
        }

        return true;
    }
}
