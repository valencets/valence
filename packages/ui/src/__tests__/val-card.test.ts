import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValCard } from '../components/val-card.js'
import { defineTestElement } from './test-helpers.js'

describe('ValCard', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValCard> {
    const tag = defineTestElement('val-card', ValCard)
    const el = document.createElement(tag) as InstanceType<typeof ValCard>
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

    it('sets display: block', () => {
      const el = create()
      expect(el.style.display).toBe('block')
    })
  })

  describe('styling', () => {
    it('has elevated background', () => {
      const el = create()
      expect(el.style.background).toBe('var(--val-color-bg-elevated)')
    })

    it('has border', () => {
      const el = create()
      expect(el.style.borderWidth).toBe('1px')
      expect(el.style.borderStyle).toBe('solid')
      expect(el.style.borderColor).toBe('var(--val-color-border)')
    })

    it('has border-radius', () => {
      const el = create()
      expect(el.style.borderRadius).toBe('var(--val-radius-lg)')
    })

    it('has shadow', () => {
      const el = create()
      expect(el.style.boxShadow).toBe('var(--val-shadow-sm)')
    })

    it('has padding', () => {
      const el = create()
      expect(el.style.padding).toBe('var(--val-space-4)')
    })
  })

  describe('padding attribute', () => {
    it('overrides default padding with token', () => {
      const el = create({ padding: '6' })
      expect(el.style.padding).toBe('var(--val-space-6)')
    })

    it('accepts CSS value', () => {
      const el = create({ padding: '2rem' })
      expect(el.style.padding).toBe('2rem')
    })

    it('responds to attribute change', () => {
      const el = create()
      el.setAttribute('padding', '8')
      expect(el.style.padding).toBe('var(--val-space-8)')
    })
  })

  describe('variant', () => {
    it('removes shadow with flat variant', () => {
      const el = create({ variant: 'flat' })
      expect(el.style.boxShadow).toBe('none')
    })

    it('uses muted background with muted variant', () => {
      const el = create({ variant: 'muted' })
      expect(el.style.background).toBe('var(--val-color-bg-muted)')
      expect(el.style.boxShadow).toBe('none')
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
      const el = create({ 'data-cms-id': 'feature-card' })
      expect(el.cmsId).toBe('feature-card')
    })
  })
})
