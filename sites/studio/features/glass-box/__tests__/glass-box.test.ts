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
})
