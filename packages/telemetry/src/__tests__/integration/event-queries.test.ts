import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, teardownTestDatabase, getAppPool } from './setup.js'
import {
  createSession,
  getSessionById,
  insertEvent,
  insertEvents,
  getEventsBySession,
  getEventsByTimeRange
} from '../../event-queries.js'
import type { InsertableSession, InsertableEvent } from '../../event-types.js'
import type { DbPool } from '@valencets/db'

let pool: DbPool

beforeAll(async () => {
  await setupTestDatabase()
  pool = getAppPool()
})

afterAll(async () => {
  await teardownTestDatabase()
})

beforeEach(async () => {
  await pool.sql`DELETE FROM events`
  await pool.sql`DELETE FROM sessions`
})

const testSession: InsertableSession = {
  referrer: 'google.com',
  device_type: 'desktop',
  operating_system: 'Linux'
}

describe('createSession + getSessionById', () => {
  it('round-trips a session', async () => {
    const createResult = await createSession(pool, testSession)
    expect(createResult.isOk()).toBe(true)

    const created = createResult.unwrap()
    expect(created.referrer).toBe('google.com')
    expect(created.device_type).toBe('desktop')
    expect(created.operating_system).toBe('Linux')
    expect(created.session_id).toBeTruthy()
    expect(created.created_at).toBeInstanceOf(Date)

    const getResult = await getSessionById(pool, created.session_id)
    expect(getResult.isOk()).toBe(true)

    const fetched = getResult.unwrap()
    expect(fetched.session_id).toBe(created.session_id)
    expect(fetched.referrer).toBe('google.com')
  })

  it('creates session with null referrer and OS', async () => {
    const result = await createSession(pool, {
      referrer: null,
      device_type: 'mobile',
      operating_system: null
    })
    expect(result.isOk()).toBe(true)

    const row = result.unwrap()
    expect(row.referrer).toBeNull()
    expect(row.operating_system).toBeNull()
  })

  it('returns error for nonexistent session ID', async () => {
    const result = await getSessionById(pool, '00000000-0000-0000-0000-000000000000')
    expect(result.isErr()).toBe(true)
  })
})

describe('insertEvent + getEventsBySession', () => {
  it('round-trips a single event', async () => {
    const session = (await createSession(pool, testSession)).unwrap()

    const event: InsertableEvent = {
      session_id: session.session_id,
      event_category: 'CLICK',
      dom_target: 'button.cta',
      payload: { path: '/home', x_coord: 100 }
    }

    const insertResult = await insertEvent(pool, event)
    expect(insertResult.isOk()).toBe(true)

    const inserted = insertResult.unwrap()
    expect(inserted.event_category).toBe('CLICK')
    expect(inserted.dom_target).toBe('button.cta')
    expect(inserted.payload).toEqual({ path: '/home', x_coord: 100 })
    expect(inserted.session_id).toBe(session.session_id)

    const eventsResult = await getEventsBySession(pool, session.session_id)
    expect(eventsResult.isOk()).toBe(true)
    expect(eventsResult.unwrap()).toHaveLength(1)
  })

  it('returns events ordered by created_at ASC', async () => {
    const session = (await createSession(pool, testSession)).unwrap()

    await insertEvent(pool, {
      session_id: session.session_id,
      event_category: 'CLICK',
      dom_target: null,
      payload: { order: 1 }
    })
    await insertEvent(pool, {
      session_id: session.session_id,
      event_category: 'SCROLL',
      dom_target: null,
      payload: { order: 2 }
    })

    const result = await getEventsBySession(pool, session.session_id)
    const events = result.unwrap()
    expect(events).toHaveLength(2)
    expect(events[0]!.event_category).toBe('CLICK')
    expect(events[1]!.event_category).toBe('SCROLL')
  })

  it('returns empty for session with no events', async () => {
    const session = (await createSession(pool, testSession)).unwrap()
    const result = await getEventsBySession(pool, session.session_id)
    expect(result.unwrap()).toHaveLength(0)
  })
})

describe('insertEvents (batch)', () => {
  it('batch-inserts multiple events', async () => {
    const session = (await createSession(pool, testSession)).unwrap()

    const events: ReadonlyArray<InsertableEvent> = [
      { session_id: session.session_id, event_category: 'CLICK', dom_target: 'a.link', payload: {} },
      { session_id: session.session_id, event_category: 'SCROLL', dom_target: null, payload: {} },
      { session_id: session.session_id, event_category: 'LEAD_FORM', dom_target: 'form#contact', payload: { field: 'email' } }
    ]

    const result = await insertEvents(pool, events)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(3)

    const stored = await getEventsBySession(pool, session.session_id)
    expect(stored.unwrap()).toHaveLength(3)
  })

  it('returns 0 for empty array', async () => {
    const result = await insertEvents(pool, [])
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(0)
  })
})

describe('getEventsByTimeRange', () => {
  it('returns events within the time range', async () => {
    const session = (await createSession(pool, testSession)).unwrap()

    // Insert events at known times
    await pool.sql`
      INSERT INTO events (session_id, event_category, payload, created_at)
      VALUES
        (${session.session_id}, 'CLICK', '{}', '2026-03-15T10:00:00Z'),
        (${session.session_id}, 'SCROLL', '{}', '2026-03-15T12:00:00Z'),
        (${session.session_id}, 'LEAD_FORM', '{}', '2026-03-16T10:00:00Z')
    `

    const result = await getEventsByTimeRange(
      pool,
      new Date('2026-03-15T00:00:00Z'),
      new Date('2026-03-15T23:59:59Z')
    )
    expect(result.isOk()).toBe(true)

    const events = result.unwrap()
    expect(events).toHaveLength(2)
    expect(events[0]!.event_category).toBe('CLICK')
    expect(events[1]!.event_category).toBe('SCROLL')
  })

  it('returns empty when no events in range', async () => {
    const result = await getEventsByTimeRange(
      pool,
      new Date('2025-01-01'),
      new Date('2025-01-02')
    )
    expect(result.unwrap()).toHaveLength(0)
  })
})
