import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { DbErrorCode } from './types.js'
import type { DbError } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'

export interface MigrationFile {
  readonly version: number
  readonly name: string
  readonly sql: string
}

const MIGRATION_PATTERN = /^(\d+)-(.+)\.sql$/

export function parseMigrationFilename (filename: string): Result<{ version: number; name: string }, DbError> {
  const match = MIGRATION_PATTERN.exec(filename)

  if (!match || !match[1] || !match[2]) {
    return err({
      code: DbErrorCode.MIGRATION_FAILED,
      message: `Invalid migration filename: ${filename}. Expected format: NNN-name.sql`
    })
  }

  return ok({ version: Number(match[1]), name: match[2] })
}

export function sortMigrations (migrations: ReadonlyArray<MigrationFile>): ReadonlyArray<MigrationFile> {
  return [...migrations].sort((a, b) => a.version - b.version)
}

export function validateMigrations (migrations: ReadonlyArray<MigrationFile>): Result<ReadonlyArray<MigrationFile>, DbError> {
  const seen = new Set<number>()

  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      return err({
        code: DbErrorCode.MIGRATION_FAILED,
        message: `Duplicate migration version: ${migration.version}`
      })
    }
    seen.add(migration.version)
  }

  return ok(migrations)
}

export function loadMigrations (directory: string): ResultAsync<ReadonlyArray<MigrationFile>, DbError> {
  return ResultAsync.fromPromise(
    readdir(directory),
    (e: unknown): DbError => ({
      code: DbErrorCode.MIGRATION_FAILED,
      message: e instanceof Error ? e.message : 'Failed to read migrations directory'
    })
  ).andThen((filenames: string[]) => {
    const sqlFiles = filenames.filter((f) => f.endsWith('.sql'))
    const parsed: MigrationFile[] = []

    for (const filename of sqlFiles) {
      const result = parseMigrationFilename(filename)
      if (result.isErr()) {
        return ResultAsync.fromSafePromise<never, DbError>(
          Promise.reject(result.error)
        ).orElse((e) => err(e))
      }
      const { version, name } = result.value
      parsed.push({ version, name, sql: '' })
    }

    return ResultAsync.fromPromise(
      Promise.all(parsed.map(async (m, i) => {
        const content = await readFile(join(directory, sqlFiles[i]!), 'utf-8')
        return { ...m, sql: content }
      })),
      (e: unknown): DbError => ({
        code: DbErrorCode.MIGRATION_FAILED,
        message: e instanceof Error ? e.message : 'Failed to read migration file'
      })
    )
  }).andThen((migrations) => {
    const sorted = sortMigrations(migrations)
    return validateMigrations(sorted)
  })
}

const MIGRATION_LOCK_ID = 839274628

export function runMigrations (pool: DbPool, migrations: ReadonlyArray<MigrationFile>): ResultAsync<number, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      await pool.sql.unsafe('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])

      try {
        await pool.sql`
          CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `

        const applied = await pool.sql<Array<{ version: number }>>`
          SELECT version FROM _migrations ORDER BY version
        `
        const appliedVersions = new Set(applied.map((r) => r.version))

        let count = 0
        for (const migration of migrations) {
          if (appliedVersions.has(migration.version)) {
            continue
          }

          await pool.sql.begin(async (tx) => {
            await tx.unsafe(migration.sql)
            await tx.unsafe(
              'INSERT INTO _migrations (version, name) VALUES ($1, $2)',
              [migration.version, migration.name]
            )
          })
          count++
        }

        return count
      } finally {
        await pool.sql.unsafe('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
      }
    })(),
    mapPostgresError
  )
}

export function getMigrationStatus (pool: DbPool): ResultAsync<ReadonlyArray<{ version: number; applied_at: Date }>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<Array<{ version: number; applied_at: Date }>>`
        SELECT version, applied_at FROM _migrations ORDER BY version
      `
      return rows as ReadonlyArray<{ version: number; applied_at: Date }>
    })(),
    mapPostgresError
  )
}
