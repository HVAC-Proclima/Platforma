-- 005_projects_workers.sql

BEGIN;

-- workers = angajații care lucrează efectiv (nu neapărat useri cu login)
CREATE TABLE IF NOT EXISTS workers (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workers_name ON workers (name);

-- projects = lucrări
CREATE TABLE IF NOT EXISTS projects (
  id         BIGSERIAL PRIMARY KEY,
  client_id  BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  title      TEXT NOT NULL,
  address    TEXT,
  status     TEXT NOT NULL DEFAULT 'planned'
             CHECK (status IN ('planned','in_progress','done','canceled')),
  notes      TEXT,
  archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

-- project_workers = cine a lucrat pe lucrare
CREATE TABLE IF NOT EXISTS project_workers (
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  worker_id  BIGINT NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  note       TEXT,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, worker_id)
);

COMMIT;
