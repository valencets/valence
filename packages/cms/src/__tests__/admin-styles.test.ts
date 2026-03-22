import { describe, it, expect } from 'vitest'
import { ADMIN_THEME_CSS, getAdminStyles } from '../admin/admin-styles.js'

describe('admin-styles (Kinetic Monolith)', () => {
  describe('getAdminStyles', () => {
    it('returns the ADMIN_THEME_CSS string', () => {
      expect(getAdminStyles()).toBe(ADMIN_THEME_CSS)
    })
  })

  describe('KM surface tokens (single source in critical CSS)', () => {
    it('does NOT define token values (defined once in km-critical.css)', () => {
      expect(ADMIN_THEME_CSS).not.toContain('--km-surface:')
      expect(ADMIN_THEME_CSS).not.toContain('--km-on-surface:')
    })

    it('references KM token vars in component styles', () => {
      expect(ADMIN_THEME_CSS).toContain('var(--km-surface')
      expect(ADMIN_THEME_CSS).toContain('var(--km-on-surface')
    })

    it('declares Manrope and Inter @font-face', () => {
      expect(ADMIN_THEME_CSS).toContain('Manrope')
      expect(ADMIN_THEME_CSS).toContain('Inter')
    })
  })

  describe('val-button gradient override', () => {
    it('overrides val-button primary color via custom property', () => {
      expect(ADMIN_THEME_CSS).toContain('val-button.km-gradient-btn')
    })

    it('overrides val-button typography and spacing tokens', () => {
      expect(ADMIN_THEME_CSS).toMatch(/val-button\.km-gradient-btn\s*\{[^}]*--val-font-sans/)
      expect(ADMIN_THEME_CSS).toMatch(/val-button\.km-gradient-btn\s*\{[^}]*--val-weight-medium/)
    })

    it('does NOT set --val-color-primary in page CSS (belongs in token sheet)', () => {
      expect(ADMIN_THEME_CSS).not.toMatch(/val-button\.km-gradient-btn\s*\{[^}]*--val-color-primary/)
    })
  })

  describe('val-input overrides', () => {
    it('does NOT contain val-input token overrides (belongs in token sheet)', () => {
      expect(ADMIN_THEME_CSS).not.toMatch(/val-input\s*\{[^}]*--val-color-bg-elevated/)
    })
  })

  describe('KM components', () => {
    it('defines km-kinetic-bg background', () => {
      expect(ADMIN_THEME_CSS).toContain('.km-kinetic-bg')
    })

    it('defines km-card glassmorphism', () => {
      expect(ADMIN_THEME_CSS).toContain('.km-card')
      expect(ADMIN_THEME_CSS).toContain('backdrop-filter')
    })

    it('defines km-accent-line gradient', () => {
      expect(ADMIN_THEME_CSS).toContain('.km-accent-line')
    })

    it('defines km-error with left border', () => {
      expect(ADMIN_THEME_CSS).toContain('.km-error')
      expect(ADMIN_THEME_CSS).toContain('border-left')
    })

    it('defines km-status-dot with pulse animation', () => {
      expect(ADMIN_THEME_CSS).toContain('.km-status-dot')
      expect(ADMIN_THEME_CSS).toContain('km-pulse')
    })
  })
})
