import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValFormElement } from '../core/val-form-element.js'
import { defineTestElement } from './test-helpers.js'

// Concrete test subclass
class TestInput extends ValFormElement {
  private currentValue = ''

  get value (): string { return this.currentValue }
  set value (v: string) {
    this.currentValue = v
    this.setFormValue(v)
  }

  protected createTemplate (): HTMLTemplateElement {
    const t = document.createElement('template')
    t.innerHTML = '<input type="text" />'
    return t
  }
}

describe('ValFormElement', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('has static formAssociated = true', () => {
    expect(TestInput.formAssociated).toBe(true)
  })

  it('always uses Shadow DOM', () => {
    const tag = defineTestElement('val-fi', TestInput)
    const el = document.createElement(tag)
    expect(el.shadowRoot).not.toBeNull()
  })

  it('has non-null internals', () => {
    const tag = defineTestElement('val-fi-int', TestInput)
    const el = document.createElement(tag) as TestInput
    expect((el as TestInput & { internals: ElementInternals }).internals).not.toBeNull()
  })

  describe('name', () => {
    it('returns empty string when no name attribute', () => {
      const tag = defineTestElement('val-fi-noname', TestInput)
      const el = document.createElement(tag) as TestInput
      expect(el.name).toBe('')
    })

    it('returns the name attribute value', () => {
      const tag = defineTestElement('val-fi-name', TestInput)
      const el = document.createElement(tag) as TestInput
      el.setAttribute('name', 'email')
      expect(el.name).toBe('email')
    })
  })

  describe('value', () => {
    it('gets and sets value', () => {
      const tag = defineTestElement('val-fi-val', TestInput)
      const el = document.createElement(tag) as TestInput
      el.value = 'hello'
      expect(el.value).toBe('hello')
    })
  })

  describe('validation', () => {
    it('starts valid', () => {
      const tag = defineTestElement('val-fi-valid', TestInput)
      const el = document.createElement(tag) as TestInput
      expect(el.checkValidity()).toBe(true)
      expect(el.validity.valid).toBe(true)
    })

    it('setValidity sets custom error', () => {
      const tag = defineTestElement('val-fi-invalid', TestInput)
      const el = document.createElement(tag) as TestInput

      // Access protected method via type assertion
      ;(el as TestInput & { setValidity: (f: ValidityStateFlags, m: string) => void })
        .setValidity({ customError: true }, 'Required field')

      expect(el.checkValidity()).toBe(false)
      expect(el.validity.valid).toBe(false)
      expect(el.validationMessage).toBe('Required field')
    })

    it('clearValidity resets to valid', () => {
      const tag = defineTestElement('val-fi-clear', TestInput)
      const el = document.createElement(tag) as TestInput

      ;(el as TestInput & { setValidity: (f: ValidityStateFlags, m: string) => void })
        .setValidity({ customError: true }, 'Error')
      ;(el as TestInput & { clearValidity: () => void }).clearValidity()

      expect(el.checkValidity()).toBe(true)
      expect(el.validationMessage).toBe('')
    })

    it('reportValidity returns validity state', () => {
      const tag = defineTestElement('val-fi-report', TestInput)
      const el = document.createElement(tag) as TestInput
      expect(el.reportValidity()).toBe(true)
    })
  })

  describe('form lifecycle callbacks', () => {
    it('formResetCallback exists and is callable', () => {
      const tag = defineTestElement('val-fi-reset', TestInput)
      const el = document.createElement(tag) as TestInput
      expect(() => el.formResetCallback()).not.toThrow()
    })

    it('formDisabledCallback exists and is callable', () => {
      const tag = defineTestElement('val-fi-dis', TestInput)
      const el = document.createElement(tag) as TestInput
      expect(() => el.formDisabledCallback(true)).not.toThrow()
    })
  })

  describe('inherits ValElement pillars', () => {
    it('emits val:interaction events', () => {
      const tag = defineTestElement('val-fi-emit', TestInput)
      const el = document.createElement(tag) as TestInput
      container.appendChild(el)

      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      ;(el as TestInput & { emitInteraction: (a: string) => void }).emitInteraction('focus')
      expect(listener).toHaveBeenCalledOnce()
    })

    it('reads data-cms-id', () => {
      const tag = defineTestElement('val-fi-cms', TestInput)
      const el = document.createElement(tag) as TestInput
      el.setAttribute('data-cms-id', 'contact-email')
      expect(el.cmsId).toBe('contact-email')
    })
  })
})
