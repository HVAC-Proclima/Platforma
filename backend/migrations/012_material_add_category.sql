-- +migrate Up
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS category TEXT;

-- +migrate Down
ALTER TABLE materials
  DROP COLUMN IF EXISTS category;
