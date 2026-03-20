Run Playwright E2E tests against the CMS admin interface.

## Steps

1. Run `pnpm build` to compile all packages
2. Run `npx playwright test` to execute E2E tests
3. If tests fail, check `playwright-report/` for traces and screenshots
4. Report results: pass count, fail count, and any errors

## Notes

- E2E tests use `global-setup.ts` which creates a test DB (`valence_e2e_test`), seeds data, and starts a server on port 3111
- Auth setup (`auth.setup.ts`) logs in as `admin@test.local` / `admin123` and saves session to `tests/e2e/.auth/user.json`
- Tests run on Chromium only by default
- On CI: retries=2, workers=1, traces on first retry
- Locally: no retries, parallel workers, traces on-first-retry
- Page objects in `tests/e2e/pages/`: `LoginPage`, `DashboardPage`, `ListPage`, `EditPage`
- The test server uses `createTestApp()` from `tests/integration/test-app.ts` (shared infrastructure)
- Seeded data: one admin user, one "Welcome Post" in posts collection
