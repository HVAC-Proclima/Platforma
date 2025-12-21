-- SKU unic (când există)
CREATE UNIQUE INDEX IF NOT EXISTS ux_materials_sku
ON materials (sku)
WHERE sku IS NOT NULL AND sku <> '';

-- “material logic” unic (name+unit) pentru materiale active
CREATE UNIQUE INDEX IF NOT EXISTS ux_materials_name_unit
ON materials (LOWER(name), COALESCE(unit,''))
WHERE active = TRUE;
