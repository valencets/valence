// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { createStoreClient } from '../client/store-client.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import { effect } from '@valencets/reactive'
import type { StoreDefinition, StoreState } from '../types.js'

function makeCounterConfig (): StoreDefinition {
  const result = store({
    slug: 'counter',
    scope: 'session',
    fields: [field.number({ name: 'count', default: 0 })],
    mutations: {
      increment: {
        input: [field.number({ name: 'amount' })],
        server: async ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        },
        client: ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        }
      },
      reset: {
        input: [],
        server: async ({ state }) => { state.count = 0 }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

function makeCartConfig (): StoreDefinition {
  const result = store({
    slug: 'cart',
    scope: 'session',
    fields: [
      field.array({
        name: 'items',
        fields: [
          field.text({ name: 'sku' }),
          field.number({ name: 'qty' }),
          field.number({ name: 'price' })
        ]
      }),
      field.select({ name: 'status', options: ['open', 'checkout', 'paid'], default: 'open' })
    ],
    mutations: {
      addItem: {
        input: [
          field.text({ name: 'sku' }),
          field.number({ name: 'qty' }),
          field.number({ name: 'price' })
        ],
        server: async ({ state, input }) => {
          const items = (state.items ?? []) as Array<{ sku: string; qty: number; price: number }>
          items.push({ sku: input.sku as string, qty: input.qty as number, price: input.price as number })
          state.items = items
        },
        client: ({ state, input }) => {
          const items = (state.items ?? []) as Array<{ sku: string; qty: number; price: number }>
          items.push({ sku: input.sku as string, qty: input.qty as number, price: input.price as number })
          state.items = items
        }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

describe('createStoreClient', () => {
  it('creates a client with typed signals', () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn().mockResolvedValue({ ok: true, state: { count: 0 }, confirmedId: 1 })
    const client = createStoreClient(config, {}, mockPost)

    expect(client.signals.count).toBeDefined()
    expect(client.signals.count.value).toBe(0)
    client.dispose()
  })

  it('initializes signals from hydration state', () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn()
    const client = createStoreClient(config, { count: 42 }, mockPost)

    expect(client.signals.count.value).toBe(42)
    client.dispose()
  })

  it('exposes mutation callers', () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn()
    const client = createStoreClient(config, {}, mockPost)

    expect(client.mutations.increment).toBeDefined()
    expect(typeof client.mutations.increment).toBe('function')
    expect(client.mutations.reset).toBeDefined()
    client.dispose()
  })

  it('mutation caller validates and calls post', async () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn().mockResolvedValue({ ok: true, state: { count: 5 }, confirmedId: 1 })
    const client = createStoreClient(config, {}, mockPost)

    const result = await client.mutations.increment({ amount: 5 })
    expect(result.isOk()).toBe(true)
    expect(mockPost).toHaveBeenCalledWith('counter', 'increment', { amount: 5 }, expect.any(Number))
    client.dispose()
  })

  it('signals update reactively after mutation', async () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn().mockResolvedValue({ ok: true, state: { count: 10 }, confirmedId: 1 })
    const client = createStoreClient(config, {}, mockPost)

    const values: number[] = []
    effect(() => { values.push(client.signals.count.value as number) })

    await client.mutations.increment({ amount: 10 })

    expect(values).toContain(10)
    client.dispose()
  })

  it('optimistic apply updates signals before server response', async () => {
    const config = makeCounterConfig()
    let resolvePost: (v: { ok: boolean; state: StoreState; confirmedId: number }) => void = () => {}
    const mockPost = vi.fn().mockReturnValue(new Promise(resolve => { resolvePost = resolve }))
    const client = createStoreClient(config, {}, mockPost)

    const resultPromise = client.mutations.increment({ amount: 7 })

    // Optimistic: count should be 7 before server responds
    expect(client.signals.count.value).toBe(7)

    resolvePost({ ok: true, state: { count: 7 }, confirmedId: 1 })
    await resultPromise

    expect(client.signals.count.value).toBe(7)
    client.dispose()
  })

  it('mutation without client fn waits for server', async () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn().mockResolvedValue({ ok: true, state: { count: 0 }, confirmedId: 1 })
    const client = createStoreClient(config, { count: 5 }, mockPost)

    await client.mutations.reset({})
    expect(client.signals.count.value).toBe(0)
    client.dispose()
  })

  it('rejects invalid mutation input', async () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn()
    const client = createStoreClient(config, {}, mockPost)

    const result = await client.mutations.increment({ amount: 'bad' })
    expect(result.isErr()).toBe(true)
    expect(mockPost).not.toHaveBeenCalled()
    client.dispose()
  })

  it('cart store: addItem with array mutation', async () => {
    const config = makeCartConfig()
    const mockPost = vi.fn().mockResolvedValue({
      ok: true,
      state: { items: [{ sku: 'W1', qty: 2, price: 9.99 }], status: 'open' },
      confirmedId: 1
    })
    const client = createStoreClient(config, { items: [], status: 'open' }, mockPost)

    const result = await client.mutations.addItem({ sku: 'W1', qty: 2, price: 9.99 })
    expect(result.isOk()).toBe(true)

    const items = client.signals.items.value as Array<{ sku: string }>
    expect(items).toHaveLength(1)
    expect(items[0]!.sku).toBe('W1')
    client.dispose()
  })

  it('dispose cleans up', () => {
    const config = makeCounterConfig()
    const mockPost = vi.fn()
    const client = createStoreClient(config, {}, mockPost)
    client.dispose()
    // Should not throw
    expect(client.signals.count.value).toBe(0)
  })
})
