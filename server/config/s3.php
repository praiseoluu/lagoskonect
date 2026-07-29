<?php

// ── IDrive e2 (S3-compatible) Configuration ───────────────────────────────
// Override all values via environment variables in production.

define('S3_ENDPOINT', getenv('S3_ENDPOINT') ?: 'https://s3.eu-central-1.idrivee2.com');
define('S3_REGION',   getenv('S3_REGION')   ?: 'eu-central-1');
define('S3_BUCKET',   getenv('S3_BUCKET')   ?: 'ktg-connect');
define('S3_KEY',      getenv('S3_KEY')      ?: '');
define('S3_SECRET',   getenv('S3_SECRET')   ?: '');
