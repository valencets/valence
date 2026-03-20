# Flaky Test Quarantine Process

## Overview

A flaky test is one that produces non-deterministic results — it passes sometimes and fails other times without code changes. Flaky tests erode trust in the test suite and slow development.

This document describes the identify → tag → register → isolate → fix/remove → alert lifecycle for managing flaky tests in the Valence monorepo.

## The 30-Day SLA

Every quarantined flaky test carries a hard **30-day deadline** by which it must be resolved. Resolution means:

1. **Fix it** — Eliminate the flakiness and remove quarantine
2. **Delete it** — Remove the test if it no longer provides value

There are no extensions. An expired quarantine automatically opens a GitHub issue and must be resolved within 48 hours.

## Step-by-Step Process

### 1. Identify

Flakiness is detected two ways:

**Automated (weekly CI job):** `flaky-detection` runs every Sunday at 02:00 UTC. It runs the Vitest suite twice and compares results. Tests that changed status between runs are candidates. Playwright tests run with `repeatEach: 5`.

**Manual:** A developer notices intermittent failures on CI or locally.

### 2. Tag

Add the `@flaky` tag to the test using Vitest's tag syntax:

```typescript
it('processes webhook correctly', { tags: ['flaky'] }, async () => {
  // test body
})
```

For Playwright tests:

```typescript
test('loads dashboard @flaky', async ({ page }) => {
  // test body
})
```

The tag is already declared in `tests/vitest-tags.d.ts`. TypeScript will enforce that only known tags are used.

### 3. Register

Add an entry to `flaky-tests.json` at the repo root. The deadline is always quarantinedAt + 30 calendar days.

```json
{
  "quarantined": [
    {
      "testName": "processes webhook correctly",
      "file": "packages/cms/src/__tests__/webhook.test.ts",
      "quarantinedAt": "2026-03-20",
      "reason": "Race condition in async event emission — handler fires before listener is attached in some runs",
      "deadline": "2026-04-19",
      "rootCause": "timing",
      "linkedIssue": "https://github.com/valencets/valence/issues/183"
    }
  ]
}
```

Root cause categories:

| Category | Description |
|----------|-------------|
| `timing` | Race conditions, async ordering, setTimeout/setInterval |
| `state` | Shared state between tests, missing cleanup |
| `network` | External HTTP calls, DNS resolution, port conflicts |
| `resource` | File system, memory limits, CPU contention |
| `database` | Transaction isolation, sequence gaps, connection pooling |

### 4. Isolate

Once tagged and registered, the quarantine system takes over:

- **Main CI (`unit` job):** Runs tests with `--tags-filter='!flaky'` — quarantined tests are skipped
- **Quarantine CI job:** Runs tests with `--tags-filter=flaky` and `continue-on-error: true` — failures do not block the build
- **Weekly deadline check:** `flaky-deadline-check` CI job runs `check-flaky-deadlines.sh` every Sunday

### 5. Fix or Remove

**Fixing a flaky test:**

1. Identify and eliminate the root cause (see categories above for common patterns)
2. Remove the `@flaky` tag from the test
3. Delete the entry from `flaky-tests.json`
4. Run the test in a loop locally to verify: `for i in $(seq 10); do pnpm test -- src/__tests__/mytest.test.ts || break; done`
5. Commit and push — the test re-enters the normal suite

**Deleting a flaky test:**

If the test covers behavior already tested elsewhere, or covers functionality that no longer exists:

1. Delete the test file or remove the specific test
2. Delete the entry from `flaky-tests.json`
3. Commit and push with a note explaining what coverage was lost (if any)

### 6. Alert

The `flaky-deadline-check` CI job runs every Sunday. If any entry in `flaky-tests.json` has a `deadline` on or before today's date, it:

1. Exits with code 1
2. Creates a GitHub issue titled `ALERT: Quarantined flaky tests have exceeded 30-day SLA`
3. Labels the issue `flaky-test`

The issue lists all expired tests with their files, deadlines, and reasons.

## Running Locally

```bash
# Check if any quarantined tests have expired deadlines
pnpm test:flaky:deadlines

# Run quarantined tests in isolation
pnpm test:quarantine

# Run flaky detection (runs suite twice, compares results)
pnpm test:flaky:detect

# Check deadlines directly
bash scripts/check-flaky-deadlines.sh
```

## Common Fixes

### Timing (race conditions)

```typescript
// Before (flaky): assumes async op completes synchronously
const result = await fetchData()
expect(cache.size).toBe(1)  // Cache update may be deferred

// After (stable): await the observable side effect
await vi.waitFor(() => expect(cache.size).toBe(1))
```

### State (missing cleanup)

```typescript
// Before (flaky): shared state leaks between tests
let server: Server

beforeAll(() => { server = createServer() })
// Missing: afterAll(() => server.close())

// After (stable): always clean up
afterAll(() => server.close())
```

### Database (isolation)

Each integration test must use its own database or wrap everything in a transaction that rolls back. See `tests/integration/setup.ts` for the pattern.

### Network (port conflicts)

Use `0` for dynamic port assignment instead of hardcoded ports:

```typescript
const server = app.listen(0)  // OS assigns a free port
const port = (server.address() as AddressInfo).port
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `scripts/check-flaky-deadlines.sh` | Parse `flaky-tests.json`, warn on expired entries. Exit 1 if any expired. |
| `scripts/detect-flaky-vitest.sh` | Run Vitest twice, compare results, output JSON report of flaky candidates. |
| `tests/e2e/flaky-detection.config.ts` | Playwright config with `repeatEach: 5` for weekly E2E flaky detection. |

## CI Jobs Reference

| Job | Trigger | Purpose |
|-----|---------|---------|
| `unit` | Every push/PR | Runs tests excluding `@flaky` tagged tests |
| `quarantine` | Every push/PR | Runs only `@flaky` tests, `continue-on-error: true` |
| `flaky-detection` | Weekly (Sunday 02:00 UTC) | Detects new flaky tests via repeat runs |
| `flaky-deadline-check` | Weekly (Sunday 02:00 UTC) | Alerts when quarantine SLA expires |
