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
        } catch (PDOException $e) {
            // Never expose DB details in production
            http_response_code(500);
            echo json_encode(['error' => ['code' => 'DB_ERROR', 'message' => 'Database connection failed.']]);
            exit;
        }

        return self::$instance;
    }
}
