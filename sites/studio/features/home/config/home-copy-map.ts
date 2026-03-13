export interface CopyMapEntry {
  readonly id: string
  readonly default: string
  readonly technical: string
}

export const HOME_COPY_MAP: readonly CopyMapEntry[] = [
  // Hero
  {
    id: 'hero-headline',
    default: 'Your website should be yours. Not rented. Not hostage. Yours.',
    technical: 'Deterministic TypeScript on client-owned x86 hardware. No SaaS dependency. No vendor kill switch.'
  },
  {
    id: 'hero-subhead',
    default: 'We build fast, secure websites on dedicated hardware we hand-deliver to your business. You own the server, the code, the data, and the analytics. No monthly ransom. No vendor lock-in. No kill switch.',
    technical: 'Native Web Components, HTML-over-the-wire routing, pre-allocated ring buffer telemetry, PostgreSQL on a fanless edge appliance behind a WireGuard tunnel.'
  },
  {
    id: 'hero-eyebrow',
    default: 'Proudly serving DFW businesses from McKinney, TX',
    technical: 'Edge-deployed from McKinney, TX \u2014 sub-millisecond intra-DFW latency'
  },

  // Hero stats
  {
    id: 'hero-stat-1-label',
    default: 'Page Load',
    technical: 'Time to First Contentful Paint (FCP)'
  },
  {
    id: 'hero-stat-2-label',
    default: 'Lighthouse Score',
    technical: 'Lighthouse Performance + Accessibility + Best Practices + SEO (avg)'
  },
  {
    id: 'hero-stat-3-label',
    default: 'Third-Party Scripts',
    technical: 'External JS payloads (GA, GTM, Meta Pixel, Adobe): zero'
  },
  {
    id: 'hero-stat-4-label',
    default: 'Client Owned',
    technical: 'Hardware, PostgreSQL, Payload CMS, domain, backups, source code'
  },

  // Pillars \u2014 titles
  {
    id: 'pillar-no-dynamic-alloc-title',
    default: 'Never Stutters Under Load',
    technical: 'AV Rule 206'
  },
  {
    id: 'pillar-no-exceptions-title',
    default: 'Never Crashes Silently',
    technical: 'AV Rule 208'
  },
  {
    id: 'pillar-low-complexity-title',
    default: 'Nothing Can Hide in the Code',
    technical: 'AV Rule 3'
  },
  {
    id: 'pillar-14kb-title',
    default: 'Loads Before Your Competitor\'s Logo Appears',
    technical: '14kB Protocol'
  },

  // Pillars \u2014 summaries
  {
    id: 'pillar-no-dynamic-alloc-summary',
    default: 'Your site stays fast even when traffic spikes. No slowdowns, no freezing, no excuses.',
    technical: 'Fixed-capacity ring buffer initialized at boot. Monomorphic interface preserves V8 inline cache. Zero GC pressure.'
  },
  {
    id: 'pillar-no-exceptions-summary',
    default: 'Every possible error is handled up front. Your site never breaks without telling you why.',
    technical: 'Result<Ok, Err> monads via neverthrow. One try/catch boundary: safeJsonParse. All other paths are compiler-enforced.'
  },
  {
    id: 'pillar-low-complexity-summary',
    default: 'Every function is small enough to audit in seconds. Bugs have nowhere to hide.',
    technical: 'Cyclomatic complexity < 20. Static dictionary maps replace switch statements. Early returns reduce nesting depth.'
  },
  {
    id: 'pillar-14kb-summary',
    default: 'Your website renders from the very first server response. Visitors see content instantly.',
    technical: 'Inline critical CSS + initial DOM fits first TCP slow start window. DOMParser fragment swaps for subsequent navigations.'
  },

  // Comparison section
  {
    id: 'comparison-header',
    default: 'What you\u2019re actually paying for',
    technical: 'Competitive analysis: SaaS platforms vs agency retainers vs Inertia appliance model'
  },
  {
    id: 'comparison-subtitle',
    default: 'Most DFW businesses don\u2019t realize how much they\u2019re spending to rent infrastructure they\u2019ll never own.',
    technical: 'Ownership model comparison across infrastructure, code, data, and operational independence'
  },

  // Pain cards (alternating: ours/pain/ours/pain/ours/pain)
  {
    id: 'pain-card-1-label',
    default: 'How We\'re Different',
    technical: 'Appliance Model'
  },
  {
    id: 'pain-card-1-title',
    default: 'Your server sits in your office',
    technical: 'Edge appliance: x86 hardware on-prem, WireGuard tunnel to stateless VPS relay'
  },
  {
    id: 'pain-card-1-desc',
    default: 'We build your site, install it on a dedicated server, and hand-deliver the hardware to your business. Your database, your analytics, your code. An optional $49/month relay puts you on the public internet. Cancel and your site keeps running.',
    technical: 'x86 edge appliance with PostgreSQL, Payload CMS, and WireGuard tunnel. Full pg_dump + git clone access. Bus factor: zero.'
  },
  {
    id: 'pain-card-2-label',
    default: 'The Platform Trap',
    technical: 'Vendor Lock-In Risk'
  },
  {
    id: 'pain-card-2-title',
    default: 'You don\'t own your Wix site',
    technical: 'Vendor lock-in: no pg_dump, no code export, proprietary CMS schema'
  },
  {
    id: 'pain-card-2-desc',
    default: 'Wix and Squarespace market $16/month as affordable. But you can\'t export your site. You can\'t add custom features. When you outgrow the platform, you start over from scratch and write off years of sunk cost.',
    technical: 'No file-system access, no database export, proprietary template engine locks content to platform. Migration cost: full rebuild.'
  },
  {
    id: 'pain-card-3-label',
    default: 'Built for Speed',
    technical: 'Performance Architecture'
  },
  {
    id: 'pain-card-3-title',
    default: 'Your site loads before they can blink',
    technical: 'Sub-200ms TTFB, <14kB critical shell, zero render-blocking external scripts'
  },
  {
    id: 'pain-card-3-desc',
    default: 'No shared servers. No bloated frameworks. Just your code on your hardware, optimized for sub-second page loads.',
    technical: 'Dedicated x86 hardware, inline critical CSS, HTML-over-the-wire routing, pre-allocated ring buffer telemetry'
  },
  {
    id: 'pain-card-4-label',
    default: 'The Agency Tax',
    technical: 'Retainer Model Analysis'
  },
  {
    id: 'pain-card-4-title',
    default: '$60K/year and you still own nothing',
    technical: 'Agency retainer model: $5,000\u2013$9,000/mo for hosting + maintenance you could self-serve'
  },
  {
    id: 'pain-card-4-desc',
    default: 'DFW agencies charge $5,000 - $9,000/month for managed digital presence. If you cancel, you lose the website, the content, and the SEO rankings they built on their hosting. You paid $60K and walk away empty-handed.',
    technical: 'Managed service markup on trivial CMS edits. Client has no admin access. Code ownership retained by agency.'
  },
  {
    id: 'pain-card-5-label',
    default: 'True Independence',
    technical: 'Gliding Failover'
  },
  {
    id: 'pain-card-5-title',
    default: 'Your site runs with or without us',
    technical: 'Gliding failover: static HTML snapshot on VPS. Caddy health-check auto-switches. Zero vendor dependency.'
  },
  {
    id: 'pain-card-5-desc',
    default: 'If we disappeared tomorrow, your website keeps running. You have the server, the database, and every line of code.',
    technical: 'Client holds full pg_dump + git clone access. Static failover snapshot on VPS serves if appliance offline.'
  },
  {
    id: 'pain-card-6-label',
    default: 'The Outage Gamble',
    technical: 'Single Point of Failure'
  },
  {
    id: 'pain-card-6-title',
    default: 'When AWS goes down, your website disappears',
    technical: 'Cloud SPOF: us-east-1 outage cascades to all tenants. No local failover.'
  },
  {
    id: 'pain-card-6-desc',
    default: 'During the 2025 AWS outage, thousands of business websites across Texas went dark. Customers searching for hours, menus, or directions got nothing. One DFW business owner lost a full day of leads because his site was hosted on a server 1,000 miles away.',
    technical: 'Multi-tenant cloud: single AZ failure cascades to all hosted sites. No edge failover, no local serving capability.'
  },

  // Comparison CTA
  {
    id: 'comparison-cta-headline',
    default: 'Curious what your current site is costing you?',
    technical: 'Automated Lighthouse audit pipeline: Performance, Accessibility, Best Practices, SEO'
  }
] as const
