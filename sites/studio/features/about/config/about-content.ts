export const ABOUT = {
  headline: 'About Inertia Web Solutions',
  intro: 'We build websites the way aerospace engineers build flight systems — deterministic, testable, and entirely within your control.',
  founder: {
    name: 'Forrest Blade',
    bio: 'Software engineer in McKinney, TX who got tired of watching local DFW businesses pay monthly ransoms for websites they would never own. Inertia exists because your dentist, your plumber, and your local bakery deserve the same engineering standards as a fighter jet.',
    philosophy: 'Every website we build runs on hardware we hand-deliver to you. A dedicated server appliance sitting in your office, serving your site to the world through a secure tunnel you control. You own it. You control it. We just build it.'
  },
  hardware: {
    headline: 'The Appliance Model',
    summary: 'We build your website, install it on a dedicated server appliance, and hand-deliver the hardware to your McKinney, Plano, Frisco, or Dallas business. You own the server, the database, and the code. No monthly hosting trap.',
    cta: { label: 'See full specs and pricing', href: '/pricing' }
  },
  proof: {
    headline: 'Why Inertia Exists',
    points: [
      'Websites that load instantly — first paint in under one second',
      'Hardware you physically own — no shared hosting, no vendor lock-in',
      'Analytics that respect your customers — no third-party tracking scripts'
    ]
  }
} as const
