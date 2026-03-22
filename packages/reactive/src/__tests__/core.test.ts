import { describe, it, expect, vi } from 'vitest'
import { signal } from '../core.js'

describe('signal()', () => {
  it('returns initial value via .value', () => {
    const s = signal(0)
    expect(s.value).toBe(0)
  })

  it('returns initial value for non-number types', () => {
    const s = signal('hello')
    expect(s.value).toBe('hello')
  })

  it('updates value on write', () => {
    const s = signal(0)
    s.value = 42
    expect(s.value).toBe(42)
  })

  it('returns updated value via peek() without tracking', () => {
    const s = signal(10)
    expect(s.peek()).toBe(10)
    s.value = 20
    expect(s.peek()).toBe(20)
  })

  it('does not notify when setting same value (Object.is)', () => {
    const s = signal(5)
    const spy = vi.fn()
    // Subscribe manually to test notification (internal API)
    s._subscribe(spy)
    s.value = 5
    expect(spy).not.toHaveBeenCalled()
  })

  it('notifies when setting different value', () => {
    const s = signal(5)
    const spy = vi.fn()
    s._subscribe(spy)
    s.value = 10
    expect(spy).toHaveBeenCalledOnce()
  })

  it('supports custom equality function', () => {
    const s = signal(
      { x: 1, y: 2 },
      { equals: (a, b) => a.x === b.x && a.y === b.y }
    )
    const spy = vi.fn()
    s._subscribe(spy)
    s.value = { x: 1, y: 2 }
    expect(spy).not.toHaveBeenCalled()
    s.value = { x: 3, y: 4 }
    expect(spy).toHaveBeenCalledOnce()
  })

  it('unsubscribe stops notifications', () => {
    const s = signal(0)
    const spy = vi.fn()
    const unsub = s._subscribe(spy)
    s.value = 1
    expect(spy).toHaveBeenCalledOnce()
    unsub()
    s.value = 2
    expect(spy).toHaveBeenCalledOnce()
  })
})
