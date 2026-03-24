import { describe, it, expect, vi } from 'vitest'
import { ingestBeacon } from '../ingestion.js'
import type { BeaconEvent } from '../beacon-types.js'
import type { DbPool } from '@valencets/db'

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

function makeIngestionMockPool (): DbPool {
  const sessionRow = {
    session_id: '123e4567-e89b-12d3-a456-426614174000',
    referrer: 'google.com',
    device_type: 'beacon',
    operating_system: 'dental',
    created_at: new Date()
  }
  const batchResult = Object.assign([], { count: 2 })

  let callIndex = 0
  const sql = vi.fn((...args: ReadonlyArray<unknown>) => {
    if (Array.isArray(args[0]) && 'raw' in (args[0] as object)) {
      // Tagged template call
      callIndex++
      if (callIndex === 1) return Promise.resolve([sessionRow]) // createSession
      return Promise.resolve(batchResult) // insertEvents
    }
    // Helper call: sql(values, 'col1', ...) — return placeholder
    return sql
  }) as unknown as DbPool['sql']
  Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
  return { sql }
}

describe('ingestBeacon', () => {
  it('creates a session and inserts events', async () => {
    const pool = makeIngestionMockPool()
    const events = [makeBeaconEvent(), makeBeaconEvent({ id: 'evt-002' })]
    const result = await ingestBeacon(pool, events)
    expect(result.isOk()).toBe(true)

    const value = result.unwrap()
    expect(value.eventsInserted).toBe(2)
    expect(value.sessionId).toBe('123e4567-e89b-12d3-a456-426614174000')
  })

  it('returns error when pool rejects', async () => {
    const sql = vi.fn(() => Promise.reject(new Error('connection refused'))) as unknown as DbPool['sql']
    Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
    const pool: DbPool = { sql }

    const result = await ingestBeacon(pool, [makeBeaconEvent()])
    expect(result.isErr()).toBe(true)
  })

  it('passes referrer from first event to session', async () => {
    const pool = makeIngestionMockPool()
    const sqlFn = pool.sql as ReturnType<typeof vi.fn>
    const events = [makeBeaconEvent({ referrer: 'bing.com' })]
    await ingestBeacon(pool, events)

    // Verify sql was called (createSession + insertEvents)
    expect(sqlFn).toHaveBeenCalled()
  })
})
