export const HERO = {
  eyebrow: 'Proudly serving DFW businesses from McKinney, TX',
  headline: 'Your website should be yours. Not rented. Not hostage. Yours.',
  headlineAccent: 'yours',
  subhead: 'We build fast, secure websites on dedicated hardware we hand-deliver to your business. You own the server, the code, the data, and the analytics. No monthly ransom. No vendor lock-in. No kill switch.',
  stats: [
    { value: '<1s', label: 'Page Load', accent: '' },
    { value: '100', label: 'Lighthouse Score', accent: 'green' },
    { value: '0', label: 'Third-Party Scripts', accent: '' },
    { value: '100%', label: 'Client Owned', accent: 'green' }
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

type MarkerType = 'check' | 'cross' | 'warn'

interface ComparisonRow {
  readonly feature: string
  readonly wix: string
  readonly agency: string
  readonly inertia: string
  readonly wixMarker: MarkerType | ''
  readonly agencyMarker: MarkerType | ''
  readonly inertiaMarker: MarkerType | ''
  readonly wixClass: string
  readonly agencyClass: string
  readonly inertiaClass: string
}

export const COMPARISON_TABLE = {
  heading: 'What you\u2019re actually paying for',
  subtitle: 'Most DFW businesses don\u2019t realize how much they\u2019re spending to rent infrastructure they\u2019ll never own.',
  headers: ['', 'Wix / Squarespace', 'Agency Retainer', 'Inertia Web Solutions'],
  rows: [
    { feature: 'Typical Cost', wix: '$30 - $100/mo forever', agency: '$2,500 - $9,000/mo forever', inertia: '$3,500 one-time + optional $49/mo relay', wixMarker: '', agencyMarker: '', inertiaMarker: '', wixClass: 'price-pain', agencyClass: 'price-pain', inertiaClass: 'price-good' },
    { feature: '3-Year Total', wix: '$1,080 - $3,600', agency: '$90,000 - $324,000', inertia: '$3,500 (+ $1,764 with optional relay)', wixMarker: '', agencyMarker: '', inertiaMarker: '', wixClass: 'price-pain', agencyClass: 'price-pain', inertiaClass: 'price-good' },
    { feature: 'You Own the Code', wix: 'Locked in their platform', agency: 'Usually retained by agency', inertia: 'Full source code handover', wixMarker: 'cross', agencyMarker: 'cross', inertiaMarker: 'check', wixClass: '', agencyClass: '', inertiaClass: '' },
    { feature: 'You Own Your Data', wix: 'Stored on their servers', agency: 'Depends on contract', inertia: 'Database on your hardware', wixMarker: 'cross', agencyMarker: 'warn', inertiaMarker: 'check', wixClass: '', agencyClass: '', inertiaClass: '' },
    { feature: 'Analytics Privacy', wix: 'Google Analytics / third-party', agency: 'Google Analytics / Adobe', inertia: 'Self-hosted, zero third-party scripts', wixMarker: 'cross', agencyMarker: 'cross', inertiaMarker: 'check', wixClass: '', agencyClass: '', inertiaClass: '' },
    { feature: 'Survives Without Vendor', wix: 'Site disappears if you stop paying', agency: 'Lose access to everything', inertia: 'Server keeps running in your office', wixMarker: 'cross', agencyMarker: 'cross', inertiaMarker: 'check', wixClass: '', agencyClass: '', inertiaClass: '' },
    { feature: 'Page Speed', wix: '3 - 6 seconds typical', agency: '2 - 4 seconds typical', inertia: 'Under 1 second, sub-14kB critical load', wixMarker: 'warn', agencyMarker: 'warn', inertiaMarker: 'check', wixClass: '', agencyClass: '', inertiaClass: '' },
    { feature: 'Hidden Fees', wix: 'Transaction %, plugin upsells, storage limits', agency: 'Scope creep, hourly overages', inertia: 'Price is the price. No surprises.', wixMarker: 'cross', agencyMarker: 'cross', inertiaMarker: 'check', wixClass: '', agencyClass: '', inertiaClass: '' }
  ] as readonly ComparisonRow[]
} as const

export const PAIN_CARDS = [
  {
    id: 'ours-different',
    variant: 'ours' as const,
    label: 'How We\'re Different',
    title: 'Your server sits in your office',
    description: 'We build your site, install it on a dedicated server, and hand-deliver the hardware to your business. Your database, your analytics, your code. An optional $49/month relay puts you on the public internet. Cancel and your site keeps running.',
    stat: 'Bus factor: <strong>zero</strong>. If we disappear, your website doesn\'t.'
  },
  {
    id: 'pain-platform',
    variant: 'pain' as const,
    label: 'The Platform Trap',
    title: 'You don\'t own your Wix site',
    description: 'Wix and Squarespace market $16/month as affordable. But you can\'t export your site. You can\'t add custom features. When you outgrow the platform, you start over from scratch and write off years of sunk cost.',
    stat: 'Average 3-year DIY platform cost: <strong>$1,800 - $3,600</strong> for a site you\'ll eventually abandon'
  },
  {
    id: 'ours-speed',
    variant: 'ours' as const,
    label: 'Built for Speed',
    title: 'Your site loads before they can blink',
    description: 'No shared servers. No bloated frameworks. Just your code on your hardware, optimized for sub-second page loads.',
    stat: 'Perfect <strong>100</strong> Lighthouse score'
  },
  {
    id: 'pain-agency',
    variant: 'pain' as const,
    label: 'The Agency Tax',
    title: '$60K/year and you still own nothing',
    description: 'DFW agencies charge $5,000 - $9,000/month for managed digital presence. If you cancel, you lose the website, the content, and the SEO rankings they built on their hosting. You paid $60K and walk away empty-handed.',
    stat: 'Average mid-tier DFW agency retainer: <strong>$5,000 - $9,000/mo</strong>'
  },
  {
    id: 'ours-independence',
    variant: 'ours' as const,
    label: 'True Independence',
    title: 'Your site runs with or without us',
    description: 'If we disappeared tomorrow, your website keeps running. You have the server, the database, and every line of code.',
    stat: '<strong>Zero</strong> vendor dependencies'
  },
  {
    id: 'pain-outage',
    variant: 'pain' as const,
    label: 'The Outage Gamble',
    title: 'When AWS goes down, your website disappears',
    description: 'During the 2025 AWS outage, thousands of business websites across Texas went dark. Customers searching for hours, menus, or directions got nothing. One DFW business owner lost a full day of leads because his site was hosted on a server 1,000 miles away.',
    stat: 'McKinney has experienced <strong>3-day business internet outages</strong> from a single fiber cut'
  }
] as const

export const COMPARISON_CTA = {
  headline: 'Curious what your current site is costing you?',
  subtitle: 'Run a free audit and see your real performance scores. No email required.',
  cta: { label: 'Run Free Site Audit', href: '/free-site-audit' }
} as const
