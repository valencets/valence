// Spacing system: 4px base, 12-col grid, 1120px max-width
export const SPACING = {
  base: '4px',
  scale: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem'
  },
  grid: {
    columns: 12,
    maxWidth: '1120px',
    gutter: '1.5rem',
    margin: '1rem'
  },
  section: {
    paddingY: '4rem',
    paddingYMobile: '2.5rem'
  }
} as const
