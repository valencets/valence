-- Sites registry — one row per registered client site
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE sites (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  slug               TEXT UNIQUE NOT NULL,
  vertical           TEXT NOT NULL DEFAULT 'other',
  sub_vertical       TEXT,
  location           TEXT,
  tier               TEXT NOT NULL DEFAULT 'build_only',
  registered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  appliance_hardware TEXT,
  lead_action_schema JSONB
);

-- Seed studio site
INSERT INTO sites (name, slug, vertical, tier, appliance_hardware)
VALUES ('Inertia Studio', 'studio', 'studio', 'managed', 'N100-16GB');
