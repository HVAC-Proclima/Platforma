-- SKU unic, doar când nu e NULL / gol
CREATE UNIQUE INDEX IF NOT EXISTS ux_materials_sku
ON materials (sku)
WHERE sku IS NOT NULL AND sku <> '';
