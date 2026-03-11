import { describe, it, expect, beforeAll, afterEach } from 'vitest'

beforeAll(async () => {
  if (customElements.get('inertia-button') === undefined) {
    await import('../tracking-button.js')
  }
})

function createElement (attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement('inertia-button')
  if (attrs !== undefined) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
  }
  return el
}

function attach (el: HTMLElement): HTMLElement {
  document.body.appendChild(el)
  return el
}

describe('TrackingButton', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element inertia-button', () => {
    expect(customElements.get('inertia-button')).toBeDefined()
  })

  it('sets data-telemetry-type to CLICK by default', () => {
    const el = attach(createElement())
    expect(el.getAttribute('data-telemetry-type')).toBe('CLICK')
  })

  it('sets data-telemetry-type from type attribute', () => {
    const el = attach(createElement({ type: 'INTENT_CALL' }))
    expect(el.getAttribute('data-telemetry-type')).toBe('INTENT_CALL')
  })

  it('sets data-telemetry-target from target attribute', () => {
    const el = attach(createElement({ target: 'cta-hero' }))
    expect(el.getAttribute('data-telemetry-target')).toBe('cta-hero')
  })

  it('syncs data-telemetry-type on attribute change', () => {
    const el = attach(createElement())
    expect(el.getAttribute('data-telemetry-type')).toBe('CLICK')

    el.setAttribute('type', 'SCROLL')
    expect(el.getAttribute('data-telemetry-type')).toBe('SCROLL')
  })

  it('syncs data-telemetry-target on attribute change', () => {
    const el = attach(createElement({ target: 'old' }))
    expect(el.getAttribute('data-telemetry-target')).toBe('old')

    el.setAttribute('target', 'new')
    expect(el.getAttribute('data-telemetry-target')).toBe('new')
  })

  it('persist attribute sets data-inertia-persist', () => {
    const el = attach(createElement({ persist: '' }))
    expect(el.hasAttribute('data-inertia-persist')).toBe(true)
  })

  it('persist attribute generates id if missing', () => {
    const el = attach(createElement({ persist: '' }))
    expect(el.id).not.toBe('')
  })

  it('persist attribute does not overwrite existing id', () => {
    const el = attach(createElement({ persist: '', id: 'my-button' }))
    expect(el.id).toBe('my-button')
  })

  it('has role="group" for accessibility', () => {
    const el = attach(createElement())
    expect(el.getAttribute('role')).toBe('group')
  })

  it('has disconnectedCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { disconnectedCallback: unknown }).disconnectedCallback).toBe('function')
  })

  it('has connectedMoveCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { connectedMoveCallback: unknown }).connectedMoveCallback).toBe('function')
  })

  it('renders slotted light DOM children', () => {
    const el = attach(createElement())
    const button = document.createElement('button')
    button.textContent = 'Click me'
    el.appendChild(button)

    expect(el.querySelector('button')?.textContent).toBe('Click me')
  })
})
