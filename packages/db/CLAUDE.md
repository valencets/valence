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

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor:

1. Write a failing test that specifies the behavior
2. Write the minimum code to make it pass
3. Refactor while keeping tests green

### Test Coverage Requirements

- Schema: verify table creation, constraints, and index presence
- Immutability: confirm UPDATE/DELETE/TRUNCATE are denied for the application service account
- JSONB: test containment queries with `jsonb_path_ops` index, payloads under 2kB
- Migrations: test up/down for every migration file
- Aggregation: verify hourly rollup produces correct summary rows

### LOC Targets

| Module | Estimated LOC | Test LOC |
|---|---|---|
| `migrations/001-init.sql` | ~60 | ~50 |
| `migrations/002-rbac.sql` | ~30 | ~40 |
| `src/connection.ts` | ~40 | ~30 |
| `src/queries.ts` | ~80 | ~120 |
| `src/aggregation.ts` | ~60 | ~80 |
| `seed/` scripts | ~40 | — |

Tests should be ~1.5x the implementation LOC where applicable.

## Development Order

Build schema-first: init migration → RBAC migration → connection module → query helpers → aggregation. Each module is test-driven and merged only when all tests pass.
