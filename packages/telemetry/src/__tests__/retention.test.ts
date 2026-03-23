import { describe, it, expect, vi } from 'vitest'
import { cleanupOldEvents, cleanupOldSessions } from '../retention.js'
import { makeErrorPool } from './test-helpers.js'
import type { DbPool } from '@valencets/db'

function makeCountPool (count: number): DbPool {
  const result = Object.assign([], { count })
  const sql = vi.fn(() => Promise.resolve(result)) as unknown as DbPool['sql']
  Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
  return { sql }
}

describe('cleanupOldEvents', () => {
  it('returns the count of deleted rows', async () => {
    const pool = makeCountPool(42)
    const result = await cleanupOldEvents(pool, 90)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(42)
  })

  it('uses 90-day default when no retention specified', async () => {
    const pool = makeCountPool(0)
    const result = await cleanupOldEvents(pool)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(0)
  })

  it('passes retention days to the query', async () => {
    const pool = makeCountPool(5)
    const result = await cleanupOldEvents(pool, 30)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(5)
    // Verify the sql tagged template was called with the retention days parameter
    expect(pool.sql).toHaveBeenCalledTimes(1)
    const callArgs = (pool.sql as ReturnType<typeof vi.fn>).mock.calls[0] as [TemplateStringsArray, ...ReadonlyArray<number>]
    expect(callArgs[1]).toBe(30)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await cleanupOldEvents(pool, 90)
    expect(result.isErr()).toBe(true)
  })

  it('returns 0 when no old events exist', async () => {
    const pool = makeCountPool(0)
    const result = await cleanupOldEvents(pool, 7)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(0)
  })
})

describe('cleanupOldSessions', () => {
  it('returns the count of deleted rows', async () => {
    const pool = makeCountPool(10)
    const result = await cleanupOldSessions(pool, 90)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(10)
  })

  it('uses 90-day default when no retention specified', async () => {
    const pool = makeCountPool(0)
    const result = await cleanupOldSessions(pool)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(0)
  })

  it('passes retention days to the query', async () => {
    const pool = makeCountPool(3)
    const result = await cleanupOldSessions(pool, 60)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(3)
    expect(pool.sql).toHaveBeenCalledTimes(1)
    const callArgs = (pool.sql as ReturnType<typeof vi.fn>).mock.calls[0] as [TemplateStringsArray, ...ReadonlyArray<number>]
    expect(callArgs[1]).toBe(60)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('disk full'))
    const result = await cleanupOldSessions(pool, 90)
    expect(result.isErr()).toBe(true)
  })

  it('returns 0 when no orphaned sessions exist', async () => {
    const pool = makeCountPool(0)
    const result = await cleanupOldSessions(pool, 365)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(0)
  })
})
