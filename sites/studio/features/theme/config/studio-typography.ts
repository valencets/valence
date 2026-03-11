// Typography system: modular scale 1.25 (Major Third), max 65ch body
export const TYPOGRAPHY = {
  scale: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.25rem',
    xl: '1.5625rem',
    '2xl': '1.953rem',
    '3xl': '2.441rem',
    '4xl': '3.052rem'
  },
  lineHeight: {
    tight: '1.15',
    body: '1.65',
    relaxed: '1.8'
  },
  maxWidth: '65ch',
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  }
} as const
