export interface CopyMapEntry {
  readonly id: string
  readonly default: string
  readonly technical: string
}

export const ABOUT_COPY_MAP: readonly CopyMapEntry[] = [
  {
    id: 'about-spec-server',
    default: 'Industrial-grade x86 edge server',
    technical: 'Intel N100 quad-core @ 3.4GHz, fanless passive cooling, NVMe via PCIe'
  },
  {
    id: 'about-spec-os',
    default: 'Debian-based, hardened',
    technical: 'Debian Bookworm 64-bit, headless, unattended-upgrades, UFW, fail2ban'
  },
  {
    id: 'about-spec-database',
    default: 'Private database, client-owned',
    technical: 'PostgreSQL 16, immutable ledger, RBAC (app role: INSERT + SELECT only)'
  },
  {
    id: 'about-spec-network',
    default: 'Secure tunnel to disposable relay',
    technical: 'WireGuard persistent outbound tunnel to stateless $4/mo VPS'
  },
  {
    id: 'about-spec-analytics',
    default: 'Self-hosted, first-party only',
    technical: 'Ring buffer → sendBeacon → monadic ingestion pipeline → PostgreSQL → HUD'
  },
  {
    id: 'about-spec-cost',
    default: '~$5/mo relay + electricity',
    technical: '~$4/mo Hetzner VPS + ~$3/mo electricity (15W × 24/7 × $0.12/kWh)'
  }
] as const
