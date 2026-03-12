export const HERO = {
  headline: 'Your website should load in one TCP round trip.',
  subhead: 'We build deterministic websites on dedicated hardware you own. No shared hosting. No bloated frameworks. No monthly ransom.',
  cta: { label: 'See Our Principles', href: '/principles' },
  ctaSecondary: { label: 'Get In Touch', href: '/about#contact' }
} as const

export const PILLARS = [
  {
    id: 'no-dynamic-alloc',
    title: 'No Dynamic Allocation',
    summary: 'Pre-allocated buffers. Monomorphic interfaces. Zero garbage collection jank at runtime.',
    icon: '⬡'
  },
  {
    id: 'no-exceptions',
    title: 'No Exceptions',
    summary: 'Result monads replace try/catch everywhere. Every code path is explicitly handled.',
    icon: '⬢'
  },
  {
    id: 'low-complexity',
    title: 'Low Complexity',
    summary: 'Every function under 20 cyclomatic complexity. Early returns. Dictionary maps. No spaghetti.',
    icon: '◇'
  },
  {
    id: '14kb-protocol',
    title: '14kB Protocol',
    summary: 'Your critical shell fits in the first 10 TCP packets. First paint before the server even knows you arrived.',
    icon: '△'
  }
] as const

export const ELIMINATES = [
  'WordPress update anxiety',
  'Monthly hosting invoices',
  'Third-party analytics tracking your visitors',
  'Shared server neighbors tanking your speed',
  'Framework vendor lock-in',
  'Database access held hostage'
] as const

export const OWNERSHIP = {
  headline: 'Total Ownership',
  body: 'When we hand you a Pi, you own your entire stack. The server hardware. The database. The analytics. The code. No subscriptions. No vendor dependencies. If we got hit by a bus tomorrow, your website keeps running.',
  proof: [
    { metric: '<14kB', label: 'First paint payload' },
    { metric: '0', label: 'Third-party scripts' },
    { metric: '100%', label: 'Client-owned infrastructure' },
    { metric: '∞', label: 'Uptime without us' }
  ]
} as const
