import type { ThemeConfig, ColorSet, ShadowSet } from './token-types.js'

// Static color token names — ordered to match Onyx tokens.css
const COLOR_TOKENS: ReadonlyArray<keyof ColorSet> = [
  'background', 'foreground',
  'card', 'card-foreground',
  'popover', 'popover-foreground',
  'primary', 'primary-foreground',
  'secondary', 'secondary-foreground',
  'muted', 'muted-foreground',
  'accent', 'accent-foreground',
  'destructive', 'destructive-foreground',
  'border', 'input', 'ring', 'overlay',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'sidebar', 'sidebar-foreground',
  'sidebar-primary', 'sidebar-primary-foreground',
  'sidebar-accent', 'sidebar-accent-foreground',
  'sidebar-border', 'sidebar-ring'
]

// Shadow token names mapped to CSS variable names
const SHADOW_TOKENS: ReadonlyArray<{ key: keyof ShadowSet; cssVar: string }> = [
  { key: '2xs', cssVar: 'shadow-2xs' },
  { key: 'xs', cssVar: 'shadow-xs' },
  { key: 'sm', cssVar: 'shadow-sm' },
  { key: 'DEFAULT', cssVar: 'shadow' },
  { key: 'md', cssVar: 'shadow-md' },
  { key: 'lg', cssVar: 'shadow-lg' },
  { key: 'xl', cssVar: 'shadow-xl' },
  { key: '2xl', cssVar: 'shadow-2xl' }
]

function generateThemeInline (): string {
  const lines: string[] = ['@theme inline {']

  // Color mappings
  for (const token of COLOR_TOKENS) {
    lines.push(`  --color-${token}: var(--${token});`)
  }

  lines.push('')

  // Font mappings
  lines.push('  --font-sans: var(--font-sans);')
  lines.push('  --font-mono: var(--font-mono);')
  lines.push('  --font-serif: var(--font-serif);')

  lines.push('')

  // Radius derivations
  lines.push('  --radius-sm: calc(var(--radius) - 4px);')
  lines.push('  --radius-md: calc(var(--radius) - 2px);')
  lines.push('  --radius-lg: var(--radius);')
  lines.push('  --radius-xl: calc(var(--radius) + 4px);')

  lines.push('')

  // Shadow mappings
  for (const { cssVar } of SHADOW_TOKENS) {
    lines.push(`  --${cssVar}: var(--${cssVar});`)
  }

  lines.push('')

  // Tracking derivations
  lines.push('  --tracking-tighter: calc(var(--tracking-normal) - 0.05em);')
  lines.push('  --tracking-tight: calc(var(--tracking-normal) - 0.025em);')
  lines.push('  --tracking-normal: var(--tracking-normal);')
  lines.push('  --tracking-wide: calc(var(--tracking-normal) + 0.025em);')
  lines.push('  --tracking-wider: calc(var(--tracking-normal) + 0.05em);')
  lines.push('  --tracking-widest: calc(var(--tracking-normal) + 0.1em);')

  lines.push('}')
  return lines.join('\n')
}

function generateColorBlock (colors: ColorSet): string[] {
  const lines: string[] = []
  for (const token of COLOR_TOKENS) {
    lines.push(`  --${token}: ${colors[token]};`)
  }
  return lines
}

function generateShadowBlock (shadows: ShadowSet): string[] {
  const lines: string[] = []
  for (const { key, cssVar } of SHADOW_TOKENS) {
    lines.push(`  --${cssVar}: ${shadows[key]};`)
  }
  return lines
}

function generateRootBlock (config: ThemeConfig): string {
  const lines: string[] = [':root {']

  lines.push(...generateColorBlock(config.colors.light))
  lines.push(`  --font-sans: ${config.fonts.sans};`)
  lines.push(`  --font-serif: ${config.fonts.serif};`)
  lines.push(`  --font-mono: ${config.fonts.mono};`)
  lines.push(`  --radius: ${config.radius};`)
  lines.push(...generateShadowBlock(config.shadows))
  lines.push(`  --tracking-normal: ${config.tracking};`)
  lines.push(`  --spacing: ${config.spacing};`)

  lines.push('}')
  return lines.join('\n')
}

function generateDarkBlock (config: ThemeConfig): string {
  const lines: string[] = ['.dark {']
  lines.push(...generateColorBlock(config.colors.dark))
  lines.push('}')
  return lines.join('\n')
}

const BODY_BLOCK = `body {
  letter-spacing: var(--tracking-normal);
}`

const LAYER_BASE_BLOCK = `@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`

export function generateCSS (config: ThemeConfig): string {
  const sections = [
    '@custom-variant dark (&:is(.dark *));',
    '',
    generateThemeInline(),
    '',
    generateRootBlock(config),
    '',
    generateDarkBlock(config),
    '',
    BODY_BLOCK,
    '',
    LAYER_BASE_BLOCK,
    ''
  ]

  return sections.join('\n')
}
