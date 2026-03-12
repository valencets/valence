export interface CopyMapEntry {
  readonly id: string
  readonly default: string
  readonly technical: string
}

export const HOME_COPY_MAP: readonly CopyMapEntry[] = [
  // Hero
  {
    id: 'hero-headline',
    default: 'Your website should load before you can blink.',
    technical: 'Your critical shell ships in the first 10 TCP packets. Sub-14kB compressed.'
  },
  {
    id: 'hero-subhead',
    default: 'We build websites on dedicated hardware you own. No shared hosting. No bloated frameworks. No monthly ransom.',
    technical: 'Deterministic TypeScript, native Web Components, HTML-over-the-wire routing, pre-allocated ring buffer telemetry. Zero framework dependencies.'
  },

  // Pillars — titles
  {
    id: 'pillar-no-dynamic-alloc-title',
    default: 'No Dynamic Allocation',
    technical: 'AV Rule 206'
  },
  {
    id: 'pillar-no-exceptions-title',
    default: 'No Exceptions',
    technical: 'AV Rule 208'
  },
  {
    id: 'pillar-low-complexity-title',
    default: 'Low Complexity',
    technical: 'AV Rule 3'
  },
  {
    id: 'pillar-14kb-title',
    default: 'Instant First Paint',
    technical: '14kB Protocol'
  },

  // Pillars — summaries
  {
    id: 'pillar-no-dynamic-alloc-summary',
    default: 'Pre-allocated buffers. Zero garbage collection jank at runtime.',
    technical: 'Fixed-capacity ring buffer initialized at boot. Monomorphic interface preserves V8 inline cache. Zero GC pressure.'
  },
  {
    id: 'pillar-no-exceptions-summary',
    default: 'Every code path is explicitly handled. No silent failures.',
    technical: 'Result<Ok, Err> monads via neverthrow. One try/catch boundary: safeJsonParse. All other paths are compiler-enforced.'
  },
  {
    id: 'pillar-low-complexity-summary',
    default: 'Every function is small enough to reason about. Bugs have fewer places to hide.',
    technical: 'Cyclomatic complexity < 20. Static dictionary maps replace switch statements. Early returns reduce nesting depth.'
  },
  {
    id: 'pillar-14kb-summary',
    default: 'Your website renders from the very first server response.',
    technical: 'Inline critical CSS + initial DOM fits first TCP slow start window. DOMParser fragment swaps for subsequent navigations.'
  },

  // Eliminates
  {
    id: 'eliminate-1',
    default: 'WordPress update anxiety',
    technical: 'Runtime dependency churn and CVE exposure from transitive node_modules'
  },
  {
    id: 'eliminate-2',
    default: 'Overpriced shared hosting',
    technical: 'Multi-tenant noisy-neighbor latency on shared infrastructure'
  },
  {
    id: 'eliminate-3',
    default: 'Third-party analytics tracking your visitors',
    technical: 'Third-party JS injection: Google Analytics, Meta Pixel, Adobe Target beacon chains'
  },
  {
    id: 'eliminate-4',
    default: 'Shared server neighbors tanking your speed',
    technical: 'Shared-tenancy resource contention causing P99 latency spikes'
  },
  {
    id: 'eliminate-5',
    default: 'Framework vendor lock-in',
    technical: 'React/Next.js/Vercel ecosystem lock-in with proprietary deployment targets'
  },
  {
    id: 'eliminate-6',
    default: 'Database access held hostage',
    technical: 'Managed database credentials controlled by SaaS provider, no pg_dump access'
  },

  // Ownership
  {
    id: 'ownership-body',
    default: 'When we deliver your server, you own your entire stack. The hardware. The database. The analytics. The code. No vendor dependencies. If we got hit by a bus tomorrow, your website keeps running.',
    technical: 'The appliance runs Node.js, PostgreSQL, Caddy, and Payload CMS on a fanless x86 mini-PC behind a WireGuard tunnel to a stateless VPS relay.'
  },

  // Proof metrics — labels
  {
    id: 'proof-1-label',
    default: 'First paint payload',
    technical: 'Brotli-compressed initial response (inline critical CSS + DOM shell)'
  },
  {
    id: 'proof-2-label',
    default: 'Third-party scripts',
    technical: 'Third-party scripts (no GA, no GTM, no Meta Pixel, no Adobe)'
  },
  {
    id: 'proof-3-label',
    default: 'Client-owned infrastructure',
    technical: 'Client-owned: hardware, PostgreSQL, Payload CMS, domain, backups, source'
  },
  {
    id: 'proof-4-label',
    default: 'Your site runs with or without us',
    technical: 'Gliding failover: static HTML snapshot on VPS serves if appliance goes offline. Caddy health-check auto-switches.'
  }
] as const
