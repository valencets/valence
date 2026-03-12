export const APPLIANCE_MODEL = {
  headline: 'The Web Appliance Model',
  body: 'Your website actually lives on a computer inside your business. The internet just needs a doorway so visitors can reach it. That doorway costs about five dollars a month and it\'s registered in your name. If you ever want to switch providers, your website is still sitting in your office — we just move the doorway.'
} as const

export const SERVICE_TIERS = [
  {
    id: 'build-own',
    name: 'Build, Deploy & Own',
    estimate: '~$3,500 – $4,800 one-time',
    description: 'We design and build your website on the Inertia framework, install it on a dedicated server appliance, and deliver the hardware to your business. You own everything.',
    includes: [
      'Custom website built on Inertia framework',
      'Dedicated server appliance hardware',
      'First-party analytics dashboard (HUD)',
      'Custom telemetry event definitions',
      'Conversion funnel tracking',
      'Dynamic Number Insertion (DNI) for call tracking',
      'Cookieless attribution',
      'Verified digital promo codes for walk-in tracking',
      'Private database analytics ledger on your hardware',
      'Source code handover',
      '30-day post-launch support'
    ]
  },
  {
    id: 'infrastructure',
    name: 'The Infrastructure Pipe',
    estimate: '~$49 – $79/mo',
    description: 'The internet doorway: a managed network relay so visitors can reach your server. Cancel anytime — you keep the hardware, the data, and the code. You just manage your own network routing.',
    includes: [
      'Disposable VPS relay (~$5/mo actual cost, we manage it)',
      'SSL certificate management',
      'Automated OS and security patching',
      'Domain DNS management',
      'Uptime monitoring and alerts'
    ]
  },
  {
    id: 'managed',
    name: 'Managed Webmaster',
    estimate: '~$199 – $299/mo',
    description: 'Everything in The Infrastructure Pipe, plus ongoing content updates, performance tuning, and quarterly analytics reviews. Your website stays current without you thinking about it.',
    includes: [
      'Everything in The Infrastructure Pipe',
      'Monthly content updates',
      'Security patches and dependency updates',
      'Quarterly analytics review',
      'Priority support via email'
    ]
  }
] as const

export const OWNERSHIP_LIST = [
  'You own the server hardware',
  'You own the database and all customer data',
  'You own the source code',
  'You own the analytics — every visitor interaction stored on your hardware, viewable in your private dashboard. No Google. No Adobe. No third-party tracking. Ever.',
  'You own the domain and DNS',
  'No monthly hosting fees beyond the relay',
  'No vendor lock-in',
  'Full data portability'
] as const
