# Testing Guide

## Quick Start

```bash
pnpm build              # Required before first test run
pnpm test               # All unit tests (~1,600 across 6 packages)
pnpm test:integration   # Integration tests (requires PostgreSQL)
pnpm test:e2e           # Playwright E2E tests (requires built app)
pnpm test:coverage      # Unit tests with coverage report
pnpm test:mutate        # Stryker mutation testing
pnpm test:watch         # Watch mode for local development
```

## Test Architecture

### Layers

| Layer | Tool | Location | DB Required | Speed |
|-------|------|----------|-------------|-------|
| **Unit** | Vitest | `packages/*/src/__tests__/*.test.ts` | No (mocked) | Fast (~5s) |
| **Integration** | Vitest + Supertest | `tests/integration/*.test.ts` | Yes (PostgreSQL) | Medium (~10s) |
| **E2E** | Playwright | `tests/e2e/*.spec.ts` | Yes (full app) | Slow (~30s) |
| **Contract** | Vitest | `tests/integration/contracts.test.ts` | No | Fast (~1s) |

### Directory Structure

```
tests/
├── integration/           # Integration tests (real DB)
│   ├── setup.ts           # DB lifecycle (create/migrate/teardown)
│   ├── test-app.ts        # HTTP server builder for supertest
│   ├── db-helpers.ts      # Per-test isolation helpers
│   ├── auth.integration.test.ts
│   ├── crud.integration.test.ts
│   ├── schema.integration.test.ts
│   ├── telemetry.integration.test.ts
│   └── contracts.test.ts  # Package boundary contracts
├── e2e/                   # Playwright E2E tests
│   ├── auth.setup.ts      # Global auth (login + save state)
│   ├── auth.spec.ts
│   ├── content.spec.ts
│   ├── schema.spec.ts
│   ├── errors.spec.ts
│   └── pages/             # Page Object Models
│       ├── login.page.ts
│       ├── dashboard.page.ts
│       ├── list.page.ts
│       └── edit.page.ts
├── factories/             # Test data builders
│   └── index.ts
├── mocks/                 # MSW v2 request handlers
│   ├── handlers.ts        # Happy-path API mocks
│   ├── server.ts          # Node.js (Vitest)
│   └── browser.ts         # Browser (Playwright)
└── vitest-tags.d.ts       # Tag type augmentation
```

## Writing Tests

### Unit Tests

Co-located in each package at `src/__tests__/*.test.ts`. Use mock pools from test helpers:

```typescript
import { makeMockPool } from './test-helpers.js'

it('creates a document', async () => {
  const pool = makeMockPool([{ id: '123', title: 'Test' }])
  const result = await createDocument(pool, { title: 'Test' })
  expect(result.isOk()).toBe(true)
})
```

### Integration Tests

Use real PostgreSQL. Each test file manages its own database:

```typescript
import { startTestApp } from './test-app.js'
import supertest from 'supertest'

const app = await startTestApp({ pool, collections: [...] })
const res = await supertest(app.server).get('/api/posts').expect(200)
```

### E2E Tests

Use Page Object Models for maintainability:

```typescript
import { LoginPage } from './pages/login.page.js'

test('login flow', async ({ page }) => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login('admin@test.local', 'admin123')
  await expect(page).toHaveURL('/admin')
})
```

### MSW Mocks

Override happy-path handlers per test:

```typescript
import { server } from '../mocks/server.js'
import { http, HttpResponse } from 'msw'

it('handles server error', async () => {
  server.use(
    http.get('/api/posts', () => HttpResponse.json({ error: 'fail' }, { status: 500 }))
  )
  // test error handling...
})
```

## Test Tags

Tests can be tagged for selective execution:

- **smoke** — Critical path tests, run on every PR
- **regression** — Bug fix verification (mandatory for every fix)
- **unit** — Standard isolated tests
- **flaky** — Known flaky tests, quarantined with auto-retry

## CI Pipeline

GitHub Actions runs these jobs in order:

1. **lint** — ESLint
2. **typecheck** — `pnpm build` (tsc all packages)
3. **unit** — All unit tests (needs lint + typecheck)
4. **integration** — Real PostgreSQL via GitHub service container
5. **e2e** — Playwright with trace upload on failure
6. **coverage** — Report with 80% threshold
7. **security** — `pnpm audit` + CodeQL analysis
8. **publish** — npm publish on master (needs all gates)

## Conventions

- TDD workflow: RED → GREEN → REFACTOR with micro-commits
- Result monads everywhere — no try/catch in test setup
- Integration tests create/drop their own test database
- E2E tests use `storageState` for auth (login once, reuse)
- Pre-commit: lint-staged (eslint --fix on staged files)
- Pre-push: build + full test suite

## Flaky Test Quarantine

Flaky tests are tagged `@flaky` and registered in `flaky-tests.json`. They are excluded from the main CI suite and run in an isolated quarantine job with `continue-on-error`. Every quarantined test has a **30-day SLA** — it must be fixed or deleted before its deadline.

See [FLAKY-TESTS.md](./FLAKY-TESTS.md) for the full identify → tag → register → isolate → fix/remove → alert cycle.

```bash
pnpm test:quarantine        # Run only quarantined flaky tests
pnpm test:flaky:deadlines   # Check for expired quarantine SLAs
pnpm test:flaky:detect      # Detect new flaky tests (2x Vitest + 5x Playwright)
```
## API Surface Tracking

API surface changes are tracked via [Microsoft API Extractor](https://api-extractor.com/). Every public package has a committed `*.api.md` report that documents its exported types. Changes to the API surface are caught in CI before they ship.

### How it works

- Each package (`core`, `db`, `cms`, `telemetry`, `ui`, `valence`, `graphql`) has an `api-extractor.json` config.
- The generated `*.api.md` files are committed to Git and serve as the reference baseline.
- The `api-review` CI job runs `pnpm api:check` after every build. If the generated report differs from the committed baseline, the job fails.

### Workflow for API changes

1. Make your change (add, remove, or rename an export).
2. Run `pnpm build` to recompile TypeScript.
3. Run `pnpm api:update` to regenerate all `*.api.md` files.
4. Review the diffs — removals and signature changes are breaking changes.
5. Commit the updated `*.api.md` files alongside your code change.

```bash
# After changing a public export
pnpm build
pnpm api:update
git add packages/*/\*.api.md
git commit -m "feat: update API surface for <change>"
```

### Scripts

| Script | Description |
|---|---|
| `pnpm api:check` | Runs API Extractor in strict mode — fails if any `.api.md` differs |
| `pnpm api:update` | Regenerates all `.api.md` baselines (use `--local` mode) |

### CI job: `api-review`

Runs after `typecheck` on every push and PR. Executes `pnpm api:check`. Fails with:

```
API surface changed — review the diff and run `pnpm api:update` to accept
```

if any package's API surface has changed without an updated baseline.
