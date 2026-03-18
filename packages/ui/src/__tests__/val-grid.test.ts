import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValGrid } from '../components/val-grid.js'
import { defineTestElement } from './test-helpers.js'

describe('ValGrid', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValGrid> {
    const tag = defineTestElement('val-grid', ValGrid)
    const el = document.createElement(tag) as InstanceType<typeof ValGrid>
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

    it('sets display: grid on connect', () => {
      const el = create()
      expect(el.style.display).toBe('grid')
    })
  })

  describe('columns', () => {
    it('maps numeric columns to repeat()', () => {
      const el = create({ columns: '3' })
      expect(el.style.gridTemplateColumns).toBe('repeat(3, 1fr)')
    })

    it('passes CSS value through', () => {
      const el = create({ columns: '200px 1fr 1fr' })
      expect(el.style.gridTemplateColumns).toBe('200px 1fr 1fr')
    })

    it('responds to attribute change', () => {
      const el = create({ columns: '2' })
      el.setAttribute('columns', '4')
      expect(el.style.gridTemplateColumns).toBe('repeat(4, 1fr)')
    })
  })

  describe('rows', () => {
    it('sets grid-template-rows', () => {
      const el = create({ rows: 'auto 1fr auto' })
      expect(el.style.gridTemplateRows).toBe('auto 1fr auto')
    })
  })

  describe('gap', () => {
    it('maps numeric gap to spacing token', () => {
      const el = create({ gap: '4' })
      expect(el.style.gap).toBe('var(--val-space-4)')
    })

    it('passes CSS values through', () => {
      const el = create({ gap: '1rem 2rem' })
      expect(el.style.gap).toBe('1rem 2rem')
    })
  })

  describe('align', () => {
    it('sets align-items', () => {
      const el = create({ align: 'center' })
      expect(el.style.alignItems).toBe('center')
    })
  })

  describe('justify', () => {
    it('sets justify-items', () => {
      const el = create({ justify: 'stretch' })
      expect(el.style.justifyItems).toBe('stretch')
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
      const el = create({ 'data-cms-id': 'feature-grid' })
      expect(el.cmsId).toBe('feature-grid')
    })
  })
})
