# @valencets/db — Agent Guide

PostgreSQL layer: pool creation, config validation, error mapping, forward-only migrations.
Deps: `postgres` (porsager), `zod`, `@valencets/resultkit`. Repo-wide rules: root `AGENTS.md`.

## Modules

- `types.ts` — `DbErrorCode` const union (CONNECTION_FAILED, QUERY_FAILED, MIGRATION_FAILED,
  INVALID_CONFIG, CONSTRAINT_VIOLATION, AUTH_FAILED, QUERY_TIMEOUT, POOL_EXHAUSTED,
  SERIALIZATION_FAILURE, NO_ROWS) + `DbError`, `DbConfig`, `DbSslMode`.
- `connection.ts` — `validateDbConfig` (Zod; verify-ca/verify-full require `sslrootcert` — PEM
  *contents*, not a path), `createPool` → `DbPool { readonly sql: Sql }`, `closePool`,
  `mapPostgresError` (PG SQLSTATE → DbErrorCode via static map).
- `migration-runner.ts` — `NNN-name.sql` files; `loadMigrations` (parse, sort, reject duplicate
  versions), `runMigrations` (reserved session + advisory lock, each migration in its own
  transaction, tracked in `_migrations`), `getMigrationStatus` (fresh DB = zero applied).
- `test-helpers.ts` (published at `@valencets/db/test`) — `makeMockPool`, `makeRejectingPool`,
  `makeSequentialPool` for stateless query-path tests. Session-affine behavior (reserve/release)
  needs local inline mocks.

## Hard rules

- `DbPool` is the single point of DB access; query functions take a pool, never a raw connection.
- All errors surface as `DbError` through `mapPostgresError` — never leak driver exceptions.
- Migrations are forward-only and should be idempotent SQL (`IF NOT EXISTS`).
- `postgres` is imported as a default import (third-party interop — the one allowed exception).
