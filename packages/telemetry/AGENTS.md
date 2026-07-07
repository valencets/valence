# @valencets/telemetry — Agent Guide

Server side of the first-party analytics pipeline (client capture lives in `@valencets/core/telemetry`).
Deps: `@valencets/core`, `@valencets/db`, `postgres`, `@valencets/resultkit`. Repo-wide rules: root `AGENTS.md`.

## Pipeline

1. `handler.ts` — `createIngestionHandler`: receives `navigator.sendBeacon` POSTs.
2. `beacon-validation.ts` — structure/intent-type/site-id validation (`MAX_BEACON_EVENTS` cap).
   **Invalid payloads still answer 200** — 4xx/5xx would trigger client retry storms. Bad data is
   dropped/audited, never stored.
3. `ingestion.ts` — batch insert of sessions + events (`event-queries.ts`, `event-types.ts`).
4. `aggregation.ts` / `daily-summary-aggregation.ts` — INSERT…ON CONFLICT rollups: session/event/
   conversion summaries and one denormalized `DailySummaryRow` per site per day (`generateDailySummary`,
   sub-queries in parallel).
5. `analytics-queries.ts` / `summary-queries.ts` / `daily-summary-queries.ts` — reads for the admin
   dashboard (`getDailyTrend`, `getDailyBreakdowns`, `getUnsyncedDailySummaries`/`markSynced` for fleet sync).
6. `retention.ts` — `cleanupOldEvents`/`cleanupOldSessions`.
7. `init.ts` — client bootstrap helper (`initTelemetry`) wiring core's ring buffer + flush.
8. `server-events.ts` — server-side event logger.

## Hard rules

- Never import from `@valencets/cms` (the cms consumes this package, not vice versa).
- All queries take a `DbPool`, return `ResultAsync<_, DbError>` via `mapPostgresError`.
- Schema versioning: intents carry `schema_version`; ingestion dispatches through a
  version-keyed handler map. Old events stay valid forever — add handlers, don't migrate data.
