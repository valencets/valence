import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValDialog } from '../components/val-dialog.js'
import { defineTestElement } from './test-helpers.js'

describe('ValDialog', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValDialog> {
    const tag = defineTestElement('val-dialog', ValDialog)
    const el = document.createElement(tag) as InstanceType<typeof ValDialog>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('uses shadow DOM', () => {
      const el = create()
      expect(el.shadowRoot).not.toBeNull()
    })

    it('has dialog role', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('[role="dialog"]')).not.toBeNull()
    })

    it('has aria-modal=true', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('[aria-modal="true"]')).not.toBeNull()
    })

    it('has backdrop overlay', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('.backdrop')).not.toBeNull()
    })

    it('has slot for content', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    })
  })

  describe('open/close', () => {
    it('is hidden by default', () => {
      const el = create()
      const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement
      expect(wrapper.style.display).toBe('none')
    })

    it('shows when open attribute set', () => {
      const el = create({ open: '' })
      const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement
      expect(wrapper.style.display).toBe('flex')
    })

    it('show() opens the dialog', () => {
      const el = create()
      el.show()
      expect(el.hasAttribute('open')).toBe(true)
      const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement
      expect(wrapper.style.display).toBe('flex')
    })

    it('close() closes the dialog', () => {
      const el = create({ open: '' })
      el.close()
      expect(el.hasAttribute('open')).toBe(false)
      const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement
      expect(wrapper.style.display).toBe('none')
    })

    it('responds to open attribute change', () => {
      const el = create()
      el.setAttribute('open', '')
      const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement
      expect(wrapper.style.display).toBe('flex')
    })
  })

  describe('Escape closes', () => {
    it('closes on Escape keydown', () => {
      const el = create({ open: '' })
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(el.hasAttribute('open')).toBe(false)
    })
  })

  describe('backdrop click closes', () => {
    it('closes when backdrop is clicked', () => {
      const el = create({ open: '' })
      const backdrop = el.shadowRoot!.querySelector('.backdrop') as HTMLElement
      backdrop.click()
      expect(el.hasAttribute('open')).toBe(false)
    })

    it('does not close when dialog content is clicked', () => {
      const el = create({ open: '' })
      const panel = el.shadowRoot!.querySelector('.panel') as HTMLElement
      panel.click()
      expect(el.hasAttribute('open')).toBe(true)
    })
  })

  describe('telemetry', () => {
    it('emits val:interaction on open', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.show()

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('open')
    })

    it('emits val:interaction on close', () => {
      const el = create({ open: '' })
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.close()

      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0]![0] as CustomEvent).detail.action).toBe('close')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'confirm-dialog' })
      expect(el.cmsId).toBe('confirm-dialog')
    })
  })
})
