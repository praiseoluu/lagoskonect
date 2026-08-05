<?php

/**
 * Mime — file type detection that does not assume the fileinfo extension.
 *
 * Every upload path in this codebase called mime_content_type() directly.
 * That function lives in the fileinfo extension, which is not guaranteed to be
 * loaded: where it is missing the call is simply undefined, and the upload
 * dies with a 500 rather than a useful message. Avatars, reels, chat
 * attachments, news images, advert creatives and identity documents were all
 * exposed to that.
 *
 * So: use fileinfo when it is there, and otherwise read the file's own magic
 * bytes. Never trust the browser-supplied type in $_FILES, which is attacker
 * controlled and is exactly what the MIME check exists to defend against.
 */
class Mime {

    /**
     * Best-effort MIME type for a file on disk.
     *
     * @return string A MIME type, or 'application/octet-stream' if unknown.
     *                Callers already allow-list what they accept, so an
     *                unrecognised type is rejected rather than waved through.
     */
    public static function detect(string $path): string {
        if (!is_readable($path)) {
            return 'application/octet-stream';
        }

        if (function_exists('mime_content_type')) {
            $m = @mime_content_type($path);
            if (is_string($m) && $m !== '') return $m;
        }

        if (class_exists('finfo')) {
            $f = @(new finfo(FILEINFO_MIME_TYPE))->file($path);
            if (is_string($f) && $f !== '') return $f;
        }

        return self::sniff($path);
    }

    /** Reads the leading bytes and matches known signatures. */
    private static function sniff(string $path): string {
        $fh = @fopen($path, 'rb');
        if (!$fh) return 'application/octet-stream';

        $head = fread($fh, 16) ?: '';
        fclose($fh);

        if (strlen($head) < 4) return 'application/octet-stream';

        // Images
        if (str_starts_with($head, "\xFF\xD8\xFF"))                 return 'image/jpeg';
        if (str_starts_with($head, "\x89PNG\r\n\x1A\n"))            return 'image/png';
        if (str_starts_with($head, 'GIF87a') || str_starts_with($head, 'GIF89a')) return 'image/gif';
        if (str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WEBP') return 'image/webp';
        if (str_starts_with($head, 'BM'))                           return 'image/bmp';

        // Documents
        if (str_starts_with($head, '%PDF'))                         return 'application/pdf';

        // Video. MP4 and QuickTime share the ISO base media layout, where the
        // brand at offset 8 distinguishes them.
        if (substr($head, 4, 4) === 'ftyp') {
            $brand = substr($head, 8, 4);
            return $brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
        }
        if (str_starts_with($head, "\x1A\x45\xDF\xA3"))             return 'video/webm';
        if (str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'AVI ') return 'video/x-msvideo';

        // Last resort for images fileinfo would have caught.
        $info = @getimagesize($path);
        if (is_array($info) && !empty($info['mime'])) return $info['mime'];

        return 'application/octet-stream';
    }
}
