import { describe, it, expect } from 'vitest'
import { studioTheme } from '../config/studio-theme.js'
import { TYPOGRAPHY } from '../config/studio-typography.js'
import { SPACING } from '../config/studio-spacing.js'
import { getResolvedTheme, getStudioCSS } from '../config/studio-css.js'

// WCAG 2.1 contrast ratio helpers
function parseHSL (hsl: string): [number, number, number] {
  const match = /hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\)/.exec(hsl)
  if (!match) return [0, 0, 0]
  return [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100]
}

function hslToLinearRGB (h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (h < 60) {
    r1 = c; g1 = x
  } else if (h < 120) {
    r1 = x; g1 = c
  } else if (h < 180) {
    g1 = c; b1 = x
  } else if (h < 240) {
    g1 = x; b1 = c
  } else if (h < 300) {
    r1 = x; b1 = c
  } else {
    r1 = c; b1 = x
  }
  return [r1 + m, g1 + m, b1 + m]
}

function sRGBtoLinear (c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance (r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b)
}

function contrastRatio (hsl1: string, hsl2: string): number {
  const [h1, s1, l1] = parseHSL(hsl1)
  const [h2, s2, l2] = parseHSL(hsl2)
  const lum1 = relativeLuminance(...hslToLinearRGB(h1, s1, l1))
  const lum2 = relativeLuminance(...hslToLinearRGB(h2, s2, l2))
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

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
  it('loads base theme data successfully', () => {
    // This will trigger the import in studio-css.js
    const resolved = getResolvedTheme()
    expect(resolved).toBeDefined()
    expect(resolved.colors).toBeDefined()
  })

  it('returns a full ThemeConfig', () => {
    const resolved = getResolvedTheme()
    expect(resolved.colors.dark.background).toContain('hsl')
    expect(resolved.colors.light.background).toContain('hsl')
    expect(resolved.fonts.sans).toContain('system-ui')
    expect(resolved.radius).toBe('0.375rem')
  })

  it('overrides base theme with studio values', () => {
    const resolved = getResolvedTheme()
    // Studio dark bg should be softer gunmetal (8-12% lightness range)
    expect(resolved.colors.dark.background).toBe('hsl(220, 13%, 9%)')
  })

  it('has body background lightness in comfortable range', () => {
    const bg = studioTheme.colors?.dark?.background ?? ''
    const lightnessMatch = /(\d+)%\)/.exec(bg)
    const lightness = lightnessMatch ? Number(lightnessMatch[1]) : 0
    expect(lightness).toBeGreaterThanOrEqual(8)
    expect(lightness).toBeLessThanOrEqual(12)
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

  it('nav-inner has overflow-x auto for mobile scroll', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.nav-inner\s*\{[^}]*overflow-x:\s*auto/)
  })

  it('nav-brand has flex-shrink 0 to prevent squishing', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.nav-brand\s*\{[^}]*flex-shrink:\s*0/)
  })

  it('nav links have white-space nowrap to prevent wrapping', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/nav a\s*\{[^}]*white-space:\s*nowrap/)
  })

  it('contains grid system', () => {
    const css = getStudioCSS()
    expect(css).toContain('.grid-2')
    expect(css).toContain('.grid-3')
    expect(css).toContain('.grid-4')
  })

  it('contains hero eyebrow and stats styles', () => {
    const css = getStudioCSS()
    expect(css).toContain('.hero-eyebrow')
    expect(css).toContain('.hero-eyebrow .dot')
    expect(css).toContain('.hero-stats')
    expect(css).toContain('.hero-stat .val')
    expect(css).toContain('.hero-stat .lbl')
    expect(css).toContain('.val.green')
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

  it('sets viewport-filling flex layout on body', () => {
    const css = getStudioCSS()
    expect(css).toContain('min-height: 100vh')
    expect(css).toContain('flex-direction: column')
    expect(css).toMatch(/main\s*\{[^}]*flex:\s*1/)
  })

  it('contains spec-list and spec-row styles', () => {
    const css = getStudioCSS()
    expect(css).toContain('.spec-list')
    expect(css).toContain('.spec-row')
    expect(css).toMatch(/\.spec-row dt\s*\{/)
    expect(css).toMatch(/\.spec-row dd\s*\{/)
  })

  it('contains hero-ctas utility class', () => {
    const css = getStudioCSS()
    expect(css).toContain('.hero-ctas')
  })

  it('contains comparison and pain card styles', () => {
    const css = getStudioCSS()
    expect(css).toContain('.comp-table')
    expect(css).toContain('.comparison-accent')
    expect(css).toContain('.check')
    expect(css).toContain('.cross')
    expect(css).toContain('.warn')
    expect(css).toContain('.price-pain')
    expect(css).toContain('.price-good')
    expect(css).toContain('.pain-card')
    expect(css).toContain('.pain-card.ours')
    expect(css).toContain('.pain-grid')
  })

  it('contains cta-section utility class', () => {
    const css = getStudioCSS()
    expect(css).toContain('.cta-section')
  })

  it('contains contact-info styles', () => {
    const css = getStudioCSS()
    expect(css).toContain('.contact-info')
  })

  it('hero section uses min-height 90vh', () => {
    const css = getStudioCSS()
    expect(css).toContain('min-height: 90vh')
  })

  it('contains glass-box inspector styles', () => {
    const css = getStudioCSS()
    expect(css).toContain('.gb-row')
    expect(css).toContain('.gb-label')
    expect(css).toContain('.gb-value')
    expect(css).toContain('.gb-explainer')
  })
})

describe('mobile CSS: hamburger nav', () => {
  it('hides nav-links below 768px', () => {
    const css = getStudioCSS()
    expect(css).toContain('.nav-links')
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.nav-links\s*\{[^}]*display:\s*none/)
  })

  it('shows nav-hamburger below 768px', () => {
    const css = getStudioCSS()
    expect(css).toContain('.nav-hamburger')
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.nav-hamburger\s*\{[^}]*display:\s*flex/)
  })

  it('nav-links.open displays as vertical flex below 768px', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.nav-links\.open\s*\{[^}]*display:\s*flex/)
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.nav-links\.open\s*\{[^}]*flex-direction:\s*column/)
  })
})

describe('mobile CSS: contact form', () => {
  it('increases form input font-size to 16px on mobile to prevent iOS zoom', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.form-input[\s\S]*font-size:\s*16px/)
  })

  it('stacks contact-info vertically on mobile', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.contact-info\s*\{[^}]*flex-direction:\s*column/)
  })
})

describe('hero responsive text', () => {
  it('hero h1 uses clamp() for responsive sizing', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.hero h1\s*\{[^}]*clamp\(/)
  })
})

describe('mobile CSS: footer strip clearance', () => {
  it('footer has bottom padding to clear buffer strip', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/footer\s*\{[^}]*padding-bottom/)
  })
})

describe('a11y contrast compliance', () => {
  it('primary-foreground on primary meets WCAG AA 4.5:1 for dark mode', () => {
    const primary = studioTheme.colors?.dark?.primary ?? ''
    const fg = studioTheme.colors?.dark?.['primary-foreground'] ?? ''
    const ratio = contrastRatio(primary, fg)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('primary-foreground on primary meets WCAG AA 4.5:1 for light mode', () => {
    const primary = studioTheme.colors?.light?.primary ?? ''
    const fg = studioTheme.colors?.light?.['primary-foreground'] ?? ''
    const ratio = contrastRatio(primary, fg)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('footer link has text-decoration underline by default (not hover-only)', () => {
    const css = getStudioCSS()
    // The non-hover rule should set underline, not "none"
    expect(css).toMatch(/\.footer-hardware a\s*\{[^}]*text-decoration:\s*underline/)
  })
})

describe('mobile CSS: buffer strip hidden', () => {
  it('hides inertia-buffer-strip on mobile', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*inertia-buffer-strip\s*\{[^}]*display:\s*none/)
  })
})

describe('nav CTA button styles', () => {
  it('has nav-cta class with accent styling', () => {
    const css = getStudioCSS()
    expect(css).toContain('.nav-cta')
    expect(css).toMatch(/\.nav-cta\s*\{[^}]*background/)
  })
})

describe('mobile CSS: comparison tabs', () => {
  it('hides mobile-comparison on desktop (≥768px)', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.mobile-comparison\s*\{[^}]*display:\s*none/)
  })

  it('shows mobile-comparison on mobile (<768px)', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.mobile-comparison\s*\{[^}]*display:\s*block/)
  })

  it('hides desktop comp-table on mobile (<768px)', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.comp-table\s*\{[^}]*display:\s*none/)
  })

  it('styles mobile-tabs as segmented control', () => {
    const css = getStudioCSS()
    expect(css).toContain('.mobile-tabs')
    expect(css).toContain('.mobile-tab')
  })

  it('styles active tab with accent background', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.mobile-tab\.active\s*\{[^}]*background/)
  })

  it('hides inactive panels', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.mobile-panel\s*\{[^}]*display:\s*none/)
  })

  it('shows active panel', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.mobile-panel\.active\s*\{[^}]*display:\s*block/)
  })

  it('styles mobile-row with label and value', () => {
    const css = getStudioCSS()
    expect(css).toContain('.mobile-row')
    expect(css).toContain('.mobile-row-label')
    expect(css).toContain('.mobile-row-value')
  })

  it('mobile-comparison has bottom margin for spacing from next element', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.mobile-comparison\s*\{[^}]*margin-bottom/)
  })

  it('mobile-tabs has sticky positioning within section', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/\.mobile-tabs\s*\{[^}]*position:\s*sticky/)
  })
})

describe('mobile CSS: contact form improvements', () => {
  it('form has full-width inputs on mobile', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.form-input[\s\S]*width:\s*100%/)
  })

  it('form submit button is full-width on mobile', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*form .btn-primary[\s\S]*width:\s*100%/)
  })

  it('form group has no horizontal padding on mobile', () => {
    const css = getStudioCSS()
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*\.form-group[\s\S]*padding/)
  })
})
