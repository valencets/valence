export const HERO = {
  headline: 'Your website should load before you can blink.',
  subhead: 'We build websites on dedicated hardware you own. No shared hosting. No bloated frameworks. No monthly ransom.',
  cta: { label: 'See Our Principles', href: '/principles' },
  ctaSecondary: { label: 'Get In Touch', href: '/about#contact' }
} as const

export const PILLARS = [
  {
    id: 'no-dynamic-alloc',
    title: 'No Dynamic Allocation',
    summary: 'Pre-allocated buffers. Zero garbage collection jank at runtime.',
    icon: '⬡'
  },
  {
    id: 'no-exceptions',
    title: 'No Exceptions',
    summary: 'Every code path is explicitly handled. No silent failures.',
    icon: '⬢'
  },
  {
    id: 'low-complexity',
    title: 'Low Complexity',
    summary: 'Every function is small enough to reason about. Bugs have fewer places to hide.',
    icon: '◇'
  },
  {
    id: '14kb-protocol',
    title: 'Instant First Paint',
    summary: 'Your website renders from the very first server response.',
    icon: '△'
  }
] as const

export const ELIMINATES = [
  'WordPress update anxiety',
  'Overpriced shared hosting',
  'Third-party analytics tracking your visitors',
  'Shared server neighbors tanking your speed',
  'Framework vendor lock-in',
  'Database access held hostage'
] as const

export const OWNERSHIP = {
  headline: 'Total Ownership',
  body: 'When we deliver your server, you own your entire stack. The hardware. The database. The analytics. The code. No vendor dependencies. If we got hit by a bus tomorrow, your website keeps running.',
  proof: [
    { metric: '<14kB', label: 'First paint payload' },
    { metric: '0', label: 'Third-party scripts' },
    { metric: '100%', label: 'Client-owned infrastructure' },
    { metric: '24/7', label: 'Your site runs with or without us' }
  ]
} as const
