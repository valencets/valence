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

## Quick Start

```bash
pnpm install
pnpm build
pnpm --filter=@valencets/db test
```
