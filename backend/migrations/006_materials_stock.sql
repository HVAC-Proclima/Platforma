-- 006_materials_stock.sql

BEGIN;

-- Catalog materiale (tipuri de materiale)
CREATE TABLE IF NOT EXISTS materials (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  sku        TEXT,
  unit       TEXT NOT NULL DEFAULT 'buc',   -- buc, m, kg etc.
  price      NUMERIC(12,2),                -- optional
  min_stock  NUMERIC(12,3),                -- optional (pentru alerte)
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- nume+sku ajută la autocomplete
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials (name);
CREATE INDEX IF NOT EXISTS idx_materials_sku ON materials (sku);

-- ledger mișcări stoc
CREATE TABLE IF NOT EXISTS stock_movements (
  id                  BIGSERIAL PRIMARY KEY,
  material_id          BIGINT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,

  -- IN, TRANSFER, CONSUM, RETURN
  type                TEXT NOT NULL CHECK (type IN ('IN','TRANSFER','CONSUM','RETURN')),

  from_location_id     BIGINT REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id       BIGINT REFERENCES locations(id) ON DELETE RESTRICT,

  -- CONSUM/RETURN se leagă de lucrare
  project_id           BIGINT REFERENCES projects(id) ON DELETE RESTRICT,

  qty                 NUMERIC(12,3) NOT NULL CHECK (qty > 0),

  -- cost istoric (recomandat): dacă e NULL, poți folosi materials.price în rapoarte
  unit_price_snapshot  NUMERIC(12,2),

  created_by_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  document_ref         TEXT,
  note                 TEXT,

  -- reguli de consistență în funcție de tip:
  CHECK (
    (type = 'IN'       AND from_location_id IS NULL AND to_location_id IS NOT NULL AND project_id IS NULL)
 OR (type = 'TRANSFER' AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL AND project_id IS NULL)
 OR (type = 'CONSUM'    AND from_location_id IS NOT NULL AND to_location_id IS NULL AND project_id IS NOT NULL)
 OR (type = 'RETURN'    AND from_location_id IS NULL AND to_location_id IS NOT NULL AND project_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_material ON stock_movements (material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements (type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_project ON stock_movements (project_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements (created_at);

COMMIT;
