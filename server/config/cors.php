<?php

/**
 * Set CORS headers.
 * Call this before any output on every request.
 */
function setCorsHeaders(): void {
    // Allow specific origins. In production, replace '*' with your exact frontend origin.
    $allowedOrigins = [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:3000',
        'https://lagkonnect.com',
        'https://www.lagkonnect.com',
        'https://app.lagkonnect.com',
        'https://ngcatt.org',
        'https://www.ngcatt.org',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    header('Vary: Origin');
    if (in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
    }
    // Unknown origins receive no Access-Control-Allow-Origin header → browser blocks the request

    header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400'); // 24h preflight cache

    // Handle OPTIONS preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
