# packages/db

PostgreSQL immutable ledger. Client-owned database for self-hosted analytics.

## Schema

Two core tables: `sessions` and `events`. See `docs/ARCHITECTURE.md` section: PostgreSQL Schema for full DDL.

Session liveness is derived from the last event timestamp — no `is_active` column. This avoids UPDATE operations which conflict with INSERT+SELECT-only RBAC.

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

## No Cross-Package Imports

DB defines its own types (`InsertableEvent`, `SessionRow`). Wiring happens at the app layer. Never import from `@inertia/core` or `@inertia/ingestion`.

## Driver

`postgres` (porsager/postgres). Native ESM, tagged template SQL (parameterized by default), zero deps, TypeScript-first. Import as `import postgres from 'postgres'` — default import (third-party API, not our export convention).

## Migrations

All schema changes via migration files in `migrations/`. Filename format: `NNN-name.sql` (e.g., `001-init.sql`). The migration runner creates its own `_migrations` tracking table.

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor:

1. Write a failing test that specifies the behavior
2. Write the minimum code to make it pass
3. Refactor while keeping tests green

## Module Map

```
src/
├── types.ts              # DbError, SessionRow, EventRow, InsertableSession, InsertableEvent, DbConfig
├── connection.ts         # validateDbConfig, createPool, closePool, mapPostgresError
├── migration-runner.ts   # loadMigrations, runMigrations, getMigrationStatus
├── queries.ts            # createSession, getSessionById, insertEvents, insertEvent, getEventsBySession, getEventsByTimeRange
└── index.ts              # Barrel exports
```

## Development Order

Build schema-first: types → connection → migration runner → SQL migrations → query helpers → barrel exports. Each module is test-driven and merged only when all tests pass.
