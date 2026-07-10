import { describe, it, expect, vi } from 'vitest'
import { store } from '../index.js'
import { field } from '../fields/index.js'
import { StoreErrorCode } from '../types.js'
import type { StoreInput } from '../types.js'

// #341 — anonymous persisted buckets (`session` scope + persist) write rows
// keyed by signed session ids, and nothing ever expired them. Stores opt in
// to retention with `retentionDays`; a sweeper hard-deletes expired
// anonymous rows. `user:*` keys and `__global__` are NEVER touched.

function base (overrides?: Partial<StoreInput>): StoreInput {
  return {
    slug: 'drafts',
    scope: 'session',
    persist: true,
    fields: [field.number({ name: 'count', default: 0 })],
    mutations: {},
    ...overrides
  }
}

describe('store() retentionDays validation', () => {
  it('accepts retentionDays on a persisted session store and carries it into the definition', () => {
    const result = store(base({ retentionDays: 30 }))
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.retentionDays).toBe(30)
    }
  })

  it('rejects retentionDays on user scope — user state must never expire', () => {
    const result = store(base({ scope: 'user', persist: undefined, retentionDays: 30 }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_RETENTION)
    }
  })

  it('rejects retentionDays on global scope — the shared copy must never expire', () => {
    const result = store(base({ scope: 'global', retentionDays: 30 }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_RETENTION)
    }
  })

  it('rejects retentionDays without persist — in-memory stores expire via LRU already', () => {
    const result = store(base({ persist: undefined, retentionDays: 30 }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_RETENTION)
    }
  })

  it('rejects non-positive and non-integer retentionDays', () => {
    expect(store(base({ retentionDays: 0 })).isErr()).toBe(true)
    expect(store(base({ retentionDays: -3 })).isErr()).toBe(true)
    expect(store(base({ retentionDays: 1.5 })).isErr()).toBe(true)
  })
})

describe('pruneExpiredStates', () => {
  it('hard-deletes expired rows for one store, sparing user:* keys and __global__', async () => {
    const { pruneExpiredStates } = await import('../server/retention.js')
    const query = vi.fn(async () => [])

    const result = await pruneExpiredStates({ query }, 'drafts', 30)

    expect(result.isOk()).toBe(true)
    expect(query).toHaveBeenCalledTimes(1)
    const [text, params] = query.mock.calls[0]! as [string, readonly unknown[]]
    expect(text).toContain('DELETE FROM store_states')
    expect(text).toContain("NOT LIKE 'user:%'")
    expect(text).toContain('__global__')
    expect(text).toContain('make_interval')
    expect(params).toEqual(['drafts', 30])
  })

  it('maps pool failures into a StoreError instead of throwing', async () => {
    const { pruneExpiredStates } = await import('../server/retention.js')
    const query = vi.fn(async () => Promise.reject(new Error('connection lost')))

    const result = await pruneExpiredStates({ query }, 'drafts', 30)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.STATE_ERROR)
      expect(result.error.message).toContain('connection lost')
    }
  })
})
