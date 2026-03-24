# @valencets/db

PostgreSQL connection, config validation, and migration runner for Valence. The package validates `DbConfig`, creates `postgres` pools with explicit SSL modes, maps database errors into `DbError`, and applies SQL migrations under an advisory lock.

[Full documentation on the wiki.](https://github.com/valencets/valence/wiki/Packages:-Db)

## Config

`DbConfig` includes:

- host, port, database, username, password
- pool sizing and timeout settings
- `sslmode?: 'disable' | 'require' | 'verify-ca' | 'verify-full'`
- `sslrootcert?: string`

Verified TLS modes require `sslrootcert`. The package boundary expects certificate contents, not a file path.

## Migrations

`loadMigrations()` reads `NNN-name.sql` files, validates version uniqueness, and sorts them deterministically.

`runMigrations()`:

- reserves one database session for the full migration run
- acquires a session-scoped advisory lock
- applies each unapplied migration inside its own transaction
- records applied versions in `_migrations`

`getMigrationStatus()` returns the applied migration list, and treats a fresh database with no `_migrations` table as zero applied migrations.

## Testing

The package also publishes query-path test helpers at `@valencets/db/test`:

- `makeMockPool()` for fixed successful query results
- `makeRejectingPool()` for raw rejected SQL-boundary failures
- `makeSequentialPool()` for deterministic per-call result sequences

These shared helpers are intentionally limited to stateless query-path tests. Tests that need session-affine behavior such as `reserve()` and `release()` should use local inline mocks instead of the shared helper surface.

## Quick Start

```bash
pnpm install
pnpm build
pnpm --filter=@valencets/db test
```
