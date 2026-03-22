import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValInput } from '../components/val-input.js'
import { defineTestElement } from './test-helpers.js'

describe('ValInput', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValInput> {
    const tag = defineTestElement('val-input', ValInput)
    const el = document.createElement(tag) as InstanceType<typeof ValInput>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  function inner (el: InstanceType<typeof ValInput>): HTMLInputElement {
    return el.shadowRoot!.querySelector('input')!
  }

  describe('DOM structure', () => {
    it('renders an input inside shadow DOM', () => {
      const el = create()
      expect(inner(el)).not.toBeNull()
    })

    it('renders a label with named slot', () => {
      const el = create()
      const label = el.shadowRoot!.querySelector('label')
      expect(label).not.toBeNull()
      const slot = label!.querySelector('slot')
      expect(slot).not.toBeNull()
      expect(slot!.getAttribute('name')).toBe('label')
    })
  })

  describe('attributes', () => {
    it('syncs type attribute to inner input', () => {
      const el = create({ type: 'email' })
      expect(inner(el).type).toBe('email')
    })

    it('syncs placeholder to inner input', () => {
      const el = create({ placeholder: 'Enter email' })
      expect(inner(el).placeholder).toBe('Enter email')
    })

    it('syncs required to inner input', () => {
      const el = create({ required: '' })
      expect(inner(el).required).toBe(true)
    })

    it('syncs disabled to inner input', () => {
      const el = create({ disabled: '' })
      expect(inner(el).disabled).toBe(true)
    })

    it('removes synced attr when host attr removed', () => {
      const el = create({ placeholder: 'test' })
      el.removeAttribute('placeholder')
      expect(inner(el).hasAttribute('placeholder')).toBe(false)
    })
  })

  describe('value', () => {
    it('gets and sets value', () => {
      const el = create()
      el.value = 'hello'
      expect(el.value).toBe('hello')
      expect(inner(el).value).toBe('hello')
    })

    it('initializes from value attribute', () => {
      const el = create({ value: 'initial' })
      expect(el.value).toBe('initial')
    })
  })

  describe('form association', () => {
    it('has static formAssociated = true', () => {
      expect(ValInput.formAssociated).toBe(true)
    })

    it('returns name from attribute', () => {
      const el = create({ name: 'email' })
      expect(el.name).toBe('email')
    })
  })

  describe('validation', () => {
    it('starts valid', () => {
      const el = create()
      expect(el.checkValidity()).toBe(true)
    })

    it('reports validity', () => {
      const el = create()
      expect(el.reportValidity()).toBe(true)
    })
  })

  describe('form lifecycle', () => {
    it('resets to default value on formResetCallback', () => {
      const el = create({ value: 'default' })
      el.value = 'changed'
      el.formResetCallback()
      expect(el.value).toBe('default')
    })

    it('disables on formDisabledCallback', () => {
      const el = create()
      el.formDisabledCallback(true)
      expect(inner(el).disabled).toBe(true)
    })
  })

  describe('telemetry', () => {
    it('emits val:interaction on input', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      inner(el).value = 'a'
      inner(el).dispatchEvent(new Event('input', { bubbles: true }))

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('input')
      expect(detail.value).toBe('a')
    })

    it('emits val:interaction on change', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      inner(el).dispatchEvent(new Event('change', { bubbles: true }))

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('change')
    })

    it('emits val:interaction on focus', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      inner(el).dispatchEvent(new Event('focus'))

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('focus')
    })
  })

  describe('icon slot', () => {
    it('renders icon slot inside input-row', () => {
      const el = create()
      const iconSlot = el.shadowRoot!.querySelector('slot[name="icon"]')
      expect(iconSlot).not.toBeNull()
      const row = el.shadowRoot!.querySelector('.input-row')
      expect(row!.contains(iconSlot!)).toBe(true)
    })

    it('icon-slot container is hidden when no icon slotted', () => {
      const el = create()
      expect(el.hasAttribute('has-icon')).toBe(false)
    })
  })

  describe('size attribute', () => {
    it('accepts size="lg"', () => {
      const el = create({ size: 'lg' })
      expect(el.getAttribute('size')).toBe('lg')
    })

    it('accepts size="sm"', () => {
      const el = create({ size: 'sm' })
      expect(el.getAttribute('size')).toBe('sm')
    })
  })

  describe('aria label sync', () => {
    it('sets aria-label on inner input from slotted label text', () => {
      const tag = defineTestElement('val-input', ValInput)
      const el = document.createElement(tag) as InstanceType<typeof ValInput>
      const label = document.createElement('span')
      label.slot = 'label'
      label.textContent = 'Email Address'
      el.appendChild(label)
      container.appendChild(el)
      const inputEl = el.shadowRoot!.querySelector('input')!
      expect(inputEl.getAttribute('aria-label')).toBe('Email Address')
    })
  })

  describe('initial setFormValue', () => {
    it('registers default value with ElementInternals on connect', () => {
      const el = create({ value: 'pre-filled', name: 'test-field' })
      // The value should be set via setFormValue during connectedCallback
      expect(el.value).toBe('pre-filled')
    })

    it('registers empty string when no value attribute', () => {
      const el = create({ name: 'test-field' })
      expect(el.value).toBe('')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'contact-name' })
      expect(el.cmsId).toBe('contact-name')
    })
  })
})
