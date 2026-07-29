<?php

/**
 * Minimal JWT implementation (HS256 only).
 * No external dependencies — uses PHP's built-in hash_hmac.
 */
class JWT {
    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        $padded = str_pad(strtr($data, '-_', '+/'), strlen($data) + (4 - strlen($data) % 4) % 4, '=');
        return base64_decode($padded);
    }

    public static function encode(array $payload, string $secret, int $expiresIn = 2592000): string {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];

        $payload['iat'] = time();
        $payload['exp'] = time() + $expiresIn;

        $headerEncoded  = self::base64UrlEncode(json_encode($header));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", $secret, true);
        $sigEncoded = self::base64UrlEncode($signature);

        return "$headerEncoded.$payloadEncoded.$sigEncoded";
    }

    /**
     * Decode and verify a JWT.
     * Returns payload array on success, or throws RuntimeException on failure.
     */
    public static function decode(string $token, string $secret): array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new RuntimeException('Invalid token structure');
        }

        [$headerEncoded, $payloadEncoded, $sigEncoded] = $parts;

        $expectedSig = self::base64UrlEncode(
            hash_hmac('sha256', "$headerEncoded.$payloadEncoded", $secret, true)
        );

        if (!hash_equals($expectedSig, $sigEncoded)) {
            throw new RuntimeException('Invalid token signature');
        }

        $payload = json_decode(self::base64UrlDecode($payloadEncoded), true);
        if (!is_array($payload)) {
            throw new RuntimeException('Invalid token payload');
        }

        if (isset($payload['exp']) && $payload['exp'] < time()) {
            throw new RuntimeException('Token has expired');
        }

        return $payload;
    }

    /**
     * Generate a SHA-256 hash of a token (for blacklist storage).
     */
    public static function hash(string $token): string {
        return hash('sha256', $token);
    }
}
