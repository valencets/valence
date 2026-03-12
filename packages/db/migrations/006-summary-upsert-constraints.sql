-- Add UNIQUE constraints to intermediate summary tables to prevent duplicate rows
-- when the aggregation cron runs multiple times for the same period.

-- Clean up any existing duplicate rows (keep the most recent per unique combo)
DELETE FROM session_summaries a
USING session_summaries b
WHERE a.id < b.id
  AND a.period_start = b.period_start
  AND a.period_end = b.period_end;

ALTER TABLE session_summaries
  ADD CONSTRAINT session_summaries_period_unique UNIQUE (period_start, period_end);

DELETE FROM event_summaries a
USING event_summaries b
WHERE a.id < b.id
  AND a.period_start = b.period_start
  AND a.period_end = b.period_end
  AND a.event_category = b.event_category;

ALTER TABLE event_summaries
  ADD CONSTRAINT event_summaries_period_category_unique UNIQUE (period_start, period_end, event_category);

DELETE FROM conversion_summaries a
USING conversion_summaries b
WHERE a.id < b.id
  AND a.period_start = b.period_start
  AND a.period_end = b.period_end
  AND a.intent_type = b.intent_type;

ALTER TABLE conversion_summaries
  ADD CONSTRAINT conversion_summaries_period_intent_unique UNIQUE (period_start, period_end, intent_type);
