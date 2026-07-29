<?php

// ── JWT Configuration ──────────────────────────────────────────────────────
// Override JWT_SECRET via environment variable in production.
// IMPORTANT: Set a strong random secret before deploying.

$_jwtSecret = getenv('JWT_SECRET');
if (!$_jwtSecret) {
    throw new RuntimeException('JWT_SECRET environment variable is not set.');
}
define('JWT_SECRET', $_jwtSecret);
unset($_jwtSecret);
define('JWT_EXPIRES_IN', getenv('JWT_EXPIRES_IN') ?: 2592000); // 30 days in seconds
