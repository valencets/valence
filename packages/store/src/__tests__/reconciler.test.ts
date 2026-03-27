// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { reconcileState } from '../client/reconciler.js'
import { PendingQueue } from '../client/pending-queue.js'
import { createStoreSignals } from '../client/store-signals.js'
import { field } from '../fields/index.js'
import type { StoreState } from '../types.js'

describe('reconcileState', () => {
  it('applies server state to signals', () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()

    reconcileState(signals, { count: 42 }, queue)

    expect(signals.count.value).toBe(42)
  })

  it('applies multiple fields from server state', () => {
    const fields = [
      field.text({ name: 'name' }),
      field.number({ name: 'age' }),
      field.boolean({ name: 'active', default: false })
    ]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()

    reconcileState(signals, { name: 'Alice', age: 30, active: true }, queue)

    expect(signals.name.value).toBe('Alice')
    expect(signals.age.value).toBe(30)
    expect(signals.active.value).toBe(true)
  })

  it('drops confirmed mutation from pending queue', () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()

    queue.enqueue('increment', { amount: 5 })
    const id2 = queue.enqueue('increment', { amount: 3 })

    reconcileState(signals, { count: 5 }, queue, id2)

    expect(queue.size).toBe(1)
    expect(queue.pending()[0]!.id).toBe(1) // first one remains
  })

  it('replays pending mutations client functions after server state apply', () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()

    // Enqueue two mutations with client fns
    queue.enqueue('increment', { amount: 5 })
    queue.enqueue('increment', { amount: 3 })

    const clientFns = new Map<number, (state: StoreState) => void>()
    clientFns.set(1, (state) => { state.count = (state.count as number) + 5 })
    clientFns.set(2, (state) => { state.count = (state.count as number) + 3 })

    // Server confirms mutation 1, sends state count=5
    reconcileState(signals, { count: 5 }, queue, 1, clientFns)

    // Mutation 1 dropped, mutation 2 replayed: 5 + 3 = 8
    expect(signals.count.value).toBe(8)
    expect(queue.size).toBe(1)
  })

  it('handles empty pending queue — just applies server state', () => {
    const fields = [field.text({ name: 'title' })]
    const signals = createStoreSignals(fields, { title: 'old' })
    const queue = PendingQueue.create()

    reconcileState(signals, { title: 'new' }, queue)

    expect(signals.title.value).toBe('new')
  })

  it('handles server state with array values', () => {
    const fields = [
      field.array({
        name: 'items',
        fields: [field.text({ name: 'sku' })]
      })
    ]
    const signals = createStoreSignals(fields, { items: [] })
    const queue = PendingQueue.create()

    reconcileState(signals, {
      items: [{ sku: 'A' }, { sku: 'B' }]
    }, queue)

    const items = signals.items.value as Array<{ sku: string }>
    expect(items).toHaveLength(2)
    expect(items[0]!.sku).toBe('A')
  })

  it('handles server state with nested group values', () => {
    const fields = [
      field.group({
        name: 'seo',
        fields: [field.text({ name: 'title' }), field.text({ name: 'desc' })]
      })
    ]
    const signals = createStoreSignals(fields, { seo: {} })
    const queue = PendingQueue.create()

    reconcileState(signals, {
      seo: { title: 'New Title', desc: 'New Desc' }
    }, queue)

    const seo = signals.seo.value as { title: string; desc: string }
    expect(seo.title).toBe('New Title')
    expect(seo.desc).toBe('New Desc')
  })

  it('only updates signals that exist in server state', () => {
    const fields = [
      field.text({ name: 'a', default: 'original-a' }),
      field.text({ name: 'b', default: 'original-b' })
    ]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()

    reconcileState(signals, { a: 'updated-a' }, queue)

    expect(signals.a.value).toBe('updated-a')
    expect(signals.b.value).toBe('original-b')
  })

  it('reconcile with no confirmedId just applies state without dropping', () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const queue = PendingQueue.create()
    queue.enqueue('increment', { amount: 1 })

    reconcileState(signals, { count: 10 }, queue)

    expect(signals.count.value).toBe(10)
    expect(queue.size).toBe(1) // nothing dropped
  })
})
