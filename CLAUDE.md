# Inertia Framework

Deterministic web framework applying JSF aerospace coding standards to TypeScript, Web Components, and PostgreSQL. Proprietary engine for a solo web studio delivering physical web server appliances to local service businesses.

## Tech Stack

- Language: Vanilla ES6/ES7 + TypeScript (strict mode, zero `any`)
- UI: Native Web Components (Custom Elements), no React/Angular/Vue on public-facing pages
- Styling: PostCSS + Tailwind CSS (design token driven, OKLCh color space)
- Routing: HTML-over-the-wire, `history.pushState()`, DOMParser fragment swaps, beforeSwap/afterSwap lifecycle hooks
- Server: Node.js or Bun
- CMS: Payload CMS 3.x (self-hosted, PostgreSQL-backed, MIT license). React exists in admin panel only, never in public pages.
- Database: PostgreSQL (client-owned, immutable append-only ledger)
- Analytics: Self-hosted first-party telemetry engine (ring buffer → ingestion → PostgreSQL → HUD)
- Linting: Neostandard
- Validation: Zod (`.safeParse()` only, never `.parse()`)
- Error handling: `neverthrow` (Result monads)
- Package manager: pnpm workspaces (monorepo)

## The Four Pillars (Non-Negotiable)

1. **AV Rule 206** — No dynamic memory allocation after init. Pre-allocated circular buffers, monomorphic interfaces, in-place mutation only.
2. **AV Rule 208** — No exceptions. Zero `try/catch/throw` in business logic. ONE permitted boundary: `safeJsonParse()`. Everything else uses `Result<Ok, Err>` monads.
3. **AV Rule 3** — Cyclomatic complexity < 20 per function. Early returns, static dictionary maps, micro-componentization. No `switch` statements. No enums (const unions only).
4. **14kB Protocol Limit** — Critical shell (inline CSS + initial DOM) must fit in first 10 TCP packets (~14kB compressed). No external stylesheets in critical path.

## Infrastructure Model

### Hardware (Client Appliance)
- Fanless x86 mini-PC (Intel N100, 8GB+ RAM, dual NIC preferred)
- NAS-grade NVMe SSD (WD Red SN700, high TBW for PostgreSQL write loads)
- Inline 12V DC mini-UPS (survives power blips, cleaners unplugging outlets)
- No Raspberry Pi (SD cards corrupt under PostgreSQL WAL). No ZimaBoard (cost/margin).

### Network (Disposable Infrastructure)
- Appliance establishes persistent outbound WireGuard tunnel to a stateless $4/mo VPS (Hetzner/DigitalOcean)
- VPS runs Caddy as a reverse proxy: handles public internet traffic + SSL, pipes down the tunnel
- VPS is disposable. If it dies, spin a new one in 60 seconds. The site lives on the appliance, not the VPS.
- No Cloudflare Tunnels (surrenders control to Big Tech, violates ownership thesis)

### Gliding Failover
- On every CMS publish, the appliance compiles a static HTML snapshot and rsyncs it to the VPS
- If the appliance goes offline, Caddy serves the static snapshot automatically
- Dynamic telemetry pauses but the public storefront never goes dark
- When the appliance reconnects, live serving resumes seamlessly

### Public-Facing Copy Rule
- Never mention specific hardware brand names (N100, NVMe, WD Red) on client-facing pages
- Use: "industrial-grade x86 edge server" or "dedicated server appliance"
- Protects margins, prevents clients googling retail parts, maintains enterprise aesthetic

## Architecture Reference

Read `docs/ARCHITECTURE.md` for full details covering:
- Telemetry engine (circular buffer, object pool, flush mechanics, schema versioning)
- Ingestion node (monadic pipeline, Black Hole strategy, HMAC signature verification)
- Router (anticipatory prefetch, fragment swap, beforeSwap/afterSwap hooks, Web Component lifecycle)
- Database schema (sessions/events/daily_summaries tables, JSONB optimization, 1/80th rule)
- Fleet dashboard (multi-tenant aggregation, health indicators, cross-client comparison)
- Offline conversion tracking (DNI, promo codes, proxy actions)
- Gliding failover (static snapshot + VPS fallback)

## Project Structure

```
inertia/
├── packages/
│   ├── core/           # Telemetry engine, router, event delegation
│   ├── components/     # Web Component primitives
│   ├── tokens/         # Design token engine (OKLCh)
│   ├── ingestion/      # Server-side monadic pipeline + aggregation endpoint
│   ├── db/             # PostgreSQL schema, migrations, RBAC, daily summaries, push client
│   └── hud/            # Analytics dashboard (client HUD + fleet dashboard)
├── sites/
│   └── studio/         # Studio website (first Inertia deployment)
│       ├── features/   # Feature modules (see Adding a Feature)
│       ├── server/
│       ├── public/
│       └── pages/
├── tools/
│   ├── critical-css/   # CSS extraction pipeline
│   └── build/          # Build tooling
├── docs/               # Architecture docs, specs, research
├── .husky/             # Git hooks
└── CLAUDE.md           # You are here
```

## Site Structure (Studio)

```
/                → Home (manifesto + pillars + ownership + proof)
/principles      → The Four Pillars (detailed engineering philosophy)
/services        → Appliance model, three pricing tiers, ownership list
/audit           → Live Lighthouse audit tool (lead generation)
/about           → Bio → Philosophy → Proof → Contact form (merged page)
/admin/hud       → Private analytics dashboard (authenticated)
/admin/fleet     → Fleet dashboard — all client sites in one view (authenticated)
```

Five public pages + two admin routes. No separate /contact page (merged into /about).

## Commands

- `pnpm install` — Install all workspace dependencies
- `pnpm build` — Build all packages
- `pnpm test` — Run tests across workspaces
- `pnpm lint` — Neostandard lint check
- `pnpm dev --filter=studio` — Dev server for studio site

## Code Rules

- Barrel exports for all module directories (`index.ts`)
- Named exports only. No default exports (except Web Component class registrations).
- All interfaces explicitly defined. No inferred return types on public functions.
- File naming: `kebab-case.ts` for modules, `PascalCase.ts` for Web Component classes
- Comments explain WHY, not WHAT
- Do not arbitrarily refactor `let` to `const` or vice versa. Respect intentional declarations.
- No enums. Use const unions: `const BusinessType = ['barbershop', 'legal', ...] as const`

## Adding a Feature

Features live in `sites/<site-name>/features/<feature-name>/`:

```
features/<feature-name>/
  components/    Web Components (Custom Elements)
  templates/     HTML fragments returned by server routes
  server/        Server-side route handlers (return HTML, not JSON)
  types/         TypeScript interfaces (monomorphic, explicit)
  schemas/       Zod schemas (.safeParse() only)
  telemetry/     Feature-specific IntentType definitions and data-* contracts
  config/        Constants and static dictionary maps
```

Only create what you use. No `try/catch`, no `switch`, no framework imports, no direct DOM mutation outside the router's fragment swap cycle.

## Commit Convention

Logical semantic micro-commits using conventional format:
- `feat(telemetry): implement ring buffer flush mechanics`
- `fix(ingestion): handle empty payload edge case`
- `refactor(router): extract fragment swap to dedicated module`
- `test(hud): RED — add fleet dashboard health indicator tests`

TDD commits must be tagged: `RED`, `GREEN`, or `REFACTOR` in the message.

## Post-Commit Indexing

After every commit, re-index the codebase and docs so search tools stay current:

1. `mcp__jcodemunch__index_folder` with `path: "/home/forrest/dev/inertia"` and `incremental: true`
2. `mcp__jdocmunch__index_local` with `path: "/home/forrest/dev/inertia"` and `incremental: true`

Always use `incremental: true` to avoid full re-index on every commit.

## Banned Patterns

These will fail code review. No exceptions.

- `try { } catch { }` in business logic (use Result monads)
- `switch` statements (use static dictionary maps)
- `enum` keyword (use const unions)
- `new` keyword for telemetry objects at runtime (pre-allocate at boot)
- `Record<string, any>` or any loose typing
- `import React` or any Virtual DOM framework in public-facing code
- `.parse()` on Zod schemas (use `.safeParse()` only)
- Third-party analytics scripts (Google Analytics, Adobe, etc.)
- `localStorage`/`sessionStorage` for critical application state
- `process.env` outside the centralized config module
- Cloudflare Tunnels (use WireGuard + VPS relay)
- Specific hardware brand names on public-facing pages

## When Compacting

Always preserve: the Four Pillars, infrastructure model (N100 + WireGuard + VPS + gliding failover), banned patterns list, current implementation phase, and any active file paths being worked on.

## File Boundaries

- Safe to edit: `packages/`, `sites/`, `tools/`, `docs/`
- Never touch: `node_modules/`, `.husky/` (edit via config only), any `dist/` output
- Read for context: `docs/ARCHITECTURE.md`, package-level `CLAUDE.md` files
