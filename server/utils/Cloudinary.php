<?php

/**
 * KTG Connect — Cloudinary Utility
 * ============================================================
 * Handles media uploads and deletions via Cloudinary REST API.
 * No external SDK required — uses PHP's built-in curl.
 *
 * Supports:
 *   - Video upload (reels)
 *   - Image upload (reels, news images)
 *   - Auto thumbnail generation from video
 *   - Deletion by public_id
 */
class Cloudinary {

    /**
     * Upload a file to Cloudinary.
     *
     * @param string $filePath   Local path to the file (from $_FILES['file']['tmp_name'])
     * @param string $folder     Cloudinary folder (e.g. 'reels', 'news')
     * @param string $resourceType 'video' | 'image' | 'auto'
     * @param array  $options    Additional Cloudinary params
     *
     * @return array  { public_id, secure_url, thumbnail_url, duration, width, height, format }
     * @throws RuntimeException on upload failure
     */
    public static function upload(
        string $filePath,
        string $folder       = 'reels',
        string $resourceType = 'auto',
        array  $options      = []
    ): array {
        $timestamp = time();

        $params = array_merge([
            'folder'    => $folder,
            'timestamp' => $timestamp,
        ], $options);

        // Generate signature
        $params['signature'] = self::sign($params);
        $params['api_key']   = CLOUDINARY_API_KEY;

        $url = sprintf(
            'https://api.cloudinary.com/v1_1/%s/%s/upload',
            CLOUDINARY_CLOUD_NAME,
            $resourceType
        );

        $postFields = $params;
        $postFields['file'] = new CURLFile($filePath);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POSTFIELDS     => $postFields,
            CURLOPT_TIMEOUT        => 120, // 2 minutes for large video uploads
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$response) {
            throw new RuntimeException('Cloudinary upload failed: no response');
        }

        $data = json_decode($response, true);

        if ($httpCode !== 200 || isset($data['error'])) {
            $msg = $data['error']['message'] ?? 'Unknown error';
            throw new RuntimeException("Cloudinary upload failed: {$msg}");
        }

        // Build thumbnail URL for videos
        $thumbnailUrl = null;
        if ($resourceType === 'video' || ($resourceType === 'auto' && str_starts_with($data['resource_type'] ?? '', 'video'))) {
            // Replace /upload/ with /upload/w_600,h_375,c_fill,so_1/ for a 16:9 thumbnail at 1 second
            $thumbnailUrl = str_replace(
                '/upload/',
                '/upload/w_600,h_375,c_fill,so_1/',
                str_replace('.' . ($data['format'] ?? 'mp4'), '.jpg', $data['secure_url'])
            );
        } else {
            $thumbnailUrl = $data['secure_url'];
        }

        return [
            'public_id'     => $data['public_id'],
            'secure_url'    => $data['secure_url'],
            'thumbnail_url' => $thumbnailUrl,
            'duration'      => (int) ($data['duration'] ?? 0),
            'width'         => (int) ($data['width']    ?? 0),
            'height'        => (int) ($data['height']   ?? 0),
            'format'        => $data['format'] ?? '',
            'resource_type' => $data['resource_type'] ?? $resourceType,
        ];
    }

    /**
     * Delete a resource from Cloudinary by its public_id.
     *
     * @param string $publicId      e.g. 'reels/reel_abc123'
     * @param string $resourceType  'video' | 'image'
     */
    public static function delete(string $publicId, string $resourceType = 'video'): bool {
        $timestamp = time();
        $params = [
            'public_id' => $publicId,
            'timestamp' => $timestamp,
        ];
        $params['signature'] = self::sign($params);

        $url = sprintf(
            'https://api.cloudinary.com/v1_1/%s/%s/destroy',
            CLOUDINARY_CLOUD_NAME,
            $resourceType
        );

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POSTFIELDS     => array_merge($params, ['api_key' => CLOUDINARY_API_KEY]),
        ]);
        $response = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($response, true);
        return ($data['result'] ?? '') === 'ok';
    }

    /**
     * Generate a Cloudinary API signature.
     * Sorts params alphabetically, concatenates as key=value pairs,
     * appends the API secret, and SHA-1 hashes the result.
     */
    private static function sign(array $params): string {
        // Remove params that should not be signed
        unset($params['file'], $params['api_key'], $params['signature']);

        ksort($params);
        $str = implode('&', array_map(
            fn($k, $v) => "{$k}={$v}",
            array_keys($params),
            array_values($params)
        ));
        $str .= CLOUDINARY_API_SECRET;

        return sha1($str);
    }
}
