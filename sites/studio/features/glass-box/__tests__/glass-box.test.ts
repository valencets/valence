import { describe, it, expect, beforeAll } from 'vitest'
import { GLASS_BOX_CONFIG, EXPLAINER_MAP } from '../config/glass-box-config.js'

describe('GLASS_BOX_CONFIG', () => {
  it('has 400ms hover delay', () => {
    expect(GLASS_BOX_CONFIG.hoverDelayMs).toBe(400)
  })

  it('has 320px inspector width', () => {
    expect(GLASS_BOX_CONFIG.inspectorWidth).toBe(320)
  })

  it('has 32px strip height', () => {
    expect(GLASS_BOX_CONFIG.stripHeight).toBe(32)
  })

  it('has 2s flush message duration', () => {
    expect(GLASS_BOX_CONFIG.flushMessageDurationMs).toBe(2000)
  })
})

describe('EXPLAINER_MAP', () => {
  it('has explainers for all intent types', () => {
    const types = ['CLICK', 'SCROLL', 'VIEWPORT_INTERSECT', 'FORM_INPUT', 'INTENT_NAVIGATE', 'INTENT_CALL', 'INTENT_BOOK']
    for (const type of types) {
      expect(EXPLAINER_MAP[type]).toBeDefined()
      expect(EXPLAINER_MAP[type]!.length).toBeGreaterThan(0)
    }
  })
})

describe('GlassBoxInspector', () => {
  let GlassBoxInspector: typeof import('../components/GlassBoxInspector.js').GlassBoxInspector

  beforeAll(async () => {
    const mod = await import('../components/GlassBoxInspector.js')
    GlassBoxInspector = mod.GlassBoxInspector
  })

  it('is defined as a custom element', () => {
    expect(customElements.get('inertia-telemetry-infobox')).toBeDefined()
  })

  it('can be created', () => {
    const el = document.createElement('inertia-telemetry-infobox')
    expect(el).toBeInstanceOf(GlassBoxInspector)
  })

  it('has observedAttributes', () => {
    expect(GlassBoxInspector.observedAttributes).toContain('visible')
  })

  it('sets role=tooltip on connect', () => {
    const el = document.createElement('inertia-telemetry-infobox') as InstanceType<typeof GlassBoxInspector>
    document.body.appendChild(el)
    expect(el.getAttribute('role')).toBe('tooltip')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    el.remove()
  })
})

describe('GlassBoxInspector overlay mode', () => {
  beforeAll(async () => {
    if (customElements.get('inertia-telemetry-infobox') === undefined) {
      await import('../components/GlassBoxInspector.js')
    }
  })

  function setup (): { inspector: HTMLElement; target: HTMLElement } {
    const target = document.createElement('button')
    target.setAttribute('data-telemetry-type', 'CLICK')
    target.setAttribute('data-telemetry-target', 'test-btn')
    document.body.appendChild(target)

    const inspector = document.createElement('inertia-telemetry-infobox')
    document.body.appendChild(inspector)

    return { inspector, target }
  }

  function teardown (): void {
    document.body.innerHTML = ''
  }

  it('toggles overlay labels on backtick keydown', () => {
    setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    const labels = document.querySelectorAll('[data-overlay-label]')
    expect(labels.length).toBeGreaterThanOrEqual(1)
    teardown()
  })

  it('removes overlay labels on second backtick press', () => {
    setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    const labels = document.querySelectorAll('[data-overlay-label]')
    expect(labels.length).toBe(0)
    teardown()
  })

  it('ignores backtick when input is focused', () => {
    setup()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    const labels = document.querySelectorAll('[data-overlay-label]')
    expect(labels.length).toBe(0)
    teardown()
  })
})

describe('GlassBoxInspector route lifecycle', () => {
  beforeAll(async () => {
    if (customElements.get('inertia-telemetry-infobox') === undefined) {
      await import('../components/GlassBoxInspector.js')
    }
  })

  function setup (): { inspector: HTMLElement; target: HTMLElement } {
    const target = document.createElement('button')
    target.setAttribute('data-telemetry-type', 'CLICK')
    target.setAttribute('data-telemetry-target', 'lifecycle-btn')
    document.body.appendChild(target)

    const inspector = document.createElement('inertia-telemetry-infobox')
    document.body.appendChild(inspector)

    return { inspector, target }
  }

  function teardown (): void {
    document.body.innerHTML = ''
  }

  it('tears down overlay labels on inertia:before-swap', () => {
    setup()
    // Activate overlay
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBeGreaterThanOrEqual(1)

    // Simulate router before-swap
    document.dispatchEvent(new CustomEvent('inertia:before-swap'))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBe(0)
    teardown()
  })

  it('re-renders overlay labels on inertia:after-swap when overlay was active', () => {
    setup()
    // Activate overlay
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBeGreaterThanOrEqual(1)

    // Simulate route swap
    document.dispatchEvent(new CustomEvent('inertia:before-swap'))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBe(0)

    // Add new route content with telemetry targets
    const newTarget = document.createElement('a')
    newTarget.setAttribute('data-telemetry-type', 'INTENT_NAVIGATE')
    newTarget.setAttribute('data-telemetry-target', 'new-link')
    document.body.appendChild(newTarget)

    document.dispatchEvent(new CustomEvent('inertia:after-swap'))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBeGreaterThanOrEqual(1)
    teardown()
  })

  it('does NOT re-render overlay on after-swap when overlay was inactive', () => {
    setup()
    // Do NOT activate overlay — just dispatch swap events
    document.dispatchEvent(new CustomEvent('inertia:before-swap'))
    document.dispatchEvent(new CustomEvent('inertia:after-swap'))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBe(0)
    teardown()
  })

  it('cleans up overlay when inspector node is moved without destroying', () => {
    const { inspector } = setup()
    // Activate overlay
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBeGreaterThanOrEqual(1)

    // Move the inspector to a new parent (simulates fragment swap moveBefore)
    const newParent = document.createElement('div')
    document.body.appendChild(newParent)
    newParent.appendChild(inspector) // move, not destroy

    // Simulate swap — overlay should still tear down via event listener
    document.dispatchEvent(new CustomEvent('inertia:before-swap'))
    expect(document.querySelectorAll('[data-overlay-label]').length).toBe(0)
    teardown()
  })

  it('cleans up swap listeners on disconnectedCallback', () => {
    const { inspector } = setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    // Remove inspector from DOM
    inspector.remove()
    // Dispatch swap event — should NOT throw or create labels
    document.dispatchEvent(new CustomEvent('inertia:before-swap'))
    document.dispatchEvent(new CustomEvent('inertia:after-swap'))
    teardown()
  })
})

describe('GlassBoxInspector overlay layout', () => {
  beforeAll(async () => {
    if (customElements.get('inertia-telemetry-infobox') === undefined) {
      await import('../components/GlassBoxInspector.js')
    }
  })

  function setup (): { inspector: HTMLElement; target: HTMLElement } {
    const target = document.createElement('button')
    target.setAttribute('data-telemetry-type', 'CLICK')
    target.setAttribute('data-telemetry-target', 'layout-btn')
    document.body.appendChild(target)

    const inspector = document.createElement('inertia-telemetry-infobox')
    document.body.appendChild(inspector)

    return { inspector, target }
  }

  function teardown (): void {
    document.body.removeAttribute('data-glass-box-active')
    document.body.innerHTML = ''
  }

  it('adds data-glass-box-active attribute to body when overlay activates', () => {
    setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    expect(document.body.hasAttribute('data-glass-box-active')).toBe(true)
    teardown()
  })

  it('removes data-glass-box-active attribute when overlay deactivates', () => {
    setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    expect(document.body.hasAttribute('data-glass-box-active')).toBe(false)
    teardown()
  })

  it('adds marginTop to telemetry targets when overlay activates', () => {
    const { target } = setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    const margin = parseInt(target.style.marginTop, 10)
    expect(margin).toBeGreaterThan(0)
    teardown()
  })

  it('restores original marginTop when overlay deactivates', () => {
    const { target } = setup()
    target.style.marginTop = '8px'
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    // Should have increased margin
    const activeMargin = parseInt(target.style.marginTop, 10)
    expect(activeMargin).toBeGreaterThan(8)
    // Deactivate
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    expect(target.style.marginTop).toBe('8px')
    teardown()
  })

  it('cleans up margins and body attribute on before-swap', () => {
    const { target } = setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    expect(document.body.hasAttribute('data-glass-box-active')).toBe(true)

    document.dispatchEvent(new CustomEvent('inertia:before-swap'))
    expect(document.body.hasAttribute('data-glass-box-active')).toBe(false)
    expect(target.style.marginTop).toBe('')
    teardown()
  })

  it('re-applies margins on after-swap when overlay was active', () => {
    setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))

    document.dispatchEvent(new CustomEvent('inertia:before-swap'))

    // Add new content
    const newTarget = document.createElement('a')
    newTarget.setAttribute('data-telemetry-type', 'INTENT_NAVIGATE')
    newTarget.setAttribute('data-telemetry-target', 'new-link')
    document.body.appendChild(newTarget)

    document.dispatchEvent(new CustomEvent('inertia:after-swap'))

    expect(document.body.hasAttribute('data-glass-box-active')).toBe(true)
    const margin = parseInt(newTarget.style.marginTop, 10)
    expect(margin).toBeGreaterThan(0)
    teardown()
  })
})

describe('GlassBoxStrip', () => {
  let GlassBoxStrip: typeof import('../components/GlassBoxStrip.js').GlassBoxStrip

  beforeAll(async () => {
    const mod = await import('../components/GlassBoxStrip.js')
    GlassBoxStrip = mod.GlassBoxStrip
  })

  it('is defined as a custom element', () => {
    expect(customElements.get('inertia-buffer-strip')).toBeDefined()
  })

  it('can be created', () => {
    const el = document.createElement('inertia-buffer-strip')
    expect(el).toBeInstanceOf(GlassBoxStrip)
  })

  it('has observedAttributes', () => {
    expect(GlassBoxStrip.observedAttributes).toContain('hardware-label')
  })

  it('sets role=status on connect', () => {
    const el = document.createElement('inertia-buffer-strip') as InstanceType<typeof GlassBoxStrip>
    document.body.appendChild(el)
    expect(el.getAttribute('role')).toBe('status')
    el.remove()
  })

  it('accepts buffer property', () => {
    const el = document.createElement('inertia-buffer-strip') as InstanceType<typeof GlassBoxStrip>
    const mockBuffer = { count: 5, capacity: 1024, head: 5, slotAt: () => undefined }
    el.buffer = mockBuffer
    // No error thrown
    expect(true).toBe(true)
  })

  it('renders demo flood button on desktop', async () => {
    const el = document.createElement('inertia-buffer-strip') as InstanceType<typeof GlassBoxStrip>
    const mockBuffer = { count: 5, capacity: 1024, head: 5, slotAt: () => ({ isDirty: false }) }
    el.buffer = mockBuffer
    document.body.appendChild(el)
    // Wait for rAF tick to render
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const demoBtn = el.querySelector('[data-demo-flood]')
    expect(demoBtn).not.toBeNull()
    el.remove()
  })
})
