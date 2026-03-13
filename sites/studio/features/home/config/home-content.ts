export const HERO = {
  eyebrow: 'Proudly serving DFW businesses from McKinney, TX',
  headline: 'Your website should be yours. Not rented. Not hostage. Yours.',
  headlineAccent: 'yours',
  subhead: 'We build fast, secure websites on dedicated hardware we hand-deliver to your business. You own the server, the code, the data, and the analytics. No monthly ransom. No vendor lock-in. No kill switch.',
  stats: [
    { value: '<1s', label: 'Page Load' },
    { value: '100', label: 'Lighthouse Score' },
    { value: '0', label: 'Third-Party Scripts' },
    { value: '100%', label: 'Client Owned' }
  ],
  cta: { label: 'Get a Free Site Audit', href: '/free-site-audit' },
  ctaSecondary: { label: 'See How It Works', href: '/how-it-works' }
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

type MarkerType = 'pass' | 'fail' | 'partial'

interface ComparisonRow {
  readonly feature: string
  readonly wix: string
  readonly agency: string
  readonly inertia: string
  readonly wixMarker: MarkerType | ''
  readonly agencyMarker: MarkerType | ''
  readonly inertiaMarker: MarkerType | ''
}

export const COMPARISON_TABLE = {
  headers: ['', 'Wix / Squarespace', 'Agency Retainer', 'Inertia'],
  rows: [
    { feature: 'You own the server', wix: 'No', agency: 'No', inertia: 'Yes', wixMarker: 'fail', agencyMarker: 'fail', inertiaMarker: 'pass' },
    { feature: 'You own the code', wix: 'No', agency: 'Sometimes', inertia: 'Yes', wixMarker: 'fail', agencyMarker: 'partial', inertiaMarker: 'pass' },
    { feature: 'You own the data', wix: 'No', agency: 'Sometimes', inertia: 'Yes', wixMarker: 'fail', agencyMarker: 'partial', inertiaMarker: 'pass' },
    { feature: 'Page load under 1s', wix: '3–6s typical', agency: '2–4s typical', inertia: 'Under 1s', wixMarker: 'fail', agencyMarker: 'partial', inertiaMarker: 'pass' },
    { feature: 'No third-party tracking', wix: 'Platform scripts', agency: 'GA + GTM', inertia: 'Zero scripts', wixMarker: 'fail', agencyMarker: 'fail', inertiaMarker: 'pass' },
    { feature: 'Works if vendor disappears', wix: 'Site gone', agency: 'Depends', inertia: 'Runs forever', wixMarker: 'fail', agencyMarker: 'partial', inertiaMarker: 'pass' },
    { feature: 'Lighthouse 100', wix: '50–70', agency: '70–90', inertia: '100', wixMarker: 'fail', agencyMarker: 'partial', inertiaMarker: 'pass' },
    { feature: 'Monthly cost after launch', wix: '$16–45/mo', agency: '$1,500–5,000/mo', inertia: '$0 required', wixMarker: '', agencyMarker: '', inertiaMarker: '' }
  ] as readonly ComparisonRow[]
} as const

export const PAIN_CARDS = [
  {
    id: 'pain-hosting',
    variant: 'pain' as const,
    label: 'The Hosting Trap',
    title: 'You\'re renting a website you can\'t take with you',
    description: 'Wix, Squarespace, and WordPress.com hold your site hostage. Try to leave and you start from scratch.',
    stat: '72% of small businesses can\'t export their own website'
  },
  {
    id: 'pain-speed',
    variant: 'pain' as const,
    label: 'The Speed Tax',
    title: 'Slow sites cost you customers every single day',
    description: 'Shared hosting, bloated themes, and third-party scripts add seconds to every page load.',
    stat: '53% of visitors leave if a page takes over 3 seconds'
  },
  {
    id: 'pain-cost',
    variant: 'pain' as const,
    label: 'The Retainer Racket',
    title: 'Agencies charge monthly for a site you should own',
    description: 'You paid to build it. Now you pay to keep it. Change a phone number? That\'ll be $150.',
    stat: 'Average agency retainer: $2,500/month'
  },
  {
    id: 'ours-ownership',
    variant: 'ours' as const,
    label: 'The Inertia Model',
    title: 'One payment. Your server. Your site. Forever.',
    description: 'We hand-deliver a dedicated server appliance to your business. You own the hardware, the code, the data, and the analytics. No monthly ransom.',
    stat: '$0/month after launch'
  },
  {
    id: 'ours-speed',
    variant: 'ours' as const,
    label: 'Built for Speed',
    title: 'Your site loads before they can blink',
    description: 'No shared servers. No bloated frameworks. Just your code on your hardware, optimized for sub-second page loads.',
    stat: 'Perfect 100 Lighthouse score'
  },
  {
    id: 'ours-independence',
    variant: 'ours' as const,
    label: 'True Independence',
    title: 'Your site runs with or without us',
    description: 'If we disappeared tomorrow, your website keeps running. You have the server, the database, and every line of code.',
    stat: 'Zero vendor dependencies'
  }
] as const

export const COMPARISON_CTA = {
  headline: 'See exactly what we\'d build for you',
  subtitle: 'We\'ll audit your current site for free — speed, SEO, accessibility, and security. No strings.',
  cta: { label: 'Run Free Site Audit', href: '/free-site-audit' }
} as const
