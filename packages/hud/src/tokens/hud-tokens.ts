export const HUD_COLORS = {
  bg: 'hsl(220, 13%, 8%)',
  surface: 'hsl(220, 13%, 12%)',
  border: 'hsl(220, 10%, 18%)',
  textPrimary: 'hsl(220, 10%, 88%)',
  textSecondary: 'hsl(220, 8%, 55%)',
  textMuted: 'hsl(220, 6%, 35%)',
  positive: 'hsl(145, 60%, 45%)',
  negative: 'hsl(0, 70%, 55%)',
  warning: 'hsl(35, 85%, 55%)',
  accent: 'hsl(215, 60%, 55%)',
  neutral: 'hsl(220, 8%, 45%)'
} as const

export type HudColor = typeof HUD_COLORS[keyof typeof HUD_COLORS]

export const HUD_TYPOGRAPHY = {
  fontPrimary: 'system-ui, -apple-system, sans-serif',
  fontMono: 'ui-monospace, \'Cascadia Code\', \'Fira Code\', monospace',
  scale: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '20px',
    xl: '28px'
  },
  lineHeight: {
    body: '1.4',
    heading: '1.2',
    metric: '1.0'
  }
} as const

export const HUD_SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px'
} as const

export const HUD_CHART = {
  sparkline: {
    width: 120,
    height: 32,
    strokeWidth: 1.5
  }
} as const
