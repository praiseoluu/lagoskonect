-- 040_renumber_user_ids.sql
-- Renumber citizen user IDs to be gap-free and sequential (100001, 100002, …).
-- Existing IDs have gaps (e.g. 100001 → 100014) caused by rows deleted
-- before the MAX(id)+1 logic was introduced in AuthController::register.
--
-- This script:
--   1. Builds a mapping of old_id → new_id (sequential from MAX(existing_admin_id)+1)
--   2. Disables FK checks, updates every referencing table, updates the primary
--      key, then re-enables FK checks.
--   3. Resets AUTO_INCREMENT so the next registration continues cleanly.
--
-- SAFETY:
--   • Only affects the `users` table (citizens). Admins are left untouched.
--   • Wrapped in a single transaction so it's all-or-nothing.
--   • Existing JWTs will become invalid — users must re-login. This is expected.
--
-- Tables with FK constraints referencing users.id:
--   reel_reports, user_totp, posts, lga_chat_messages, notifications
-- Tables with plain indexes (no FK) referencing users:
--   reels (author_id), reel_likes (user_id), reel_comments (user_id),
--   news (author_id), page_views (user_id), users (referred_by_user_id),
--   sse_tokens (user_id), chat_last_read (user_id)

START TRANSACTION;

-- Step 1: Disable FK checks to allow primary-key updates
SET FOREIGN_KEY_CHECKS = 0;

-- Step 2: Create a mapping table (old_id → new_id)
CREATE TEMPORARY TABLE _id_mapping (
    old_id INT PRIMARY KEY,
    new_id INT NOT NULL UNIQUE,
    INDEX idx_new (new_id)
);

-- Step 3: Determine the starting ID. Admins use ids < 100000, so
--         citizens start at 100001. We use ROW_NUMBER to assign
--         sequential IDs in ascending order.
SET @row := 0;
SET @start_id := 100001;

INSERT INTO _id_mapping (old_id, new_id)
SELECT id, @start_id + @row := @row AS new_id
FROM users
WHERE id >= 100000
ORDER BY id ASC;

-- Step 4: Update all tables that reference users.id
-- Foreign-key tables (order doesn't matter with FK checks off)
UPDATE reel_reports        rr JOIN _id_mapping m ON rr.user_id = m.old_id SET rr.user_id = m.new_id;
UPDATE user_totp           ut JOIN _id_mapping m ON ut.user_id = m.old_id SET ut.user_id = m.new_id;
UPDATE posts               p  JOIN _id_mapping m ON p.user_id = m.old_id SET p.user_id = m.new_id;
UPDATE lga_chat_messages   lc JOIN _id_mapping m ON lc.user_id = m.old_id SET lc.user_id = m.new_id;
UPDATE notifications       n  JOIN _id_mapping m ON n.user_id = m.old_id SET n.user_id = m.new_id;
UPDATE reels               r  JOIN _id_mapping m ON r.author_id = m.old_id SET r.author_id = m.new_id;
UPDATE news                nw JOIN _id_mapping m ON nw.author_id = m.old_id SET nw.author_id = m.new_id;
UPDATE reel_likes          rl JOIN _id_mapping m ON rl.user_id = m.old_id SET rl.user_id = m.new_id;
UPDATE reel_comments       rc JOIN _id_mapping m ON rc.user_id = m.old_id SET rc.user_id = m.new_id;
UPDATE page_views          pv JOIN _id_mapping m ON pv.user_id = m.old_id SET pv.user_id = m.new_id;
UPDATE users               u  JOIN _id_mapping m ON u.referred_by_user_id = m.old_id SET u.referred_by_user_id = m.new_id;
UPDATE sse_tokens          st JOIN _id_mapping m ON st.user_id = m.old_id SET st.user_id = m.new_id;
UPDATE chat_last_read      cl JOIN _id_mapping m ON cl.user_id = m.old_id SET cl.user_id = m.new_id;

-- Step 5: Update the primary key in the users table
-- We use a temporary column swap to avoid PK constraint conflicts
ALTER TABLE users ADD COLUMN _new_id INT NULL;
UPDATE users u JOIN _id_mapping m ON u.id = m.old_id SET u._new_id = m.new_id;
UPDATE users SET id = _new_id WHERE _new_id IS NOT NULL;
ALTER TABLE users DROP COLUMN _new_id;

-- Step 6: Reset AUTO_INCREMENT to MAX(id) + 1
ALTER TABLE users AUTO_INCREMENT = 0;
SET @next := (SELECT COALESCE(MAX(id), 0) + 1 FROM users WHERE id >= 100000);
SET @sql := CONCAT('ALTER TABLE users AUTO_INCREMENT = ', @next);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 7: Clean up
DROP TEMPORARY TABLE _id_mapping;
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

-- Post-migration note: existing JWTs contain the old user ID.
-- All users (including admins) must re-authenticate.
-- If you need to preserve sessions, clear the jwt_blacklist table
-- and instruct users to log in again.
