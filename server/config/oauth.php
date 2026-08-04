<?php

// ── Google OAuth Configuration ────────────────────────────────────────────
// All values MUST be provided as environment variables.
// For cPanel/Apache: add to .htaccess or VirtualHost via SetEnv
// For Nginx+PHP-FPM: add via fastcgi_param or env[] in pool config
//
// Required variables:
//   GOOGLE_CLIENT_ID      — from Google Cloud Console → Credentials → OAuth 2.0 Client ID
//   GOOGLE_CLIENT_SECRET  — from Google Cloud Console → Credentials → OAuth 2.0 Client Secret
//   GOOGLE_REDIRECT_URI   — must match exactly what is registered in Google Cloud Console
//   FRONTEND_URL          — base URL of the frontend app (no trailing slash)

define('GOOGLE_CLIENT_ID',
    getenv('GOOGLE_CLIENT_ID') ?: ''
);

define('GOOGLE_CLIENT_SECRET',
    getenv('GOOGLE_CLIENT_SECRET') ?: ''
);

// Redirect URI must exactly match what's registered in Google Cloud Console.
define('GOOGLE_REDIRECT_URI',
    getenv('GOOGLE_REDIRECT_URI') ?: 'https://lagoskonect.com/server/api/v1/auth/oauth/google/callback'
);

// Frontend base URL — where to redirect after OAuth completes
define('FRONTEND_URL',
    getenv('FRONTEND_URL') ?: 'https://lagoskonect.com'
);
