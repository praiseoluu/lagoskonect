-- Fix picsum photo URLs: fastly.picsum.photos → picsum.photos
-- Run via phpMyAdmin: Import tab → choose this file → Go

UPDATE users
SET avatar_url = REPLACE(avatar_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE avatar_url LIKE '%fastly.picsum.photos%';

UPDATE admins
SET avatar_url = REPLACE(avatar_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE avatar_url LIKE '%fastly.picsum.photos%';

UPDATE reels
SET thumbnail_url = REPLACE(thumbnail_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/'),
    author_avatar_url = REPLACE(author_avatar_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE thumbnail_url LIKE '%fastly.picsum.photos%'
   OR author_avatar_url LIKE '%fastly.picsum.photos%';

UPDATE reel_comments
SET avatar_url = REPLACE(avatar_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE avatar_url LIKE '%fastly.picsum.photos%';

UPDATE lga_chat_messages
SET avatar_url = REPLACE(avatar_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE avatar_url LIKE '%fastly.picsum.photos%';

UPDATE notifications
SET actor_avatar_url = REPLACE(actor_avatar_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE actor_avatar_url LIKE '%fastly.picsum.photos%';

UPDATE news
SET image_url = REPLACE(image_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE image_url LIKE '%fastly.picsum.photos%';

UPDATE adverts
SET image_url = REPLACE(image_url, 'https://fastly.picsum.photos/', 'https://picsum.photos/')
WHERE image_url LIKE '%fastly.picsum.photos%';
