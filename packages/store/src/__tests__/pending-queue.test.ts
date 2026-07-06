import { describe, it, expect } from 'vitest'
import { PendingQueue } from '../client/pending-queue.js'

describe('PendingQueue', () => {
  it('starts empty', () => {
    const queue = PendingQueue.create()
    expect(queue.pending()).toEqual([])
    expect(queue.size).toBe(0)
  })

  it('enqueue assigns monotonically increasing IDs', () => {
    const queue = PendingQueue.create()
    const id1 = queue.enqueue('increment', { amount: 1 })
    const id2 = queue.enqueue('increment', { amount: 2 })
    const id3 = queue.enqueue('decrement', { amount: 1 })
    expect(id1).toBe(1)
    expect(id2).toBe(2)
    expect(id3).toBe(3)
  })

  it('enqueue increases size', () => {
    const queue = PendingQueue.create()
    queue.enqueue('increment', { amount: 1 })
    expect(queue.size).toBe(1)
    queue.enqueue('increment', { amount: 2 })
    expect(queue.size).toBe(2)
  })

  it('pending returns all queued mutations in FIFO order', () => {
    const queue = PendingQueue.create()
    queue.enqueue('addItem', { sku: 'abc' })
    queue.enqueue('removeItem', { sku: 'def' })
    const pending = queue.pending()
    expect(pending).toHaveLength(2)
    expect(pending[0]!.id).toBe(1)
    expect(pending[0]!.name).toBe('addItem')
    expect(pending[0]!.args).toEqual({ sku: 'abc' })
    expect(pending[1]!.id).toBe(2)
    expect(pending[1]!.name).toBe('removeItem')
    expect(pending[1]!.args).toEqual({ sku: 'def' })
  })

  it('confirm removes the specified mutation by ID', () => {
    const queue = PendingQueue.create()
    queue.enqueue('a', {})
    queue.enqueue('b', {})
    queue.enqueue('c', {})

    const result = queue.confirm(2)
    expect(result.isOk()).toBe(true)
    expect(queue.size).toBe(2)

    const names = queue.pending().map(m => m.name)
    expect(names).toEqual(['a', 'c'])
  })

  it('confirm returns Err for unknown ID', () => {
    const queue = PendingQueue.create()
    queue.enqueue('a', {})
    const result = queue.confirm(999)
    expect(result.isErr()).toBe(true)
  })

  it('reject removes the specified mutation by ID', () => {
    const queue = PendingQueue.create()
    queue.enqueue('a', {})
    queue.enqueue('b', {})

    const result = queue.reject(1)
    expect(result.isOk()).toBe(true)
    expect(queue.size).toBe(1)
    expect(queue.pending()[0]!.name).toBe('b')
  })

  it('reject returns Err for unknown ID', () => {
    const queue = PendingQueue.create()
    const result = queue.reject(42)
    expect(result.isErr()).toBe(true)
  })

  it('confirm and reject are idempotent after removal', () => {
    const queue = PendingQueue.create()
    queue.enqueue('a', {})
    queue.confirm(1)
    const result = queue.confirm(1)
    expect(result.isErr()).toBe(true)
  })

  it('IDs never reset after confirm/reject', () => {
    const queue = PendingQueue.create()
    const id1 = queue.enqueue('a', {})
    queue.confirm(id1)
    const id2 = queue.enqueue('b', {})
    expect(id2).toBe(2)
  })

  it('clear removes all pending mutations', () => {
    const queue = PendingQueue.create()
    queue.enqueue('a', {})
    queue.enqueue('b', {})
    queue.enqueue('c', {})
    queue.clear()
    expect(queue.size).toBe(0)
    expect(queue.pending()).toEqual([])
  })

  it('clear does not reset ID counter', () => {
    const queue = PendingQueue.create()
    queue.enqueue('a', {})
    queue.enqueue('b', {})
    queue.clear()
    const id = queue.enqueue('c', {})
    expect(id).toBe(3)
  })

  it('pending returns a copy, not the internal array', () => {
    const queue = PendingQueue.create()
    queue.enqueue('a', {})
    const first = queue.pending()
    const second = queue.pending()
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })

  it('handles rapid sequential enqueue/confirm cycles', () => {
    const queue = PendingQueue.create()
    for (let i = 0; i < 100; i++) {
      const id = queue.enqueue('op', { i })
      queue.confirm(id)
    }
    expect(queue.size).toBe(0)
    expect(queue.enqueue('final', {})).toBe(101)
  })
})
