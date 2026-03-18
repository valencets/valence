import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValForm } from '../components/val-form.js'
import { ValFormElement } from '../core/val-form-element.js'
import { defineTestElement } from './test-helpers.js'

// Minimal form field for testing
class MockField extends ValFormElement {
  private currentValue = ''

  get value (): string { return this.currentValue }
  set value (v: string) {
    this.currentValue = v
    this.setFormValue(v)
  }

  protected createTemplate (): HTMLTemplateElement {
    return document.createElement('template')
  }

  formResetCallback (): void {
    this.currentValue = ''
    this.setFormValue('')
  }
}

describe('ValForm', () => {
  let container: HTMLDivElement
  let fieldTag: string

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    fieldTag = defineTestElement('mock-field', MockField)
  })

  afterEach(() => {
    container.remove()
  })

  function create (children?: Array<{ name: string, value: string }>): InstanceType<typeof ValForm> {
    const tag = defineTestElement('val-form', ValForm)
    const el = document.createElement(tag) as InstanceType<typeof ValForm>
    if (children) {
      for (const { name, value } of children) {
        const field = document.createElement(fieldTag) as InstanceType<typeof MockField>
        field.setAttribute('name', name)
        container.appendChild(field) // connect first so template clones
        field.value = value
        field.remove()
        el.appendChild(field)
      }
    }
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('is light DOM (no shadow root)', () => {
      const el = create()
      expect(el.shadowRoot).toBeNull()
    })

    it('has role=form', () => {
      const el = create()
      expect(el.getAttribute('role')).toBe('form')
    })
  })

  describe('collectData', () => {
    it('collects name/value pairs from children', () => {
      const el = create([
        { name: 'first', value: 'Alice' },
        { name: 'last', value: 'Smith' }
      ])
      const data = el.collectData()
      expect(data).toEqual({ first: 'Alice', last: 'Smith' })
    })

    it('returns empty object when no children', () => {
      const el = create()
      expect(el.collectData()).toEqual({})
    })
  })

  describe('validate', () => {
    it('returns true when all children valid', () => {
      const el = create([{ name: 'name', value: 'test' }])
      expect(el.validate()).toBe(true)
    })
  })

  describe('submit', () => {
    it('emits val:submit with collected data', () => {
      const el = create([
        { name: 'email', value: 'a@b.com' }
      ])
      const listener = vi.fn()
      el.addEventListener('val:submit', listener)

      el.submit()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.data).toEqual({ email: 'a@b.com' })
    })

    it('emits val:interaction on submit', () => {
      const el = create([{ name: 'x', value: 'y' }])
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.submit()

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('submit')
    })

    it('does not submit when disabled', () => {
      const el = create([{ name: 'x', value: 'y' }])
      el.setAttribute('disabled', '')
      const listener = vi.fn()
      el.addEventListener('val:submit', listener)

      el.submit()

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('calls formResetCallback on children', () => {
      const el = create([
        { name: 'name', value: 'Alice' }
      ])
      const field = el.querySelector('[name="name"]') as InstanceType<typeof MockField>
      expect(field.value).toBe('Alice')

      el.reset()

      expect(field.value).toBe('')
    })

    it('emits val:interaction on reset', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.reset()

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('reset')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create()
      el.setAttribute('data-cms-id', 'contact-form')
      expect(el.cmsId).toBe('contact-form')
    })
  })
})
