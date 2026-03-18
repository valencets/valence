// @valencets/ui Tailwind preset — maps design tokens to Tailwind theme utilities.
// Usage: import { valencePreset } from '@valencets/ui/tailwind'
// Then: export default { presets: [valencePreset], content: [...] }

function scale (prefix: string, steps: ReadonlyArray<number | string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const step of steps) {
    out[String(step)] = `var(--val-${prefix}-${step})`
  }
  return out
}

const colorSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
const graySteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
const spaceSteps = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const

export const valencePreset = {
  theme: {
    extend: {
      colors: {
        val: {
          bg: 'var(--val-color-bg)',
          'bg-elevated': 'var(--val-color-bg-elevated)',
          'bg-muted': 'var(--val-color-bg-muted)',
          text: 'var(--val-color-text)',
          'text-muted': 'var(--val-color-text-muted)',
          primary: 'var(--val-color-primary)',
          'primary-hover': 'var(--val-color-primary-hover)',
          error: 'var(--val-color-error)',
          success: 'var(--val-color-success)',
          warning: 'var(--val-color-warning)',
          'text-inverted': 'var(--val-color-text-inverted)',
          'primary-text': 'var(--val-color-primary-text)',
          border: 'var(--val-color-border)',
          'border-focus': 'var(--val-color-border-focus)',
        },
        'val-gray': scale('gray', graySteps),
        'val-blue': scale('blue', colorSteps),
        'val-red': scale('red', colorSteps),
        'val-green': scale('green', colorSteps),
        'val-amber': scale('amber', colorSteps),
      },
      spacing: Object.fromEntries(
        spaceSteps.map(s => [`val-${s}`, `var(--val-space-${s})`])
      ),
      borderRadius: {
        'val-sm': 'var(--val-radius-sm)',
        'val-md': 'var(--val-radius-md)',
        'val-lg': 'var(--val-radius-lg)',
        'val-full': 'var(--val-radius-full)',
      },
      fontSize: {
        'val-xs': 'var(--val-text-xs)',
        'val-sm': 'var(--val-text-sm)',
        'val-base': 'var(--val-text-base)',
        'val-lg': 'var(--val-text-lg)',
        'val-xl': 'var(--val-text-xl)',
        'val-2xl': 'var(--val-text-2xl)',
        'val-3xl': 'var(--val-text-3xl)',
        'val-4xl': 'var(--val-text-4xl)',
        'val-5xl': 'var(--val-text-5xl)',
      },
      fontFamily: {
        'val-sans': 'var(--val-font-sans)',
        'val-mono': 'var(--val-font-mono)',
      },
      boxShadow: {
        'val-sm': 'var(--val-shadow-sm)',
        'val-md': 'var(--val-shadow-md)',
        'val-lg': 'var(--val-shadow-lg)',
      },
      transitionDuration: {
        'val-fast': 'var(--val-duration-fast)',
        'val-normal': 'var(--val-duration-normal)',
        'val-slow': 'var(--val-duration-slow)',
      },
      transitionTimingFunction: {
        'val-in': 'var(--val-ease-in)',
        'val-out': 'var(--val-ease-out)',
        'val-in-out': 'var(--val-ease-in-out)',
      },
    },
  },
} as const
