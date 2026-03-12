# Inertia Framework — Agent Manifest

Comprehensive onboarding reference for any agent working in this codebase. Read this before writing a single line of code.

---

## What Is Inertia?

Inertia is a deterministic web framework that applies JSF (Joint Strike Fighter) aerospace coding standards to TypeScript, Web Components, and PostgreSQL. It is the proprietary engine for a solo web studio that delivers **physical web server appliances** to local service businesses (barbershops, dental offices, law firms).

Each client gets a fanless x86 mini-PC running the full stack locally. A disposable VPS acts as a reverse proxy via WireGuard tunnel. The client owns their data, their server, and their website. This is the core value proposition — full ownership, zero cloud dependency.

---

## The Four Pillars (Non-Negotiable)

These are hard rules. Violating any of them will fail code review. No exceptions, no shortcuts, no "just this once."

### AV Rule 206 — No Dynamic Memory Allocation After Init

In C++, heap allocation causes fragmentation. In JavaScript, it causes GC pauses that drop frames. Pre-allocate all structures at boot. Mutate in-place. Never create/destroy during runtime.

- **Telemetry**: `TelemetryObjectPool` pre-allocates intent slots. `TelemetryRingBuffer` uses fixed-capacity circular buffer with modulo arithmetic.
- **Admin/fleet paths** are relaxed (no public-facing perf impact), but still avoid gratuitous allocation.
- `new Date()` in route handlers is tolerated. `new BusinessObject()` per request is not.

### AV Rule 208 — No Exceptions

The Ariane 5 exploded because of an unhandled exception. Every function returns `Result<Ok, Err>` via the `neverthrow` library. The compiler forces explicit handling of both branches.

- **Zero `try/catch/throw`** in business logic.
- **ONE boundary**: `safeJsonParse()` in `packages/ingestion/` wraps `JSON.parse` via `neverthrow.fromThrowable()`. The throw lives inside neverthrow, not our code.
- When you need to signal failure inside `ResultAsync.fromPromise()`, use `return Promise.reject(new Error(...))` — never `throw`.

### AV Rule 3 — Cyclomatic Complexity < 20

Formula: `V(G) = E - N + 2P`. Every `if`, `for`, `while`, `&&`, `||` adds a decision path. Above 20, exhaustive testing is mathematically impossible.

- Use early returns, static dictionary maps, and micro-componentization.
- **No `switch` statements.** Use dictionary maps: `const handlers: Record<Key, Handler> = { ... }`.
- **No `enum` keyword.** Use const unions: `const Foo = ['a', 'b'] as const; type Foo = typeof Foo[number]`.

### 14kB Protocol Limit

Critical shell (inline CSS + initial DOM) must fit in the first 10 TCP packets (~14kB compressed). No external stylesheets in the critical path. Admin pages are relaxed but still budget-conscious.

---

## Banned Patterns

These will fail code review. Memorize them.

| Pattern | Why | Use Instead |
|---------|-----|-------------|
| `try { } catch { }` | AV Rule 208 | `Result<Ok, Err>` monads |
| `switch (x) { }` | AV Rule 3 | Static dictionary maps |
| `enum Foo { }` | No enums | `const Foo = [...] as const` |
| `new TelemetryObj()` at runtime | AV Rule 206 | Pre-allocate at boot |
| `Record<string, any>` | Loose typing | Explicit interfaces |
| `.parse()` on Zod | Throws on failure | `.safeParse()` only |
| `import React` | No VDOM frameworks | Native Web Components |
| `localStorage`/`sessionStorage` | Fragile state | Server-delivered HTML |
| `process.env` outside config.ts | Scattered config | Centralized `loadConfig()` |
| Third-party analytics | Self-hosted only | Inertia telemetry engine |
| `throw new Error(...)` | AV Rule 208 | `err(...)` or `Promise.reject(...)` |

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript (strict mode, zero `any`) | ES2022 target, ESNext modules |
| UI | Native Web Components | Light DOM, `connectedMoveCallback` lifecycle |
| Styling | PostCSS + Tailwind CSS 4.0 | OKLCh color space, design tokens |
| Routing | HTML-over-the-wire | `history.pushState()`, DOMParser fragment swaps |
| Server | Node.js (http module) | No Express, no Fastify |
| Database | PostgreSQL | Immutable append-only ledger, INSERT+SELECT only |
| Validation | Zod 4.x | `.safeParse()` exclusively |
| Error handling | neverthrow | `Result<Ok, Err>`, `ResultAsync`, `.andThen()`, `.map()` |
| Linting | Neostandard (ESLint 9) | Pre-commit hook enforced |
| Testing | Vitest 4.x + happy-dom | ~966 tests across 79 test files |
| Package mgr | pnpm 10.x workspaces | Monorepo, `node >= 22` |
| Build | TypeScript compiler (`tsc`) | Per-package, outputs to `dist/` |
| DB driver | `postgres` (porsager/postgres) | Tagged template SQL, parameterized by default |

---

## Project Structure

```
inertia/
├── packages/
│   ├── core/           # Telemetry engine + HTML-over-the-wire router
│   ├── components/     # Web Component primitives (TrackingButton, TrackingLink, TrackingForm)
│   ├── tokens/         # Design token engine (OKLCh, tailwind-variants)
│   ├── ingestion/      # Server-side monadic pipeline, HMAC, aggregation
│   ├── db/             # PostgreSQL schema, migrations, queries, fleet data
│   └── hud/            # Analytics dashboard components (client HUD + fleet dashboard)
├── sites/
│   └── studio/         # Studio website (first Inertia deployment)
│       ├── features/   # 14 feature modules (self-contained)
│       ├── server/     # Entry point, router, config, middleware
│       ├── scripts/    # Standalone scripts (aggregate-and-push)
│       ├── public/     # Static assets
│       └── pages/      # Top-level page shells (minimal)
├── tools/
│   ├── critical-css/   # CSS extraction for 14kB budget enforcement
│   └── build/          # Build tooling
├── docs/
│   ├── ARCHITECTURE.md # Full architectural reference (460 lines, 12 sections)
│   └── HUD_SPEC.md     # Analytics dashboard design spec
├── .husky/
│   └── pre-commit      # Runs: pnpm lint
├── CLAUDE.md           # AI agent instructions (this file's parent)
├── CONTRIBUTING.md     # Human contributor guide
├── MANIFEST.md         # You are here
├── package.json        # Root monorepo config
├── pnpm-workspace.yaml # Workspace: packages/*, sites/*, tools/*
├── tsconfig.json       # Root TypeScript config (strict)
└── eslint.config.js    # Neostandard config
```

---

## Workspace Packages

### @inertia/core
**Purpose**: Client-side telemetry engine and HTML-over-the-wire router.

Two subsystems:
- **Telemetry**: `GlobalTelemetryIntent` monomorphic interface, `TelemetryObjectPool` (pre-allocated slots), `TelemetryRingBuffer` (circular buffer), event delegation via `data-*` attributes, `sendBeacon` flush.
- **Router**: `history.pushState()` navigation, `DOMParser` fragment extraction, `replaceChildren()` swap, `Element.moveBefore()` for persistent Web Components, hover-intent prefetch with velocity calculation.

**Key exports**: `IntentType`, `TelemetryObjectPool`, `TelemetryRingBuffer`, `initEventDelegation`, `flushTelemetry`, `initRouter`, `initPrefetch`, `swapContent`

### @inertia/components
**Purpose**: Native Web Component primitives for telemetry tracking.

- `TrackingButton` (`<inertia-button>`) — CTA tracking
- `TrackingLink` (`<inertia-link>`) — Navigation intent tracking
- `TrackingForm` (`<inertia-form>`) — Form submission capture

All dispatch telemetry via `data-*` attributes, handled by core's event delegation.

### @inertia/tokens
**Purpose**: Design token engine driving PostCSS/Tailwind for all client sites.

Two-tier CSS variable system: `:root`/`.dark` define raw tokens, `@theme inline` maps to Tailwind namespace. Uses `tailwind-variants` (`tv()`) for framework-agnostic variant composition.

**Key exports**: `parseTheme`, `resolveTheme`, `generateCSS`, `cn`, `tv`

### @inertia/ingestion
**Purpose**: Server-side telemetry ingestion — monadic pipeline from raw HTTP to database.

Pipeline: raw string → `safeJsonParse()` → Zod validation → persist. Always returns HTTP 200 (Black Hole strategy — prevents client retry storms).

Also contains:
- **HMAC module**: `signPayload()` / `verifySignature()` for fleet push authentication
- **Aggregation pipeline**: Receives daily summaries from client appliances
- **Daily summary schema**: Zod validation for fleet data

**Key exports**: `safeJsonParse`, `validateTelemetryPayload`, `createIngestionPipeline`, `createIngestionHandler`, `signPayload`, `verifySignature`, `validateDailySummary`, `createAggregationPipeline`

### @inertia/db
**Purpose**: PostgreSQL schema, migrations, query helpers, fleet data.

**Driver**: `postgres` (porsager/postgres) — tagged template SQL, parameterized by default, zero deps. Import as `import postgres from 'postgres'` (default import, third-party API).

**Immutability model**: Application service account has INSERT + SELECT only. UPDATE, DELETE, TRUNCATE revoked. Corrections are compensating events, never mutations. Exception: `daily_summaries.synced_at` is updated by fleet sync.

**JSONB rules**: 1/80th Rule — if a JSONB key appears in >1/80th of rows, extract to a typed column. GIN index uses `jsonb_path_ops`. Keep payloads under 2kB.

**Migrations** (in `migrations/`):
1. `001-init.sql` — Core tables (sessions, events)
2. `002-rbac.sql` — Role-based access control
3. `003-summary-tables.sql` — Pre-aggregated summaries (session, event, conversion, ingestion health)
4. `004-contact.sql` — Contact form data
5. `005-daily-summaries.sql` — Fleet daily aggregation (multi-tenant)

**Key exports**: `createPool`, `closePool`, `createSession`, `insertEvents`, `generateDailySummary`, `getFleetSites`, `getFleetComparison`, `insertDailySummaryFromRemote`

### @inertia/hud
**Purpose**: Self-hosted analytics dashboard — Web Components for data visualization.

- **All visualization is hand-built SVG and CSS.** No charting libraries (no D3, no Recharts, no Chart.js).
- Sparklines are single `<polyline>` elements mutated in-place.
- Color is functional per MIL-STD-1472G: green=positive, red=negative, amber=warning.

**Components**: `HudSparkline`, `HudMetric`, `HudBar`, `HudTable`, `HudStatus`, `HudTimeRange`, `HudPanel`

**Layouts**: `ClientDashboard`, `DiagnosticDashboard`, `FleetDashboard`, `FleetComparison`

**Data fetchers**: `fetchSessionSummary`, `fetchFleetSites`, `fetchFleetComparison` — all return `ResultAsync`

### @inertia/critical-css
**Purpose**: PostCSS AST walking for 14kB budget enforcement. Extracts critical CSS from full stylesheet.

---

## Studio Site (First Deployment)

### Route Map

| Path | Method | Handler | Auth |
|------|--------|---------|------|
| `/` | GET | `homeHandler` | Public |
| `/principles` | GET | `principlesHandler` | Public |
| `/about` | GET | `aboutHandler` | Public |
| `/services` | GET | `servicesHandler` | Public |
| `/contact` | GET, POST | `contactGetHandler`, `contactPostHandler` | Public |
| `/audit` | GET, POST | `auditGetHandler`, `auditPostHandler` | Public |
| `/admin/hud` | GET, POST | `createHudHandler`, `createHudPostHandler` | Bearer/cookie token |
| `/admin/fleet` | GET | `createFleetOverviewHandler` | Bearer/cookie token |
| `/admin/fleet/compare` | GET | `createFleetCompareHandler` | Bearer/cookie token |
| `/api/telemetry` | POST | `telemetryHandler` | None (Black Hole) |
| `/api/session` | POST | `sessionHandler` | None |
| `/api/aggregation` | POST | `aggregationHandler` | HMAC signature |
| `/api/fleet/sites` | GET | `fleetSitesHandler` | None |
| `/api/fleet/compare` | GET | `fleetComparisonHandler` | None |
| `/api/summaries/sessions` | GET | `sessionSummaryHandler` | None |
| `/api/summaries/events` | GET | `eventSummaryHandler` | None |
| `/api/summaries/conversions` | GET | `conversionSummaryHandler` | None |
| `/api/diagnostics/ingestion` | GET | `ingestionHealthHandler` | None |
| `/404` | GET | `notFoundHandler` | Public |

### Feature Modules (14 total)

Each lives in `sites/studio/features/<name>/` with subdirectories as needed:

| Feature | Purpose |
|---------|---------|
| `home` | Homepage — manifesto, pillars, ownership proof |
| `principles` | The Four Pillars detail page |
| `services` | Appliance model, pricing tiers |
| `about` | Bio + philosophy + proof + contact (merged page) |
| `contact` | Contact form with Zod validation |
| `audit` | Live Lighthouse audit tool (lead gen) |
| `admin` | Auth gateway, HUD handler, fleet handler, aggregation, push client |
| `telemetry` | Telemetry data ingestion endpoint |
| `glass-box` | Telemetry overlay component (dev diagnostic) |
| `theme` | Theme configuration |
| `not-found` | 404 handler |
| `budget` | 14kB budget compliance tests |
| `client` | Client HUD integration tests |
| `deploy` | Deployment configuration tests |

### Feature Directory Convention

```
features/<feature-name>/
  components/    Web Components (Custom Elements)
  templates/     HTML fragments returned by server routes
  server/        Server-side route handlers (return HTML, not JSON)
  types/         TypeScript interfaces (monomorphic, explicit)
  schemas/       Zod schemas (.safeParse() only)
  telemetry/     Feature-specific IntentType definitions and data-* contracts
  config/        Constants and static dictionary maps
  __tests__/     Test files
```

Only create directories you use. Not every feature needs all of these.

### Server Architecture

- **Entry**: `server/entry.ts` — HTTP server bootstrap, middleware chain
- **Router**: `server/router.ts` — Route registration, fragment protocol (`X-Inertia-Fragment: 1`)
- **Config**: `server/config.ts` — Centralized `loadConfig()` reads all env vars
- **Shell**: `server/shell.ts` — HTML shell template, `renderShell()` / `renderFragment()`
- **Types**: `server/types.ts` — `RouteHandler`, `RouteContext`, `ServerConfig`, `ServerError`

**RouteHandler signature**:
```typescript
type RouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: RouteContext) => Promise<void>
```

**RouteContext** provides `pool` (DbPool) and `config` (ServerConfig) to every handler.

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `STUDIO_PORT` | `3000` | Server port |
| `STUDIO_HOST` | `0.0.0.0` | Server bind address |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `inertia_studio` | Database name |
| `DB_USER` | `inertia_app` | Database user |
| `DB_PASSWORD` | `changeme` | Database password |
| `DB_MAX_CONNECTIONS` | `10` | Connection pool size |
| `ADMIN_TOKEN` | `''` | Bearer token for admin routes |
| `SITE_ID` | `'studio'` | Site identifier for fleet |
| `BUSINESS_TYPE` | `'studio'` | Business category |
| `SITE_SECRET` | `''` | HMAC secret for fleet push |
| `STUDIO_ENDPOINT` | `''` | URL to push daily summaries to |

---

## Error Handling Patterns

### Error Type Convention

Every domain uses the const union + interface pattern:

```typescript
// 1. Define error codes as const object
export const FooErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT'
} as const

// 2. Derive the union type
export type FooErrorCode = typeof FooErrorCode[keyof typeof FooErrorCode]

// 3. Define the error interface
export interface FooError {
  readonly code: FooErrorCode
  readonly message: string
}
```

### Result Monad Usage

```typescript
import { ok, err, Result, ResultAsync } from 'neverthrow'

// Synchronous
function validate (input: string): Result<ValidData, FooError> {
  if (input.length === 0) return err({ code: FooErrorCode.INVALID_INPUT, message: 'empty' })
  return ok(parseData(input))
}

// Asynchronous (DB, HTTP)
function fetchThing (pool: DbPool, id: string): ResultAsync<Thing, DbError> {
  return ResultAsync.fromPromise(
    pool.sql`SELECT * FROM things WHERE id = ${id}`.then(rows => rows[0]),
    mapPostgresError
  )
}

// Chaining
const result = safeJsonParse(body)
  .andThen(validatePayload)
  .map(transform)
```

### Black Hole Strategy

Telemetry and aggregation endpoints always return HTTP 200 OK, even on validation failure. This prevents client retry storms. Bad payloads are logged to audit and silently dropped.

---

## Testing

### Environment

- **Framework**: Vitest 4.x
- **DOM**: happy-dom (not jsdom)
- **Pattern**: `src/__tests__/*.test.ts` within each package, `features/<name>/__tests__/` in studio

### TDD Discipline

All development follows strict RED → GREEN → REFACTOR:

1. **RED**: Write a failing test specifying the behavior. Commit: `test(scope): RED — description`
2. **GREEN**: Write minimum code to pass. Commit: `feat(scope): GREEN — description`
3. **REFACTOR**: Improve without changing behavior. Commit: `refactor(scope): REFACTOR — description`

### Test Patterns

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

// Dynamic import pattern for modules that need happy-dom
let MyComponent: typeof import('../my-component.js').MyComponent
beforeAll(async () => {
  const mod = await import('../my-component.js')
  MyComponent = mod.MyComponent
})

// Web Component testing
function createElement (): HTMLElement {
  const el = document.createElement('my-component')
  document.body.appendChild(el)
  return el
}
```

### Running Tests

```bash
pnpm test              # All workspaces
pnpm test -- --run     # Without watch mode
pnpm test --filter=@inertia/db  # Single package
```

### Current Test Count

~966 tests across 79 test files, all passing.

---

## Commit Convention

Conventional format with semantic micro-commits:

```
feat(scope): description        # New feature
fix(scope): description         # Bug fix
refactor(scope): description    # Code improvement, no behavior change
test(scope): description        # Adding/modifying tests
docs(scope): description        # Documentation
chore(scope): description       # Dependencies, config, tooling
```

**Scopes**: `core`, `components`, `tokens`, `ingestion`, `db`, `hud`, `critical-css`, `studio`, `admin`, `telemetry`, `router`

**TDD tags**: RED, GREEN, REFACTOR must appear in the commit message for TDD commits.

**Pre-commit hook**: `pnpm lint` runs automatically. Lint must pass before commit.

---

## Build System

```bash
pnpm install           # Install all workspace dependencies
pnpm build             # Build all packages (tsc in each)
pnpm lint              # Neostandard lint check
pnpm dev --filter=studio  # Dev server for studio site
```

**Build order** matters — packages with cross-workspace dependencies must build after their dependencies. `pnpm -r run build` handles this via topological sort.

**Output**: Each package emits to `dist/` with `.js`, `.d.ts`, `.d.ts.map`, `.js.map`. Never edit `dist/` directly.

---

## Cross-Package Import Rules

| Package | Can Import From | Cannot Import From |
|---------|----------------|-------------------|
| `@inertia/core` | Nothing | All others |
| `@inertia/components` | Nothing | All others |
| `@inertia/tokens` | Nothing (Zod, neverthrow are external deps) | All others |
| `@inertia/ingestion` | Nothing (Zod, neverthrow, node:crypto) | All others |
| `@inertia/db` | Nothing (postgres, neverthrow, zod) | All others |
| `@inertia/hud` | Nothing (neverthrow) | All others |
| `studio` (site) | All `@inertia/*` packages | — |

**Key rule**: Packages do not import from each other. Wiring happens at the site/app layer. The studio site imports from all packages and composes them.

---

## Infrastructure Model

### Client Appliance
- Fanless x86 mini-PC (Intel N100, 8GB RAM, NAS-grade NVMe)
- Inline 12V DC mini-UPS
- Runs full stack: Node.js server + PostgreSQL + telemetry

### Network
- Appliance → outbound WireGuard tunnel → stateless VPS (Hetzner/DO, $4/mo)
- VPS runs Caddy as reverse proxy, handles SSL
- VPS is disposable — spin new one in 60 seconds

### Gliding Failover
- On CMS publish: compile static HTML snapshot, rsync to VPS
- Appliance offline → Caddy serves static snapshot
- Appliance online → live serving resumes
- Telemetry pauses during failover, storefront never goes dark

### Fleet Architecture
- Each client appliance generates `daily_summaries` (one row per day)
- HMAC-SHA256 signed payload pushed to studio's `/api/aggregation`
- Studio aggregates all client data for fleet dashboard (`/admin/fleet`)
- `aggregate-and-push.ts` script runs via systemd timer on each appliance

---

## File Boundaries

- **Safe to edit**: `packages/`, `sites/`, `tools/`, `docs/`
- **Never touch**: `node_modules/`, `.husky/` (edit via config only), any `dist/` output
- **Read for context**: `docs/ARCHITECTURE.md`, package-level `CLAUDE.md` files

---

## Key Architectural Decisions

1. **No framework runtime on public pages.** React exists only in Payload CMS admin panel. Public pages are vanilla Web Components + HTML-over-the-wire.

2. **Server routes return HTML, not JSON.** The router fetches HTML fragments and swaps them into the DOM. JSON APIs exist only for telemetry ingestion, fleet data, and summary queries.

3. **Fragment protocol**: Client sends `X-Inertia-Fragment: 1` header. Server responds with just the `<main>` content (no shell). Without the header, server sends full HTML shell.

4. **Web Component lifecycle preservation**: `Element.moveBefore()` preserves component state across router swaps. Components implement `connectedMoveCallback()` as a no-op to signal they support this.

5. **Pre-aggregated data only for dashboards**: HUD reads from summary tables (`session_summaries`, `event_summaries`, etc.), never raw `events`. The 1/80th rule governs when JSONB keys get promoted to typed columns.

6. **Immutable database**: Application user has INSERT + SELECT only. No UPDATE, no DELETE. Corrections are compensating events. The one exception is `daily_summaries.synced_at` which is updated by fleet sync.

7. **Black Hole ingestion**: Telemetry and aggregation endpoints always return 200 OK. Bad payloads are audited and dropped. This prevents retry storms from client-side flush logic.

---

## Quick Reference: Common Tasks

### Adding a new feature to studio
1. Create `sites/studio/features/<name>/`
2. Add server handler in `features/<name>/server/`
3. Add template in `features/<name>/templates/`
4. Register route in `sites/studio/server/register-routes.ts`
5. Write tests in `features/<name>/__tests__/`

### Adding a new database table
1. Create migration `packages/db/migrations/NNN-name.sql`
2. Add types in `packages/db/src/<name>-types.ts`
3. Add queries in `packages/db/src/<name>-queries.ts`
4. Export from `packages/db/src/index.ts`
5. Run `pnpm build` to update dist

### Adding a new HUD component
1. Create `packages/hud/src/components/HudFoo.ts`
2. Tag: `<hud-foo>`, Class: `HudFoo extends HTMLElement`
3. Register: `customElements.define('hud-foo', HudFoo)`
4. Export from `packages/hud/src/index.ts`
5. Hand-built SVG/CSS only — no charting libraries

### Adding a Zod schema
1. Define schema with `z.object({ ... })`
2. Create validation function returning `Result<ValidData, ValidationFailure>`
3. Use `.safeParse()` — never `.parse()`
4. Nullable fields: `z.number().nullable()`, not `.optional()`
