import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

beforeAll(async () => {
  if (customElements.get('inertia-form') === undefined) {
    await import('../tracking-form.js')
  }
})

function createElement (attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement('inertia-form')
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

function createWithForm (attrs?: Record<string, string>): HTMLElement {
  const el = createElement(attrs)
  const form = document.createElement('form')
  form.action = '/submit'
  form.method = 'POST'
  const input = document.createElement('input')
  input.name = 'email'
  input.type = 'email'
  form.appendChild(input)
  el.appendChild(form)
  return el
}

describe('TrackingForm', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element inertia-form', () => {
    expect(customElements.get('inertia-form')).toBeDefined()
  })

  it('sets data-telemetry-type to FORM_INPUT by default', () => {
    const el = attach(createElement())
    expect(el.getAttribute('data-telemetry-type')).toBe('FORM_INPUT')
  })

  it('sets data-telemetry-target from target attribute', () => {
    const el = attach(createElement({ target: 'contact-form' }))
    expect(el.getAttribute('data-telemetry-target')).toBe('contact-form')
  })

  it('attaches submit listener on connectedCallback', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    attach(createElement())

    expect(spy).toHaveBeenCalledWith('submit', expect.any(Function))
    spy.mockRestore()
  })

  it('removes submit listener on disconnectedCallback', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const el = attach(createElement())
    el.remove()

    expect(spy).toHaveBeenCalledWith('submit', expect.any(Function))
    spy.mockRestore()
  })

  it('submit event dispatches inertia:form-submit custom event', () => {
    const el = attach(createWithForm({ target: 'contact-form' }))
    const handler = vi.fn()
    el.addEventListener('inertia:form-submit', handler)

    const form = el.querySelector('form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('submit event does NOT prevent default', () => {
    const el = attach(createWithForm({ target: 'contact-form' }))

    const form = el.querySelector('form')!
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(submitEvent)

    expect(submitEvent.defaultPrevented).toBe(false)
  })

  it('inertia:form-submit detail contains target identifier', () => {
    const el = attach(createWithForm({ target: 'contact-form' }))
    let detail: unknown = null
    el.addEventListener('inertia:form-submit', ((e: CustomEvent) => {
      detail = e.detail
    }) as EventListener)

    const form = el.querySelector('form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(detail).toEqual(expect.objectContaining({ target: 'contact-form' }))
  })

  it('syncs data-telemetry-type on attribute change', () => {
    const el = attach(createElement())
    expect(el.getAttribute('data-telemetry-type')).toBe('FORM_INPUT')

    el.setAttribute('type', 'CLICK')
    expect(el.getAttribute('data-telemetry-type')).toBe('CLICK')
  })

  it('syncs data-telemetry-target on attribute change', () => {
    const el = attach(createElement({ target: 'old' }))
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

  it('has connectedMoveCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { connectedMoveCallback: unknown }).connectedMoveCallback).toBe('function')
  })

  it('type attribute override works', () => {
    const el = attach(createElement({ type: 'CLICK' }))
    expect(el.getAttribute('data-telemetry-type')).toBe('CLICK')
  })

  it('renders slotted light DOM form children', () => {
    const el = attach(createWithForm())
    expect(el.querySelector('form')).not.toBeNull()
    expect(el.querySelector('input[name="email"]')).not.toBeNull()
  })
})
