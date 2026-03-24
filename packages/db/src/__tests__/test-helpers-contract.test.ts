import { describe, expect, it } from 'vitest'
import { makeRejectingPool, makeMockPool, makeSequentialPool } from '../test-helpers.js'
import { DbErrorCode } from '../types.js'

describe('db test helper surface', () => {
  it('makeMockPool exposes the minimal shared sql surface', async () => {
    const pool = makeMockPool([{ id: 1 }])

    expect(typeof pool.sql).toBe('function')
    expect(typeof pool.sql.unsafe).toBe('function')
    expect(typeof pool.sql.begin).toBe('function')
    expect(typeof pool.sql.array).toBe('function')

    await expect(pool.sql()).resolves.toEqual([{ id: 1 }])
    await expect(pool.sql.unsafe('SELECT 1')).resolves.toEqual([{ id: 1 }])
  })

  it('makeRejectingPool exposes the same minimal shared sql surface', async () => {
    const pool = makeRejectingPool({ code: 'QUERY_FAILED', message: 'boom' })

    expect(typeof pool.sql).toBe('function')
    expect(typeof pool.sql.unsafe).toBe('function')
    expect(typeof pool.sql.begin).toBe('function')
    expect(typeof pool.sql.array).toBe('function')

    await expect(pool.sql()).rejects.toEqual({ code: 'QUERY_FAILED', message: 'boom' })
    await expect(pool.sql.unsafe('SELECT 1')).rejects.toEqual({ code: 'QUERY_FAILED', message: 'boom' })
  })

  it('makeRejectingPool rejects with raw database-like error objects', async () => {
    const pool = makeRejectingPool({ code: '42P01', message: 'relation does not exist' })

    await expect(pool.sql()).rejects.toEqual({ code: '42P01', message: 'relation does not exist' })
  })

  it('makeRejectingPool can simulate normalized DbError failures explicitly', async () => {
    const pool = makeRejectingPool({ code: DbErrorCode.QUERY_FAILED, message: 'boom' })

    await expect(pool.sql()).rejects.toEqual({ code: DbErrorCode.QUERY_FAILED, message: 'boom' })
  })

  it('makeSequentialPool exposes the same minimal shared sql surface', async () => {
    const pool = makeSequentialPool([[{ id: 1 }], [{ id: 2 }]])

    expect(typeof pool.sql).toBe('function')
    expect(typeof pool.sql.unsafe).toBe('function')
    expect(typeof pool.sql.begin).toBe('function')
    expect(typeof pool.sql.array).toBe('function')

    await expect(pool.sql()).resolves.toEqual([{ id: 1 }])
    await expect(pool.sql.unsafe('SELECT 1')).resolves.toEqual([{ id: 2 }])
  })
})
