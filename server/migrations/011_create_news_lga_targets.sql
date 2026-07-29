-- 011_create_news_lga_targets.sql
-- Adds multi-LGA targeting to news items.
--
-- How targeting works after this migration:
--   target_all_lgas = 1  → show to ALL LGAs (news_lga_targets ignored)
--   target_all_lgas = 0  → show only to LGAs listed in news_lga_targets
--
-- news.lga_id now means "author/source LGA" (who published it),
-- not the target. A news item published by Yola North can be targeted
-- to Yola North + Gombi + Song without targeting everyone.

CREATE TABLE IF NOT EXISTS `news_lga_targets` (
                                                  `news_id`    INT NOT NULL,
                                                  `lga_id`     INT NOT NULL,
                                                  PRIMARY KEY (`news_id`, `lga_id`),
    CONSTRAINT `fk_nlt_news` FOREIGN KEY (`news_id`) REFERENCES `news` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_nlt_lga`  FOREIGN KEY (`lga_id`)  REFERENCES `lgas` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
