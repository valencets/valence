import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, teardownTestDatabase, getAppPool } from './setup.js'
import { ingestBeacon } from '../../ingestion.js'
import type { BeaconEvent } from '../../beacon-types.js'
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

function makeBeaconEvent (overrides: Partial<BeaconEvent> = {}): BeaconEvent {
  return {
    id: 'evt-001',
    timestamp: Date.now(),
    type: 'CLICK',
    targetDOMNode: 'button.cta',
    x_coord: 100,
    y_coord: 200,
    schema_version: 1,
    site_id: 'site-abc',
    business_type: 'dental',
    path: '/home',
    referrer: 'google.com',
    ...overrides
  }
}

describe('ingestBeacon (integration)', () => {
  it('creates a session and inserts events into real PG', async () => {
    const events: ReadonlyArray<BeaconEvent> = [
      makeBeaconEvent({ id: 'evt-001', type: 'CLICK' }),
      makeBeaconEvent({ id: 'evt-002', type: 'SCROLL' }),
      makeBeaconEvent({ id: 'evt-003', type: 'LEAD_FORM' })
    ]

    const result = await ingestBeacon(pool, events)
    expect(result.isOk()).toBe(true)

    const value = result.unwrap()
    expect(value.eventsInserted).toBe(3)
    expect(value.sessionId).toBeTruthy()

    // Verify session was created
    const sessions = await pool.sql`SELECT * FROM sessions WHERE session_id = ${value.sessionId}::uuid`
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.referrer).toBe('google.com')
    expect(sessions[0]!.device_type).toBe('beacon')

    // Verify events were inserted
    const storedEvents = await pool.sql`SELECT * FROM events WHERE session_id = ${value.sessionId}::uuid ORDER BY event_id`
    expect(storedEvents).toHaveLength(3)
    expect(storedEvents[0]!.event_category).toBe('CLICK')
    expect(storedEvents[1]!.event_category).toBe('SCROLL')
    expect(storedEvents[2]!.event_category).toBe('LEAD_FORM')
  })

  it('stores event payload with path and coordinates', async () => {
    const events: ReadonlyArray<BeaconEvent> = [
      makeBeaconEvent({ path: '/about', x_coord: 50, y_coord: 75, targetDOMNode: 'a.nav-link' })
    ]

    const result = await ingestBeacon(pool, events)
    expect(result.isOk()).toBe(true)

    const stored = await pool.sql`SELECT * FROM events WHERE session_id = ${result.unwrap().sessionId}::uuid`
    expect(stored).toHaveLength(1)

    const payload = stored[0]!.payload as { path: string; x_coord: number; y_coord: number }
    expect(payload.path).toBe('/about')
    expect(payload.x_coord).toBe(50)
    expect(payload.y_coord).toBe(75)
    expect(stored[0]!.dom_target).toBe('a.nav-link')
  })

  it('handles multiple ingestions creating separate sessions', async () => {
    const batch1 = [makeBeaconEvent({ referrer: 'google.com' })]
    const batch2 = [makeBeaconEvent({ referrer: 'bing.com' })]

    const r1 = await ingestBeacon(pool, batch1)
    const r2 = await ingestBeacon(pool, batch2)

    expect(r1.isOk()).toBe(true)
    expect(r2.isOk()).toBe(true)
    expect(r1.unwrap().sessionId).not.toBe(r2.unwrap().sessionId)

    const sessions = await pool.sql`SELECT * FROM sessions`
    expect(sessions).toHaveLength(2)
  })
})
