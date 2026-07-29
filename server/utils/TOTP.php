<?php

/**
 * KTG Connect — TOTP Utility
 * ============================================================
 * Implements RFC 6238 Time-based One-Time Passwords.
 * No external libraries required — pure PHP.
 *
 * Compatible with Google Authenticator, Authy, Microsoft
 * Authenticator, and any RFC 6238 compliant app.
 *
 * Algorithm:
 *   1. Generate a random base32 secret (stored per user)
 *   2. On each 30-second window: HMAC-SHA1(secret, floor(time/30))
 *   3. Extract 6 digits from the HMAC output
 *   4. Compare with user-provided code (with ±1 window tolerance)
 */
class TOTP {

    // ── Base32 alphabet (RFC 4648) ────────────────────────────────────────
    private const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /**
     * Generate a cryptographically random base32 secret.
     * 20 bytes → 32 base32 characters (160 bits of entropy).
     */
    public static function generateSecret(): string {
        $bytes  = random_bytes(20);
        $result = '';
        $buffer = 0;
        $bitsLeft = 0;

        foreach (str_split($bytes) as $byte) {
            $buffer   = ($buffer << 8) | ord($byte);
            $bitsLeft += 8;
            while ($bitsLeft >= 5) {
                $bitsLeft -= 5;
                $result   .= self::BASE32[($buffer >> $bitsLeft) & 31];
            }
        }

        if ($bitsLeft > 0) {
            $result .= self::BASE32[($buffer << (5 - $bitsLeft)) & 31];
        }

        return $result;
    }

    /**
     * Decode a base32 string to raw bytes.
     */
    private static function base32Decode(string $secret): string {
        $secret  = strtoupper($secret);
        $secret  = str_replace(' ', '', $secret); // strip spaces if any
        $buffer  = 0;
        $bitsLeft = 0;
        $result  = '';

        foreach (str_split($secret) as $char) {
            $pos = strpos(self::BASE32, $char);
            if ($pos === false) continue; // skip padding/invalid chars
            $buffer   = ($buffer << 5) | $pos;
            $bitsLeft += 5;
            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $result   .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }

        return $result;
    }

    /**
     * Generate the TOTP code for a given secret and timestamp.
     * Default: current time, 30-second window, 6 digits.
     *
     * @param string $secret   Base32 encoded secret
     * @param int    $time     Unix timestamp (default: now)
     * @param int    $digits   Code length (default: 6)
     * @param int    $period   Window in seconds (default: 30)
     */
    public static function generate(
        string $secret,
        int    $time   = 0,
        int    $digits = 6,
        int    $period = 30
    ): string {
        if ($time === 0) $time = time();

        $timeStep = (int) floor($time / $period);

        // Pack time step as 8-byte big-endian integer
        $msg = pack('N*', 0) . pack('N*', $timeStep);

        $key  = self::base32Decode($secret);
        $hash = hash_hmac('sha1', $msg, $key, true);

        // Dynamic truncation
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $code   = (
            ((ord($hash[$offset])     & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) <<  8) |
            ( ord($hash[$offset + 3]) & 0xFF)
        ) % (10 ** $digits);

        return str_pad((string) $code, $digits, '0', STR_PAD_LEFT);
    }

    /**
     * Verify a user-provided TOTP code.
     * Allows ±1 time window (±30s) to account for clock drift.
     *
     * @param string $secret  Base32 encoded secret
     * @param string $code    User-provided 6-digit code
     * @param int    $drift   Number of windows to check either side (default: 1)
     */
    public static function verify(string $secret, string $code, int $drift = 1): bool {
        $code = trim($code);
        if (!preg_match('/^\d{6}$/', $code)) return false;

        $now = time();
        for ($i = -$drift; $i <= $drift; $i++) {
            $expected = self::generate($secret, $now + ($i * 30));
            if (hash_equals($expected, $code)) return true;
        }

        return false;
    }

    /**
     * Build a otpauth:// URI for QR code generation.
     * The QR code encodes this URI — scan it with any authenticator app.
     *
     * @param string $secret    Base32 secret
     * @param string $account   User identifier (e.g. phone number or email)
     * @param string $issuer    App name shown in the authenticator
     */
    public static function getUri(string $secret, string $account, string $issuer = 'KTG Connect'): string {
        return sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            rawurlencode($issuer),
            rawurlencode($account),
            $secret,
            rawurlencode($issuer)
        );
    }

    /**
     * Return the raw otpauth:// URI for client-side QR code generation.
     * No external HTTP request is made — the URI is returned directly.
     *
     * @param string $secret   Base32 secret
     * @param string $account  User identifier (e.g. phone or email)
     * @param string $issuer   App name shown in the authenticator
     */
    public static function getOtpauthUri(string $secret, string $account, string $issuer = 'KTG Connect'): string {
        return self::getUri($secret, $account, $issuer);
    }

    /**
     * @deprecated Use getOtpauthUri() for client-side QR generation.
     * Kept for backward compatibility — returns raw otpauth:// URI instead
     * of the former qrserver.com URL.
     *
     * @param string $uri  The otpauth:// URI from getUri()
     * @param int    $size Unused (kept for signature compatibility)
     */
    public static function getQrCodeUrl(string $uri, int $size = 200): string {
        // Previously called api.qrserver.com — now returns the URI directly
        // so the frontend can generate the QR code client-side.
        return $uri;
    }

    /**
     * Generate 8 one-time backup codes.
     * Each code is 8 alphanumeric characters.
     * Returned as plain text array — hash before storing in DB.
     *
     * @return string[]
     */
    public static function generateBackupCodes(): array {
        $codes  = [];
        $chars  = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/1/I/O to avoid confusion
        $len    = strlen($chars);
        for ($i = 0; $i < 8; $i++) {
            $code = '';
            for ($j = 0; $j < 8; $j++) {
                $code .= $chars[random_int(0, $len - 1)];
            }
            $codes[] = $code;
        }
        return $codes;
    }
}
