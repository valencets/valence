import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValTextarea } from '../components/val-textarea.js'
import { defineTestElement } from './test-helpers.js'

describe('ValTextarea', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValTextarea> {
    const tag = defineTestElement('val-textarea', ValTextarea)
    const el = document.createElement(tag) as InstanceType<typeof ValTextarea>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  function inner (el: InstanceType<typeof ValTextarea>): HTMLTextAreaElement {
    return el.shadowRoot!.querySelector('textarea')!
  }

  describe('DOM structure', () => {
    it('renders a textarea inside shadow DOM', () => {
      const el = create()
      expect(inner(el)).not.toBeNull()
    })

    it('renders a label with named slot', () => {
      const el = create()
      const slot = el.shadowRoot!.querySelector('label slot')
      expect(slot).not.toBeNull()
      expect(slot!.getAttribute('name')).toBe('label')
    })
  })

  describe('attributes', () => {
    it('syncs placeholder', () => {
      const el = create({ placeholder: 'Type here' })
      expect(inner(el).placeholder).toBe('Type here')
    })

    it('syncs required', () => {
      const el = create({ required: '' })
      expect(inner(el).required).toBe(true)
    })

    it('syncs disabled', () => {
      const el = create({ disabled: '' })
      expect(inner(el).disabled).toBe(true)
    })

    it('syncs maxlength', () => {
      const el = create({ maxlength: '500' })
      expect(inner(el).getAttribute('maxlength')).toBe('500')
    })
  })

  describe('value', () => {
    it('gets and sets value', () => {
      const el = create()
      el.value = 'some text'
      expect(el.value).toBe('some text')
      expect(inner(el).value).toBe('some text')
    })

    it('initializes from value attribute', () => {
      const el = create({ value: 'initial' })
      expect(el.value).toBe('initial')
    })
  })

  describe('form association', () => {
    it('has static formAssociated = true', () => {
      expect(ValTextarea.formAssociated).toBe(true)
    })

    it('returns name from attribute', () => {
      const el = create({ name: 'bio' })
      expect(el.name).toBe('bio')
    })
  })

  describe('form lifecycle', () => {
    it('resets to default value', () => {
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

      inner(el).value = 'typed'
      inner(el).dispatchEvent(new Event('input', { bubbles: true }))

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('input')
    })

    it('emits val:interaction on change', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      inner(el).dispatchEvent(new Event('change', { bubbles: true }))

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('change')
    })
  })

  describe('autofill styling', () => {
    it('has autofill override styles in shadow DOM', () => {
      const el = create()
      const style = el.shadowRoot!.querySelector('style')!
      expect(style.textContent).toContain(':autofill')
      expect(style.textContent).toContain('--val-color-bg-elevated')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'comment-field' })
      expect(el.cmsId).toBe('comment-field')
    })
  })
})
