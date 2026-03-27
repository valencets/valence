// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { createMutationCaller } from '../client/mutation-caller.js'
import { createStoreSignals } from '../client/store-signals.js'
import { PendingQueue } from '../client/pending-queue.js'
import { generateStoreSchema } from '../validation/zod-generator.js'
import { field } from '../fields/index.js'
import type { StoreState } from '../types.js'

describe('createMutationCaller', () => {
  function setup () {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()
    const inputFields = [field.number({ name: 'amount' })]
    const inputSchema = generateStoreSchema(inputFields)
    const postFn = vi.fn().mockResolvedValue({
      ok: true,
      state: { count: 5 },
      confirmedId: 1
    })

    const caller = createMutationCaller({
      storeSlug: 'counter',
      mutationName: 'increment',
      inputSchema,
      signals,
      pendingQueue: queue,
      postMutation: postFn
    })

    return { caller, signals, queue, postFn }
  }

  it('validates input and rejects invalid args', async () => {
    const { caller } = setup()
    const result = await caller({ amount: 'not-a-number' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('VALIDATION_FAILED')
    }
  })

  it('enqueues mutation in pending queue', async () => {
    const { caller, queue } = setup()
    await caller({ amount: 5 })
    // Post was called, mutation was enqueued then confirmed
    expect(queue.size).toBe(0) // confirmed and removed
  })

  it('calls postMutation with correct args', async () => {
    const { caller, postFn } = setup()
    await caller({ amount: 5 })
    expect(postFn).toHaveBeenCalledWith('counter', 'increment', { amount: 5 }, expect.any(Number))
  })

  it('applies optimistic client function when provided', async () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()
    const inputSchema = generateStoreSchema([field.number({ name: 'amount' })])

    // postMutation that delays to let us check optimistic state
    let resolvePost: (value: { ok: boolean; state: StoreState; confirmedId: number }) => void = () => {}
    const postFn = vi.fn().mockReturnValue(new Promise(resolve => { resolvePost = resolve }))

    const caller = createMutationCaller({
      storeSlug: 'counter',
      mutationName: 'increment',
      inputSchema,
      signals,
      pendingQueue: queue,
      postMutation: postFn,
      clientFn: (state, input) => {
        state.count = (state.count as number) + (input.amount as number)
      }
    })

    const resultPromise = caller({ amount: 10 })

    // Optimistic state should be applied immediately
    expect(signals.count.value).toBe(10)
    expect(queue.size).toBe(1)

    // Server confirms
    resolvePost({ ok: true, state: { count: 10 }, confirmedId: 1 })
    const result = await resultPromise

    expect(result.isOk()).toBe(true)
    expect(signals.count.value).toBe(10)
    expect(queue.size).toBe(0)
  })

  it('rolls back optimistic state on server rejection', async () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()
    const inputSchema = generateStoreSchema([field.number({ name: 'amount' })])

    const postFn = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'MUTATION_FAILED', message: 'Server rejected' }
    })

    const caller = createMutationCaller({
      storeSlug: 'counter',
      mutationName: 'increment',
      inputSchema,
      signals,
      pendingQueue: queue,
      postMutation: postFn,
      clientFn: (state, input) => {
        state.count = (state.count as number) + (input.amount as number)
      },
      serverState: { count: 0 }
    })

    const result = await caller({ amount: 5 })

    expect(result.isErr()).toBe(true)
    // Rolled back to server state
    expect(signals.count.value).toBe(0)
    expect(queue.size).toBe(0)
  })

  it('returns Ok with void on success', async () => {
    const { caller } = setup()
    const result = await caller({ amount: 1 })
    expect(result.isOk()).toBe(true)
  })

  it('works without client function — no optimistic, just waits for server', async () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()
    const inputSchema = generateStoreSchema([field.number({ name: 'amount' })])

    const postFn = vi.fn().mockResolvedValue({
      ok: true,
      state: { count: 7 },
      confirmedId: 1
    })

    const caller = createMutationCaller({
      storeSlug: 'counter',
      mutationName: 'increment',
      inputSchema,
      signals,
      pendingQueue: queue,
      postMutation: postFn
    })

    // Count stays 0 until server responds (no optimistic)
    const result = await caller({ amount: 7 })
    expect(result.isOk()).toBe(true)
    expect(signals.count.value).toBe(7)
  })
})
