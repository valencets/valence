// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { handleMutation } from '../server/mutation-handler.js'
import { SessionStateHolder } from '../server/session-state.js'
import { createStoreClient } from '../client/store-client.js'
import { generateStoreSchema } from '../validation/zod-generator.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import { StoreErrorCode } from '../types.js'
import type { StoreDefinition, StoreState, StoreValue } from '../types.js'

const mockSession = { id: 'proto-session' }
const mockPool = { query: async () => [] }

interface PostResponse {
  readonly ok: boolean
  readonly state?: StoreState
  readonly confirmedId?: number
  readonly error?: { readonly code: string; readonly message: string }
}

function makeCounterStore (): StoreDefinition {
  const result = store({
    slug: 'proto-counter',
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
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

describe('mutation protocol — server side', () => {
  it('echoes the client-supplied mutation id as confirmedId', async () => {
    const config = makeCounterStore()
    const holder = SessionStateHolder.create(config.fields)

    const result = await handleMutation(config, holder, mockSession.id, 'increment', { amount: 1 }, mockPool, mockSession, 42)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.confirmedId).toBe(42)
    }
  })

  it('passes only declared input fields to the server fn — unknown keys stripped', async () => {
    let seenKeys: string[] = []
    const result = store({
      slug: 'proto-strip',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {
        record: {
          input: [field.number({ name: 'amount' })],
          server: async ({ input }) => {
            seenKeys = Object.keys(input)
          }
        }
      }
    })
    if (result.isErr()) return
    const holder = SessionStateHolder.create(result.value.fields)

    await handleMutation(result.value, holder, mockSession.id, 'record', { amount: 2, injected: 'evil' }, mockPool, mockSession)
    expect(seenKeys).toEqual(['amount'])
  })

  it('ignores args entirely for mutations with an empty input definition', async () => {
    let seenInput: { [key: string]: StoreValue } = { untouched: true }
    const result = store({
      slug: 'proto-noargs',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {
        reset: {
          input: [],
          server: async ({ input }) => {
            seenInput = { ...input }
          }
        }
      }
    })
    if (result.isErr()) return
    const holder = SessionStateHolder.create(result.value.fields)

    await handleMutation(result.value, holder, mockSession.id, 'reset', { sneaky: 'payload' }, mockPool, mockSession)
    expect(seenInput).toEqual({})
  })
})

describe('field-level required support', () => {
  it('required fields reject missing input', () => {
    const schema = generateStoreSchema([field.number({ name: 'amount', required: true })])
    const missing = schema.safeParse({})
    expect(missing.success).toBe(false)
  })

  it('fields stay optional by default', () => {
    const schema = generateStoreSchema([field.number({ name: 'amount' })])
    const missing = schema.safeParse({})
    expect(missing.success).toBe(true)
  })
})

describe('store definition error codes', () => {
  it('rejects empty fields with INVALID_FIELDS, not INVALID_SLUG', () => {
    const result = store({
      slug: 'no-fields',
      scope: 'session',
      fields: [],
      mutations: {}
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_FIELDS)
    }
  })
})

describe('mutation protocol — client side', () => {
  it('rolls back a failed first mutation to initial field defaults (no hydration state)', async () => {
    const config = makeCounterStore()
    const post = vi.fn(async (): Promise<PostResponse> => ({
      ok: false,
      error: { code: 'MUTATION_FAILED', message: 'rejected' }
    }))

    const client = createStoreClient(config, {}, post)
    const result = await client.mutations.increment!({ amount: 5 })

    expect(result.isErr()).toBe(true)
    expect(client.signals.count!.value).toBe(0)
  })

  it('sends only validated, stripped args to the server', async () => {
    const config = makeCounterStore()
    const sentArgs: Array<{ [key: string]: StoreValue }> = []
    const post = vi.fn(async (_slug: string, _name: string, args: { [key: string]: StoreValue }): Promise<PostResponse> => {
      sentArgs.push(args)
      return { ok: true, state: { count: 1 }, confirmedId: 1 }
    })

    const client = createStoreClient(config, {}, post)
    await client.mutations.increment!({ amount: 1, extra: 'should-not-travel' })

    expect(sentArgs[0]).toEqual({ amount: 1 })
  })

  it('drains its own pending entry even when the server omits confirmedId', async () => {
    const config = makeCounterStore()
    const post = vi.fn(async (): Promise<PostResponse> => ({ ok: true, state: { count: 3 } }))

    const client = createStoreClient(config, {}, post)
    await client.mutations.increment!({ amount: 3 })

    expect(client.pendingCount).toBe(0)
  })

  it('maps unknown server error codes to MUTATION_FAILED', async () => {
    const config = makeCounterStore()
    const post = vi.fn(async (): Promise<PostResponse> => ({
      ok: false,
      error: { code: 'SOMETHING_NOVEL', message: 'weird' }
    }))

    const client = createStoreClient(config, {}, post)
    const result = await client.mutations.increment!({ amount: 1 })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.MUTATION_FAILED)
    }
  })

  it('replays pending mutations of other names during reconciliation', async () => {
    const result = store({
      slug: 'proto-list',
      scope: 'session',
      fields: [field.custom({ name: 'items', validator: z.array(z.string()), default: [] })],
      mutations: {
        appendA: {
          input: [],
          server: async ({ state }) => { state.items = [...(state.items as string[] ?? []), 'a'] },
          client: ({ state }) => { state.items = [...(state.items as string[] ?? []), 'a'] }
        },
        appendB: {
          input: [],
          server: async ({ state }) => { state.items = [...(state.items as string[] ?? []), 'b'] },
          client: ({ state }) => { state.items = [...(state.items as string[] ?? []), 'b'] }
        }
      }
    })
    if (result.isErr()) return
    const config = result.value

    let resolveA: (r: PostResponse) => void = () => {}
    let resolveB: (r: PostResponse) => void = () => {}
    const responseA = new Promise<PostResponse>((resolve) => { resolveA = resolve })
    const responseB = new Promise<PostResponse>((resolve) => { resolveB = resolve })

    const post = vi.fn((_slug: string, name: string): Promise<PostResponse> => {
      return name === 'appendA' ? responseA : responseB
    })

    const client = createStoreClient(config, {}, post)

    const pA = client.mutations.appendA!({})
    const pB = client.mutations.appendB!({})

    // Both optimistic applies land immediately
    expect(client.signals.items!.value).toEqual(['a', 'b'])

    // Server confirms A first: state = ['a'], and pending B must be REPLAYED on top
    resolveA({ ok: true, state: { items: ['a'] }, confirmedId: 1 })
    await pA
    expect(client.signals.items!.value).toEqual(['a', 'b'])

    // Server confirms B: authoritative state now includes both
    resolveB({ ok: true, state: { items: ['a', 'b'] }, confirmedId: 2 })
    await pB
    expect(client.signals.items!.value).toEqual(['a', 'b'])
    expect(client.pendingCount).toBe(0)
  })
})
