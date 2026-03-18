import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValNav } from '../components/val-nav.js'
import { defineTestElement } from './test-helpers.js'

describe('ValNav', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValNav> {
    const tag = defineTestElement('val-nav', ValNav)
    const el = document.createElement(tag) as InstanceType<typeof ValNav>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('is light DOM', () => {
      const el = create()
      expect(el.shadowRoot).toBeNull()
    })

    it('has role=navigation', () => {
      const el = create()
      expect(el.getAttribute('role')).toBe('navigation')
    })

    it('sets display: flex', () => {
      const el = create()
      expect(el.style.display).toBe('flex')
    })
  })

  describe('direction', () => {
    it('defaults to row', () => {
      const el = create()
      expect(el.style.flexDirection).toBe('row')
    })

    it('accepts vertical direction', () => {
      const el = create({ direction: 'vertical' })
      expect(el.style.flexDirection).toBe('column')
    })

    it('responds to attribute change', () => {
      const el = create()
      el.setAttribute('direction', 'vertical')
      expect(el.style.flexDirection).toBe('column')
    })
  })

  describe('aria-label', () => {
    it('accepts aria-label for landmark distinction', () => {
      const el = create({ 'aria-label': 'Main navigation' })
      expect(el.getAttribute('aria-label')).toBe('Main navigation')
    })
  })

  describe('telemetry', () => {
    it('emits val:interaction on child link click', () => {
      const el = create()
      const link = document.createElement('a')
      link.href = '/about'
      link.textContent = 'About'
      el.appendChild(link)

      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      link.click()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('navigate')
      expect(detail.href).toBe('/about')
    })

    it('does not emit for non-link clicks', () => {
      const el = create()
      const span = document.createElement('span')
      el.appendChild(span)

      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      span.click()

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'main-nav' })
      expect(el.cmsId).toBe('main-nav')
    })
  })
})
