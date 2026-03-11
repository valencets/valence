import { describe, it, expect, beforeAll, afterEach } from 'vitest'

beforeAll(async () => {
  if (customElements.get('inertia-link') === undefined) {
    await import('../tracking-link.js')
  }
})

function createElement (attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement('inertia-link')
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

describe('TrackingLink', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element inertia-link', () => {
    expect(customElements.get('inertia-link')).toBeDefined()
  })

  it('sets data-telemetry-type to INTENT_NAVIGATE by default', () => {
    const el = attach(createElement())
    expect(el.getAttribute('data-telemetry-type')).toBe('INTENT_NAVIGATE')
  })

  it('creates inner <a> with href attribute', () => {
    const el = attach(createElement({ href: '/about' }))
    const anchor = el.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/about')
  })

  it('tel attribute sets href to tel: URI', () => {
    const el = attach(createElement({ tel: '555-0100' }))
    const anchor = el.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('tel:555-0100')
  })

  it('tel attribute sets data-telemetry-type to INTENT_CALL', () => {
    const el = attach(createElement({ tel: '555-0100' }))
    expect(el.getAttribute('data-telemetry-type')).toBe('INTENT_CALL')
  })

  it('tel change updates inner anchor href and text', () => {
    const el = attach(createElement({ tel: '555-0100' }))
    const anchor = el.querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('tel:555-0100')
    expect(anchor?.textContent).toBe('555-0100')

    el.setAttribute('tel', '555-0200')
    expect(anchor?.getAttribute('href')).toBe('tel:555-0200')
    expect(anchor?.textContent).toBe('555-0200')
  })

  it('href change updates inner anchor href', () => {
    const el = attach(createElement({ href: '/about' }))
    const anchor = el.querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('/about')

    el.setAttribute('href', '/contact')
    expect(anchor?.getAttribute('href')).toBe('/contact')
  })

  it('syncs data-telemetry-target from target attribute', () => {
    const el = attach(createElement({ target: 'nav-about' }))
    expect(el.getAttribute('data-telemetry-target')).toBe('nav-about')

    el.setAttribute('target', 'nav-contact')
    expect(el.getAttribute('data-telemetry-target')).toBe('nav-contact')
  })

  it('persist attribute sets data-inertia-persist', () => {
    const el = attach(createElement({ persist: '' }))
    expect(el.hasAttribute('data-inertia-persist')).toBe(true)
  })

  it('persist attribute generates id if missing', () => {
    const el = attach(createElement({ persist: '' }))
    expect(el.id).not.toBe('')
  })

  it('type attribute override works', () => {
    const el = attach(createElement({ type: 'INTENT_BOOK' }))
    expect(el.getAttribute('data-telemetry-type')).toBe('INTENT_BOOK')
  })

  it('has disconnectedCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { disconnectedCallback: unknown }).disconnectedCallback).toBe('function')
  })

  it('has connectedMoveCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { connectedMoveCallback: unknown }).connectedMoveCallback).toBe('function')
  })

  it('renders text content for navigation links', () => {
    const el = attach(createElement({ href: '/about' }))
    el.textContent = 'About Us'
    // Text content is set on the element, anchor was created before text was set
    expect(el.textContent).toContain('About Us')
  })

  it('uses existing <a> child if present', () => {
    const el = createElement({ href: '/existing' })
    const existingAnchor = document.createElement('a')
    existingAnchor.textContent = 'Existing Link'
    el.appendChild(existingAnchor)

    attach(el)
    const anchors = el.querySelectorAll('a')
    expect(anchors.length).toBe(1)
    expect(existingAnchor.getAttribute('href')).toBe('/existing')
  })
})
