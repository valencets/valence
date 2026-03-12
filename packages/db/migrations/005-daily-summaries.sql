-- Daily summaries table for multi-tenant fleet aggregation (Telemetry v2)
-- One denormalized row per site per day, pushed from client appliances to studio

CREATE TABLE IF NOT EXISTS daily_summaries (
  id               BIGSERIAL PRIMARY KEY,
  site_id          TEXT NOT NULL,
  date             DATE NOT NULL,
  business_type    TEXT NOT NULL,
  schema_version   INTEGER NOT NULL DEFAULT 1,
  session_count    INTEGER,
  pageview_count   INTEGER,
  conversion_count INTEGER,
  top_referrers    JSONB,
  top_pages        JSONB,
  intent_counts    JSONB,
  avg_flush_ms     NUMERIC,
  rejection_count  INTEGER,
  synced_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, date)
);

CREATE INDEX idx_summaries_site_date ON daily_summaries(site_id, date);
