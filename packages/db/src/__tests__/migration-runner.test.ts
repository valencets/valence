import { describe, it, expect } from 'vitest'
import { parseMigrationFilename, sortMigrations, validateMigrations } from '../migration-runner.js'
import type { MigrationFile } from '../migration-runner.js'

describe('parseMigrationFilename', () => {
  it('parses 001-init.sql', () => {
    const result = parseMigrationFilename('001-init.sql')
    expect(result.isOk()).toBe(true)
    const file = result._unsafeUnwrap()
    expect(file.version).toBe(1)
    expect(file.name).toBe('init')
  })

  it('parses 002-rbac.sql', () => {
    const result = parseMigrationFilename('002-rbac.sql')
    expect(result.isOk()).toBe(true)
    const file = result._unsafeUnwrap()
    expect(file.version).toBe(2)
    expect(file.name).toBe('rbac')
  })

  it('parses multi-word names with hyphens', () => {
    const result = parseMigrationFilename('010-add-user-table.sql')
    expect(result.isOk()).toBe(true)
    const file = result._unsafeUnwrap()
    expect(file.version).toBe(10)
    expect(file.name).toBe('add-user-table')
  })

  it('rejects non-SQL files', () => {
    const result = parseMigrationFilename('001-init.txt')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('MIGRATION_FAILED')
  })

  it('rejects files without version prefix', () => {
    const result = parseMigrationFilename('init.sql')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('MIGRATION_FAILED')
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
    expect(result._unsafeUnwrapErr().code).toBe('MIGRATION_FAILED')
  })

  it('error message mentions duplicate version', () => {
    const migrations: ReadonlyArray<MigrationFile> = [
      { version: 5, name: 'a', sql: '' },
      { version: 5, name: 'b', sql: '' }
    ]
    const result = validateMigrations(migrations)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('5')
  })

  it('MigrationFile has version, name, and sql', () => {
    const file: MigrationFile = { version: 1, name: 'test', sql: 'SELECT 1;' }
    expect(file.version).toBe(1)
    expect(file.name).toBe('test')
    expect(file.sql).toBe('SELECT 1;')
  })
})
