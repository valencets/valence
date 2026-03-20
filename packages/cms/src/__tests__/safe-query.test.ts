import { describe, it, expect } from 'vitest'
import { safeQuery } from '../db/safe-query.js'
import { safeQuery as publicSafeQuery } from '../index.js'
import { CmsErrorCode } from '../schema/types.js'
import { makeMockPool, makeErrorPool } from './test-helpers.js'

describe('safeQuery()', () => {
  it('is exported from the public API', () => {
    expect(publicSafeQuery).toBeDefined()
    expect(typeof publicSafeQuery).toBe('function')
    expect(publicSafeQuery).toBe(safeQuery)
  })

  it('calls sql.unsafe with query string and params array', async () => {
    const rows = [{ id: '1', title: 'Hello' }]
    const pool = makeMockPool(rows)
    const result = await safeQuery<Array<{ id: string, title: string }>>(pool, 'SELECT * FROM "posts" WHERE id = $1', ['abc'])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
    expect(pool.sql.unsafe).toHaveBeenCalledWith('SELECT * FROM "posts" WHERE id = $1', ['abc'])
  })

  it('returns Err on db failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await safeQuery(pool, 'SELECT 1', [])
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(CmsErrorCode.INTERNAL)
  })

  it('passes empty params array when no params', async () => {
    const pool = makeMockPool([{ count: '5' }])
    await safeQuery(pool, 'SELECT COUNT(*) FROM "posts"', [])
    expect(pool.sql.unsafe).toHaveBeenCalledWith('SELECT COUNT(*) FROM "posts"', [])
  })
})
