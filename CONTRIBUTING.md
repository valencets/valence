# Contributing to Valence

## Development Setup

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm build   # Build all packages (required before first test run)
pnpm test    # ~580 tests across all packages
pnpm lint    # Neostandard lint
```

Requires Node.js >= 22 and pnpm 10.x. The `packageManager` field in `package.json` enforces the exact pnpm version.

## Project Structure

```
packages/
  core/        # Router, server, telemetry engine (223 tests)
  db/          # PostgreSQL connection, migrations (38 tests)
  ui/          # ValElement protocol base class (1 test)
  cms/         # Schema engine, admin, auth, API (270 tests)
  telemetry/   # Beacon, ingestion, aggregation (59 tests)
```

Each package has:
- `src/` — Source code
- `src/__tests__/` — Tests (co-located)
- `src/index.ts` — Barrel export
- `vitest.config.ts` — Test configuration
- `tsconfig.json` — TypeScript configuration

## Banned Patterns

These will fail code review. No exceptions.

| Pattern | Why | Use Instead |
|---------|-----|-------------|
| `try { } catch { }` | AV Rule 208 | `Result<Ok, Err>` monads |
| `throw new Error(...)` | AV Rule 208 | `err(...)` or `errAsync(...)` |
| `switch (x) { }` | AV Rule 3 | Static dictionary maps |
| `enum Foo { }` | No enums | `const Foo = [...] as const` |
| `Record<string, any>` | Loose typing | Explicit interfaces |
| `Record<string, unknown>` | Loose typing | Explicit interfaces or typed unions |
| `unknown` as property type | Loose typing | `string \| number \| boolean \| null` |
| `.parse()` on Zod | Throws on failure | `.safeParse()` only |
| `import React` | No VDOM frameworks | Native Web Components |
| `localStorage`/`sessionStorage` | Fragile state | Server-delivered HTML |
| `process.env` outside config | Scattered config | Centralized `loadConfig()` |
| `export default` | Named exports only | `export function/class/const` |
| `as never` | Unsafe cast | `safeQuery()` for DB, proper types |
| `as unknown as` | Unsafe cast | Proper type narrowing |
| `as any` | Defeats TypeScript | Never acceptable |

## Code Style

- **Barrel exports** for all module directories (`index.ts`)
- **Named exports only.** No default exports.
- **Explicit return types** on all exported/public functions.
- **File naming**: `kebab-case.ts` for modules, `PascalCase.ts` for Web Component classes.
- **Comments** explain WHY, not WHAT.
- **No enums.** Use const unions: `const Status = ['draft', 'published'] as const`
- **Linter**: Neostandard (ESLint 9). Enforced via pre-commit hook.

## TypeScript

Strict mode with these compiler options enforced:

- `noImplicitAny` — no implicit `any` types
- `noImplicitReturns` — all code paths must return
- `strictNullChecks` — null/undefined are distinct types
- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`
- `exactOptionalPropertyTypes` — `undefined` must be explicit

## Error Handling

Every domain uses the const union + interface pattern:

```typescript
export const FooErrorCode = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT'
} as const)

export type FooErrorCode = typeof FooErrorCode[keyof typeof FooErrorCode]

export interface FooError {
  readonly code: FooErrorCode
  readonly message: string
}
```

All async operations return `ResultAsync<T, E>`. All sync operations return `Result<T, E>`. Chain via `.andThen()`, `.map()`, `.match()`.

The only acceptable use of `(e: unknown)` is in `ResultAsync.fromPromise()` error handler callbacks.

## TDD Workflow

All code changes follow strict TDD with tagged micro-commits:

1. **RED** — Write a failing test that specifies the behavior. Run tests to confirm failure. Commit with `— RED` tag.
2. **GREEN** — Write the minimum implementation to make the test pass. Run tests to confirm pass. Commit with `— GREEN` tag.
3. **REFACTOR** — Clean up while keeping tests green. Commit with `— REFACTOR` tag.

```bash
# Example commit sequence
test(cms): add rate limiter tests — RED
feat(cms): implement rate limiter — GREEN
refactor(cms): extract shared test helpers — REFACTOR
```

## Commit Convention

Conventional format with package scope:

```
feat(scope): description        # New feature
fix(scope): description         # Bug fix
refactor(scope): description    # Code improvement, no behavior change
test(scope): description        # Adding/modifying tests
docs(scope): description        # Documentation
chore(scope): description       # Dependencies, config, tooling
```

**Scopes:** `core`, `db`, `ui`, `cms`, `telemetry`, `studio`

Commits are enforced via Husky pre-commit hooks that run lint.

## Branching

- `master` — stable, production-ready
- `development` — integration branch, CI runs on push
- `feat/<name>` — feature branches off `development`
- `fixes/<name>` — fix branches off `development`

Merge feature/fix branches into `development` with `--no-ff`. Merge `development` into `master` when stable.

## Pull Requests

1. Create a feature branch from `development`.
2. Follow TDD: RED → GREEN → REFACTOR commits.
3. Ensure `pnpm test` and `pnpm lint` both pass.
4. Ensure `pnpm build` (typecheck) passes.
5. Open a PR against `development`. CI runs lint, typecheck, and tests.

## Cross-Package Import Rules

| Package | Can Import From |
|---------|----------------|
| `@valencets/core` | `neverthrow` only |
| `@valencets/db` | `neverthrow`, `postgres`, `zod` |
| `@valencets/ui` | Nothing (zero deps) |
| `@valencets/cms` | `@valencets/core`, `@valencets/db`, `@valencets/ui`, `zod`, `neverthrow`, `argon2` |
| `@valencets/telemetry` | `@valencets/db`, `@valencets/ui` |

## Working with the CMS Package

The CMS is the largest package (~270 tests, ~55 source files). Key patterns:

### Database Queries

Always use `safeQuery()` from `db/safe-query.ts`. Never call `pool.sql` directly — `safeQuery` wraps `sql.unsafe()` with `ResultAsync` error mapping:

```typescript
import { safeQuery } from '../db/safe-query.js'

const result = await safeQuery<UserRow[]>(pool, 'SELECT * FROM users WHERE id = $1', [userId])
```

### SQL Identifier Safety

All field names and table names interpolated into SQL must pass through `isValidIdentifier()` from `db/sql-sanitize.ts`. The query builder does this automatically — only use raw `safeQuery` for queries the builder doesn't cover (sessions, auth).

### HTML Output

Every string interpolated into HTML must use `escapeHtml()` from `admin/escape.ts`. No exceptions.

### Body Reading

Use `readStringBody()` or `readRawBody()` from `api/read-body.ts` for request body parsing. These enforce size limits and return `ResultAsync`.

### Adding a New Field Type

1. Add the type to `FieldType` const and the discriminated union in `schema/field-types.ts`
2. Add a factory function in `schema/fields.ts`
3. Add the PG column mapping in `db/column-map.ts`
4. Add the Zod schema builder in `validation/zod-generator.ts`
5. Add the HTML renderer in `admin/field-renderers.ts`
6. Add the type mapping in `schema/infer.ts`
7. Write tests for each step (TDD)

### Adding a New Admin View

Use the existing renderers as building blocks:

```typescript
import { renderLayout, renderFieldInput, escapeHtml } from '@valencets/cms'
```

All admin views are plain HTML strings — no framework, no templating engine. `renderLayout()` provides the shell with sidebar navigation.

## Architecture Guidelines

- **AV Rule 206**: No dynamic memory allocation after init. Pre-allocate buffers and pools at boot.
- **AV Rule 208**: No exceptions. Return `Result<Ok, Err>` monads. Handle both branches explicitly.
- **AV Rule 3**: Cyclomatic complexity under 20. Early returns, dictionary maps, micro-componentization.
- **14kB Protocol**: Critical shell must fit in first 10 TCP packets (~14kB compressed).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

## Running Tests

```bash
pnpm test                     # All packages
pnpm --filter=cms test        # CMS only
pnpm --filter=core test       # Core only
pnpm test:ci                  # CI mode (limited concurrency)
```

## File Boundaries

- **Safe to edit**: `packages/`, `docs/`
- **Never touch**: `node_modules/`, `.husky/` (edit via config only), any `dist/` output
