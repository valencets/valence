import { describe, it, expect } from 'vitest'
import { parseMigrationFilename, sortMigrations, validateMigrations } from '../migration-runner.js'
import type { MigrationFile } from '../migration-runner.js'

describe('parseMigrationFilename', () => {
  it('parses 001-init.sql', () => {
    const result = parseMigrationFilename('001-init.sql')
    expect(result.isOk()).toBe(true)
    const file = result.unwrap()
    expect(file.version).toBe(1)
    expect(file.name).toBe('init')
  })

  it('parses 002-rbac.sql', () => {
    const result = parseMigrationFilename('002-rbac.sql')
    expect(result.isOk()).toBe(true)
    const file = result.unwrap()
    expect(file.version).toBe(2)
    expect(file.name).toBe('rbac')
  })

  it('parses multi-word names with hyphens', () => {
    const result = parseMigrationFilename('010-add-user-table.sql')
    expect(result.isOk()).toBe(true)
    const file = result.unwrap()
    expect(file.version).toBe(10)
    expect(file.name).toBe('add-user-table')
  })

  it('rejects non-SQL files', () => {
    const result = parseMigrationFilename('001-init.txt')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('MIGRATION_FAILED')
  })

  it('rejects files without version prefix', () => {
    const result = parseMigrationFilename('init.sql')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('MIGRATION_FAILED')
  })

  it('rejects gitkeep files', () => {
    const result = parseMigrationFilename('.gitkeep')
    expect(result.isErr()).toBe(true)
  })

  it('rejects files with no name after version', () => {
    const result = parseMigrationFilename('001-.sql')
    expect(result.isErr()).toBe(true)
  })
})

describe('sortMigrations', () => {
  it('sorts by version ascending', () => {
    const migrations: ReadonlyArray<MigrationFile> = [
      { version: 3, name: 'c', sql: '' },
      { version: 1, name: 'a', sql: '' },
      { version: 2, name: 'b', sql: '' }
    ]
    const sorted = sortMigrations(migrations)
    expect(sorted[0]!.version).toBe(1)
    expect(sorted[1]!.version).toBe(2)
    expect(sorted[2]!.version).toBe(3)
  })

  it('returns empty array for empty input', () => {
    const sorted = sortMigrations([])
    expect(sorted).toEqual([])
  })

  it('does not mutate original array', () => {
    const migrations: ReadonlyArray<MigrationFile> = [
      { version: 2, name: 'b', sql: '' },
      { version: 1, name: 'a', sql: '' }
    ]
    sortMigrations(migrations)
    expect(migrations[0]!.version).toBe(2)
  })
})

describe('validateMigrations', () => {
  it('returns Ok for valid migrations', () => {
    const migrations: ReadonlyArray<MigrationFile> = [
      { version: 1, name: 'a', sql: 'CREATE TABLE a;' },
      { version: 2, name: 'b', sql: 'CREATE TABLE b;' }
    ]
    const result = validateMigrations(migrations)
    expect(result.isOk()).toBe(true)
  })

  it('returns Ok for empty array', () => {
    const result = validateMigrations([])
    expect(result.isOk()).toBe(true)
  })

  it('returns Err for duplicate versions', () => {
    const migrations: ReadonlyArray<MigrationFile> = [
      { version: 1, name: 'a', sql: 'CREATE TABLE a;' },
      { version: 1, name: 'b', sql: 'CREATE TABLE b;' }
    ]
    const result = validateMigrations(migrations)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('MIGRATION_FAILED')
  })

  it('error message mentions duplicate version', () => {
    const migrations: ReadonlyArray<MigrationFile> = [
      { version: 5, name: 'a', sql: '' },
      { version: 5, name: 'b', sql: '' }
    ]
    const result = validateMigrations(migrations)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().message).toContain('5')
  })

  it('MigrationFile has version, name, and sql', () => {
    const file: MigrationFile = { version: 1, name: 'test', sql: 'SELECT 1;' }
    expect(file.version).toBe(1)
    expect(file.name).toBe('test')
    expect(file.sql).toBe('SELECT 1;')
  })
})

import { loadMigrations, runMigrations, getMigrationStatus } from '../migration-runner.js'
import { makeMockPool, makeRejectingPool } from '../test-helpers.js'
import { DbErrorCode } from '../types.js'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('loadMigrations', () => {
  it('returns Err for nonexistent directory', async () => {
    const result = await loadMigrations('/tmp/does-not-exist-' + Date.now())
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('MIGRATION_FAILED')
  })

  it('returns Ok([]) for empty directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'val-db-test-'))
    const result = await loadMigrations(dir)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual([])
    await rm(dir, { recursive: true })
  })

  it('ignores non-.sql files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'val-db-test-'))
    await writeFile(join(dir, 'README.md'), '# hello')
    await writeFile(join(dir, '.gitkeep'), '')
    const result = await loadMigrations(dir)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual([])
    await rm(dir, { recursive: true })
  })

  it('reads SQL content from files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'val-db-test-'))
    await writeFile(join(dir, '001-init.sql'), 'CREATE TABLE foo (id INT);')
    const result = await loadMigrations(dir)
    expect(result.isOk()).toBe(true)
    const migrations = result.unwrap()
    expect(migrations.length).toBe(1)
    expect(migrations[0]!.version).toBe(1)
    expect(migrations[0]!.name).toBe('init')
    expect(migrations[0]!.sql).toBe('CREATE TABLE foo (id INT);')
    await rm(dir, { recursive: true })
  })

  it('returns Err when a sql filename is invalid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'val-db-test-'))
    await writeFile(join(dir, '001-init.sql'), 'CREATE TABLE foo (id INT);')
    await writeFile(join(dir, 'bad-name.sql'), 'SELECT 1;')

    const result = await loadMigrations(dir)

    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(DbErrorCode.MIGRATION_FAILED)
    await rm(dir, { recursive: true })
  })

  it('reads and sorts migrations deterministically', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'val-db-test-'))
    await writeFile(join(dir, '002-second.sql'), 'SELECT 2;')
    await writeFile(join(dir, '001-first.sql'), 'SELECT 1;')

    const result = await loadMigrations(dir)

    expect(result.isOk()).toBe(true)
    expect(result.unwrap().map((migration) => migration.version)).toEqual([1, 2])
    expect(result.unwrap().map((migration) => migration.sql)).toEqual(['SELECT 1;', 'SELECT 2;'])
    await rm(dir, { recursive: true })
  })
})

describe('getMigrationStatus', () => {
  it('returns Ok with rows from pool', async () => {
    const pool = makeMockPool([{ version: 1, applied_at: '2026-01-01' }])
    const result = await getMigrationStatus(pool)
    expect(result.isOk()).toBe(true)
  })

  it('returns Ok([]) when migrations table does not exist yet', async () => {
    const pool = makeRejectingPool({ code: '42P01', message: 'relation "_migrations" does not exist' })
    const result = await getMigrationStatus(pool)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual([])
  })

  it('returns Err on query failure', async () => {
    const pool = makeRejectingPool({ code: DbErrorCode.QUERY_FAILED, message: 'boom' })
    const result = await getMigrationStatus(pool)
    expect(result.isErr()).toBe(true)
  })
})

describe('runMigrations edge cases', () => {
  it('returns Ok(0) for empty migrations array', async () => {
    const reservedSql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: async (): Promise<ReadonlyArray<Record<string, number>>> => [],
        begin: async (): Promise<void> => {},
        release: async (): Promise<void> => {}
      }
    )
    const sql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: async (): Promise<ReadonlyArray<Record<string, number>>> => [],
        begin: async (): Promise<void> => {},
        reserve: async () => reservedSql
      }
    ) as unknown as import('../connection.js').DbPool['sql']
    const pool = { sql }
    const result = await runMigrations(pool, [])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(0)
  })
})

describe('runMigrations advisory lock', () => {
  it('uses one reserved connection for lock, migration execution, and unlock', async () => {
    const rootCalls: string[] = []
    const reservedCalls: string[] = []
    const txCalls: string[] = []

    const reservedUnsafe = async (query: string): Promise<ReadonlyArray<Record<string, number>>> => {
      reservedCalls.push(query)
      return []
    }

    const reservedSql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: reservedUnsafe,
        begin: async (fn: (tx: { unsafe: typeof reservedUnsafe }) => Promise<void>): Promise<void> => {
          await fn({
            unsafe: async (query: string): Promise<ReadonlyArray<Record<string, number>>> => {
              txCalls.push(query)
              return []
            }
          })
        },
        release: async (): Promise<void> => {}
      }
    )

    const sql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: async (query: string): Promise<ReadonlyArray<Record<string, number>>> => {
          rootCalls.push(query)
          return []
        },
        begin: async (): Promise<void> => {},
        reserve: async () => reservedSql
      }
    ) as unknown as import('../connection.js').DbPool['sql']

    const pool = { sql }
    const result = await runMigrations(pool, [
      { version: 1, name: 'init', sql: 'CREATE TABLE test (id INT);' }
    ])

    expect(result.isOk()).toBe(true)
    expect(rootCalls).toEqual([])
    expect(reservedCalls.some((query) => query.includes('pg_advisory_lock'))).toBe(true)
    expect(reservedCalls.some((query) => query.includes('pg_advisory_unlock'))).toBe(true)
    expect(txCalls).toContain('CREATE TABLE test (id INT);')
  })

  it('releases the advisory lock on the reserved connection when a migration fails', async () => {
    const reservedCalls: string[] = []
    const txCalls: string[] = []

    const reservedUnsafe = async (query: string): Promise<ReadonlyArray<Record<string, number>>> => {
      reservedCalls.push(query)
      return []
    }

    const reservedSql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: reservedUnsafe,
        begin: async (fn: (tx: { unsafe: typeof reservedUnsafe }) => Promise<void>): Promise<void> => {
          await fn({
            unsafe: async (query: string): Promise<ReadonlyArray<Record<string, number>>> => {
              txCalls.push(query)
              throw new Error('boom')
            }
          })
        },
        release: async (): Promise<void> => {}
      }
    )

    const sql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: async (): Promise<ReadonlyArray<Record<string, number>>> => [],
        begin: async (): Promise<void> => {},
        reserve: async () => reservedSql
      }
    ) as unknown as import('../connection.js').DbPool['sql']

    const pool = { sql }
    const result = await runMigrations(pool, [
      { version: 1, name: 'init', sql: 'CREATE TABLE test (id INT);' }
    ])

    expect(result.isErr()).toBe(true)
    expect(txCalls).toContain('CREATE TABLE test (id INT);')
    expect(reservedCalls.some((query) => query.includes('pg_advisory_lock'))).toBe(true)
    expect(reservedCalls.some((query) => query.includes('pg_advisory_unlock'))).toBe(true)
  })

  it('attempts release when advisory unlock fails', async () => {
    const reservedCalls: string[] = []
    let releaseCalls = 0

    const reservedUnsafe = async (query: string): Promise<ReadonlyArray<Record<string, number>>> => {
      reservedCalls.push(query)
      if (query.includes('pg_advisory_unlock')) {
        throw new Error('unlock failed')
      }
      return []
    }

    const reservedSql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: reservedUnsafe,
        begin: async (): Promise<void> => {},
        release: async (): Promise<void> => {
          releaseCalls++
        }
      }
    )

    const sql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: async (): Promise<ReadonlyArray<Record<string, number>>> => [],
        begin: async (): Promise<void> => {},
        reserve: async () => reservedSql
      }
    ) as unknown as import('../connection.js').DbPool['sql']

    const result = await runMigrations({ sql }, [])

    expect(result.isErr()).toBe(true)
    expect(reservedCalls.some((query) => query.includes('pg_advisory_unlock'))).toBe(true)
    expect(releaseCalls).toBe(1)
  })

  it('preserves the migration failure when unlock also fails', async () => {
    let releaseCalls = 0

    const reservedUnsafe = async (query: string): Promise<ReadonlyArray<Record<string, number>>> => {
      if (query.includes('pg_advisory_unlock')) {
        throw new Error('unlock failed')
      }
      return []
    }

    const reservedSql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: reservedUnsafe,
        begin: async (fn: (tx: { unsafe: typeof reservedUnsafe }) => Promise<void>): Promise<void> => {
          await fn({
            unsafe: async (): Promise<ReadonlyArray<Record<string, number>>> => {
              throw new Error('migration failed')
            }
          })
        },
        release: async (): Promise<void> => {
          releaseCalls++
        }
      }
    )

    const sql = Object.assign(
      async (): Promise<ReadonlyArray<Record<string, number>>> => [],
      {
        unsafe: async (): Promise<ReadonlyArray<Record<string, number>>> => [],
        begin: async (): Promise<void> => {},
        reserve: async () => reservedSql
      }
    ) as unknown as import('../connection.js').DbPool['sql']

    const result = await runMigrations({ sql }, [
      { version: 1, name: 'init', sql: 'CREATE TABLE test (id INT);' }
    ])

    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().message).toContain('migration failed')
    expect(releaseCalls).toBe(1)
  })
})
