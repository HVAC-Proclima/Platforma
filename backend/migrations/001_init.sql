-- 001_init.sql

BEGIN;

-- Users (admin/employee)
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (name);

-- Locations (doar Zorilor/Iris)
CREATE TABLE IF NOT EXISTS locations (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Seed locations
INSERT INTO locations (name) VALUES ('Zorilor') ON CONFLICT DO NOTHING;
INSERT INTO locations (name) VALUES ('Iris') ON CONFLICT DO NOTHING;

-- Schema migrations (ca să știm ce s-a rulat)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
