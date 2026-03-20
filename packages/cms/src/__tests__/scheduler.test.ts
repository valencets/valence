import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DbPool } from '@valencets/db'
import { startPublishScheduler } from '../scheduler.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

function getUnsafeCalls (pool: DbPool): Array<[string, ...Array<unknown>]> {
  return (pool.sql as ReturnType<typeof vi.fn> & { unsafe: ReturnType<typeof vi.fn> }).unsafe.mock.calls
}

describe('startPublishScheduler()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a handle with a stop function', () => {
    const pool = makeMockPool()
    const registry = createCollectionRegistry()
    const handle = startPublishScheduler(pool, registry, 1000)
    expect(handle.stop).toBeDefined()
    expect(typeof handle.stop).toBe('function')
    handle.stop()
  })

  it('executes publish query on interval for versioned collections', () => {
    const pool = makeMockPool()
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: true }
    }))
    const handle = startPublishScheduler(pool, registry, 1000)

    vi.advanceTimersByTime(1000)

    const calls = getUnsafeCalls(pool)
    expect(calls.length).toBeGreaterThan(0)
    const sql = calls[0]?.[0] ?? ''
    expect(sql).toContain('UPDATE "posts"')
    expect(sql).toContain('"_status" = \'published\'')
    expect(sql).toContain('publish_at')

    handle.stop()
  })

  it('skips non-versioned collections', () => {
    const pool = makeMockPool()
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'pages',
      fields: [field.text({ name: 'title' })]
    }))
    const handle = startPublishScheduler(pool, registry, 1000)

    vi.advanceTimersByTime(1000)

    expect(getUnsafeCalls(pool).length).toBe(0)

    handle.stop()
  })

  it('stops executing after stop() is called', () => {
    const pool = makeMockPool()
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: true }
    }))
    const handle = startPublishScheduler(pool, registry, 1000)

    vi.advanceTimersByTime(1000)
    const callsAfterFirst = getUnsafeCalls(pool).length

    handle.stop()
    vi.advanceTimersByTime(5000)

    expect(getUnsafeCalls(pool).length).toBe(callsAfterFirst)
  })

  it('runs on each interval tick', () => {
    const pool = makeMockPool()
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: true }
    }))
    const handle = startPublishScheduler(pool, registry, 500)

    vi.advanceTimersByTime(1500)

    expect(getUnsafeCalls(pool).length).toBe(3) // 500, 1000, 1500

    handle.stop()
  })
})
