import { describe, it, expect, vi } from 'vitest'
import { createEntityStore } from '../entity-store.js'

describe('createEntityStore()', () => {
  it('creates a store with the given name', () => {
    const store = createEntityStore('configs')
    expect(store.name).toBe('configs')
  })

  it('subscribe + patch notifies subscribers', () => {
    const store = createEntityStore('configs')
    const callback = vi.fn()
    store.subscribe('id-1', callback)
    store.patch('id-1', { liked: true, count: 5 })
    expect(callback).toHaveBeenCalledWith({ liked: true, count: 5 })
  })

  it('patch merges with existing state', () => {
    const store = createEntityStore('configs')
    const callback = vi.fn()
    store.subscribe('id-1', callback)
    store.patch('id-1', { liked: true, count: 5 })
    store.patch('id-1', { count: 6 })
    expect(callback).toHaveBeenLastCalledWith({ liked: true, count: 6 })
  })

  it('multiple subscribers all get notified', () => {
    const store = createEntityStore('configs')
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    store.subscribe('id-1', cb1)
    store.subscribe('id-1', cb2)
    store.patch('id-1', { liked: true })
    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops notifications', () => {
    const store = createEntityStore('configs')
    const callback = vi.fn()
    const unsub = store.subscribe('id-1', callback)
    unsub()
    store.patch('id-1', { liked: true })
    expect(callback).not.toHaveBeenCalled()
  })

  it('get() returns current state', () => {
    const store = createEntityStore('configs')
    store.patch('id-1', { liked: true })
    expect(store.get('id-1')).toEqual({ liked: true })
  })

  it('get() returns undefined for unknown IDs', () => {
    const store = createEntityStore('configs')
    expect(store.get('unknown')).toBeUndefined()
  })

  it('different entity IDs are independent', () => {
    const store = createEntityStore('configs')
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    store.subscribe('id-1', cb1)
    store.subscribe('id-2', cb2)
    store.patch('id-1', { liked: true })
    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).not.toHaveBeenCalled()
  })

  it('set() replaces state entirely', () => {
    const store = createEntityStore('configs')
    const callback = vi.fn()
    store.subscribe('id-1', callback)
    store.patch('id-1', { liked: true, count: 5 })
    store.set('id-1', { count: 0 })
    expect(store.get('id-1')).toEqual({ count: 0 })
    expect(callback).toHaveBeenLastCalledWith({ count: 0 })
  })
})
