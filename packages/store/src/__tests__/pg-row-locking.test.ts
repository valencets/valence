import { describe, it, expect, vi } from 'vitest'
import { PostgresStateHolder } from '../server/pg-state-holder.js'
import { handleMutation } from '../server/mutation-handler.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import type { StoreDefinition, StoreState } from '../types.js'

// #336 — persisted store buckets need multi-node safety. When the pool can
// open transactions, PostgresStateHolder exposes update(): an atomic
// read-modify-write that locks the bucket row with SELECT … FOR UPDATE so
// two nodes sharing one database cannot interleave getState → mutate →
// setState and silently lose writes. In-memory backends keep the
// in-process promise-chain lock and never see this path.

const FIELDS = [field.number({ name: 'count', default: 0 })]

function counterConfig (): StoreDefinition {
  const result = store({
    slug: 'counter',
    scope: 'user',
    fields: FIELDS,
    mutations: {
      increment: {
        input: [field.number({ name: 'amount', required: true })],
        server: async ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        }
      },
      explode: {
        input: [],
        server: async () => {
          return Promise.reject(new Error('mutation exploded'))
        }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

interface TxCall { readonly text: string, readonly params: readonly unknown[] }

function transactionalPool (storedState: StoreState | null) {
  const txCalls: TxCall[] = []
  const txQuery = vi.fn(async (text: string, params: readonly unknown[] = []) => {
    txCalls.push({ text, params })
    if (text.includes('FOR UPDATE')) {
      return storedState === null ? [] : [{ state: storedState }]
    }
    return []
  })
  const transaction = vi.fn(async <T>(fn: (tx: { query: typeof txQuery }) => Promise<T>): Promise<T> => {
    return await fn({ query: txQuery })
  })
  const query = vi.fn(async () => [])
  return { pool: { query, transaction }, txQuery, txCalls, transaction, query }
}

describe('PostgresStateHolder.update — row-locked read-modify-write', () => {
  it('is exposed only when the pool supports transactions', () => {
    const bare = PostgresStateHolder.create({ pool: { query: async () => [] }, slug: 'prefs', fields: FIELDS })
    expect(bare.update).toBeUndefined()

    const { pool } = transactionalPool(null)
    const locking = PostgresStateHolder.create({ pool, slug: 'prefs', fields: FIELDS })
    expect(typeof locking.update).toBe('function')
  })

  it('locks the bucket row with SELECT … FOR UPDATE inside one transaction', async () => {
    const { pool, txCalls, transaction } = transactionalPool({ count: 5 })
    const holder = PostgresStateHolder.create({ pool, slug: 'prefs', fields: FIELDS })

    const result = await holder.update!('user:u1', async (state) => {
      state.count = (state.count as number) + 1
      return state
    })

    expect(result.count).toBe(6)
    expect(transaction).toHaveBeenCalledTimes(1)

    const selectForUpdate = txCalls.find(c => c.text.includes('FOR UPDATE'))
    expect(selectForUpdate).toBeDefined()
    expect(selectForUpdate!.params).toEqual(['prefs', 'user:u1'])

    const write = txCalls.find(c => c.text.startsWith('UPDATE store_states'))
    expect(write).toBeDefined()
    expect(write!.params[0]).toBe('prefs')
    expect(write!.params[1]).toBe('user:u1')
    expect(JSON.parse(String(write!.params[2]))).toEqual({ count: 6 })

    // Lock, read, and write all ride the transaction — never the bare pool
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('ensures the row exists before locking, so first contact locks too', async () => {
    const { pool, txCalls } = transactionalPool(null)
    const holder = PostgresStateHolder.create({ pool, slug: 'prefs', fields: FIELDS })

    const result = await holder.update!('user:new', async (state) => state)

    // Defaults come back when no row exists yet
    expect(result.count).toBe(0)

    const ensure = txCalls.findIndex(c => c.text.includes('ON CONFLICT') && c.text.includes('DO NOTHING'))
    const lock = txCalls.findIndex(c => c.text.includes('FOR UPDATE'))
    expect(ensure).toBeGreaterThanOrEqual(0)
    expect(lock).toBeGreaterThan(ensure)
  })
})

describe('handleMutation drives the locked path for capable backends', () => {
  it('uses StateBackend.update instead of getState/setState when available', async () => {
    const config = counterConfig()
    const getState = vi.fn(async (): Promise<StoreState> => ({ count: 0 }))
    const setState = vi.fn(async () => {})
    const update = vi.fn(async (key: string, mutate: (s: StoreState) => Promise<StoreState>) => {
      return await mutate({ count: 10 })
    })

    const result = await handleMutation(
      config, { getState, setState, update }, 'user:u1', 'increment', { amount: 4 },
      { query: async () => [] }, { id: 'sess', userId: 'u1' }
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.state.count).toBe(14)
    }
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![0]).toBe('user:u1')
    expect(getState).not.toHaveBeenCalled()
    expect(setState).not.toHaveBeenCalled()
  })

  it('surfaces MUTATION_FAILED when the server fn rejects inside update', async () => {
    const config = counterConfig()
    const update = vi.fn(async (key: string, mutate: (s: StoreState) => Promise<StoreState>) => {
      return await mutate({ count: 0 })
    })

    const result = await handleMutation(
      config, { getState: async () => ({}), setState: async () => {}, update },
      'user:u1', 'explode', {}, { query: async () => [] }, { id: 'sess', userId: 'u1' }
    )

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('MUTATION_FAILED')
      expect(result.error.message).toContain('mutation exploded')
    }
  })

  it('keeps the getState/setState path for backends without update', async () => {
    const config = counterConfig()
    const stored = new Map<string, StoreState>()
    const backend = {
      getState: async (key: string): Promise<StoreState> => ({ ...(stored.get(key) ?? { count: 0 }) }),
      setState: async (key: string, state: StoreState): Promise<void> => { stored.set(key, { ...state }) }
    }

    const result = await handleMutation(
      config, backend, 'bucket', 'increment', { amount: 2 },
      { query: async () => [] }, { id: 'sess' }
    )

    expect(result.isOk()).toBe(true)
    expect(stored.get('bucket')?.count).toBe(2)
  })
})
