-- 002_users_phone.sql

BEGIN;

-- adaugă coloane doar dacă lipsesc
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- pentru unicitate (fără să stricăm rânduri vechi care au NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (email) WHERE email IS NOT NULL;

COMMIT;
