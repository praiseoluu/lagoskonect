<?php

/**
 * KTG Connect — Platform Settings Helper
 * ============================================================
 * Simple static helper for reading/writing platform_settings.
 * Used by controllers to enforce feature flags.
 *
 * Usage:
 *   Settings::get('maintenance_mode')       → '0' or '1'
 *   Settings::is('reels_enabled')           → true/false
 *   Settings::set('chat_enabled', '0')
 *   Settings::all()                         → ['key' => 'value', ...]
 */
class Settings {
    private static array $cache = [];

    /**
     * Deliberately not cached in a static of its own.
     *
     * Database::connect() already pools the handle, so a second reference here
     * bought nothing but kept the connection alive after
     * Database::disconnect() had released it. index.php calls Settings::is()
     * on every request including /events/stream, so that stray reference
     * pinned one MySQL connection for the whole five-minute life of every SSE
     * stream, which is exactly what the disconnect was meant to avoid.
     */
    private static function db(): PDO {
        return Database::connect();
    }

    public static function get(string $key, string $default = '0'): string {
        if (isset(self::$cache[$key])) return self::$cache[$key];

        $stmt = self::db()->prepare('SELECT value FROM platform_settings WHERE `key` = ?');
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        $val = $row ? $row['value'] : $default;
        self::$cache[$key] = $val;
        return $val;
    }

    public static function is(string $key, string $default = '1'): bool {
        return self::get($key, $default) === '1';
    }

    public static function set(string $key, string $value): void {
        self::db()->prepare('
            INSERT INTO platform_settings (`key`, `value`)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE `value` = ?, `updated_at` = NOW()
        ')->execute([$key, $value, $value]);
        self::$cache[$key] = $value;
    }

    public static function all(): array {
        $stmt = self::db()->query('SELECT `key`, `value` FROM platform_settings');
        $rows = [];
        foreach ($stmt->fetchAll() as $r) {
            $rows[$r['key']] = $r['value'];
            self::$cache[$r['key']] = $r['value'];
        }
        return $rows;
    }
}
