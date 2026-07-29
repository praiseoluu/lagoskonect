-- Migration 040: Newsletter subscribers
-- Stores email addresses that have subscribed via the landing-page footer form.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    email       VARCHAR(255)    NOT NULL,
    subscribed_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed   TINYINT(1)      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
