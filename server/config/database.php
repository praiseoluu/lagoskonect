<?php

class Database {
    private static ?PDO $instance = null;

    public static function connect(): PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        // ── Configuration ─────────────────────────────────────────────────
        // Override via environment variables in production:
        //   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
        $host    = getenv('DB_HOST') ?: 'localhost';
        $port    = getenv('DB_PORT') ?: '3306';
        $dbName  = getenv('DB_NAME') ?: 'lgkonect_db';
        $user    = getenv('DB_USER') ?: 'lgkonect_user';
        $pass    = getenv('DB_PASS') ?: 'lgkonect_user';
        $charset = 'utf8mb4';

        $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset={$charset}";

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            self::$instance = new PDO($dsn, $user, $pass, $options);
            // Pin the session to UTC so NOW() does not depend on how the host
            // OS happens to be configured. MySQL defaults time_zone to SYSTEM,
            // and shared hosting is often set to a timezone that has nothing to
            // do with the audience, which silently shifted every stored
            // timestamp. Must stay in step with the UTC default set in env.php.
            self::$instance->exec("SET time_zone = '+00:00'");
        } catch (PDOException $e) {
            // Never expose DB details in production
            http_response_code(500);
            echo json_encode(['error' => ['code' => 'DB_ERROR', 'message' => 'Database connection failed.']]);
            exit;
        }

        return self::$instance;
    }

    /**
     * Drops the pooled connection so the server can reclaim it.
     *
     * Ordinary requests never need this: PHP closes the handle when the
     * request ends. It exists for the SSE stream, which stays alive for
     * minutes at a time and would otherwise occupy one of the account's few
     * MySQL connections for its whole lifetime. The next connect() call
     * transparently opens a fresh one.
     *
     * Callers must also release their own reference (PDO only disconnects
     * once every reference is gone).
     */
    public static function disconnect(): void {
        self::$instance = null;
    }
}
