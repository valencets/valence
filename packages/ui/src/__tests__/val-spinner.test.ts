import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ValSpinner } from '../components/val-spinner.js'
import { defineTestElement } from './test-helpers.js'

describe('ValSpinner', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValSpinner> {
    const tag = defineTestElement('val-spinner', ValSpinner)
    const el = document.createElement(tag) as InstanceType<typeof ValSpinner>
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

    it('renders an SVG spinner', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('svg')).not.toBeNull()
    })
  })

  describe('ARIA', () => {
    it('has role=status', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('[role="status"]')).not.toBeNull()
    })

    it('has aria-label', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('[aria-label]')).not.toBeNull()
    })

    it('accepts custom label', () => {
      const el = create({ label: 'Saving...' })
      expect(el.shadowRoot!.querySelector('[aria-label="Saving..."]')).not.toBeNull()
    })
  })

  describe('size', () => {
    it('defaults to 1.5rem', () => {
      const el = create()
      const svg = el.shadowRoot!.querySelector('svg')!
      expect(svg.style.width).toBe('1.5rem')
      expect(svg.style.height).toBe('1.5rem')
    })

    it('accepts sm size', () => {
      const el = create({ size: 'sm' })
      const svg = el.shadowRoot!.querySelector('svg')!
      expect(svg.style.width).toBe('1rem')
    })

    it('accepts lg size', () => {
      const el = create({ size: 'lg' })
      const svg = el.shadowRoot!.querySelector('svg')!
      expect(svg.style.width).toBe('2.5rem')
    })

    it('responds to size attribute change', () => {
      const el = create()
      el.setAttribute('size', 'lg')
      const svg = el.shadowRoot!.querySelector('svg')!
      expect(svg.style.width).toBe('2.5rem')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'save-spinner' })
      expect(el.cmsId).toBe('save-spinner')
    })
  })
})
