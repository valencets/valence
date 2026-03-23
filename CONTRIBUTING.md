# Contributing to Valence

## Development Setup

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm db:up   # Start local PostgreSQL on localhost:55432
pnpm build   # Build all packages (required before first test run)
pnpm test    # 1,306 tests across all packages
pnpm lint    # Neostandard lint
```

Requires Node.js >= 22 and pnpm 10.x. The `packageManager` field in `package.json` enforces the exact pnpm version.
Local CI, integration tests, E2E, and scaffold flows also require Docker Desktop or Docker Engine so `pnpm db:up` can provision PostgreSQL.

New to the codebase? Create a test project with the interactive tutorial:

```bash
npx @valencets/valence init my-test --learn
cd my-test
pnpm dev
# Open http://localhost:3000/_learn
```

## Project Structure

```
packages/
  core/        # Router, server, telemetry client (284 tests)
  db/          # PostgreSQL connection, migrations (75 tests)
  ui/          # Web Components + protocol base class (374 tests)
  cms/         # Schema engine, admin, auth, REST API, analytics dashboard (364 tests)
  telemetry/   # Beacon ingestion, daily summaries, event queries, aggregation (108 tests)
  valence/     # CLI: init, dev, migrate, build, user:create, learn (101 tests)
```

Each package has:
- `src/` Source code
- `src/__tests__/` Tests (co-located)
- `src/index.ts` Barrel export
- `vitest.config.ts` Test configuration
- `tsconfig.json` TypeScript configuration

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
| `localStorage`/`sessionStorage` | Fragile state | Server-delivered HTML |
| `process.env` outside config | Scattered config | Centralized `loadConfig()` |
| `export default` (in library code) | Named exports only | `export function/class/const` |
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

- `noImplicitAny`: no implicit `any` types
- `noImplicitReturns`: all code paths must return
- `strictNullChecks`: null/undefined are distinct types
- `noUncheckedIndexedAccess`: array/object index access returns `T | undefined`
- `exactOptionalPropertyTypes`: `undefined` must be explicit

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

1. **RED**: Write a failing test that specifies the behavior. Run tests to confirm failure. Commit with `RED` tag.
2. **GREEN**: Write the minimum implementation to make the test pass. Run tests to confirm pass. Commit with `GREEN` tag.
3. **REFACTOR**: Clean up while keeping tests green. Commit with `REFACTOR` tag.

```bash
# Example commit sequence
test(cms): add rate limiter tests -- RED
feat(cms): implement rate limiter -- GREEN
refactor(cms): extract shared test helpers -- REFACTOR
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

**Common scopes:** `core`, `db`, `ui`, `cms`, `telemetry`, `graphql`, `valence`, `tooling`, `docs`, `plugin-cloud-storage`, `plugin-nested-docs`, `plugin-seo`

Commits are enforced via Husky:
- `pre-commit` runs `lint-staged` on staged code and shell files
- `commit-msg` enforces Conventional Commit format and required TDD suffixes for code commits:
  `test(...) -- RED`, `feat(...) -- GREEN`, `fix(...) -- GREEN`, `refactor(...) -- REFACTOR`
- `pre-push` runs `pnpm validate`, `pnpm check:patterns`, and `pnpm test:smoke`
- `VALENCE_PREPUSH_FULL=1 git push` also runs `pnpm test:visual:ci`

## Branching

- `master`: stable, production-ready
- `development`: integration branch, CI runs on push
- `feat/<name>`: feature branches off `development`
- `fixes/<name>`: fix branches off `development`

Merge feature/fix branches into `development` with `--no-ff`. Merge `development` into `master` when stable.

## Pull Requests

1. Create a feature branch from `development`.
2. Follow TDD: RED, GREEN, REFACTOR commits.
3. Ensure `pnpm test` and `pnpm lint` both pass.
4. Ensure `pnpm build` (typecheck) passes.
5. Run `pnpm ci:local` before opening the PR. This is the local mirror of the main CI workflow and is the required pre-PR gate.
6. Confirm local prerequisites first: `pnpm db:up` has started PostgreSQL, Playwright browsers are installed, and dependencies are installed from the current lockfile.
7. Open a PR against `development`. CI runs lint, typecheck, and tests.

## CI Parity

Use one canonical local path for GitHub-parity checks:

```bash
pnpm ci:local
```

Visual regression is not a `pre-commit` concern. It is too slow and too environment-sensitive. The repo standard is:

- `pre-commit`: fast staged checks only
- `pre-push`: fast validation by default
- `pnpm ci:local`: required before opening a PR
- `pnpm test:visual:ci`: clean-worktree, Ubuntu-container visual regression parity with GitHub Actions

Refresh visual baselines from the containerized path, not from an arbitrary host render:

```bash
pnpm test:visual:ci -- --update-snapshots tests/e2e/visual/admin-dashboard.spec.ts --project=chromium
```

`pnpm test:visual:ci` creates a temporary clean worktree, installs dependencies, builds the repo, and runs Playwright inside the matching Ubuntu Playwright container. This is the source of truth for visual baselines.

## Local PostgreSQL

Use the repo-managed PostgreSQL instance for local development and CI parity:

```bash
pnpm db:up
pnpm db:logs
pnpm db:down
pnpm db:reset
```

Defaults:

- `PGHOST=localhost`
- `PGPORT=55432`
- `PGUSER=postgres`
- `PGPASSWORD=postgres`

The container uses `postgres:16-alpine` and creates the default `postgres` maintenance database expected by the integration, E2E, and scaffold test flows.

## Cross-Package Import Rules

| Package | Can Import From |
|---------|----------------|
| `@valencets/core` | `@valencets/resultkit` only |
| `@valencets/db` | `@valencets/resultkit`, `postgres`, `zod` |
| `@valencets/ui` | Nothing (zero deps) |
| `@valencets/cms` | `@valencets/core`, `@valencets/db`, `@valencets/ui`, `zod`, `@valencets/resultkit`, `argon2` |
| `@valencets/telemetry` | `@valencets/db`, `@valencets/core` |
| `@valencets/valence` | `@valencets/cms`, `@valencets/core`, `@valencets/db`, `@valencets/telemetry`, `tsx`, `zod`, `@valencets/resultkit` |

## Working with the CMS Package

The CMS is the largest package (~270 tests, ~55 source files). Key patterns:

### Database Queries

Always use `safeQuery()` from `db/safe-query.ts`. Never call `pool.sql` directly. `safeQuery` wraps `sql.unsafe()` with `ResultAsync` error mapping:

```typescript
import { safeQuery } from '../db/safe-query.js'

const result = await safeQuery<UserRow[]>(pool, 'SELECT * FROM users WHERE id = $1', [userId])
```

### SQL Identifier Safety

All field names and table names interpolated into SQL must pass through `isValidIdentifier()` from `db/sql-sanitize.ts`. The query builder does this automatically. Only use raw `safeQuery` for queries the builder doesn't cover (sessions, auth).

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

All admin views are plain HTML strings. No framework, no templating engine. `renderLayout()` provides the shell with sidebar navigation.

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
