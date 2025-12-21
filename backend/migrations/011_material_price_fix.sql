-- UP
ALTER TABLE materials
  ALTER COLUMN price TYPE numeric(12,2)
  USING price::numeric;

ALTER TABLE stock_movements
  ALTER COLUMN unit_price_snapshot TYPE numeric(12,2)
  USING unit_price_snapshot::numeric;
