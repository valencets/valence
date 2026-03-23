import { describe, it, expect, vi } from 'vitest'
import {
  createSession,
  getSessionById,
  insertEvent,
  insertEvents,
  getEventsBySession,
  getEventsByTimeRange
} from '../event-queries.js'
import { makeMockPool, makeErrorPool } from './test-helpers.js'
import type { DbPool } from '@valencets/db'

const mockSession = {
  session_id: '123e4567-e89b-12d3-a456-426614174000',
  referrer: 'google.com',
  device_type: 'desktop',
  operating_system: 'Linux',
  created_at: new Date()
}

const mockEvent = {
  event_id: 1,
  session_id: '123e4567-e89b-12d3-a456-426614174000',
  event_category: 'CLICK',
  dom_target: 'button.cta',
  payload: { path: '/home' },
  created_at: new Date()
}

describe('createSession', () => {
  it('returns the created session row', async () => {
    const pool = makeMockPool([mockSession])
    const result = await createSession(pool, {
      referrer: 'google.com',
      device_type: 'desktop',
      operating_system: 'Linux'
    })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().session_id).toBe(mockSession.session_id)
  })

  it('returns error when no rows returned', async () => {
    const pool = makeMockPool([])
    const result = await createSession(pool, {
      referrer: null,
      device_type: 'mobile',
      operating_system: null
    })
    expect(result.isErr()).toBe(true)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await createSession(pool, {
      referrer: null,
      device_type: 'mobile',
      operating_system: null
    })
    expect(result.isErr()).toBe(true)
  })
})

describe('getSessionById', () => {
  it('returns the session when found', async () => {
    const pool = makeMockPool([mockSession])
    const result = await getSessionById(pool, mockSession.session_id)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().device_type).toBe('desktop')
  })

  it('returns error when not found', async () => {
    const pool = makeMockPool([])
    const result = await getSessionById(pool, 'nonexistent')
    expect(result.isErr()).toBe(true)
  })
})

describe('insertEvent', () => {
  it('returns the created event row', async () => {
    const pool = makeMockPool([mockEvent])
    const result = await insertEvent(pool, {
      session_id: mockSession.session_id,
      event_category: 'CLICK',
      dom_target: 'button.cta',
      payload: { path: '/home' }
    })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().event_id).toBe(1)
  })

  it('returns error when no rows returned', async () => {
    const pool = makeMockPool([])
    const result = await insertEvent(pool, {
      session_id: mockSession.session_id,
      event_category: 'CLICK',
      dom_target: null,
      payload: {}
    })
    expect(result.isErr()).toBe(true)
  })
})

describe('insertEvents', () => {
  it('returns count of inserted events', async () => {
    // insertEvents uses pool.sql as both helper (sql(values, ...)) and tagged template (sql`...`)
    // Mock needs to handle both: helper returns itself (for interpolation), template resolves with count
    const mockResult = Object.assign([], { count: 3 })
    const sql = vi.fn((...args: ReadonlyArray<unknown>) => {
      // Tagged template call: first arg is TemplateStringsArray
      if (Array.isArray(args[0]) && 'raw' in (args[0] as object)) {
        return Promise.resolve(mockResult)
      }
      // Helper call: sql(values, 'col1', ...) — return a placeholder for interpolation
      return sql
    }) as unknown as DbPool['sql']
    Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
    const pool: DbPool = { sql }

    const events = [
      { session_id: mockSession.session_id, event_category: 'CLICK', dom_target: null, payload: {} },
      { session_id: mockSession.session_id, event_category: 'SCROLL', dom_target: null, payload: {} },
      { session_id: mockSession.session_id, event_category: 'LEAD_FORM', dom_target: null, payload: {} }
    ]
    const result = await insertEvents(pool, events)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(3)
  })

  it('returns 0 for empty array without calling pool', async () => {
    const pool = makeMockPool()
    const result = await insertEvents(pool, [])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(0)
  })
})

describe('getEventsBySession', () => {
  it('returns events for the session', async () => {
    const pool = makeMockPool([mockEvent, { ...mockEvent, event_id: 2 }])
    const result = await getEventsBySession(pool, mockSession.session_id)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toHaveLength(2)
  })

  it('returns empty array when no events', async () => {
    const pool = makeMockPool([])
    const result = await getEventsBySession(pool, 'no-events')
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toHaveLength(0)
  })
})

describe('getEventsByTimeRange', () => {
  it('returns events within range', async () => {
    const pool = makeMockPool([mockEvent])
    const result = await getEventsByTimeRange(
      pool,
      new Date('2026-03-01'),
      new Date('2026-03-02')
    )
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toHaveLength(1)
  })

  it('returns empty array when no events in range', async () => {
    const pool = makeMockPool([])
    const result = await getEventsByTimeRange(
      pool,
      new Date('2026-01-01'),
      new Date('2026-01-02')
    )
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toHaveLength(0)
  })
})
