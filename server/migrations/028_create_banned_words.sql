-- 028_create_banned_words.sql
-- Creates the banned_words table for the chat profanity filter.
-- Admins manage this list via the Chat Management admin panel.
-- Default words are pre-seeded below — extend with locally appropriate terms.

CREATE TABLE IF NOT EXISTS `banned_words` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `word`       VARCHAR(100) NOT NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_word` (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed with default words.
-- Add/remove words appropriate for your community and region.
-- All comparisons are case-insensitive (handled in PHP).
INSERT IGNORE INTO `banned_words` (`word`) VALUES
    ('idiot'),
    ('stupid'),
    ('fool'),
    ('bastard'),
    ('bitch'),
    ('asshole'),
    ('damn'),
    ('shit'),
    ('fuck'),
    ('crap'),
    ('bloody hell'),
    ('useless'),
    ('moron'),
    ('imbecile');
