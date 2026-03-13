export const HERO = {
  headline: 'Your website should load before you can blink.',
  subhead: 'A McKinney web studio building websites on dedicated hardware you own. No shared hosting. No bloated frameworks. Serving businesses across DFW.',
  cta: { label: 'See How It Works', href: '/how-it-works' },
  ctaSecondary: { label: 'Get In Touch', href: '/about#contact' }
} as const

export const PILLARS = [
  {
    id: 'no-dynamic-alloc',
    title: 'Never Stutters Under Load',
    summary: 'Your site stays fast even when traffic spikes. No slowdowns, no freezing, no excuses.',
    icon: '⬡'
  },
  {
    id: 'no-exceptions',
    title: 'Never Crashes Silently',
    summary: 'Every possible error is handled up front. Your site never breaks without telling you why.',
    icon: '⬢'
  },
  {
    id: 'low-complexity',
    title: 'Nothing Can Hide in the Code',
    summary: 'Every function is small enough to audit in seconds. Bugs have nowhere to hide.',
    icon: '◇'
  },
  {
    id: '14kb-protocol',
    title: 'Loads Before Your Competitor\'s Logo Appears',
    summary: 'Your website renders from the very first server response. Visitors see content instantly.',
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
  body: 'When we deliver your server to your Dallas-Fort Worth business, you own your entire stack. The hardware. The database. The analytics. The code. No vendor dependencies. If we got hit by a bus tomorrow, your website keeps running.',
  proof: [
    { metric: '<14kB', label: 'First paint payload' },
    { metric: '0', label: 'Third-party scripts' },
    { metric: '100%', label: 'Client-owned infrastructure' },
    { metric: '24/7', label: 'Your site runs with or without us' }
  ]
} as const
