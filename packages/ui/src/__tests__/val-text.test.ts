import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValText } from '../components/val-text.js'
import { defineTestElement } from './test-helpers.js'

describe('ValText', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValText> {
    const tag = defineTestElement('val-text', ValText)
    const el = document.createElement(tag) as InstanceType<typeof ValText>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    el.textContent = 'Some text'
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('is light DOM', () => {
      const el = create()
      expect(el.shadowRoot).toBeNull()
    })

    it('displays as inline', () => {
      const el = create()
      expect(el.style.display).toBe('inline')
    })
  })

  describe('variant', () => {
    it('defaults to body styling', () => {
      const el = create()
      expect(el.style.fontSize).toBe('var(--val-text-base)')
      expect(el.style.lineHeight).toBe('var(--val-leading-normal)')
    })

    it('applies caption variant', () => {
      const el = create({ variant: 'caption' })
      expect(el.style.fontSize).toBe('var(--val-text-xs)')
      expect(el.style.color).toBe('var(--val-color-text-muted)')
    })

    it('applies label variant', () => {
      const el = create({ variant: 'label' })
      expect(el.style.fontSize).toBe('var(--val-text-sm)')
      expect(el.style.fontWeight).toBe('var(--val-weight-medium)')
    })

    it('applies code variant', () => {
      const el = create({ variant: 'code' })
      expect(el.style.fontFamily).toBe('var(--val-font-mono)')
      expect(el.style.fontSize).toBe('var(--val-text-sm)')
    })

    it('applies small variant', () => {
      const el = create({ variant: 'small' })
      expect(el.style.fontSize).toBe('var(--val-text-sm)')
    })

    it('applies large variant', () => {
      const el = create({ variant: 'large' })
      expect(el.style.fontSize).toBe('var(--val-text-lg)')
    })

    it('responds to variant attribute change', () => {
      const el = create()
      el.setAttribute('variant', 'caption')
      expect(el.style.fontSize).toBe('var(--val-text-xs)')
    })

    it('resets fontFamily when switching from code to body', () => {
      const el = create({ variant: 'code' })
      expect(el.style.fontFamily).toBe('var(--val-font-mono)')
      el.setAttribute('variant', 'body')
      expect(el.style.fontFamily).toBe('var(--val-font-sans)')
    })

    it('resets fontWeight when switching from label to body', () => {
      const el = create({ variant: 'label' })
      expect(el.style.fontWeight).toBe('var(--val-weight-medium)')
      el.setAttribute('variant', 'body')
      expect(el.style.fontWeight).toBe('')
    })
  })

  describe('muted', () => {
    it('sets muted color when present', () => {
      const el = create({ muted: '' })
      expect(el.style.color).toBe('var(--val-color-text-muted)')
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
      const el = create({ 'data-cms-id': 'hero-body' })
      expect(el.cmsId).toBe('hero-body')
    })
  })
})
