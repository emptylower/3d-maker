-- Migration: add password_hash and password_salt to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_salt TEXT;

-- Rollback (manual):
-- ALTER TABLE users DROP COLUMN password_hash;
-- ALTER TABLE users DROP COLUMN password_salt;

