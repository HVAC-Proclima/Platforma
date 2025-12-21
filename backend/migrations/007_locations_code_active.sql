-- 007_locations_code_active.sql

BEGIN;

-- adăugăm coloane lipsă
ALTER TABLE locations ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- dacă există deja rânduri cu name, completăm code automat
UPDATE locations
SET code = CASE
  WHEN lower(name) LIKE '%zor%'  THEN 'ZOR'
  WHEN lower(name) LIKE '%iris%' THEN 'IRS'
  ELSE upper(left(regexp_replace(name, '\s+', '', 'g'), 3))
END
WHERE code IS NULL;

-- unicitate pe code și name (idempotent)
DO $$
BEGIN
  ALTER TABLE locations ADD CONSTRAINT uq_locations_code UNIQUE (code);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE locations ADD CONSTRAINT uq_locations_name UNIQUE (name);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- seed: dacă lipsesc, le inserăm
INSERT INTO locations (code, name, active) VALUES ('ZOR', 'Zorilor', TRUE) ON CONFLICT (code) DO NOTHING;
INSERT INTO locations (code, name, active) VALUES ('IRS', 'Iris', TRUE) ON CONFLICT (code) DO NOTHING;

COMMIT;
