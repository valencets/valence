export const ABOUT = {
  headline: 'About Inertia Web Solutions',
  intro: 'We build websites the way aerospace engineers build flight systems — deterministic, testable, and entirely within your control.',
  founder: {
    name: 'Forrest Blade',
    bio: 'Software engineer who got tired of watching local businesses pay monthly ransoms for websites they would never own. Inertia exists because your dentist, your plumber, and your local bakery deserve the same engineering standards as a fighter jet.',
    philosophy: 'Every website we build runs on hardware we hand-deliver to you. A Raspberry Pi 5 or ZimaBoard sitting in your office, serving your site to the world through Cloudflare. You own it. You control it. We just build it.'
  },
  hardware: {
    headline: 'The Appliance Model',
    body: 'Traditional web hosting is a subscription trap. You pay monthly for a fraction of a shared server, your data lives on someone else\'s hardware, and if you stop paying, everything disappears.',
    pitch: 'We flip this. We build your website, install it on a micro server, and deliver the physical hardware to you. Your PostgreSQL database runs on your hardware. Your analytics are self-hosted. Your website runs from your office. We charge for the build, not the electricity.',
    specs: [
      { label: 'Server', value: 'Raspberry Pi 5 (8GB) or ZimaBoard' },
      { label: 'OS', value: 'Debian-based, hardened' },
      { label: 'Database', value: 'PostgreSQL, client-owned' },
      { label: 'CDN', value: 'Cloudflare Tunnel (free tier)' },
      { label: 'Analytics', value: 'Self-hosted, first-party only' },
      { label: 'Monthly Cost', value: 'Electricity (~$0.50/mo)' }
    ]
  }
} as const
