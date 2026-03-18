# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Valence Framework

Schema-driven web framework with built-in CMS, telemetry, and a zero-dependency UI primitive library. TypeScript, Web Components, PostgreSQL.

## What Valence Is

Valence is a web framework where content management and analytics are first-class primitives. Define a schema, get a database, an admin interface, validation, and conversion tracking out of the box. Every UI component extends a protocol base class (`ValElement`) that enforces accessibility, i18n, CMS traceability, and telemetry emission at the platform level.

Valence is **deployment-agnostic**. It runs anywhere Node.js and PostgreSQL run: a VPS, a container, a bare-metal server, edge hardware. The framework does not care where it's deployed. Deployment strategy is an application concern, not a framework concern.

## Tech Stack

| Layer          | Technology                             | Notes                                           |
| -------------- | -------------------------------------- | ----------------------------------------------- |
| Language       | TypeScript (strict mode, zero `any`)   | ES2022 target, ESNext modules                   |
| UI             | Native Web Components via `ValElement` | Protocol base class with 4 pillars              |
| Styling        | CSS custom properties (design tokens)  | Tailwind for light DOM layout                   |
| Routing        | HTML-over-the-wire                     | `history.pushState()`, DOMParser fragment swaps |
| Server         | Node.js (http module)                  | No Express, no Fastify                          |
| Database       | PostgreSQL                             | Tagged template SQL via `postgres` driver       |
| Validation     | Zod 4.x                                | `.safeParse()` exclusively                      |
| Error handling | Result monads                          | `neverthrow` (npm)                              |
| Linting        | Neostandard (ESLint 9)                 | Pre-commit hook enforced                        |
| Testing        | Vitest 4.x + happy-dom                 | ~991 tests across monorepo                      |
| Package mgr    | pnpm 10.x workspaces                   | Monorepo, `node >= 22`                          |
| Build          | TypeScript compiler (`tsc`)            | Per-package, outputs to `dist/`                 |

## The Four Pillars (Non-Negotiable)

1. **AV Rule 206** — No dynamic memory allocation after init. Pre-allocated circular buffers, monomorphic interfaces, in-place mutation only.
2. **AV Rule 208** — No exceptions. Zero `try/catch/throw` in business logic. ONE permitted boundary: `safeJsonParse()`. Everything else uses `Result<Ok, Err>` monads.
3. **AV Rule 3** — Cyclomatic complexity < 20 per function. Early returns, static dictionary maps, micro-componentization. No `switch` statements. No enums (const unions only).
4. **14kB Protocol Limit** — Critical shell (inline CSS + initial DOM) must fit in first 10 TCP packets (~14kB compressed). No external stylesheets in critical path.

## Package Structure

```
valencets/
├── packages/
│   ├── core/           # Framework runtime: router, config, CLI, build validator
│   ├── db/             # PostgreSQL: tagged template queries, migrations, Result types
│   ├── ui/             # ValElement protocol + Web Component primitives (zero deps)
│   ├── cms/            # Schema engine, admin UI, auth, media uploads
│   └── telemetry/      # Beacon, ingestion, event storage, analytics HUD
├── apps/
│   └── studio/         # Studio website (first Valence deployment, private)
├── docs/               # Architecture docs, specs
├── .husky/             # Git hooks
├── CLAUDE.md           # You are here
└── CONTRIBUTING.md     # Contributor guide
```

## Package Dependency Graph

```
ui          (standalone, zero internal deps)
db          (depends on neverthrow, postgres, zod)
core        (depends on neverthrow)
telemetry   → db, ui
cms         → core, db, ui, zod
```

Five packages, no cycles. `ui`, `db`, and `core` have zero cross-workspace dependencies. `telemetry` and `cms` compose from them.

### @valencets/core — Framework Runtime

**Current state: Router + telemetry engine implemented and tested.**

- **Router:** `history.pushState()` navigation, `DOMParser` fragment extraction, `replaceChildren()` swap, `Element.moveBefore()` for persistent Web Components, hover-intent prefetch with velocity calculation, page cache with SWR revalidation.
- **Telemetry:** `GlobalTelemetryIntent` monomorphic interface, `TelemetryObjectPool` (pre-allocated slots), `TelemetryRingBuffer` (circular buffer), event delegation via `data-*` attributes, `sendBeacon` flush.
- **Server:** `createServerRouter()` with typed route handlers, `sendHtml()`, `sendJson()`, fragment protocol support.
- **TODO:** `defineConfig()`, CLI (`valence dev`, `valence migrate`), build validator, critical CSS extraction.

### @valencets/db — PostgreSQL Layer

**Current state: Connection pool, migrations, error mapping implemented and tested.**

Framework-level database primitives only. Telemetry queries migrated to `@valencets/telemetry`, studio business logic migrated to `apps/studio/`.

- `connection.ts` — `createPool()`, `closePool()`, `validateDbConfig()`, `mapPostgresError()`
- `migration-runner.ts` — `loadMigrations()`, `runMigrations()`, `getMigrationStatus()`
- `types.ts` — `DbPool`, `DbError`, `DbErrorCode`, `DbConfig`

**Driver:** `postgres` (porsager/postgres) — tagged template SQL, parameterized by default, zero deps.

### @valencets/ui — ValElement Protocol + Primitives

**Current state: Package scaffolded, architecture designed, not yet implemented.**

Protocol base class (`ValElement`) that every component extends. Four pillars baked into the base: telemetry emission (opt-in per instance), CMS traceability via `data-cms-id`, i18n via `Intl` and shared `lang` attribute observation, ARIA via `ElementInternals`.

See Linear doc "[@valencets/ui Architecture](https://linear.app/inertiastudio/document/valencetsui-architecture-protocol-base-class-component-inventory-0a551a293c0a)" for full component inventory and design decisions.

Key architectural decisions:

- Interactive components (button, input, dialog) use Shadow DOM with CSS custom properties
- Layout components (stack, grid, section) use light DOM and can use Tailwind directly
- Shared singleton locale observer (not one MutationObserver per instance)
- Template-clone-once pattern (never `innerHTML` on re-render)
- Form-associated custom elements via `ElementInternals`

### @valencets/cms — Schema Engine + Admin

**Current state: Package scaffolded, architecture designed, not yet implemented.**

Schema engine: `collection()` + `field.*` API generates Postgres tables, Zod validators, and admin UI from a single TypeScript definition. Server-rendered admin panel built on `@valencets/ui`. Session-based auth with Argon2id. Local filesystem media storage.

See Linear doc "[Valence CMS Architecture Summary](https://linear.app/inertiastudio/document/valence-cms-architecture-summary-c6760d2c193c)" for full spec.

### @valencets/telemetry — Analytics

**Current state: Package scaffolded, core telemetry engine exists in @valencets/core, needs extraction.**

Client beacon (page path, referrer, session ID, events). Server ingestion endpoint. Pre-allocated ring buffer for event storage. Daily summary aggregation. Analytics HUD. Zero third-party scripts in the browser.

The client-side telemetry engine (ring buffer, object pool, event delegation, flush) currently lives in `@valencets/core`. The server-side ingestion, aggregation, and HUD need to be assembled from code currently scattered across `@valencets/db` and the studio app.

## Banned Patterns

These will fail code review. No exceptions.

| Pattern                         | Why                | Use Instead                         |
| ------------------------------- | ------------------ | ----------------------------------- |
| `try { } catch { }`             | AV Rule 208        | `Result<Ok, Err>` monads            |
| `switch (x) { }`                | AV Rule 3          | Static dictionary maps              |
| `enum Foo { }`                  | No enums           | `const Foo = [...] as const`        |
| `new TelemetryObj()` at runtime | AV Rule 206        | Pre-allocate at boot                |
| `Record<string, any>`           | Loose typing       | Explicit interfaces                 |
| `.parse()` on Zod               | Throws on failure  | `.safeParse()` only                 |
| `import React`                  | No VDOM frameworks | Native Web Components               |
| `localStorage`/`sessionStorage` | Fragile state      | Server-delivered HTML               |
| `process.env` outside config    | Scattered config   | Centralized `loadConfig()`          |
| Third-party analytics           | Self-hosted only   | Valence telemetry engine            |
| `throw new Error(...)`          | AV Rule 208        | `err(...)` or `Promise.reject(...)` |
| `export default`                | Named exports only | `export function/class/const`       |

## Error Handling Pattern

Every domain uses the const union + interface pattern:

```typescript
export const FooErrorCode = {
  NOT_FOUND: "NOT_FOUND",
  INVALID_INPUT: "INVALID_INPUT",
} as const;

export type FooErrorCode = (typeof FooErrorCode)[keyof typeof FooErrorCode];

export interface FooError {
  readonly code: FooErrorCode;
  readonly message: string;
}
```

All async operations return `ResultAsync<T, E>`. All sync operations return `Result<T, E>`. Chain via `.andThen()`, `.map()`, `.match()`.

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm build                # Build all packages (tsc in each)
pnpm test                 # Run tests across all workspaces
pnpm test:ci              # Run tests with concurrency limit (CI)
pnpm lint                 # Neostandard lint check
pnpm validate             # Full CI gate: typecheck + lint
pnpm dev --filter=studio  # Dev server for studio app
```

## Testing

- **Framework:** Vitest 4.x with happy-dom environment
- **Test location:** `src/__tests__/*.test.ts` in packages
- **Pattern:** `beforeAll` dynamic import, `createElement`/`attach` helpers for Web Components
- **TDD discipline:** RED → GREEN → REFACTOR commits
- Test both `Ok` and `Err` branches of all Result-returning functions

## Code Rules

- Barrel exports for all module directories (`index.ts`)
- Named exports only. No default exports (except Web Component class registrations).
- All interfaces explicitly defined. No inferred return types on public functions.
- File naming: `kebab-case.ts` for modules, `PascalCase.ts` for Web Component classes
- Comments explain WHY, not WHAT
- No enums. Use const unions: `const BusinessType = ['barbershop', 'legal', ...] as const`

## Commit Convention

Logical semantic micro-commits using conventional format:

```
feat(scope): description        # New feature
fix(scope): description         # Bug fix
refactor(scope): description    # Code improvement, no behavior change
test(scope): description        # Adding/modifying tests
docs(scope): description        # Documentation
chore(scope): description       # Dependencies, config, tooling
```

**Scopes:** `core`, `db`, `ui`, `cms`, `telemetry`, `studio`

**TDD tags:** RED, GREEN, REFACTOR must appear in the commit message for TDD commits.

## Cross-Package Import Rules

| Package                | Can Import From                                            |
| ---------------------- | ---------------------------------------------------------- |
| `@valencets/core`      | `neverthrow` only                                          |
| `@valencets/db`        | `neverthrow`, `postgres`, `zod`                            |
| `@valencets/ui`        | Nothing (zero deps)                                        |
| `@valencets/cms`       | `@valencets/core`, `@valencets/db`, `@valencets/ui`, `zod` |
| `@valencets/telemetry` | `@valencets/db`, `@valencets/ui`                           |

## File Boundaries

- **Safe to edit:** `packages/`, `apps/`, `docs/`
- **Never touch:** `node_modules/`, `.husky/` (edit via config only), any `dist/` output
- **Read for context:** `docs/ARCHITECTURE.md`, package-level `CLAUDE.md` files

## Current Development Priority

1. `@valencets/ui` — ValElement base class + first 6 components (button, input, form, stack, grid, heading)
2. `@valencets/cms` — Schema engine (`collection()`, `field.*`), migration generator, query builder
3. Clean up `@valencets/db` — Move telemetry-specific and studio-specific code to correct packages
4. `@valencets/telemetry` — Extract and consolidate telemetry code from core and db
5. `@valencets/core` — Add `defineConfig()`, CLI tooling

## What NOT to Build Yet

- npm create valence@latest scaffolding
- Docs site (valenceframework.dev)
- Rich text editor (Lexical integration)
- JSON API / headless mode
- Revision history / immutable ledger
- Multi-role RBAC (single admin user for v1)
- Media optimization pipeline (just file upload for v1)
- Lifecycle hooks engine
