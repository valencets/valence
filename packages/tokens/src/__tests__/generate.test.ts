import { describe, it, expect } from 'vitest'
import { generateCSS } from '../generate.js'
import type { ThemeConfig } from '../token-types.js'

function makeTheme (): ThemeConfig {
  const lightColors = {
    background: 'oklch(0.9940 0 0)',
    foreground: 'oklch(0 0 0)',
    card: 'oklch(0.9940 0 0)',
    'card-foreground': 'oklch(0 0 0)',
    popover: 'oklch(0.9911 0 0)',
    'popover-foreground': 'oklch(0 0 0)',
    primary: 'oklch(0.6174 0.1790 319.1846)',
    'primary-foreground': 'oklch(1.0000 0 0)',
    secondary: 'oklch(0.9125 0.0095 292.7840)',
    'secondary-foreground': 'oklch(0.1344 0 0)',
    muted: 'oklch(0.9702 0 0)',
    'muted-foreground': 'oklch(0.4386 0 0)',
    accent: 'oklch(0.8914 0.0371 294.1299)',
    'accent-foreground': 'oklch(0.4664 0.1401 284.0820)',
    destructive: 'oklch(0.6794 0.0756 62.5722)',
    'destructive-foreground': 'oklch(1.0000 0 0)',
    border: 'oklch(0.8986 0.0087 308.3529)',
    input: 'oklch(0.9401 0 0)',
    ring: 'oklch(0 0 0)',
    overlay: 'oklch(0 0 0 / 0.5)',
    'chart-1': 'oklch(0.6710 0.0676 193.1683)',
    'chart-2': 'oklch(0.6174 0.1790 319.1846)',
    'chart-3': 'oklch(0.7800 0.1250 103.7675)',
    'chart-4': 'oklch(0.5082 0.1439 285.3977)',
    'chart-5': 'oklch(0.5590 0 0)',
    sidebar: 'oklch(0.9306 0.0121 286.1626)',
    'sidebar-foreground': 'oklch(0 0 0)',
    'sidebar-primary': 'oklch(0 0 0)',
    'sidebar-primary-foreground': 'oklch(1.0000 0 0)',
    'sidebar-accent': 'oklch(0.9401 0 0)',
    'sidebar-accent-foreground': 'oklch(0 0 0)',
    'sidebar-border': 'oklch(0.9401 0 0)',
    'sidebar-ring': 'oklch(0 0 0)'
  } as ThemeConfig['colors']['light']

  const darkColors = {
    background: 'oklch(0.2186 0.0039 286.0760)',
    foreground: 'oklch(0.9551 0 0)',
    card: 'oklch(0.2501 0.0058 301.1218)',
    'card-foreground': 'oklch(0.9551 0 0)',
    popover: 'oklch(0.2501 0.0058 301.1218)',
    'popover-foreground': 'oklch(0.9551 0 0)',
    primary: 'oklch(0.6805 0.1483 318.9453)',
    'primary-foreground': 'oklch(1.0000 0 0)',
    secondary: 'oklch(0.2876 0.0073 297.3717)',
    'secondary-foreground': 'oklch(0.9551 0 0)',
    muted: 'oklch(0.2876 0.0073 297.3717)',
    'muted-foreground': 'oklch(0.7058 0 0)',
    accent: 'oklch(0.2647 0.0260 291.0590)',
    'accent-foreground': 'oklch(0.6773 0.1087 281.2976)',
    destructive: 'oklch(0.7662 0.0670 65.7909)',
    'destructive-foreground': 'oklch(1.0000 0 0)',
    border: 'oklch(0.3193 0.0054 301.2196)',
    input: 'oklch(0.3193 0.0054 301.2196)',
    ring: 'oklch(0.6805 0.1483 318.9453)',
    overlay: 'oklch(0 0 0 / 0.5)',
    'chart-1': 'oklch(0.7161 0.0801 184.1089)',
    'chart-2': 'oklch(0.6805 0.1483 318.9453)',
    'chart-3': 'oklch(0.8424 0.0476 67.1048)',
    'chart-4': 'oklch(0.6052 0.1267 287.3742)',
    'chart-5': 'oklch(0.7058 0 0)',
    sidebar: 'oklch(0.2150 0.0025 325.6623)',
    'sidebar-foreground': 'oklch(0.9551 0 0)',
    'sidebar-primary': 'oklch(0.6805 0.1483 318.9453)',
    'sidebar-primary-foreground': 'oklch(1.0000 0 0)',
    'sidebar-accent': 'oklch(0.2876 0.0073 297.3717)',
    'sidebar-accent-foreground': 'oklch(0.6805 0.1483 318.9453)',
    'sidebar-border': 'oklch(0.3193 0.0054 301.2196)',
    'sidebar-ring': 'oklch(0.6805 0.1483 318.9453)'
  } as ThemeConfig['colors']['dark']

  return {
    colors: { light: lightColors, dark: darkColors },
    fonts: { sans: 'Plus Jakarta Sans, sans-serif', serif: 'Lora, serif', mono: 'IBM Plex Mono, monospace' },
    radius: '1.4rem',
    spacing: '0.27rem',
    shadows: {
      '2xs': '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.08)',
      xs: '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.08)',
      sm: '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.16), 0px 1px 2px -1px hsl(0 0% 10.1961% / 0.16)',
      DEFAULT: '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.16), 0px 1px 2px -1px hsl(0 0% 10.1961% / 0.16)',
      md: '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.16), 0px 2px 4px -1px hsl(0 0% 10.1961% / 0.16)',
      lg: '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.16), 0px 4px 6px -1px hsl(0 0% 10.1961% / 0.16)',
      xl: '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.16), 0px 8px 10px -1px hsl(0 0% 10.1961% / 0.16)',
      '2xl': '0px 2px 3px 0px hsl(0 0% 10.1961% / 0.40)'
    },
    tracking: '-0.025em'
  }
}

describe('generateCSS', () => {
  const css = generateCSS(makeTheme())

  it('produces @custom-variant dark directive', () => {
    expect(css).toContain('@custom-variant dark (&:is(.dark *));')
  })

  it('produces @theme inline with all color mappings', () => {
    expect(css).toContain('--color-background: var(--background);')
    expect(css).toContain('--color-primary: var(--primary);')
    expect(css).toContain('--color-sidebar-ring: var(--sidebar-ring);')
    expect(css).toContain('--color-chart-1: var(--chart-1);')
    expect(css).toContain('--color-destructive-foreground: var(--destructive-foreground);')
  })

  it('produces @theme inline font mappings', () => {
    expect(css).toContain('--font-sans: var(--font-sans);')
    expect(css).toContain('--font-mono: var(--font-mono);')
    expect(css).toContain('--font-serif: var(--font-serif);')
  })

  it('produces @theme inline radius derivations with calc()', () => {
    expect(css).toContain('--radius-sm: calc(var(--radius) - 4px);')
    expect(css).toContain('--radius-md: calc(var(--radius) - 2px);')
    expect(css).toContain('--radius-lg: var(--radius);')
    expect(css).toContain('--radius-xl: calc(var(--radius) + 4px);')
  })

  it('produces @theme inline shadow mappings', () => {
    expect(css).toContain('--shadow-2xs: var(--shadow-2xs);')
    expect(css).toContain('--shadow: var(--shadow);')
    expect(css).toContain('--shadow-2xl: var(--shadow-2xl);')
  })

  it('produces @theme inline tracking derivations with calc()', () => {
    expect(css).toContain('--tracking-tighter: calc(var(--tracking-normal) - 0.05em);')
    expect(css).toContain('--tracking-tight: calc(var(--tracking-normal) - 0.025em);')
    expect(css).toContain('--tracking-normal: var(--tracking-normal);')
    expect(css).toContain('--tracking-wide: calc(var(--tracking-normal) + 0.025em);')
    expect(css).toContain('--tracking-wider: calc(var(--tracking-normal) + 0.05em);')
    expect(css).toContain('--tracking-widest: calc(var(--tracking-normal) + 0.1em);')
  })

  it('produces :root with light mode values', () => {
    expect(css).toContain(':root {')
    expect(css).toContain('--background: oklch(0.9940 0 0);')
    expect(css).toContain('--primary: oklch(0.6174 0.1790 319.1846);')
  })

  it('produces .dark with dark mode values', () => {
    expect(css).toContain('.dark {')
    expect(css).toContain('--background: oklch(0.2186 0.0039 286.0760);')
    expect(css).toContain('--primary: oklch(0.6805 0.1483 318.9453);')
  })

  it('produces body letter-spacing rule', () => {
    expect(css).toContain('body {\n  letter-spacing: var(--tracking-normal);\n}')
  })

  it('produces @layer base defaults', () => {
    expect(css).toContain('@layer base {')
    expect(css).toContain('@apply border-border outline-ring/50;')
    expect(css).toContain('@apply bg-background text-foreground;')
  })

  it('font values render correctly in :root', () => {
    expect(css).toContain('--font-sans: Plus Jakarta Sans, sans-serif;')
    expect(css).toContain('--font-serif: Lora, serif;')
    expect(css).toContain('--font-mono: IBM Plex Mono, monospace;')
  })

  it('full round-trip contains expected tokens', () => {
    // Verify the overall structure order: @custom-variant → @theme inline → :root → .dark → body → @layer base
    const customVariantIdx = css.indexOf('@custom-variant dark')
    const themeInlineIdx = css.indexOf('@theme inline')
    const rootIdx = css.indexOf(':root {')
    const darkIdx = css.indexOf('.dark {')
    const bodyIdx = css.indexOf('body {')
    const layerIdx = css.indexOf('@layer base')

    expect(customVariantIdx).toBeLessThan(themeInlineIdx)
    expect(themeInlineIdx).toBeLessThan(rootIdx)
    expect(rootIdx).toBeLessThan(darkIdx)
    expect(darkIdx).toBeLessThan(bodyIdx)
    expect(bodyIdx).toBeLessThan(layerIdx)
  })
})
