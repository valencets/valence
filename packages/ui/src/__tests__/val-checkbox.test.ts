import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValCheckbox } from '../components/val-checkbox.js'
import { defineTestElement } from './test-helpers.js'

describe('ValCheckbox', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValCheckbox> {
    const tag = defineTestElement('val-checkbox', ValCheckbox)
    const el = document.createElement(tag) as InstanceType<typeof ValCheckbox>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  function box (el: InstanceType<typeof ValCheckbox>): HTMLElement {
    return el.shadowRoot!.querySelector('.box')!
  }

  describe('DOM structure', () => {
    it('renders a checkbox box and label slot', () => {
      const el = create()
      expect(box(el)).not.toBeNull()
      expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    })
  })

  describe('ARIA', () => {
    it('has role=checkbox', () => {
      const el = create()
      expect(box(el).getAttribute('role')).toBe('checkbox')
    })

    it('defaults to aria-checked=false', () => {
      const el = create()
      expect(box(el).getAttribute('aria-checked')).toBe('false')
    })

    it('reflects checked as aria-checked=true', () => {
      const el = create({ checked: '' })
      expect(box(el).getAttribute('aria-checked')).toBe('true')
    })

    it('reflects indeterminate as aria-checked=mixed', () => {
      const el = create({ indeterminate: '' })
      expect(box(el).getAttribute('aria-checked')).toBe('mixed')
    })
  })

  describe('checked state', () => {
    it('toggles on click', () => {
      const el = create()
      el.click()
      expect(box(el).getAttribute('aria-checked')).toBe('true')
      el.click()
      expect(box(el).getAttribute('aria-checked')).toBe('false')
    })

    it('toggles on Space key', () => {
      const el = create()
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      expect(box(el).getAttribute('aria-checked')).toBe('true')
    })

    it('toggles on Enter key', () => {
      const el = create()
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(box(el).getAttribute('aria-checked')).toBe('true')
    })

    it('does not toggle when disabled', () => {
      const el = create({ disabled: '' })
      el.click()
      expect(box(el).getAttribute('aria-checked')).toBe('false')
    })

    it('clears indeterminate on toggle', () => {
      const el = create({ indeterminate: '' })
      el.click()
      expect(box(el).getAttribute('aria-checked')).toBe('true')
    })
  })

  describe('value', () => {
    it('returns empty when unchecked', () => {
      const el = create()
      expect(el.value).toBe('')
    })

    it('returns "on" when checked with no value attr', () => {
      const el = create({ checked: '' })
      expect(el.value).toBe('on')
    })

    it('returns value attr when checked', () => {
      const el = create({ checked: '', value: 'yes' })
      expect(el.value).toBe('yes')
    })
  })

  describe('form', () => {
    it('has static formAssociated = true', () => {
      expect(ValCheckbox.formAssociated).toBe(true)
    })

    it('resets on formResetCallback', () => {
      const el = create({ checked: '' })
      el.click() // now unchecked
      el.click() // now checked again
      el.formResetCallback()
      expect(box(el).getAttribute('aria-checked')).toBe('false')
    })
  })

  describe('telemetry', () => {
    it('emits val:interaction on change', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.click()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('change')
      expect(detail.checked).toBe(true)
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'terms-agree' })
      expect(el.cmsId).toBe('terms-agree')
    })
  })
})
