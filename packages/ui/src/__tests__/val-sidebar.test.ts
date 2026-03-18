import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValSidebar } from '../components/val-sidebar.js'
import { defineTestElement } from './test-helpers.js'

describe('ValSidebar', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValSidebar> {
    const tag = defineTestElement('val-sidebar', ValSidebar)
    const el = document.createElement(tag) as InstanceType<typeof ValSidebar>
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

    it('has nav with role=navigation', () => {
      const el = create()
      const nav = el.shadowRoot!.querySelector('nav')
      expect(nav).not.toBeNull()
      expect(nav!.getAttribute('role')).toBe('navigation')
    })

    it('has a toggle button', () => {
      const el = create()
      const btn = el.shadowRoot!.querySelector('button')
      expect(btn).not.toBeNull()
      expect(btn!.getAttribute('aria-label')).toBe('Toggle sidebar')
    })

    it('has a slot for content', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('slot')).not.toBeNull()
    })
  })

  describe('collapsed state', () => {
    it('defaults to expanded', () => {
      const el = create()
      expect(el.hasAttribute('collapsed')).toBe(false)
      expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('true')
    })

    it('starts collapsed when attribute set', () => {
      const el = create({ collapsed: '' })
      expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('false')
    })

    it('toggles on button click', () => {
      const el = create()
      el.shadowRoot!.querySelector('button')!.click()
      expect(el.hasAttribute('collapsed')).toBe(true)
      expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('false')

      el.shadowRoot!.querySelector('button')!.click()
      expect(el.hasAttribute('collapsed')).toBe(false)
      expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('true')
    })

    it('responds to collapsed attribute change', () => {
      const el = create()
      el.setAttribute('collapsed', '')
      expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('false')
    })
  })

  describe('width', () => {
    it('defaults to 16rem', () => {
      const el = create()
      const nav = el.shadowRoot!.querySelector('nav')!
      expect(nav.style.width).toBe('16rem')
    })

    it('accepts custom width', () => {
      const el = create({ width: '20rem' })
      const nav = el.shadowRoot!.querySelector('nav')!
      expect(nav.style.width).toBe('20rem')
    })
  })

  describe('telemetry', () => {
    it('emits val:interaction on toggle', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.shadowRoot!.querySelector('button')!.click()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('toggle')
      expect(detail.collapsed).toBe(true)
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'admin-sidebar' })
      expect(el.cmsId).toBe('admin-sidebar')
    })
  })
})
