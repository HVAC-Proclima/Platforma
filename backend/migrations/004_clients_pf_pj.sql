-- 004_clients_pf_pj.sql

BEGIN;

-- adăugăm coloanele lipsă (safe dacă există deja)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnp TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cui TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- default pentru type dacă era NULL
UPDATE clients SET type = 'PJ' WHERE type IS NULL;

-- constraints: folosim bloc DO ca să fie idempotent
DO $$
BEGIN
  ALTER TABLE clients ADD CONSTRAINT chk_clients_type CHECK (type IN ('PF','PJ'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE clients ADD CONSTRAINT chk_clients_not_both CHECK (NOT (cnp IS NOT NULL AND cui IS NOT NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- unicitate pe CNP/CUI doar când sunt setate
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_cnp ON clients (cnp) WHERE cnp IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_cui ON clients (cui) WHERE cui IS NOT NULL;

COMMIT;
