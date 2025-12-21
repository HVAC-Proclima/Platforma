-- 003_users_email_nullable.sql

BEGIN;

-- email devine optional
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

COMMIT;
