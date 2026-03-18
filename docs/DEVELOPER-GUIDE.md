# Developer Guide

Day-to-day patterns for working in the Valence codebase.

## Project Structure

```
valence/
├── packages/
│   ├── core/           Telemetry engine, client router, server utilities (216 tests)
│   ├── db/             PostgreSQL pool, config, migrations, error mapping (38 tests)
│   ├── telemetry/      Summary queries, daily aggregation, fleet types (59 tests)
│   ├── ui/             Web Component primitives (scaffolded)
│   └── cms/            Content management (scaffolded)
└── docs/               You are here
```

Each package has its own `CLAUDE.md` with detailed rules and context.

## The Four Pillars

These are non-negotiable. Code that violates them will fail code review.

1. **AV Rule 206** -- No dynamic memory allocation after init. Pre-allocate buffers and pools at boot, mutate in place at runtime.
2. **AV Rule 208** -- No exceptions. Zero `try/catch/throw` in business logic. Everything uses `Result<Ok, Err>` monads from `neverthrow`.
3. **AV Rule 3** -- Cyclomatic complexity < 20. Early returns, static dictionary maps, micro-componentization. No `switch` statements.
4. **14kB Protocol Limit** -- Critical shell (inline CSS + initial DOM) fits in the first 10 TCP packets (~14kB compressed).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full rationale.

## Dependency Graph

```
core                (neverthrow)
db                  (neverthrow, postgres, zod)
    ^
    |
    +--- telemetry  (db, neverthrow, postgres)

ui                  (standalone)
cms                 (core, db, ui, zod)
```

Build order (topological): core, db, ui (parallel) -> telemetry -> cms

## Database Migration Runner

The `@valencets/db` package provides a migration runner for PostgreSQL schema management. Migration files live in a `migrations/` directory within the consuming application.

### Naming convention

```
NNN-kebab-description.sql
```

Zero-padded 3-digit sequence number. The runner creates a `_migrations` tracking table to record which migrations have been applied.

### Usage

- Write idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
- The migration runner uses Result monads -- migrations that fail return `Err`, not exceptions
- Consuming applications call `runMigrations()` from `@valencets/db` at boot time

## Testing Patterns

Tests use **Vitest** with **happy-dom** environment. No database or network required.

### Dynamic import pattern

Web Component tests use `beforeAll` with dynamic import to ensure the component registers in the happy-dom environment:

```ts
let MyComponent: typeof import('../components/MyComponent.js').MyComponent

beforeAll(async () => {
  const mod = await import('../components/MyComponent.js')
  MyComponent = mod.MyComponent
})
```

### createElement / attach helpers

```ts
function createElement (): HTMLElement {
  const el = document.createElement('my-component')
  document.body.appendChild(el)
  return el
}
```

### TDD commit convention

Commits during TDD are tagged in the message:

- `test(feature): RED -- add test for new behavior` (test written, failing)
- `feat(feature): GREEN -- implement behavior` (test passing)
- `refactor(feature): REFACTOR -- extract helper` (same tests, cleaner code)

## Banned Patterns

These fail code review. The pre-commit hook enforces lint rules, and manual review catches the rest.

| Pattern | Why | Alternative |
|---------|-----|-------------|
| `throw new Error` | AV Rule 208: no exceptions | `err()` / `errAsync()` from neverthrow |
| `try { }` | AV Rule 208: no try/catch | Result monads |
| `switch (` | AV Rule 3: complexity | Static dictionary maps |
| `enum Foo` | Banned keyword | `const Foo = [...] as const` |
| `.parse(` | Zod footgun | `.safeParse()` only |
| `import React` | No VDOM in public code | Native Web Components |
| `export default` | Named exports only | `export function/class/const` |
| `Record<string, any>` | Loose typing | Explicit interfaces |
| `localStorage` / `sessionStorage` | No critical state in web storage | Server-side state, cookies |

## Code Rules Quick Reference

- **Named exports only** -- no default exports (except Web Component class registrations via `customElements.define`)
- **Barrel exports** -- every module directory has an `index.ts`
- **File naming** -- `kebab-case.ts` for modules, `PascalCase.ts` for Web Component classes
- **No inferred return types** on public functions -- always explicit
- **Comments explain WHY**, not WHAT
- **Error types** -- const union + interface pattern: `const FooErrorCode = { ... } as const` + `interface FooError { code, message }`
- **Fetchers** -- `ResultAsync.fromPromise()` from neverthrow
- **Commit format** -- `type(scope): description` (see [GETTING-STARTED.md](./GETTING-STARTED.md))

## Further Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) -- full system design and engineering philosophy
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) -- common issues and fixes

## Working with @valencets/cms

The CMS package is the largest in the monorepo (~55 source files, 270 tests). Here's how to navigate it.

### Module Map

```
packages/cms/src/
├── schema/      # collection(), global(), field.*, registry, type inference
├── validation/  # Zod schema generator, slug/email validators
├── db/          # Query builder, migration generator, SQL sanitization, safeQuery
├── access/      # Access control types and resolver
├── hooks/       # Lifecycle hook types and runner
├── auth/        # Passwords, sessions, middleware, CSRF, rate limiting, routes
├── api/         # Local API, REST API, HTTP utilities, body reading
├── admin/       # Server-rendered admin panel (layout, views, field renderers)
├── media/       # Upload/serve handlers, MIME detection
├── config/      # buildCms() entry point, plugin system
└── index.ts     # Package barrel export
```

### Key Entry Points

- **`buildCms(config)`** — The main entry point. Pass collections, globals, plugins. Returns `Result<CmsInstance, CmsError>`.
- **`collection()` / `field.*`** — Define your schema.
- **`createQueryBuilder(pool, registry)`** — Chainable SQL queries.
- **`generateCreateTableSql(collection)`** — Schema → DDL.

### Testing CMS Code

CMS tests use mock pools from `__tests__/test-helpers.ts`:

```typescript
import { makeMockPool, makeErrorPool } from './test-helpers.js'

const pool = makeMockPool([{ id: '1', title: 'Hello' }])
// pool.sql.unsafe() returns the provided rows
```

### Full Documentation

- [CMS README](../packages/cms/README.md) — API reference
- [CMS Guide](../packages/cms/docs/guide.md) — Schema design, plugins, hooks, real-world examples
