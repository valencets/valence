export interface PageMeta {
  readonly description: string
}

export type PageKey = 'home' | 'how-it-works' | 'pricing' | 'free-site-audit' | 'about'

export const PAGE_META: Record<PageKey, PageMeta> = {
  home: {
    description: 'Inertia builds deterministic websites on dedicated hardware you own. No shared hosting. No bloated frameworks. McKinney, TX web studio.'
  },
  'how-it-works': {
    description: 'Aerospace-grade engineering for local business websites. Pre-allocated memory, explicit error handling, and 14kB first-paint budgets.'
  },
  pricing: {
    description: 'Website on a dedicated server we deliver to your DFW business. You own the hardware, the code, and the data. McKinney, TX web studio.'
  },
  'free-site-audit': {
    description: 'Free Lighthouse audit from a McKinney, TX web studio. Enter any URL and get performance, accessibility, and SEO scores in seconds.'
  },
  about: {
    description: 'Inertia Web Solutions is a solo web studio in McKinney, TX building aerospace-grade websites on hardware you physically own.'
  }
}
