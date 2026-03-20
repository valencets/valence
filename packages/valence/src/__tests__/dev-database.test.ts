import { describe, it, expect } from 'vitest'
import { toDevDbConfig, ensureDevDatabase } from '../dev-database.js'
import type { DbConfig } from '@valencets/db'

const baseConfig: DbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'my_indie_web',
  username: 'testuser',
  password: 'testpass',
  max: 5,
  idle_timeout: 10,
  connect_timeout: 10
}

describe('toDevDbConfig', () => {
  it('appends _dev suffix to the database name', () => {
    const result = toDevDbConfig(baseConfig)
    expect(result.database).toBe('my_indie_web_dev')
  })

  it('preserves all other config fields', () => {
    const result = toDevDbConfig(baseConfig)
    expect(result.host).toBe('localhost')
    expect(result.port).toBe(5432)
    expect(result.username).toBe('testuser')
    expect(result.password).toBe('testpass')
    expect(result.max).toBe(5)
    expect(result.idle_timeout).toBe(10)
    expect(result.connect_timeout).toBe(10)
  })

  it('does not double-suffix if name already ends with _dev', () => {
    const alreadyDev: DbConfig = { ...baseConfig, database: 'my_app_dev' }
    const result = toDevDbConfig(alreadyDev)
    expect(result.database).toBe('my_app_dev')
  })
})

describe('ensureDevDatabase', () => {
  it('attempts to create the dev database via maintenance connection', async () => {
    const calls: Array<{ database: string; sql: string }> = []
    const mockCreatePool = (config: DbConfig) => ({
      sql: {
        unsafe: async (sql: string) => {
          calls.push({ database: config.database, sql })
          return []
        }
      }
    })
    const mockClosePool = async () => {}

    await ensureDevDatabase(baseConfig, {
      createPool: mockCreatePool as Parameters<typeof ensureDevDatabase>[1]['createPool'],
      closePool: mockClosePool as Parameters<typeof ensureDevDatabase>[1]['closePool']
    })

    expect(calls.length).toBe(1)
    expect(calls[0]!.database).toBe('postgres')
    expect(calls[0]!.sql).toContain('CREATE DATABASE')
    expect(calls[0]!.sql).toContain('my_indie_web_dev')
  })

  it('does not throw if database already exists', async () => {
    const mockCreatePool = (config: DbConfig) => ({
      sql: {
        unsafe: async () => {
          // Simulate "database already exists" error
          const err = new Error('database "my_indie_web_dev" already exists')
          throw err
        }
      }
    })
    const mockClosePool = async () => {}

    // Should not throw
    await ensureDevDatabase(baseConfig, {
      createPool: mockCreatePool as Parameters<typeof ensureDevDatabase>[1]['createPool'],
      closePool: mockClosePool as Parameters<typeof ensureDevDatabase>[1]['closePool']
    })
  })

  it('uses the postgres maintenance database for connection', async () => {
    const poolConfigs: DbConfig[] = []
    const mockCreatePool = (config: DbConfig) => {
      poolConfigs.push(config)
      return {
        sql: {
          unsafe: async () => []
        }
      }
    }
    const mockClosePool = async () => {}

    await ensureDevDatabase(baseConfig, {
      createPool: mockCreatePool as Parameters<typeof ensureDevDatabase>[1]['createPool'],
      closePool: mockClosePool as Parameters<typeof ensureDevDatabase>[1]['closePool']
    })

    expect(poolConfigs.length).toBe(1)
    expect(poolConfigs[0]!.database).toBe('postgres')
    expect(poolConfigs[0]!.host).toBe('localhost')
    expect(poolConfigs[0]!.username).toBe('testuser')
  })

  it('closes the maintenance pool after use', async () => {
    let closed = false
    const mockCreatePool = () => ({
      sql: { unsafe: async () => [] }
    })
    const mockClosePool = async () => { closed = true }

    await ensureDevDatabase(baseConfig, {
      createPool: mockCreatePool as Parameters<typeof ensureDevDatabase>[1]['createPool'],
      closePool: mockClosePool as Parameters<typeof ensureDevDatabase>[1]['closePool']
    })

    expect(closed).toBe(true)
  })
})
