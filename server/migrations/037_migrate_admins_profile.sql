-- Add profile columns to admins table
-- Run once via phpMyAdmin or MySQL CLI

ALTER TABLE admins
  ADD COLUMN phone VARCHAR(20)   NULL AFTER name,
  ADD COLUMN state VARCHAR(100)  NULL AFTER phone,
  ADD COLUMN city  VARCHAR(100)  NULL AFTER state;
