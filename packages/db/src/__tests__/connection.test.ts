import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPostgres } = vi.hoisted(() => {
  const mockPostgres = vi.fn(() => Object.assign(() => {}, { end: () => Promise.resolve() }))
  return { mockPostgres }
})
vi.mock('postgres', () => ({ default: mockPostgres }))

import { validateDbConfig, createPool, mapPostgresError, closePool } from '../connection.js'
import type { DbConfig } from '../types.js'

const validConfig: DbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'valence',
  username: 'app',
  password: 'secret',
  max: 10,
  idle_timeout: 30,
  connect_timeout: 5,
  sslmode: 'disable'
}

beforeEach(() => {
  mockPostgres.mockClear()
})

describe('validateDbConfig', () => {
  it('returns Ok for valid config', () => {
    const result = validateDbConfig(validConfig)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().host).toBe('localhost')
  })

  it('returns Ok for port 1', () => {
    const result = validateDbConfig({ ...validConfig, port: 1 })
    expect(result.isOk()).toBe(true)
  })

  it('returns Ok for port 65535', () => {
    const result = validateDbConfig({ ...validConfig, port: 65535 })
    expect(result.isOk()).toBe(true)
  })

  it('returns Err for missing host', () => {
    const { host: _, ...noHost } = validConfig
    const result = validateDbConfig(noHost)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for empty host', () => {
    const result = validateDbConfig({ ...validConfig, host: '' })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for port 0', () => {
    const result = validateDbConfig({ ...validConfig, port: 0 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for port 65536', () => {
    const result = validateDbConfig({ ...validConfig, port: 65536 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for empty database', () => {
    const result = validateDbConfig({ ...validConfig, database: '' })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for non-positive max', () => {
    const result = validateDbConfig({ ...validConfig, max: 0 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for negative idle_timeout', () => {
    const result = validateDbConfig({ ...validConfig, idle_timeout: -1 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for negative connect_timeout', () => {
    const result = validateDbConfig({ ...validConfig, connect_timeout: -1 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('error message describes validation issues', () => {
    const result = validateDbConfig({ ...validConfig, port: -5 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().message.length).toBeGreaterThan(0)
  })
})

describe('createPool', () => {
  it('returns a DbPool with sql property', () => {
    const pool = createPool(validConfig)
    expect(pool.sql).toBeDefined()
    expect(typeof pool.sql).toBe('function')
  })

  it('passes onnotice to suppress postgres NOTICE logs', () => {
    createPool(validConfig)
    const opts = mockPostgres.mock.calls[0]![0]
    expect(opts).toHaveProperty('onnotice')
    expect(typeof opts.onnotice).toBe('function')
  })

  it('passes onnotice when query_timeout is set', () => {
    createPool({ ...validConfig, query_timeout: 30_000 })
    const opts = mockPostgres.mock.calls[0]![0]
    expect(opts).toHaveProperty('onnotice')
    expect(typeof opts.onnotice).toBe('function')
  })

  it('passes query_timeout as statement_timeout', () => {
    createPool({ ...validConfig, query_timeout: 30_000 })
    const opts = mockPostgres.mock.calls[0]![0]
    expect(opts.connection.statement_timeout).toBe(30_000)
  })

  it('disables ssl when sslmode is disable', () => {
    createPool(validConfig)
    const opts = mockPostgres.mock.calls[0]![0]
    expect(opts.ssl).toBe(false)
  })

  it('enables ssl without certificate pinning for require mode', () => {
    createPool({ ...validConfig, sslmode: 'require' })
    const opts = mockPostgres.mock.calls[0]![0]
    expect(opts.ssl).toBe('require')
  })

  it('passes CA verification settings for verify-full mode', () => {
    createPool({
      ...validConfig,
      sslmode: 'verify-full',
      sslrootcert: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'
    })
    const opts = mockPostgres.mock.calls[0]![0]
    expect(opts.ssl.rejectUnauthorized).toBe(true)
    expect(opts.ssl.ca).toContain('BEGIN CERTIFICATE')
  })

  it('disables hostname verification only for verify-ca mode', () => {
    createPool({
      ...validConfig,
      sslmode: 'verify-ca',
      sslrootcert: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'
    })
    const opts = mockPostgres.mock.calls[0]![0]
    expect(opts.ssl.rejectUnauthorized).toBe(true)
    expect(typeof opts.ssl.checkServerIdentity).toBe('function')
  })
})

describe('closePool', () => {
  it('returns Ok when pool shutdown succeeds', async () => {
    const result = await closePool(createPool(validConfig))
    expect(result.isOk()).toBe(true)
  })

  it('returns Err when pool shutdown fails', async () => {
    const pool = {
      sql: Object.assign(() => {}, {
        end: () => Promise.reject(new Error('shutdown failed'))
      })
    }
    const result = await closePool(pool)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('CONNECTION_FAILED')
  })
})

describe('validateDbConfig extended validation', () => {
  it('returns Err for empty username', () => {
    const result = validateDbConfig({ ...validConfig, username: '' })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for empty password', () => {
    const result = validateDbConfig({ ...validConfig, password: '' })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for max > 100', () => {
    const result = validateDbConfig({ ...validConfig, max: 101 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for idle_timeout > 3600000', () => {
    const result = validateDbConfig({ ...validConfig, idle_timeout: 3_600_001 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('returns Err for connect_timeout > 60000', () => {
    const result = validateDbConfig({ ...validConfig, connect_timeout: 60_001 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('accepts valid query_timeout', () => {
    const result = validateDbConfig({ ...validConfig, query_timeout: 30_000 })
    expect(result.isOk()).toBe(true)
  })

  it('returns Err for query_timeout > 600000', () => {
    const result = validateDbConfig({ ...validConfig, query_timeout: 600_001 })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('accepts config without query_timeout', () => {
    const result = validateDbConfig(validConfig)
    expect(result.isOk()).toBe(true)
  })

  it('accepts supported sslmode values', () => {
    for (const sslmode of ['disable', 'require', 'verify-ca', 'verify-full'] as const) {
      const sslConfig = sslmode === 'disable'
        ? { ...validConfig, sslmode }
        : { ...validConfig, sslmode, sslrootcert: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----' }
      const result = validateDbConfig(sslConfig)
      expect(result.isOk()).toBe(true)
    }
  })

  it('requires sslrootcert for verify-ca', () => {
    const result = validateDbConfig({ ...validConfig, sslmode: 'verify-ca' })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })

  it('requires sslrootcert for verify-full', () => {
    const result = validateDbConfig({ ...validConfig, sslmode: 'verify-full' })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_CONFIG')
  })
})

describe('mapPostgresError', () => {
  it('maps PG 28000 to AUTH_FAILED', () => {
    const pgError = Object.assign(new Error('auth failed'), { code: '28000' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('AUTH_FAILED')
  })

  it('maps PG 28P01 to AUTH_FAILED', () => {
    const pgError = Object.assign(new Error('wrong password'), { code: '28P01' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('AUTH_FAILED')
  })

  it('maps PG 08006 to CONNECTION_FAILED', () => {
    const pgError = Object.assign(new Error('connection lost'), { code: '08006' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('CONNECTION_FAILED')
  })

  it('maps PG 57014 to QUERY_TIMEOUT', () => {
    const pgError = Object.assign(new Error('statement timeout'), { code: '57014' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('QUERY_TIMEOUT')
  })

  it('maps PG 53300 to POOL_EXHAUSTED', () => {
    const pgError = Object.assign(new Error('too many connections'), { code: '53300' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('POOL_EXHAUSTED')
  })

  it('maps PG 40001 to SERIALIZATION_FAILURE', () => {
    const pgError = Object.assign(new Error('serialization failure'), { code: '40001' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('SERIALIZATION_FAILURE')
  })

  it('maps PG 23502 to CONSTRAINT_VIOLATION', () => {
    const pgError = Object.assign(new Error('not null'), { code: '23502' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('CONSTRAINT_VIOLATION')
  })

  it('maps unknown PG code to QUERY_FAILED', () => {
    const pgError = Object.assign(new Error('unknown'), { code: '99999' })
    const result = mapPostgresError(pgError)
    expect(result.code).toBe('QUERY_FAILED')
  })

  it('maps non-Error input to QUERY_FAILED', () => {
    const result = mapPostgresError('string error')
    expect(result.code).toBe('QUERY_FAILED')
  })

  it('preserves original error message', () => {
    const pgError = Object.assign(new Error('specific failure msg'), { code: '23505' })
    const result = mapPostgresError(pgError)
    expect(result.message).toBe('specific failure msg')
  })
})
