<?php

/**
 * KTG Connect — IDrive e2 / S3-compatible Storage Utility
 * ============================================================
 * Pure PHP AWS Signature V4 — no SDK, no Composer dependency.
 * Works on shared cPanel/Apache hosting.
 *
 * Usage:
 *   S3::upload($tmpPath, $key, $mimeType)  → proxy URL (BASE_URL/media?key=...)
 *   S3::delete($key)                        → bool
 *   S3::presignedGetUrl($key, $expiry)      → time-limited direct S3 URL
 *
 * Because the bucket is private, objects are served via the /media proxy
 * endpoint which generates a fresh pre-signed URL and responds HTTP 302.
 * upload() returns the proxy URL so it can be stored in the DB as-is.
 */
class S3 {

    /**
     * Upload a local file to S3-compatible storage.
     *
     * @param string $filePath  Absolute path to the file (from $_FILES[...]['tmp_name'])
     * @param string $key       Object key / path inside the bucket (e.g. 'reels/reel_abc123.mp4')
     * @param string $mimeType  MIME type of the file
     *
     * @return string  Public URL of the uploaded object
     * @throws RuntimeException on failure
     */
    public static function upload(string $filePath, string $key, string $mimeType): string {
        $body        = file_get_contents($filePath);
        $contentHash = hash('sha256', $body);
        $now         = new DateTimeImmutable('now', new DateTimeZone('UTC'));

        $dateStamp   = $now->format('Ymd');
        $amzDateTime = $now->format('Ymd\THis\Z');

        $host = parse_url(S3_ENDPOINT, PHP_URL_HOST);
        $path = '/' . S3_BUCKET . '/' . ltrim($key, '/');

        $headers = [
            'content-type'         => $mimeType,
            'host'                 => $host,
            'x-amz-content-sha256' => $contentHash,
            'x-amz-date'           => $amzDateTime,
        ];

        $authorization = self::buildAuthorization('PUT', $path, '', $headers, $contentHash, $dateStamp, $amzDateTime);

        $ch = curl_init(S3_ENDPOINT . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'PUT',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_TIMEOUT        => 180,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: '         . $mimeType,
                'Content-Length: '       . strlen($body),
                'Host: '                 . $host,
                'x-amz-content-sha256: ' . $contentHash,
                'x-amz-date: '           . $amzDateTime,
                'Authorization: '        . $authorization,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            throw new RuntimeException("S3 upload failed (cURL): {$curlErr}");
        }
        if ($httpCode < 200 || $httpCode >= 300) {
            throw new RuntimeException("S3 upload failed (HTTP {$httpCode}): {$response}");
        }

        // Return the proxy URL — browser hits /media?key=... which generates
        // a fresh pre-signed redirect. Never expose the raw S3 endpoint.
        $base = rtrim(getenv('BASE_URL') ?: '', '/');
        return $base . '/media?key=' . urlencode($key);
    }

    /**
     * Delete an object from S3-compatible storage.
     *
     * @param string $key  Object key (same value returned when uploading)
     * @return bool
     */
    public static function delete(string $key): bool {
        $now         = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $dateStamp   = $now->format('Ymd');
        $amzDateTime = $now->format('Ymd\THis\Z');

        $host        = parse_url(S3_ENDPOINT, PHP_URL_HOST);
        $path        = '/' . S3_BUCKET . '/' . ltrim($key, '/');
        $emptyHash   = hash('sha256', '');

        $headers = [
            'host'                 => $host,
            'x-amz-content-sha256' => $emptyHash,
            'x-amz-date'           => $amzDateTime,
        ];

        $authorization = self::buildAuthorization('DELETE', $path, '', $headers, $emptyHash, $dateStamp, $amzDateTime);

        $ch = curl_init(S3_ENDPOINT . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'DELETE',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => [
                'Host: '                 . $host,
                'x-amz-content-sha256: ' . $emptyHash,
                'x-amz-date: '           . $amzDateTime,
                'Authorization: '        . $authorization,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // 204 = deleted, 404 = already gone — both are acceptable
        return $httpCode === 204 || $httpCode === 404;
    }

    /**
     * Generate a pre-signed GET URL for a private S3 object.
     * Used by the /media proxy endpoint — not stored in the DB.
     *
     * @param string $key     Object key (e.g. 'reels/abc123.mp4')
     * @param int    $expiry  Seconds until URL expires (default 3600 = 1 hour)
     * @return string  Direct S3 URL with query-string signature
     */
    public static function presignedGetUrl(string $key, int $expiry = 3600): string {
        $now         = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $dateStamp   = $now->format('Ymd');
        $amzDateTime = $now->format('Ymd\THis\Z');
        $host        = parse_url(S3_ENDPOINT, PHP_URL_HOST);
        $path        = '/' . S3_BUCKET . '/' . ltrim($key, '/');

        $credentialScope = "{$dateStamp}/" . S3_REGION . "/s3/aws4_request";
        $credential      = S3_KEY . '/' . $credentialScope;

        $queryParams = [
            'X-Amz-Algorithm'  => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential' => $credential,
            'X-Amz-Date'       => $amzDateTime,
            'X-Amz-Expires'    => (string) $expiry,
            'X-Amz-SignedHeaders' => 'host',
        ];
        ksort($queryParams);
        $queryString = http_build_query($queryParams);

        $canonicalRequest = implode("\n", [
            'GET',
            $path,
            $queryString,
            'host:' . $host . "\n",
            'host',
            'UNSIGNED-PAYLOAD',
        ]);

        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256',
            $amzDateTime,
            $credentialScope,
            hash('sha256', $canonicalRequest),
        ]);

        $signingKey = self::hmac(
            self::hmac(
                self::hmac(
                    self::hmac('AWS4' . S3_SECRET, $dateStamp),
                    S3_REGION
                ),
                's3'
            ),
            'aws4_request'
        );

        $signature = bin2hex(hash_hmac('sha256', $stringToSign, $signingKey, true));

        return S3_ENDPOINT . $path . '?' . $queryString . '&X-Amz-Signature=' . $signature;
    }

    // ── AWS Signature V4 ──────────────────────────────────────────────────

    private static function buildAuthorization(
        string $method,
        string $path,
        string $queryString,
        array  $headers,
        string $payloadHash,
        string $dateStamp,
        string $amzDateTime
    ): string {
        // 1. Canonical request
        ksort($headers);
        $canonicalHeaders = implode("\n", array_map(
            fn($k, $v) => strtolower($k) . ':' . trim($v),
            array_keys($headers),
            array_values($headers)
        )) . "\n";
        $signedHeaders = implode(';', array_map('strtolower', array_keys($headers)));

        $canonicalRequest = implode("\n", [
            $method,
            $path,
            $queryString,
            $canonicalHeaders,
            $signedHeaders,
            $payloadHash,
        ]);

        // 2. String to sign
        $credentialScope = "{$dateStamp}/" . S3_REGION . "/s3/aws4_request";
        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256',
            $amzDateTime,
            $credentialScope,
            hash('sha256', $canonicalRequest),
        ]);

        // 3. Signing key
        $signingKey = self::hmac(
            self::hmac(
                self::hmac(
                    self::hmac('AWS4' . S3_SECRET, $dateStamp),
                    S3_REGION
                ),
                's3'
            ),
            'aws4_request'
        );

        // 4. Signature
        $signature = bin2hex(hash_hmac('sha256', $stringToSign, $signingKey, true));

        return "AWS4-HMAC-SHA256 Credential=" . S3_KEY . "/{$credentialScope}, "
             . "SignedHeaders={$signedHeaders}, Signature={$signature}";
    }

    private static function hmac(string $key, string $data): string {
        return hash_hmac('sha256', $data, $key, true);
    }

    /**
     * Build a unique S3 object key for an uploaded file.
     *
     * @param string $folder  e.g. 'reels', 'news', 'promos', 'thumbnails'
     * @param string $ext     file extension without dot, e.g. 'mp4', 'jpg'
     */
    public static function makeKey(string $folder, string $ext): string {
        return rtrim($folder, '/') . '/' . bin2hex(random_bytes(10)) . '.' . $ext;
    }

    /** Map a MIME type to a file extension. */
    public static function mimeToExt(string $mime): string {
        return match ($mime) {
            'video/mp4'       => 'mp4',
            'video/quicktime' => 'mov',
            'video/webm'      => 'webm',
            'video/x-msvideo' => 'avi',
            'image/jpeg'      => 'jpg',
            'image/png'       => 'png',
            'image/webp'      => 'webp',
            'image/gif'       => 'gif',
            'image/svg+xml'   => 'svg',
            default           => 'bin',
        };
    }
}
