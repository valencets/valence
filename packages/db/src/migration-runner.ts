import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ResultAsync } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
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
    const parsed: Array<{ version: number; name: string; filename: string }> = []

    for (const filename of sqlFiles) {
      const result = parseMigrationFilename(filename)
      if (result.isErr()) {
        return err(result.error)
      }
      const { version, name } = result.value
      parsed.push({ version, name, filename })
    }

    return ResultAsync.fromPromise(
      (async () => {
        const migrations: MigrationFile[] = []
        for (const migration of parsed) {
          const content = await readFile(join(directory, migration.filename), 'utf-8')
          migrations.push({
            version: migration.version,
            name: migration.name,
            sql: content
          })
        }
        return migrations
      })(),
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

function runMigrationsWithLock (pool: DbPool, migrations: ReadonlyArray<MigrationFile>): ResultAsync<number, DbError> {
  return ResultAsync.fromPromise(
    pool.sql.reserve(),
    mapPostgresError
  ).andThen((reservedSql) =>
    ResultAsync.fromPromise(
      (async () => {
        await reservedSql.unsafe('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID])

        const innerResult = await ResultAsync.fromPromise(
          (async () => {
            await reservedSql`
              CREATE TABLE IF NOT EXISTS _migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              )
            `

            const applied = await reservedSql<Array<{ version: number }>>`
              SELECT version FROM _migrations ORDER BY version
            `
            const appliedVersions = new Set(applied.map((r) => r.version))

            let count = 0
            for (const migration of migrations) {
              if (appliedVersions.has(migration.version)) {
                continue
              }

              await reservedSql.begin(async (tx) => {
                await tx.unsafe(migration.sql)
                await tx.unsafe(
                  'INSERT INTO _migrations (version, name) VALUES ($1, $2)',
                  [migration.version, migration.name]
                )
              })
              count++
            }

            return count
          })(),
          (e: unknown): DbError => mapPostgresError(e)
        )

        await reservedSql.unsafe('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
        await reservedSql.release()

        if (innerResult.isErr()) {
          return err(innerResult.error)
        }

        return ok(innerResult.value)
      })(),
      mapPostgresError
    ).andThen((result) => result)
  )
}

export function runMigrations (pool: DbPool, migrations: ReadonlyArray<MigrationFile>): ResultAsync<number, DbError> {
  return runMigrationsWithLock(pool, migrations)
}

export function getMigrationStatus (pool: DbPool): ResultAsync<ReadonlyArray<{ version: number; applied_at: Date }>, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<Array<{ version: number; applied_at: Date }>>`
      SELECT version, applied_at FROM _migrations ORDER BY version
    `,
    (error: unknown) => error
  ).orElse((error) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '42P01'
    ) {
      return ok<ReadonlyArray<{ version: number; applied_at: Date }>, DbError>([])
    }

    return err(mapPostgresError(error))
  }).map((rows) => rows as ReadonlyArray<{ version: number; applied_at: Date }>)
}
