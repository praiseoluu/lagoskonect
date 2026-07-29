<?php

/**
 * Minimal .env loader.
 *
 * Reads server/.env (one KEY=VALUE per line, # comments ignored) and calls
 * putenv() + populates $_ENV / $_SERVER so getenv() works everywhere.
 * Already-set environment variables are NOT overwritten (host-level config wins).
 */
(static function (): void {
    $path = __DIR__ . '/../.env';
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }

        $eqPos = strpos($line, '=');
        if ($eqPos === false) {
            continue;
        }

        $key   = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));

        // Strip optional surrounding quotes
        if (strlen($value) >= 2
            && (($value[0] === '"'  && $value[-1] === '"')
             || ($value[0] === "'"  && $value[-1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        if ($key === '' || getenv($key) !== false) {
            continue; // skip empty keys and already-set vars
        }

        putenv("{$key}={$value}");
        $_ENV[$key]    = $value;
        $_SERVER[$key] = $value;
    }
})();
