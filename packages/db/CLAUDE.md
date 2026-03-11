# packages/db

PostgreSQL immutable ledger. Client-owned database for self-hosted analytics.

## Schema

Two core tables: `sessions` and `events`. See `docs/ARCHITECTURE.md` section: PostgreSQL Schema for full DDL.

## Immutability

- Application service account: INSERT + SELECT only
- UPDATE, DELETE, TRUNCATE revoked at engine level
- Corrections are compensating events, never mutations
- ON DELETE RESTRICT on foreign keys (never cascade deletes)

## JSONB Rules

- The `payload` column stores business-specific data
- Apply the **1/80th Rule**: if a JSONB key appears in >1/80th of rows, extract to a typed column
- GIN index uses `jsonb_path_ops` (not default) for containment queries
- Keep payloads under 2kB to avoid TOAST overhead

## Aggregation

Background cron hourly: raw events → summary tables. Dashboard reads summaries only.

## Migrations

All schema changes via migration files in `migrations/`. Never modify production schema manually.
