import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValBadge } from '../components/val-badge.js'
import { defineTestElement } from './test-helpers.js'

describe('ValBadge', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValBadge> {
    const tag = defineTestElement('val-badge', ValBadge)
    const el = document.createElement(tag) as InstanceType<typeof ValBadge>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    el.textContent = 'Active'
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('is light DOM', () => {
      const el = create()
      expect(el.shadowRoot).toBeNull()
    })

    it('displays as inline-flex', () => {
      const el = create()
      expect(el.style.display).toBe('inline-flex')
    })

    it('has role=status', () => {
      const el = create()
      expect(el.getAttribute('role')).toBe('status')
    })
  })

  describe('styling', () => {
    it('has small font size', () => {
      const el = create()
      expect(el.style.fontSize).toBe('var(--val-text-xs)')
    })

    it('has rounded corners', () => {
      const el = create()
      expect(el.style.borderRadius).toBe('var(--val-radius-full)')
    })

    it('has padding', () => {
      const el = create()
      expect(el.style.paddingLeft).toBe('var(--val-space-2)')
    })
  })

  describe('variant', () => {
    it('defaults to neutral styling', () => {
      const el = create()
      expect(el.style.background).toBe('var(--val-color-bg-muted)')
      expect(el.style.color).toBe('var(--val-color-text)')
    })

    it('applies success variant', () => {
      const el = create({ variant: 'success' })
      expect(el.style.background).toContain('var(--val-green')
      expect(el.style.color).toContain('var(--val-green')
    })

    it('applies error variant', () => {
      const el = create({ variant: 'error' })
      expect(el.style.background).toContain('var(--val-red')
      expect(el.style.color).toContain('var(--val-red')
    })

    it('applies warning variant', () => {
      const el = create({ variant: 'warning' })
      expect(el.style.background).toContain('var(--val-amber')
      expect(el.style.color).toContain('var(--val-amber')
    })

    it('applies info variant', () => {
      const el = create({ variant: 'info' })
      expect(el.style.background).toContain('var(--val-blue')
      expect(el.style.color).toContain('var(--val-blue')
    })

    it('responds to variant attribute change', () => {
      const el = create()
      el.setAttribute('variant', 'error')
      expect(el.style.background).toContain('var(--val-red')
    })
  })

  describe('telemetry', () => {
    it('does not emit on its own', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)
      el.click()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'user-status' })
      expect(el.cmsId).toBe('user-status')
    })
  })
})
