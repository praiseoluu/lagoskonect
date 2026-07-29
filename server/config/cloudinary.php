<?php

// ── Cloudinary Configuration ──────────────────────────────────────────────
// Override via environment variables in production.
// To switch to client's account: update these three values only.

define('CLOUDINARY_CLOUD_NAME', getenv('CLOUDINARY_CLOUD_NAME') ?: 'qaz2dc');
define('CLOUDINARY_API_KEY',    getenv('CLOUDINARY_API_KEY')    ?: '865828957864419');
define('CLOUDINARY_API_SECRET', getenv('CLOUDINARY_API_SECRET') ?: 'smohJ0AvIVCnfbFqv9qNReGRKW8');
