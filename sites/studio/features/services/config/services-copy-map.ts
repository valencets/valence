export interface CopyMapEntry {
  readonly id: string
  readonly default: string
  readonly technical: string
}

export const SERVICES_COPY_MAP: readonly CopyMapEntry[] = [
  {
    id: 'service-custom-website',
    default: 'Custom website built on Inertia framework',
    technical: 'Vanilla TypeScript + native Web Components, HTML-over-the-wire router, PostCSS/Tailwind with OKLCh design tokens'
  },
  {
    id: 'service-hardware',
    default: 'Dedicated server appliance hardware',
    technical: 'Fanless x86 mini-PC (Intel N100), NAS-grade NVMe, inline 12V DC UPS'
  },
  {
    id: 'service-hud',
    default: 'First-party analytics dashboard (HUD)',
    technical: 'Self-hosted HUD: pure SVG/CSS charting, reads from PostgreSQL summary tables, no third-party tracking scripts'
  },
  {
    id: 'service-funnel',
    default: 'Conversion funnel tracking',
    technical: 'Event categorization pipeline: CLICK → SCROLL → VIEWPORT_INTERSECT → FORM_INPUT → INTENT_CALL → INTENT_BOOK'
  },
  {
    id: 'service-dni',
    default: 'Dynamic Number Insertion (DNI) for call tracking',
    technical: 'Session-scoped phone number rotation. Number → session_id mapping. Offline conversion attribution without cookies.'
  },
  {
    id: 'service-cookieless',
    default: 'Cookieless attribution',
    technical: 'Zero cookies, zero localStorage for tracking. Attribution via session_id + server-side correlation.'
  },
  {
    id: 'service-ledger',
    default: 'Private database analytics ledger on your hardware',
    technical: 'Immutable append-only PostgreSQL ledger. INSERT + SELECT only. No UPDATE, no DELETE, no TRUNCATE at engine level.'
  },
  {
    id: 'service-vps',
    default: 'Disposable VPS relay (~$5/mo actual cost, we manage it)',
    technical: 'Stateless Hetzner/DO VPS: Caddy reverse proxy + WireGuard peer. Zero application state. 60-second replacement if it dies.'
  },
  {
    id: 'service-ssl',
    default: 'SSL certificate management',
    technical: "Let's Encrypt via Caddy automatic HTTPS. Certificate rotation handled by Caddy, zero manual intervention."
  }
] as const
