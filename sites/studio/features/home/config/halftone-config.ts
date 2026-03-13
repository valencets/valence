// Halftone hero pattern configuration
// Dot positions and sizes create an organic, non-mechanical feel
// Two layers: primary organic dots + secondary grain for depth

export const HALFTONE_VIEWBOX = '0 0 1600 900'

export const ORGANIC_PATTERN = {
  id: 'ht-organic',
  cellSize: 24,
  rotation: 30,
  dots: [
    { cx: 4, cy: 4, r: 3.6 },
    { cx: 16, cy: 3, r: 1.4 },
    { cx: 20, cy: 10, r: 2.4 },
    { cx: 10, cy: 12, r: 4.2 },
    { cx: 2, cy: 18, r: 1.8 },
    { cx: 14, cy: 20, r: 2.8 },
    { cx: 22, cy: 22, r: 1.2 }
  ],
  opacity: 0.45
} as const

export const GRAIN_PATTERN = {
  id: 'ht-grain',
  cellSize: 18,
  rotation: -15,
  dots: [
    { cx: 3, cy: 5, r: 0.9 },
    { cx: 11, cy: 2, r: 0.7 },
    { cx: 7, cy: 11, r: 1.1 },
    { cx: 15, cy: 8, r: 0.6 },
    { cx: 5, cy: 16, r: 0.8 },
    { cx: 14, cy: 15, r: 1.0 }
  ],
  opacity: 0.25
} as const

// Diagonal fade: visible at top-left, fades to zero by ~45% of diagonal
export const FADE_GRADIENT = {
  id: 'diag-fade',
  stops: [
    { offset: '0%', opacity: 0.38 },
    { offset: '30%', opacity: 0.18 },
    { offset: '55%', opacity: 0.06 },
    { offset: '80%', opacity: 0.015 },
    { offset: '100%', opacity: 0 }
  ]
} as const
