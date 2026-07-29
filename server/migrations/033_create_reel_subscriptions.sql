-- Migration 033: reel_subscriptions table
-- A citizen can subscribe to another user to get notified when they post reels.

CREATE TABLE IF NOT EXISTS reel_subscriptions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    follower_id INT UNSIGNED NOT NULL,
    target_id   INT UNSIGNED NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sub (follower_id, target_id),
    KEY idx_target (target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
