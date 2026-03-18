import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValButton } from '../components/val-button.js'
import { defineTestElement, flushObservers } from './test-helpers.js'

describe('ValButton', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValButton> {
    const tag = defineTestElement('val-button', ValButton)
    const el = document.createElement(tag) as InstanceType<typeof ValButton>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('renders a button inside shadow DOM', () => {
      const el = create()
      const button = el.shadowRoot!.querySelector('button')
      expect(button).not.toBeNull()
      expect(button!.type).toBe('button')
    })

    it('projects slotted content', () => {
      const tag = defineTestElement('val-button', ValButton)
      const el = document.createElement(tag)
      el.textContent = 'Click me'
      container.appendChild(el)
      const slot = el.shadowRoot!.querySelector('slot')
      expect(slot).not.toBeNull()
    })
  })

  describe('attributes', () => {
    it('defaults to primary variant', () => {
      const el = create()
      expect(el.getAttribute('variant')).toBeNull()
      // Primary styling is the default (no variant attr needed)
    })

    it('syncs disabled to inner button', () => {
      const el = create({ disabled: '' })
      const button = el.shadowRoot!.querySelector('button')!
      expect(button.disabled).toBe(true)
      expect(button.getAttribute('aria-disabled')).toBe('true')
    })

    it('removes disabled from inner button when attribute removed', () => {
      const el = create({ disabled: '' })
      el.removeAttribute('disabled')
      const button = el.shadowRoot!.querySelector('button')!
      expect(button.disabled).toBe(false)
      expect(button.getAttribute('aria-disabled')).toBe('false')
    })

    it('sets aria-busy when loading', () => {
      const el = create({ loading: '' })
      const button = el.shadowRoot!.querySelector('button')!
      expect(button.getAttribute('aria-busy')).toBe('true')
    })
  })

  describe('ARIA', () => {
    it('inner button has implicit button role', () => {
      const el = create()
      const button = el.shadowRoot!.querySelector('button')!
      expect(button.tagName).toBe('BUTTON')
    })

    it('reflects disabled state as aria-disabled', () => {
      const el = create()
      const button = el.shadowRoot!.querySelector('button')!
      expect(button.getAttribute('aria-disabled')).toBe('false')
      el.setAttribute('disabled', '')
      expect(button.getAttribute('aria-disabled')).toBe('true')
    })
  })

  describe('telemetry', () => {
    it('emits val:interaction on click', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.shadowRoot!.querySelector('button')!.click()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('click')
    })

    it('does not emit when disabled', () => {
      const el = create({ disabled: '' })
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.shadowRoot!.querySelector('button')!.click()

      expect(listener).not.toHaveBeenCalled()
    })

    it('does not emit when loading', () => {
      const el = create({ loading: '' })
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.shadowRoot!.querySelector('button')!.click()

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'cta-hero' })
      expect(el.cmsId).toBe('cta-hero')
    })
  })

  describe('i18n', () => {
    it('responds to locale changes', async () => {
      const el = create()
      const spy = vi.spyOn(el, 'localeChanged')
      const original = document.documentElement.lang
      document.documentElement.lang = 'fr'
      await flushObservers()
      expect(spy).toHaveBeenCalledWith('fr')
      document.documentElement.lang = original
      el.remove()
    })
  })

  describe('lifecycle', () => {
    it('does not duplicate content on reconnect', () => {
      const el = create()
      const count = el.shadowRoot!.childNodes.length
      el.remove()
      container.appendChild(el)
      expect(el.shadowRoot!.childNodes.length).toBe(count)
    })
  })
})
