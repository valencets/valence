import { describe, it, expect } from 'vitest'
import { getKmPageStyles, getKmTokenOverrides, getCriticalCss, getDeferredCss } from '../admin/km-theme.js'

describe('km-theme (Kinetic Monolith)', () => {
  describe('CSS files are pure CSS (no template literals)', () => {
    it('critical CSS contains KM surface palette values (single source)', () => {
      const css = getCriticalCss()
      expect(css).toContain('#131313')
      expect(css).toContain('#1c1b1b')
      expect(css).toContain('#e5e2e1')
    })

    it('token overrides contain oklch primary', () => {
      const css = getKmTokenOverrides()
      expect(css).toContain('oklch(0.90 0.19 159.5)')
    })

    it('no template literal artifacts in any CSS', () => {
      const all = [getKmPageStyles(), getKmTokenOverrides(), getCriticalCss(), getDeferredCss()]
      for (const css of all) {
        expect(css).not.toContain('${')
        expect(css).not.toContain('KM_PALETTE')
      }
    })
  })

  describe('getKmPageStyles', () => {
    const css = getKmPageStyles()

    it('returns a non-empty CSS string', () => {
      expect(css.length).toBeGreaterThan(0)
    })

    it('does NOT duplicate KM token definitions (single source in critical CSS)', () => {
      expect(css).not.toContain('--km-surface:')
      expect(css).not.toContain('--km-on-surface:')
    })

    it('includes kinetic background and card styles', () => {
      expect(css).toContain('.km-kinetic-bg')
      expect(css).toContain('.km-card')
    })

    it('does NOT contain ValElement token overrides', () => {
      expect(css).not.toContain('--val-color-primary')
      expect(css).not.toContain('--val-color-bg-elevated')
      expect(css).not.toContain('--val-color-border')
    })
  })

  describe('getKmTokenOverrides', () => {
    const css = getKmTokenOverrides()

    it('returns CSS with :host, :root selector', () => {
      expect(css).toMatch(/:host,\s*:root/)
    })

    it('sets --val-color-primary to a gradient', () => {
      expect(css).toMatch(/--val-color-primary:\s*linear-gradient/)
    })

    it('sets --val-color-border to match background', () => {
      expect(css).toContain('--val-color-border')
    })

    it('sets --val-color-bg-elevated for dark inputs', () => {
      expect(css).toContain('--val-color-bg-elevated')
    })

    it('does NOT contain page layout classes', () => {
      expect(css).not.toContain('.km-card')
      expect(css).not.toContain('.km-kinetic-bg')
    })
  })

  describe('getCriticalCss', () => {
    const css = getCriticalCss()

    it('is under 14KB', () => {
      expect(Buffer.byteLength(css)).toBeLessThan(14_000)
    })

    it('contains KM surface tokens', () => {
      expect(css).toContain('--km-surface')
      expect(css).toContain('--km-on-surface')
    })

    it('contains reset styles', () => {
      expect(css).toContain('box-sizing: border-box')
    })

    it('contains layout skeleton (sidebar + main)', () => {
      expect(css).toContain('.sidebar')
      expect(css).toContain('.main')
    })

    it('contains FOUC prevention', () => {
      expect(css).toContain(':not(:defined)')
    })

    it('does NOT contain form or editor styles', () => {
      expect(css).not.toContain('.form-field')
      expect(css).not.toContain('.richtext-toolbar')
      expect(css).not.toContain('.blocks-field')
    })
  })

  describe('getDeferredCss', () => {
    const css = getDeferredCss()

    it('contains component styles', () => {
      expect(css).toContain('.dashboard')
      expect(css).toContain('table')
    })

    it('contains form field styles', () => {
      expect(css).toContain('.form-field')
      expect(css).toContain('.form-input')
    })

    it('contains editor styles', () => {
      expect(css).toContain('.richtext-toolbar')
    })

    it('does NOT contain layout skeleton', () => {
      expect(css).not.toContain('.sidebar')
    })

    it('does NOT duplicate critical tokens', () => {
      expect(css).not.toContain('--km-surface:')
    })
  })
})
