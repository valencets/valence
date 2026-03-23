import { describe, it, expect } from 'vitest'
import { DbErrorCode } from '../types.js'
import type { DbError, DbConfig, DbSslMode } from '../types.js'

describe('DbErrorCode', () => {
  it('has CONNECTION_FAILED code', () => {
    expect(DbErrorCode.CONNECTION_FAILED).toBe('CONNECTION_FAILED')
  })

  it('has QUERY_FAILED code', () => {
    expect(DbErrorCode.QUERY_FAILED).toBe('QUERY_FAILED')
  })

  it('has MIGRATION_FAILED code', () => {
    expect(DbErrorCode.MIGRATION_FAILED).toBe('MIGRATION_FAILED')
  })

  it('has INVALID_CONFIG code', () => {
    expect(DbErrorCode.INVALID_CONFIG).toBe('INVALID_CONFIG')
  })

  it('has CONSTRAINT_VIOLATION code', () => {
    expect(DbErrorCode.CONSTRAINT_VIOLATION).toBe('CONSTRAINT_VIOLATION')
  })

  it('has NO_ROWS code', () => {
    expect(DbErrorCode.NO_ROWS).toBe('NO_ROWS')
  })

  it('all codes are unique string literals', () => {
    const values = Object.values(DbErrorCode)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('dictionary map lookup works for each code', () => {
    const codeMap: Record<string, boolean> = {}
    for (const code of Object.values(DbErrorCode)) {
      codeMap[code] = true
    }
    expect(codeMap[DbErrorCode.CONNECTION_FAILED]).toBe(true)
    expect(codeMap[DbErrorCode.QUERY_FAILED]).toBe(true)
    expect(codeMap[DbErrorCode.MIGRATION_FAILED]).toBe(true)
    expect(codeMap[DbErrorCode.INVALID_CONFIG]).toBe(true)
    expect(codeMap[DbErrorCode.CONSTRAINT_VIOLATION]).toBe(true)
  })
})

describe('type construction', () => {
  it('DbError can be constructed', () => {
    const error: DbError = { code: DbErrorCode.CONNECTION_FAILED, message: 'refused' }
    expect(error.code).toBe('CONNECTION_FAILED')
    expect(error.message).toBe('refused')
  })

  it('DbConfig can be constructed', () => {
    const config: DbConfig = {
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'app',
      password: 'secret',
      max: 10,
      idle_timeout: 30,
      connect_timeout: 5,
      sslmode: 'disable'
    }
    expect(config.port).toBe(5432)
    expect(config.max).toBe(10)
  })

  it('DbConfig can express verified SSL settings', () => {
    const config: DbConfig = {
      host: 'db.internal',
      port: 5432,
      database: 'mydb',
      username: 'app',
      password: 'secret',
      max: 10,
      idle_timeout: 30,
      connect_timeout: 5,
      sslmode: 'verify-full',
      sslrootcert: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
    }
    expect(config.sslmode).toBe('verify-full')
    expect(config.sslrootcert).toContain('BEGIN CERTIFICATE')
  })
})

describe('DbSslMode', () => {
  it('supports the audited SSL mode subset', () => {
    const modes: DbSslMode[] = ['disable', 'require', 'verify-ca', 'verify-full']
    expect(modes).toEqual(['disable', 'require', 'verify-ca', 'verify-full'])
  })
})

describe('DbErrorCode extended codes', () => {
  it('has AUTH_FAILED code', () => {
    expect(DbErrorCode.AUTH_FAILED).toBe('AUTH_FAILED')
  })

  it('has QUERY_TIMEOUT code', () => {
    expect(DbErrorCode.QUERY_TIMEOUT).toBe('QUERY_TIMEOUT')
  })

  it('has POOL_EXHAUSTED code', () => {
    expect(DbErrorCode.POOL_EXHAUSTED).toBe('POOL_EXHAUSTED')
  })

  it('has SERIALIZATION_FAILURE code', () => {
    expect(DbErrorCode.SERIALIZATION_FAILURE).toBe('SERIALIZATION_FAILURE')
  })
})
