-- Summary tables for pre-aggregated analytics data (consumed by HUD)

CREATE TABLE session_summaries (
  id              BIGSERIAL PRIMARY KEY,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  total_sessions  INTEGER NOT NULL DEFAULT 0,
  unique_referrers INTEGER NOT NULL DEFAULT 0,
  device_mobile   INTEGER NOT NULL DEFAULT 0,
  device_desktop  INTEGER NOT NULL DEFAULT 0,
  device_tablet   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_summaries (
  id              BIGSERIAL PRIMARY KEY,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  event_category  VARCHAR(100) NOT NULL,
  total_count     INTEGER NOT NULL DEFAULT 0,
  unique_sessions INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversion_summaries (
  id              BIGSERIAL PRIMARY KEY,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  intent_type     VARCHAR(100) NOT NULL,
  total_count     INTEGER NOT NULL DEFAULT 0,
  top_sources     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingestion_health (
  id                    BIGSERIAL PRIMARY KEY,
  period_start          TIMESTAMPTZ NOT NULL,
  payloads_accepted     INTEGER NOT NULL DEFAULT 0,
  payloads_rejected     INTEGER NOT NULL DEFAULT 0,
  avg_processing_ms     REAL NOT NULL DEFAULT 0,
  buffer_saturation_pct REAL NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_summaries_period ON session_summaries(period_start, period_end);
CREATE INDEX idx_event_summaries_period ON event_summaries(period_start, period_end);
CREATE INDEX idx_conversion_summaries_period ON conversion_summaries(period_start, period_end);
CREATE INDEX idx_ingestion_health_period ON ingestion_health(period_start);
