-- 023_extend_advert_type_enum.sql
-- Extends the adverts.type ENUM to include placement slots.
-- banner       = home page sidebar (existing)
-- interstitial = full-screen (existing, unused)
-- news         = injected into the news grid every 6th slot
-- feed         = injected into the reels grid every 6th slot

ALTER TABLE `adverts`
    MODIFY COLUMN `type`
        ENUM('banner','interstitial','news','feed') NOT NULL DEFAULT 'banner';
