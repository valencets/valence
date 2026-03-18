# Valence

Schema-driven web framework with built-in CMS, telemetry, and a zero-dependency UI primitive library. TypeScript, Web Components, PostgreSQL.

## What Valence Is

Valence is a web framework where content management and analytics are first-class primitives, not bolted-on plugins. Define a schema, get a database, an admin interface, validation, and conversion tracking out of the box. Every UI component extends a protocol base class that enforces accessibility, i18n, CMS traceability, and telemetry emission at the platform level.

Valence is deployment-agnostic. It runs anywhere Node.js and PostgreSQL run: a VPS, a container, a bare-metal server, edge hardware.

## Packages

```
packages/
  core/        Framework runtime: router, server, telemetry engine
  db/          PostgreSQL: connection pool, migrations, Result types
  ui/          ValElement protocol + Web Component primitives (zero deps)
  cms/         Schema engine, admin UI, auth, media uploads, REST API
  telemetry/   Beacon, ingestion, event storage, analytics HUD
```

### @valencets/core

Router (`history.pushState()` navigation, DOMParser fragment swaps, hover-intent prefetch), server (`createServerRouter()` with typed route handlers, `sendHtml()`, `sendJson()`), and client-side telemetry engine (ring buffer, object pool, event delegation, `sendBeacon` flush).

### @valencets/db

Thin query layer over `postgres` (porsager/postgres). Tagged template literals, zero ORM, parameterized by default. Every operation returns `Result<T, E>`. Migration runner loads and executes SQL files in order.

### @valencets/ui

Protocol base class (`ValElement`) that every component extends. Native Custom Elements with `ElementInternals` for form association and accessibility. Four pillars: telemetry emission, CMS traceability, i18n via `Intl`, ARIA via `ElementInternals`. Declarative hydration directives (`hydrate:idle`, `hydrate:visible`, `hydrate:media`, `hydrate:load`) control when components initialize — server-rendered HTML ships static markup, components hydrate when the condition is met. Zero dependencies. 344 tests.

### @valencets/cms

**v0.1 implemented.** Schema engine: `collection()` + `field.*` API generates PostgreSQL tables, Zod validators, REST API, and admin UI from a single TypeScript definition. 10 field types, query builder, migration generator, Argon2id auth with sessions and rate limiting, media uploads, CSRF protection, access control, lifecycle hooks, plugin system. 270 tests. See [packages/cms/README.md](packages/cms/README.md) for full documentation.

### @valencets/telemetry

Client beacon (page path, referrer, session ID, events). Server ingestion endpoint. Pre-allocated ring buffer for event storage. Daily summary aggregation. Zero third-party scripts in the browser.

## Dependency Graph

```
ui          (standalone, zero internal deps)
db          (standalone, zero internal deps)
core        (standalone, zero internal deps)
telemetry   → db, ui
cms         → db (runtime), core + ui (declared, not yet imported)
```

## Engineering Constraints

| Rule | What It Does |
|------|-------------|
| Cyclomatic complexity < 20 | Every function fits on one screen |
| Result monads, no try/catch | Errors are values in the return type, not hidden in the call stack |
| 14kB critical shell | First paint in the first TCP data flight |
| Pre-allocated ring buffer | Zero dynamic allocation in telemetry hot paths |
| Zero third-party browser scripts | Nothing loaded in the visitor's browser that isn't yours |

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript (strict mode, zero `any`) | ES2022 target, ESNext modules |
| UI | Native Web Components via `ValElement` | Protocol base class with 4 pillars |
| Styling | CSS custom properties (design tokens) | Tailwind for light DOM layout |
| Routing | HTML-over-the-wire | `history.pushState()`, DOMParser fragment swaps |
| Server | Node.js (http module) | No Express, no Fastify |
| Database | PostgreSQL | Tagged template SQL via `postgres` driver |
| Validation | Zod 4.x | `.safeParse()` exclusively |
| Error handling | Result monads | `neverthrow` |
| Linting | Neostandard (ESLint 9) | Pre-commit hook enforced |
| Testing | Vitest 4.x + happy-dom | 934+ tests across monorepo |
| Package mgr | pnpm 10.x workspaces | Monorepo, `node >= 22` |

## Quick Start

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm build        # Build all packages
pnpm test         # Run 934+ tests
pnpm lint         # Neostandard lint
```

See [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) for detailed setup.

## Documentation

| Document | Purpose |
|----------|---------|
| [GETTING-STARTED.md](docs/GETTING-STARTED.md) | Clone, install, build in 5 minutes |
| [DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) | Day-to-day patterns for working in the codebase |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full architectural reference |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Code rules, commit convention, PR workflow |
| [CMS README](packages/cms/README.md) | CMS API reference |
| [CMS Guide](packages/cms/docs/guide.md) | Building schemas, extending with plugins and hooks |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and fixes |

## Status

Active development. The CMS package (schema engine, admin UI, auth, media, REST API) is feature-complete for v0.1. The UI primitive library and core CLI are under construction.

## License

MIT
