import { describe, it, expect, vi } from 'vitest'
import { createSession, getSessionById, insertEvents, insertEvent, getEventsBySession, getEventsByTimeRange } from '../queries.js'
import { DbErrorCode } from '../types.js'
import type { DbPool } from '../connection.js'
import type { InsertableSession, InsertableEvent } from '../types.js'

function makeMockPool (returnValue: unknown = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

const sampleSession: InsertableSession = {
  referrer: 'https://example.com',
  device_type: 'desktop',
  operating_system: 'Linux'
}

const sampleEvent: InsertableEvent = {
  session_id: 'abc-123',
  event_category: 'CLICK',
  dom_target: '#btn',
  payload: { action: 'submit' }
}

describe('query helpers — function existence', () => {
  it('createSession is a function', () => {
    expect(typeof createSession).toBe('function')
  })

  it('getSessionById is a function', () => {
    expect(typeof getSessionById).toBe('function')
  })

  it('insertEvents is a function', () => {
    expect(typeof insertEvents).toBe('function')
  })

  it('insertEvent is a function', () => {
    expect(typeof insertEvent).toBe('function')
  })

  it('getEventsBySession is a function', () => {
    expect(typeof getEventsBySession).toBe('function')
  })

  it('getEventsByTimeRange is a function', () => {
    expect(typeof getEventsByTimeRange).toBe('function')
  })
})

describe('insertEvents — empty array', () => {
  it('returns okAsync(0) for empty events array', async () => {
    const pool = makeMockPool()
    const result = await insertEvents(pool, [])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(0)
  })

  it('does not call sql for empty events array', async () => {
    const pool = makeMockPool()
    await insertEvents(pool, [])
    expect(pool.sql).not.toHaveBeenCalled()
  })
})

function makeErrorPool (error: Error): DbPool {
  const sql = vi.fn(() => Promise.reject(error)) as unknown as DbPool['sql']
  ;(sql as unknown as Record<string, unknown>).json = (v: unknown) => v
  return { sql }
}

describe('error mapping', () => {
  it('maps FK violation (23503) to CONSTRAINT_VIOLATION', async () => {
    const pgError = new Error('violates foreign key constraint')
    Object.assign(pgError, { code: '23503' })
    const pool = makeErrorPool(pgError)

    const result = await insertEvent(pool, sampleEvent)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('CONSTRAINT_VIOLATION')
  })

  it('maps unique violation (23505) to CONSTRAINT_VIOLATION', async () => {
    const pgError = new Error('duplicate key value')
    Object.assign(pgError, { code: '23505' })
    const pool = makeErrorPool(pgError)

    const result = await insertEvent(pool, sampleEvent)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('CONSTRAINT_VIOLATION')
  })

  it('maps unknown error to QUERY_FAILED', async () => {
    const pool = makeErrorPool(new Error('unknown'))

    const result = await insertEvent(pool, sampleEvent)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('QUERY_FAILED')
  })
})

describe('NO_ROWS error on empty results', () => {
  it('createSession returns Err with NO_ROWS when INSERT returns empty', async () => {
    const pool = makeMockPool([])
    const result = await createSession(pool, sampleSession)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(DbErrorCode.NO_ROWS)
  })

  it('getSessionById returns Err with NO_ROWS when session not found', async () => {
    const pool = makeMockPool([])
    const result = await getSessionById(pool, 'nonexistent')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(DbErrorCode.NO_ROWS)
  })

  it('insertEvent returns Err with NO_ROWS when INSERT returns empty', async () => {
    const pool = makeMockPool([])
    ;(pool.sql as unknown as Record<string, unknown>).json = (v: unknown) => v
    const result = await insertEvent(pool, sampleEvent)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(DbErrorCode.NO_ROWS)
  })
})

describe('query return types', () => {
  it('createSession returns a ResultAsync', () => {
    const pool = makeMockPool([{ session_id: 'abc', created_at: new Date(), referrer: null, device_type: 'desktop', operating_system: null }])
    const result = createSession(pool, sampleSession)
    expect(typeof result.andThen).toBe('function')
  })

  it('getSessionById returns a ResultAsync', () => {
    const pool = makeMockPool([{ session_id: 'abc', created_at: new Date(), referrer: null, device_type: 'desktop', operating_system: null }])
    const result = getSessionById(pool, 'abc')
    expect(typeof result.andThen).toBe('function')
  })

  it('getEventsBySession returns a ResultAsync', () => {
    const pool = makeMockPool()
    const result = getEventsBySession(pool, 'abc')
    expect(typeof result.andThen).toBe('function')
  })

  it('getEventsByTimeRange returns a ResultAsync', () => {
    const pool = makeMockPool()
    const result = getEventsByTimeRange(pool, new Date(), new Date())
    expect(typeof result.andThen).toBe('function')
  })
})
