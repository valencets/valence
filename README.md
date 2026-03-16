# Valence

Schema-driven web framework with built-in CMS, telemetry, and a zero-dependency UI primitive library. TypeScript, Web Components, PostgreSQL.

## What Valence Is

Valence is a web framework where content management and analytics are first-class primitives, not bolted-on plugins. Define a schema, get a database, an admin interface, validation, and conversion tracking out of the box. Every UI component extends a protocol base class that enforces accessibility, i18n, CMS traceability, and telemetry emission at the platform level.

## Packages
```
packages/
  core/        Framework runtime: router, config, CLI, build validator
  db/          PostgreSQL: tagged template queries, migrations, Result types
  ui/          ValElement protocol + Web Component primitives (zero deps, standalone)
  cms/         Schema engine, admin UI, auth, media uploads
  telemetry/   Beacon, ingestion, event storage, analytics HUD
```

**`@valencets/core`** — Router (URL to handler to HTML), `defineConfig()`, CLI (`valence dev`, `valence migrate`), build validator (cyclomatic complexity cap, 14kB critical shell budget), critical CSS extraction.

**`@valencets/db`** — Thin query layer over `postgres` (porsager/postgres). Tagged template literals, zero ORM, parameterized by default. Every operation returns `Result<T, E>`. Migration generator diffs schema definitions against current state and produces deterministic SQL.

**`@valencets/ui`** — Protocol base class (`ValElement`) that every component extends. Native Custom Elements with `ElementInternals` for form association and accessibility. Four pillars baked into the base: telemetry emission, CMS traceability, i18n via `Intl` and `lang` attribute observation, ARIA via `ElementInternals`. Ships layout, typography, interactive, data, navigation, and overlay primitives. Zero dependencies. Works in any HTML document with a `<script type="module">` tag.

**`@valencets/cms`** — Schema engine: `collection()` + `field.*` API generates Postgres tables, Zod validators, and admin UI from a single TypeScript definition. Server-rendered admin panel built on `@valencets/ui`. Session-based auth with Argon2id. Local filesystem media storage.

**`@valencets/telemetry`** — Client beacon (page path, referrer, session ID, events). Server ingestion endpoint. Pre-allocated ring buffer for event storage. Daily summary aggregation. Analytics HUD built on `@valencets/ui`. Zero third-party scripts in the browser.

## Dependency Graph
```
ui          (standalone, zero internal deps)
db          (standalone, zero internal deps)
core        (standalone, zero internal deps)
telemetry   → db, ui
cms         → core, db, ui
```

## Engineering Constraints

| Rule | What It Does |
|------|-------------|
| Cyclomatic complexity < 20 | Every function fits on one screen |
| Result monads, no try/catch | Errors are values in the return type, not hidden in the call stack |
| 14kB critical shell | First paint in the first TCP data flight (RFC 6928 initcwnd) |
| Pre-allocated ring buffer | Zero dynamic allocation in telemetry hot paths |
| Zero third-party browser scripts | Nothing loaded in the visitor's browser that isn't yours |

## Tech Stack

- **Language:** TypeScript, strict mode, zero `any`
- **UI:** Native Web Components via `ValElement` protocol base class
- **Styling:** CSS custom properties (design tokens), Tailwind for light DOM layout
- **Routing:** HTML-over-the-wire, `history.pushState()`, fragment swaps
- **Server:** Node.js
- **Database:** PostgreSQL
- **Validation:** Zod (`.safeParse()` only)
- **Error handling:** Result monads (`neverthrow`)
- **Package manager:** pnpm workspaces

## Getting Started
```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm dev          # Start dev server
pnpm migrate      # Run database migrations
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm lint         # Neostandard lint
```

## Status

Early development. The framework is being built in public. The UI primitive library, schema engine, and telemetry package are under active construction.

## License

MIT
