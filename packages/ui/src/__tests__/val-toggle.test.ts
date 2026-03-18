import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValToggle } from '../components/val-toggle.js'
import { defineTestElement } from './test-helpers.js'

describe('ValToggle', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValToggle> {
    const tag = defineTestElement('val-toggle', ValToggle)
    const el = document.createElement(tag) as InstanceType<typeof ValToggle>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  function track (el: InstanceType<typeof ValToggle>): HTMLElement {
    return el.shadowRoot!.querySelector('.track')!
  }

  describe('DOM structure', () => {
    it('renders a switch track and label', () => {
      const el = create()
      expect(track(el)).not.toBeNull()
      expect(el.shadowRoot!.querySelector('.thumb')).not.toBeNull()
      expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    })
  })

  describe('ARIA', () => {
    it('has role=switch', () => {
      const el = create()
      expect(track(el).getAttribute('role')).toBe('switch')
    })

    it('defaults to aria-checked=false', () => {
      const el = create()
      expect(track(el).getAttribute('aria-checked')).toBe('false')
    })

    it('reflects checked as aria-checked=true', () => {
      const el = create({ checked: '' })
      expect(track(el).getAttribute('aria-checked')).toBe('true')
    })
  })

  describe('toggle behavior', () => {
    it('toggles on click', () => {
      const el = create()
      el.click()
      expect(track(el).getAttribute('aria-checked')).toBe('true')
      el.click()
      expect(track(el).getAttribute('aria-checked')).toBe('false')
    })

    it('toggles on Space key', () => {
      const el = create()
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      expect(track(el).getAttribute('aria-checked')).toBe('true')
    })

    it('toggles on Enter key', () => {
      const el = create()
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(track(el).getAttribute('aria-checked')).toBe('true')
    })

    it('does not toggle when disabled', () => {
      const el = create({ disabled: '' })
      el.click()
      expect(track(el).getAttribute('aria-checked')).toBe('false')
    })
  })

  describe('value', () => {
    it('returns empty when off', () => {
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
      expect(ValToggle.formAssociated).toBe(true)
    })

    it('resets on formResetCallback', () => {
      const el = create({ checked: '' })
      el.formResetCallback()
      expect(track(el).getAttribute('aria-checked')).toBe('false')
    })

    it('disables on formDisabledCallback', () => {
      const el = create()
      el.formDisabledCallback(true)
      expect(track(el).getAttribute('tabindex')).toBe('-1')
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
      const el = create({ 'data-cms-id': 'dark-mode-toggle' })
      expect(el.cmsId).toBe('dark-mode-toggle')
    })
  })
})
