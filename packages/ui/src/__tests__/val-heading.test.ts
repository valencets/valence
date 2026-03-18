import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValHeading } from '../components/val-heading.js'
import { defineTestElement } from './test-helpers.js'

describe('ValHeading', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValHeading> {
    const tag = defineTestElement('val-heading', ValHeading)
    const el = document.createElement(tag) as InstanceType<typeof ValHeading>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    el.textContent = 'Hello World'
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('is light DOM', () => {
      const el = create()
      expect(el.shadowRoot).toBeNull()
    })
  })

  describe('level', () => {
    it('defaults to level 2', () => {
      const el = create()
      expect(el.getAttribute('role')).toBe('heading')
      expect(el.getAttribute('aria-level')).toBe('2')
    })

    it('sets aria-level from level attribute', () => {
      const el = create({ level: '1' })
      expect(el.getAttribute('aria-level')).toBe('1')
    })

    it('applies font-size from level', () => {
      const el1 = create({ level: '1' })
      expect(el1.style.fontSize).toBe('var(--val-text-5xl)')
      const el3 = create({ level: '3' })
      expect(el3.style.fontSize).toBe('var(--val-text-2xl)')
    })

    it('responds to level attribute change', () => {
      const el = create({ level: '1' })
      el.setAttribute('level', '4')
      expect(el.getAttribute('aria-level')).toBe('4')
      expect(el.style.fontSize).toBe('var(--val-text-xl)')
    })
  })

  describe('styling', () => {
    it('sets font-weight to bold', () => {
      const el = create()
      expect(el.style.fontWeight).toBe('var(--val-weight-bold)')
    })

    it('sets font-family to sans', () => {
      const el = create()
      expect(el.style.fontFamily).toBe('var(--val-font-sans)')
    })

    it('sets line-height to tight', () => {
      const el = create()
      expect(el.style.lineHeight).toBe('var(--val-leading-tight)')
    })

    it('sets color to text', () => {
      const el = create()
      expect(el.style.color).toBe('var(--val-color-text)')
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
      const el = create({ 'data-cms-id': 'page-title' })
      expect(el.cmsId).toBe('page-title')
    })
  })
})
