import { describe, it, expect, vi } from 'vitest'
import { generateDockerCompose, verifyDatabaseConnection, createAdminUser } from '../postgres-setup.js'
import type { DbPool } from '@valencets/db'

// CMS init must set postgres up properly: a compose file so the database
// can be stood up when absent, connectivity verified before claiming
// success, and the admin user minted during init when the panel is chosen.

const ANSWERS = { dbName: 'my_app', dbHost: 'localhost', dbPort: '5432', dbUser: 'postgres', dbPassword: 'hunter2' }

describe('generateDockerCompose', () => {
  it('emits a postgres 16 service wired to the init answers', () => {
    const compose = generateDockerCompose(ANSWERS)
    expect(compose).toContain('postgres:16')
    expect(compose).toContain('POSTGRES_DB: my_app')
    expect(compose).toContain('POSTGRES_USER: postgres')
    expect(compose).toContain('POSTGRES_PASSWORD: hunter2')
    expect(compose).toContain('"5432:5432"')
    expect(compose).toContain('volumes:')
  })

  it('maps a custom host port onto the container port', () => {
    const compose = generateDockerCompose({ ...ANSWERS, dbPort: '55432' })
    expect(compose).toContain('"55432:5432"')
  })
})

describe('verifyDatabaseConnection', () => {
  function fakeDeps (behavior: 'ok' | 'reject') {
    const sql = Object.assign(
      vi.fn(() => behavior === 'ok' ? Promise.resolve([{ one: 1 }]) : Promise.reject(new Error('ECONNREFUSED'))),
      { unsafe: vi.fn(), begin: vi.fn(), end: vi.fn(async () => undefined) }
    )
    const pool = { sql } as unknown as DbPool
    return {
      deps: {
        createPool: vi.fn(() => pool),
        closePool: vi.fn(() => ({ match: (okFn: () => void) => { okFn() } }))
      },
      sql
    }
  }

  it('answers ok when SELECT 1 round-trips', async () => {
    const { deps } = fakeDeps('ok')
    const result = await verifyDatabaseConnection(
      { host: 'localhost', port: 5432, database: 'x', username: 'u', password: 'p', max: 1, idle_timeout: 5, connect_timeout: 3 },
      deps as never
    )
    expect(result.isOk()).toBe(true)
  })

  it('answers err with the driver message when the database is unreachable', async () => {
    const { deps } = fakeDeps('reject')
    const result = await verifyDatabaseConnection(
      { host: 'localhost', port: 5432, database: 'x', username: 'u', password: 'p', max: 1, idle_timeout: 5, connect_timeout: 3 },
      deps as never
    )
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('ECONNREFUSED')
    }
  })
})

describe('createAdminUser', () => {
  function capturePool () {
    const unsafe = vi.fn(async () => [{ id: 'u1' }])
    const sql = Object.assign(vi.fn(), { unsafe, begin: vi.fn() })
    return { pool: { sql } as unknown as DbPool, unsafe }
  }

  it('inserts an admin with an argon2id hash, never the plaintext password', async () => {
    const { pool, unsafe } = capturePool()

    const result = await createAdminUser(pool, { email: 'admin@example.com', password: 'correct horse battery', name: 'Admin' })

    expect(result.isOk()).toBe(true)
    expect(unsafe).toHaveBeenCalledTimes(1)
    const [text, params] = unsafe.mock.calls[0]! as [string, readonly string[]]
    expect(text).toContain('INSERT INTO "users"')
    expect(text).toContain('$1')
    expect(params).toContain('admin@example.com')
    expect(params).toContain('Admin')
    expect(params).toContain('admin')
    expect(params.some(p => String(p).startsWith('$argon2id$'))).toBe(true)
    expect(params).not.toContain('correct horse battery')
  })

  it('maps insert failures into an error instead of throwing', async () => {
    const unsafe = vi.fn(async () => Promise.reject(new Error('duplicate key')))
    const sql = Object.assign(vi.fn(), { unsafe, begin: vi.fn() })

    const result = await createAdminUser({ sql } as unknown as DbPool, { email: 'a@b.c', password: 'x'.repeat(12), name: 'A' })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('duplicate key')
    }
  })
})
