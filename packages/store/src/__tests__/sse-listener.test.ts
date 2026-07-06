// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SSEListener } from '../client/sse-listener.js'

describe('SSEListener', () => {
  let originalEventSource: typeof EventSource

  beforeEach(() => {
    originalEventSource = globalThis.EventSource
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
  })

  it('creates with url and connects', () => {
    const listener = SSEListener.create('/store/counter/events')
    expect(listener).toBeDefined()
    listener.disconnect()
  })

  it('disconnect closes the connection', () => {
    const listener = SSEListener.create('/store/counter/events')
    listener.disconnect()
    // Should not throw on double disconnect
    listener.disconnect()
  })

  it('onState callback fires on state events', () => {
    const listener = SSEListener.create('/store/counter/events')
    const callback = vi.fn()
    listener.onState(callback)

    // Simulate SSE state event
    listener._simulateEvent('state', { count: 42 })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith({ count: 42 })
    listener.disconnect()
  })

  it('onConfirmed callback fires on confirmed events', () => {
    const listener = SSEListener.create('/store/counter/events')
    const callback = vi.fn()
    listener.onConfirmed(callback)

    listener._simulateEvent('confirmed', { mutationId: 3 })

    expect(callback).toHaveBeenCalledWith({ mutationId: 3 })
    listener.disconnect()
  })

  it('onRejected callback fires on rejected events', () => {
    const listener = SSEListener.create('/store/counter/events')
    const callback = vi.fn()
    listener.onRejected(callback)

    listener._simulateEvent('rejected', { mutationId: 5, error: { code: 'MUTATION_FAILED', message: 'Out of stock' } })

    expect(callback).toHaveBeenCalledWith({
      mutationId: 5,
      error: { code: 'MUTATION_FAILED', message: 'Out of stock' }
    })
    listener.disconnect()
  })

  it('multiple callbacks for same event type all fire', () => {
    const listener = SSEListener.create('/store/counter/events')
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    listener.onState(cb1)
    listener.onState(cb2)

    listener._simulateEvent('state', { count: 1 })

    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)
    listener.disconnect()
  })

  it('callbacks do not fire after disconnect', () => {
    const listener = SSEListener.create('/store/counter/events')
    const callback = vi.fn()
    listener.onState(callback)
    listener.disconnect()

    listener._simulateEvent('state', { count: 99 })

    expect(callback).not.toHaveBeenCalled()
  })

  it('onFragment callback fires on fragment events', () => {
    const listener = SSEListener.create('/store/counter/events')
    const callback = vi.fn()
    listener.onFragment(callback)

    listener._simulateEvent('fragment', {
      selector: '[data-store="counter"]',
      html: '<p>Count: 5</p>'
    })

    expect(callback).toHaveBeenCalledWith({
      selector: '[data-store="counter"]',
      html: '<p>Count: 5</p>'
    })
    listener.disconnect()
  })
})
