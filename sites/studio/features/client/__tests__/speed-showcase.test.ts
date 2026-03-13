// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'

let InertiaSpeedShowcase: typeof import('../components/SpeedShowcase.js').InertiaSpeedShowcase
let resetNavCounters: typeof import('../components/SpeedShowcase.js').resetNavCounters

function fireNavEvent (source: 'cache' | 'prefetch' | 'network', durationMs: number): void {
  document.dispatchEvent(new CustomEvent('inertia:navigated', {
    bubbles: true,
    detail: { source, durationMs, fromUrl: '/', toUrl: '/about' }
  }))
}

describe('InertiaSpeedShowcase', () => {
  beforeAll(async () => {
    const mod = await import('../components/SpeedShowcase.js')
    InertiaSpeedShowcase = mod.InertiaSpeedShowcase
    resetNavCounters = mod.resetNavCounters
  })

  beforeEach(() => {
    resetNavCounters()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is defined as a custom element', () => {
    expect(customElements.get('inertia-speed-showcase')).toBeDefined()
  })

  it('can be created', () => {
    const el = document.createElement('inertia-speed-showcase')
    expect(el).toBeInstanceOf(InertiaSpeedShowcase)
  })

  it('shows default state before any navigation', () => {
    const el = document.createElement('inertia-speed-showcase')
    document.body.appendChild(el)
    expect(el.textContent).toContain('Navigate')
  })

  it('updates counters on navigation events', () => {
    const el = document.createElement('inertia-speed-showcase')
    document.body.appendChild(el)

    fireNavEvent('network', 180)
    const total = el.querySelector('[data-stat="total"]')
    expect(total?.textContent).toContain('1')
  })

  it('tracks cache hit rate correctly', () => {
    const el = document.createElement('inertia-speed-showcase')
    document.body.appendChild(el)

    fireNavEvent('network', 200)
    fireNavEvent('cache', 2)
    fireNavEvent('cache', 3)

    expect(el.textContent).toContain('67%')
  })

  it('calculates average cached time', () => {
    const el = document.createElement('inertia-speed-showcase')
    document.body.appendChild(el)

    fireNavEvent('cache', 2)
    fireNavEvent('cache', 4)

    expect(el.textContent).toContain('3ms')
  })

  it('calculates average network time', () => {
    const el = document.createElement('inertia-speed-showcase')
    document.body.appendChild(el)

    fireNavEvent('network', 100)
    fireNavEvent('network', 200)

    expect(el.textContent).toContain('150ms')
  })

  it('accumulates stats while component is detached', () => {
    const el = document.createElement('inertia-speed-showcase')
    document.body.appendChild(el)

    fireNavEvent('network', 100)
    const totalBefore = el.querySelector('[data-stat="total"]')?.textContent
    expect(totalBefore).toContain('1')

    // Detach component (simulates navigation away from homepage)
    el.remove()

    // Events fire while detached
    fireNavEvent('cache', 2)
    fireNavEvent('cache', 3)

    // Re-attach (simulates navigating back to homepage)
    document.body.appendChild(el)

    // Should show accumulated total including events during detachment
    const totalAfter = el.querySelector('[data-stat="total"]')?.textContent
    expect(totalAfter).toContain('3')
  })
})
