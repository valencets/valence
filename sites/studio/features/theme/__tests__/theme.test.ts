import { describe, it, expect } from 'vitest'
import { studioTheme } from '../config/studio-theme.js'
import { TYPOGRAPHY } from '../config/studio-typography.js'
import { SPACING } from '../config/studio-spacing.js'
import { getResolvedTheme, getStudioCSS } from '../config/studio-css.js'

describe('studioTheme', () => {
  it('has dark color palette with gunmetal tones', () => {
    expect(studioTheme.colors?.dark?.background).toContain('hsl')
    expect(studioTheme.colors?.dark?.primary).toContain('hsl')
    // Card background should have visible contrast with body bg (gunmetal, not near-black)
    // Body bg is ~6% lightness, card should be at least 12% for visible distinction
    const cardBg = studioTheme.colors?.dark?.card ?? ''
    const lightnessMatch = /(\d+)%\)/.exec(cardBg)
    const lightness = lightnessMatch ? Number(lightnessMatch[1]) : 0
    expect(lightness).toBeGreaterThanOrEqual(12)
  })

  it('has light color palette', () => {
    expect(studioTheme.colors?.light?.background).toContain('hsl')
  })

  it('has font stacks', () => {
    expect(studioTheme.fonts?.sans).toContain('system-ui')
    expect(studioTheme.fonts?.mono).toContain('Dank Mono')
    expect(studioTheme.fonts?.mono).toContain('monospace')
  })

  it('has radius and spacing', () => {
    expect(studioTheme.radius).toBe('0.375rem')
    expect(studioTheme.spacing).toBe('0.25rem')
  })
})

describe('TYPOGRAPHY', () => {
  it('has modular scale values', () => {
    expect(TYPOGRAPHY.scale.base).toBe('1rem')
    expect(TYPOGRAPHY.scale.lg).toBe('1.25rem')
  })

  it('limits body width to 65ch', () => {
    expect(TYPOGRAPHY.maxWidth).toBe('65ch')
  })

  it('has line heights', () => {
    expect(TYPOGRAPHY.lineHeight.body).toBe('1.65')
  })
})

describe('SPACING', () => {
  it('uses 4px base', () => {
    expect(SPACING.base).toBe('4px')
  })

  it('has 12-col grid', () => {
    expect(SPACING.grid.columns).toBe(12)
  })

  it('has 1120px max width', () => {
    expect(SPACING.grid.maxWidth).toBe('1120px')
  })
})

describe('getResolvedTheme', () => {
  it('returns a full ThemeConfig', () => {
    const resolved = getResolvedTheme()
    expect(resolved.colors.dark.background).toContain('hsl')
    expect(resolved.colors.light.background).toContain('hsl')
    expect(resolved.fonts.sans).toContain('system-ui')
    expect(resolved.radius).toBe('0.375rem')
  })

  it('overrides base theme with studio values', () => {
    const resolved = getResolvedTheme()
    // Studio dark bg is different from base
    expect(resolved.colors.dark.background).toBe('hsl(220, 13%, 6%)')
  })
})

describe('getStudioCSS', () => {
  it('returns non-empty CSS string', () => {
    const css = getStudioCSS()
    expect(css.length).toBeGreaterThan(100)
  })

  it('contains :root block', () => {
    const css = getStudioCSS()
    expect(css).toContain(':root')
  })

  it('contains .dark block', () => {
    const css = getStudioCSS()
    expect(css).toContain('.dark')
  })

  it('contains only browser-valid CSS (no Tailwind directives)', () => {
    const css = getStudioCSS()
    expect(css).not.toContain('@custom-variant')
    expect(css).not.toContain('@theme inline')
    expect(css).not.toContain('@apply')
    expect(css).not.toContain('@layer')
  })

  it('sets body background and foreground color', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--background\)/)
    expect(css).toMatch(/body\s*\{[^}]*color:\s*var\(--foreground\)/)
  })

  it('sets card text color for contrast', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.card\s*\{[^}]*color:\s*var\(--card-foreground\)/)
  })

  it('sets form input text color for contrast', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.form-input[^{]*\{[^}]*color:\s*var\(--foreground\)/)
  })

  it('contains studio layout utilities', () => {
    const css = getStudioCSS()
    expect(css).toContain('.container')
    expect(css).toContain('.hero')
    expect(css).toContain('.btn-primary')
    expect(css).toContain('.card')
  })

  it('contains form styles', () => {
    const css = getStudioCSS()
    expect(css).toContain('.form-input')
    expect(css).toContain('.form-textarea')
  })

  it('contains nav styles', () => {
    const css = getStudioCSS()
    expect(css).toContain('.nav-brand')
    expect(css).toContain('.nav-active')
  })

  it('contains grid system', () => {
    const css = getStudioCSS()
    expect(css).toContain('.grid-2')
    expect(css).toContain('.grid-3')
    expect(css).toContain('.grid-4')
  })

  it('contains Dank Mono font-face declarations', () => {
    const css = getStudioCSS()
    expect(css).toContain('@font-face')
    expect(css).toContain('Dank Mono')
    expect(css).toContain('DankMono-Regular.woff2')
    expect(css).toContain('DankMono-Bold.woff2')
    expect(css).toContain('DankMono-Italic.woff2')
    expect(css).toContain('font-display: swap')
  })
})
