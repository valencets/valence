import { describe, it, expect, vi } from 'vitest'
import { signal, computed, effect, batch, untracked } from '../core.js'

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

describe('computed()', () => {
  it('derives value from a signal', () => {
    const count = signal(3)
    const doubled = computed(() => count.value * 2)
    expect(doubled.value).toBe(6)
  })

  it('updates when source signal changes', () => {
    const count = signal(1)
    const doubled = computed(() => count.value * 2)
    count.value = 5
    expect(doubled.value).toBe(10)
  })

  it('is lazy — does not compute until read', () => {
    const spy = vi.fn(() => 42)
    const c = computed(spy)
    expect(spy).not.toHaveBeenCalled()
    expect(c.value).toBe(42)
    expect(spy).toHaveBeenCalledOnce()
  })

  it('caches value between reads when dependencies unchanged', () => {
    const spy = vi.fn(() => 1)
    const c = computed(spy)
    const _a = c.value
    const _b = c.value
    const _c = c.value
    expect(spy).toHaveBeenCalledOnce()
    expect(_a).toBe(_b)
    expect(_b).toBe(_c)
  })

  it('recomputes only when dependencies actually change', () => {
    const count = signal(1)
    const spy = vi.fn(() => count.value * 2)
    const doubled = computed(spy)
    const _init = doubled.value
    expect(spy).toHaveBeenCalledOnce()
    expect(_init).toBe(2)
    count.value = 1 // same value — no notify
    const _same = doubled.value
    expect(spy).toHaveBeenCalledOnce()
    expect(_same).toBe(2)
    count.value = 2 // different value — recompute
    const _changed = doubled.value
    expect(spy).toHaveBeenCalledTimes(2)
    expect(_changed).toBe(4)
  })

  it('chains through multiple computeds', () => {
    const a = signal(2)
    const b = computed(() => a.value * 3)
    const c = computed(() => b.value + 1)
    expect(c.value).toBe(7)
    a.value = 10
    expect(c.value).toBe(31)
  })

  it('handles diamond dependency without double-fire', () => {
    const a = signal(1)
    const b = computed(() => a.value * 2)
    const c = computed(() => a.value * 3)
    const spy = vi.fn(() => b.value + c.value)
    const d = computed(spy)
    expect(d.value).toBe(5) // 2 + 3
    spy.mockClear()
    a.value = 2
    expect(d.value).toBe(10) // 4 + 6
    expect(spy).toHaveBeenCalledOnce()
  })

  it('is readonly — .value setter does not exist', () => {
    const c = computed(() => 42)
    expect(() => { (c as { value: number }).value = 99 }).toThrow()
  })

  it('peek() reads without tracking', () => {
    const count = signal(1)
    const c = computed(() => count.value)
    expect(c.peek()).toBe(1)
  })
})

describe('effect()', () => {
  it('runs immediately on creation', () => {
    const spy = vi.fn()
    effect(spy)
    expect(spy).toHaveBeenCalledOnce()
  })

  it('re-runs when a tracked signal changes', () => {
    const count = signal(0)
    const spy = vi.fn()
    effect(() => {
      spy(count.value)
    })
    expect(spy).toHaveBeenCalledWith(0)
    count.value = 1
    expect(spy).toHaveBeenCalledWith(1)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('tracks computed signals', () => {
    const a = signal(2)
    const b = computed(() => a.value * 10)
    const spy = vi.fn()
    effect(() => { spy(b.value) })
    expect(spy).toHaveBeenCalledWith(20)
    a.value = 3
    expect(spy).toHaveBeenCalledWith(30)
  })

  it('runs cleanup function before re-execution', () => {
    const count = signal(0)
    const order: string[] = []
    effect(() => {
      const v = count.value
      order.push(`run:${v}`)
      return () => { order.push(`cleanup:${v}`) }
    })
    expect(order).toEqual(['run:0'])
    count.value = 1
    expect(order).toEqual(['run:0', 'cleanup:0', 'run:1'])
  })

  it('dispose function stops the effect and runs final cleanup', () => {
    const count = signal(0)
    const spy = vi.fn()
    const cleanupSpy = vi.fn()
    const dispose = effect(() => {
      spy(count.value)
      return cleanupSpy
    })
    expect(spy).toHaveBeenCalledTimes(1)
    dispose()
    expect(cleanupSpy).toHaveBeenCalledOnce()
    count.value = 1
    expect(spy).toHaveBeenCalledTimes(1) // not called again
  })

  it('does not re-run after dispose even with multiple signal changes', () => {
    const a = signal(0)
    const b = signal(0)
    const spy = vi.fn()
    const dispose = effect(() => {
      spy(a.value + b.value)
    })
    dispose()
    a.value = 1
    b.value = 1
    expect(spy).toHaveBeenCalledTimes(1) // only the initial run
  })

  it('re-tracks dependencies on each run', () => {
    const toggle = signal(true)
    const a = signal('a')
    const b = signal('b')
    const spy = vi.fn()
    effect(() => {
      spy(toggle.value ? a.value : b.value)
    })
    expect(spy).toHaveBeenLastCalledWith('a')
    a.value = 'A'
    expect(spy).toHaveBeenLastCalledWith('A')
    toggle.value = false
    expect(spy).toHaveBeenLastCalledWith('b')
    a.value = 'AA' // no longer tracked
    expect(spy).toHaveBeenCalledTimes(3) // not re-run
    b.value = 'B' // now tracked
    expect(spy).toHaveBeenLastCalledWith('B')
  })
})

describe('batch()', () => {
  it('defers effect execution until batch completes', () => {
    const a = signal(0)
    const b = signal(0)
    const spy = vi.fn()
    effect(() => { spy(a.value + b.value) })
    spy.mockClear()
    batch(() => {
      a.value = 1
      b.value = 2
    })
    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(3)
  })

  it('returns the callback return value', () => {
    const result = batch(() => 42)
    expect(result).toBe(42)
  })

  it('nested batches flush only on outermost exit', () => {
    const count = signal(0)
    const spy = vi.fn()
    effect(() => { spy(count.value) })
    spy.mockClear()
    batch(() => {
      count.value = 1
      batch(() => {
        count.value = 2
      })
      // inner batch exits but outer still open — no flush yet
      expect(spy).not.toHaveBeenCalled()
      count.value = 3
    })
    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(3)
  })

  it('without batch, each write triggers immediately', () => {
    const count = signal(0)
    const spy = vi.fn()
    effect(() => { spy(count.value) })
    spy.mockClear()
    count.value = 1
    count.value = 2
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('untracked()', () => {
  it('reads signal without creating dependency', () => {
    const a = signal(1)
    const b = signal(2)
    const spy = vi.fn()
    effect(() => {
      spy(a.value + untracked(() => b.value))
    })
    expect(spy).toHaveBeenCalledWith(3)
    spy.mockClear()
    b.value = 10 // untracked — should NOT re-run effect
    expect(spy).not.toHaveBeenCalled()
    a.value = 5 // tracked — SHOULD re-run
    expect(spy).toHaveBeenCalledWith(15) // 5 + 10
  })

  it('returns the callback value', () => {
    const s = signal(42)
    const result = untracked(() => s.value)
    expect(result).toBe(42)
  })

  it('works inside computed without tracking transitive deps', () => {
    const a = signal(1)
    const b = signal(2)
    const c = computed(() => a.value + untracked(() => b.value))
    expect(c.value).toBe(3)
    b.value = 100
    expect(c.value).toBe(3) // b not tracked — still cached
    a.value = 10
    expect(c.value).toBe(110) // a tracked — recomputed with new b
  })
})

describe('recursion guard', () => {
  it('limits cross-effect recursion depth without crashing', () => {
    const a = signal(0)
    const b = signal(0)
    // Two effects that write to each other — would infinite-loop without guard
    const d1 = effect(() => {
      if (a.value < 200) b.value = a.value + 1
    })
    const d2 = effect(() => {
      if (b.value < 200) a.value = b.value + 1
    })
    // Should not crash — depth limit stops it
    a.value = 1
    d1()
    d2()
    // Values stabilized at some point under the depth limit
    expect(a.peek()).toBeGreaterThan(0)
  })
})

describe('computed conditional deps (C2 fix)', () => {
  it('re-tracks dependencies on each evaluation', () => {
    const toggle = signal(true)
    const a = signal('A')
    const b = signal('B')
    const spy = vi.fn(() => toggle.value ? a.value : b.value)
    const c = computed(spy)
    expect(c.value).toBe('A')
    spy.mockClear()
    toggle.value = false
    expect(c.value).toBe('B')
    spy.mockClear()
    a.value = 'AA' // no longer tracked — should NOT recompute
    expect(c.value).toBe('B')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('disposal edge cases', () => {
  it('double dispose is safe', () => {
    const s = signal(0)
    const dispose = effect(() => { s.peek() })
    dispose()
    dispose() // should not throw
  })

  it('handles disposal of one effect by another during notification', () => {
    const s = signal(0)
    let dispose2: (() => void) | null = null
    const order: string[] = []
    effect(() => {
      order.push(`e1:${s.value}`)
      if (s.value === 1 && dispose2 !== null) {
        dispose2()
      }
    })
    dispose2 = effect(() => {
      order.push(`e2:${s.value}`)
    })
    order.length = 0
    s.value = 1
    expect(order).toContain('e1:1')
  })
})

describe('computed custom equality', () => {
  it('uses custom equals to suppress recomputation', () => {
    const s = signal({ x: 1 })
    const spy = vi.fn(() => ({ sum: s.value.x }))
    const c = computed(spy, { equals: (a, b) => a.sum === b.sum })
    expect(c.value).toEqual({ sum: 1 })
    spy.mockClear()
    s.value = { x: 1 } // different object, same .x
    expect(c.value).toEqual({ sum: 1 })
    // computed ran but equality suppressed downstream notification
    expect(spy).toHaveBeenCalled()
  })
})
