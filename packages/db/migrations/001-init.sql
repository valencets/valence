CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE sessions (
  session_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer         TEXT,
  device_type      VARCHAR(50) NOT NULL,
  operating_system VARCHAR(50)
);

CREATE TABLE events (
  event_id         BIGSERIAL PRIMARY KEY,
  session_id       UUID NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_category   VARCHAR(100) NOT NULL,
  dom_target       TEXT,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_time_category ON events(created_at, event_category);
CREATE INDEX idx_events_payload ON events USING GIN (payload jsonb_path_ops);
