BEGIN;

CREATE TEMP TABLE tmp_material_dups AS
WITH canon AS (
  SELECT
    LOWER(name) AS lname,
    COALESCE(unit,'') AS u,
    MIN(id) AS canon_id
  FROM materials
  WHERE active = TRUE
  GROUP BY LOWER(name), COALESCE(unit,'')
)
SELECT
  m.id AS dup_id,
  c.canon_id
FROM materials m
JOIN canon c
  ON LOWER(m.name) = c.lname
 AND COALESCE(m.unit,'') = c.u
WHERE m.active = TRUE
  AND m.id <> c.canon_id;

UPDATE stock_movements sm
SET material_id = d.canon_id
FROM tmp_material_dups d
WHERE sm.material_id = d.dup_id;

UPDATE materials m
SET active = FALSE
FROM tmp_material_dups d
WHERE m.id = d.dup_id;

COMMIT;
