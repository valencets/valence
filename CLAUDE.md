# Inertia Framework

Deterministic web framework applying JSF aerospace coding standards to TypeScript, Web Components, and PostgreSQL. Proprietary engine for a solo web studio targeting local service businesses.

## Tech Stack

- Language: Vanilla ES6/ES7 + TypeScript (strict mode, zero `any`)
- UI: Native Web Components (Custom Elements), no React/Angular/Vue
- Styling: PostCSS + Tailwind CSS (design token driven)
- Routing: HTML-over-the-wire, `history.pushState()`, DOMParser fragment swaps
- Server: Node.js or Bun
- CMS: Headless (Sanity or Payload CMS)
- Database: PostgreSQL (client-owned, immutable ledger)
- Analytics: Self-hosted first-party telemetry engine
- Linting: Neostandard
- Validation: Zod (`.safeParse()` only, never `.parse()`)
- Error handling: `neverthrow` (Result monads)
- Package manager: pnpm workspaces (monorepo)

## The Four Pillars (Non-Negotiable)

1. **AV Rule 206** — No dynamic memory allocation after init. Pre-allocated circular buffers, monomorphic interfaces, in-place mutation only.
2. **AV Rule 208** — No exceptions. Zero `try/catch/throw` in business logic. ONE permitted boundary: `safeJsonParse()`. Everything else uses `Result<Ok, Err>` monads.
3. **AV Rule 3** — Cyclomatic complexity < 20 per function. Early returns, static dictionary maps, micro-componentization. No `switch` statements.
4. **14kB Protocol Limit** — Critical shell (inline CSS + initial DOM) must fit in first 10 TCP packets (~14kB compressed). No external stylesheets in critical path.

## Architecture Reference

For full architectural details, read `docs/ARCHITECTURE.md`. It covers:
- Telemetry engine (circular buffer, object pool, flush mechanics)
- Ingestion node (monadic pipeline, Black Hole strategy)
- Router (anticipatory prefetch, fragment swap, Web Component lifecycle preservation)
- Database schema (sessions/events tables, JSONB optimization, 1/80th rule)
- Offline conversion tracking (DNI, promo codes, proxy actions)

## Project Structure

```
inertia/
├── packages/
│   ├── core/           # Telemetry engine, router, event delegation
│   ├── components/     # Web Component primitives
│   ├── tokens/         # Design token engine
│   ├── ingestion/      # Server-side monadic pipeline
│   ├── db/             # PostgreSQL schema, migrations, RBAC
│   └── hud/            # Analytics dashboard components
├── sites/
│   └── studio/         # Studio website (first Inertia deployment)
├── tools/
│   ├── critical-css/   # CSS extraction pipeline
│   └── build/          # Build tooling
├── docs/               # Architecture docs, specs, research
├── .husky/             # Git hooks
└── CLAUDE.md           # You are here
```

## Commands

- `pnpm install` — Install all workspace dependencies
- `pnpm build` — Build all packages
- `pnpm test` — Run tests across workspaces
- `pnpm lint` — Neostandard lint check
- `pnpm dev --filter=studio` — Dev server for studio site

## Code Rules

- Barrel exports for all module directories (`index.ts`)
- Named exports only. No default exports (except Web Component class registrations)
- All interfaces explicitly defined. No inferred return types on public functions.
- File naming: `kebab-case.ts` for modules, `PascalCase.ts` for Web Component classes
- Comments explain WHY, not WHAT
- Do not arbitrarily refactor `let` to `const` or vice versa. Respect intentional declarations.

## Commit Convention

Logical semantic micro-commits using conventional format:
- `feat(telemetry): implement ring buffer flush mechanics`
- `fix(ingestion): handle empty payload edge case`
- `refactor(router): extract fragment swap to dedicated module`

Enforced via Husky pre-commit hooks.

## Banned Patterns

These will fail code review. No exceptions.

- `try { } catch { }` in business logic (use Result monads)
- `switch` statements (use static dictionary maps)
- `new` keyword for telemetry objects at runtime (pre-allocate at boot)
- `Record<string, any>` or any loose typing
- `import React` or any Virtual DOM framework
- `.parse()` on Zod schemas (use `.safeParse()` only)
- Third-party analytics scripts (Google, Adobe, etc.)
- `localStorage`/`sessionStorage` for critical application state

## Implementation Priority

Build in this order. Data flow locks before UI work begins.

1. `packages/core/src/telemetry/` — Ring buffer, monomorphic interfaces, event delegation
2. `packages/ingestion/` — Monadic pipeline, safeJsonParse, Zod validation, Black Hole
3. `packages/db/` — PostgreSQL schema, migrations, RBAC immutability
4. `packages/core/src/router/` — Push-state, DOMParser, anticipatory prefetch
5. `packages/components/` — Web Component primitives with moveBefore() lifecycle
6. `packages/tokens/` — Design token engine driving PostCSS/Tailwind
7. `tools/critical-css/` — Server-side extraction for 14kB compliance
8. `packages/hud/` — Analytics dashboard inside CMS admin
9. `sites/studio/` — Studio website, first production deployment

## When Compacting

Always preserve: the Four Pillars, banned patterns list, current implementation phase, and any active file paths being worked on.

## File Boundaries

- Safe to edit: `packages/`, `sites/`, `tools/`, `docs/`
- Never touch: `node_modules/`, `.husky/` (edit via config only), any `dist/` output
- Read for context: `docs/ARCHITECTURE.md`, package-level `CLAUDE.md` files
