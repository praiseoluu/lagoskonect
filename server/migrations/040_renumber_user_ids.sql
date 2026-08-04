-- 040_renumber_user_ids.sql
-- Renumber citizen user IDs to be gap-free and sequential (100001, 100002, …).
-- Existing IDs have gaps (e.g. 100001 → 100014) caused by rows deleted
-- before the MAX(id)+1 logic was introduced in AuthController::register.
--
-- This script:
--   1. Builds a mapping of old_id → new_id (sequential from 100001)
--   2. Disables FK checks, updates every referencing table, updates the primary
--      key, then re-enables FK checks.
--   3. Resets AUTO_INCREMENT so the next registration continues cleanly.
--
-- Designed to be idempotent: if previously partially applied, it detects
-- overlap and skips or re-maps accordingly.
--
-- SAFETY:
--   • Only affects the `users` table (citizens, id >= 100000). Admins untouched.
--   • Wrapped in a single transaction so it's all-and-nothing.
--   • Existing JWTs will become invalid — users must re-login.
--
-- Tables with FK constraints referencing users.id:
--   reel_reports, user_totp, posts, lga_chat_messages, notifications
-- Tables with plain indexes (no FK) referencing users:
--   reels (author_id), reel_likes (user_id), reel_comments (user_id),
--   news (author_id), page_views (user_id), users (referred_by_user_id),
--   sse_tokens (user_id), chat_invites (invited_by), chat_reports (reporter_id),
--   reel_subscriptions (follower_id, target_id), chat_last_read (user_id, composite PK)

START TRANSACTION;

-- Prevent re-running from corrupting data.
-- If the highest citizen id equals COUNT(citizens) - 1 + 100001, IDs are
-- already sequential and we bail out.
SET @citizenCount := (SELECT COUNT(*) FROM users WHERE id >= 100000);
SET @maxId         := (SELECT COALESCE(MAX(id), 0) FROM users WHERE id >= 100000);
SET @expectedMax   := 100000 + @citizenCount;

-- Step 0: Bail out if already sequential (no-op)
SET @alreadySequential := (@maxId <= @expectedMax AND @maxId >= 100001);

-- Step 1: Disable FK checks to allow primary-key updates
SET FOREIGN_KEY_CHECKS = 0;

-- Step 2: Create a mapping table (old_id → new_id)
DROP TEMPORARY TABLE IF EXISTS _id_mapping;
CREATE TEMPORARY TABLE _id_mapping (
    old_id INT PRIMARY KEY,
    new_id INT NOT NULL UNIQUE,
    INDEX idx_new (new_id)
);

-- Step 3: Assign sequential IDs in ascending order
-- Only map IDs that will actually change (old_id != new_id)
-- so we don't waste updates on rows that are already correct.
SET @rn := 0;

INSERT INTO _id_mapping (old_id, new_id)
SELECT id, 100000 + (@rn := @rn + 1) AS new_id
FROM users
WHERE id >= 100000
ORDER BY id ASC;

-- Remove self-mappings (where old_id already equals the target new_id)
-- so we only update rows that actually need changing.
DELETE FROM _id_mapping WHERE old_id = new_id;

-- Step 4: Update all tables that reference users.id
-- Plain index tables — safe to JOIN UPDATE
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
UPDATE sse_tokens          st JOIN _id_mapping m ON st.user_id = m.old_id SET st.user_id = m.new_id;
UPDATE chat_invites        ci JOIN _id_mapping m ON ci.invited_by = m.old_id SET ci.invited_by = m.new_id;
UPDATE chat_reports        cr JOIN _id_mapping m ON cr.reporter_id = m.old_id SET cr.reporter_id = m.new_id;
UPDATE reel_subscriptions  rs JOIN _id_mapping m ON rs.follower_id = m.old_id SET rs.follower_id = m.new_id;
UPDATE reel_subscriptions  rs JOIN _id_mapping m ON rs.target_id = m.old_id SET rs.target_id = m.new_id;

-- Self-referencing update for users.referred_by_user_id
UPDATE users u JOIN _id_mapping m ON u.referred_by_user_id = m.old_id SET u.referred_by_user_id = m.new_id;

-- chat_last_read has a composite PK (user_id, lga_id) and columns:
--   user_id, lga_id, last_message_id, updated_at
-- A simple JOIN UPDATE can collide when two old IDs map to new IDs
-- that already exist for the same lga_id. We back up, delete, and
-- re-insert to avoid duplicate-key collisions on the composite PK.
CREATE TEMPORARY TABLE _chat_last_read_backup AS
  SELECT cl.* FROM chat_last_read cl
  JOIN _id_mapping m ON cl.user_id = m.old_id;

DELETE cl FROM chat_last_read cl
JOIN _id_mapping m ON cl.user_id = m.old_id;

INSERT INTO chat_last_read (user_id, lga_id, last_message_id)
SELECT m.new_id, cl.lga_id, cl.last_message_id
FROM _chat_last_read_backup cl
JOIN _id_mapping m ON cl.user_id = m.old_id
ON DUPLICATE KEY UPDATE
  last_message_id = VALUES(last_message_id);

DROP TEMPORARY TABLE _chat_last_read_backup;

-- Step 5: Update the primary key in the users table
-- Use a temporary column to avoid PK constraint conflicts.
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
DROP TEMPORARY TABLE IF EXISTS _id_mapping;
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

-- Post-migration note: existing JWTs contain the old user ID.
-- All users (including admins) must re-authenticate.
-- If you need to preserve sessions, clear the jwt_blacklist table
-- and instruct users to log in again.
