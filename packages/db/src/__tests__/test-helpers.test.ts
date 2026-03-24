import { describe, it, expect } from 'vitest'
import { makeMockPool, makeRejectingPool, makeSequentialPool } from '../test-helpers.js'
import { DbErrorCode } from '../types.js'

describe('makeMockPool', () => {
  it('returns rows from sql tagged template', async () => {
    const pool = makeMockPool([{ id: '1', name: 'test' }])
    const rows = await pool.sql`SELECT * FROM foo`
    expect(rows).toEqual([{ id: '1', name: 'test' }])
  })

  it('returns rows from sql.unsafe()', async () => {
    const pool = makeMockPool([{ id: '2' }])
    const rows = await pool.sql.unsafe('SELECT 1')
    expect(rows).toEqual([{ id: '2' }])
  })
})

describe('makeRejectingPool', () => {
  it('rejects with provided error', async () => {
    const error = { code: DbErrorCode.QUERY_FAILED, message: 'boom' }
    const pool = makeRejectingPool(error)

    await expect(pool.sql`SELECT 1`).rejects.toEqual(error)
  })

  it('rejects on unsafe() too', async () => {
    const error = { code: DbErrorCode.CONNECTION_FAILED, message: 'gone' }
    const pool = makeRejectingPool(error)

    await expect(pool.sql.unsafe('SELECT 1')).rejects.toEqual(error)
  })
})

describe('makeSequentialPool', () => {
  it('returns different rows per call', async () => {
    const pool = makeSequentialPool([
      [{ id: '1' }],
      [{ id: '2' }]
    ])

    const first = await pool.sql`SELECT 1`
    const second = await pool.sql`SELECT 2`

    expect(first).toEqual([{ id: '1' }])
    expect(second).toEqual([{ id: '2' }])
  })
})
