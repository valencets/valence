Run integration tests against a real PostgreSQL database.

## Steps

1. Ensure PostgreSQL is running locally (`pg_isready`)
2. Run `pnpm build` to compile all packages
3. Run `npx vitest run tests/integration/` to execute integration tests
4. If tests fail, analyze the output and suggest fixes
5. Report results: pass count, fail count, and any errors

## Notes

- Integration tests use real databases (each test file creates its own, e.g., `valence_crud_integration_test`)
- The test DB is created/migrated/torn down automatically per test file
- Tests run sequentially in a single fork (not parallel)
- Timeout is 30s per test, 60s for setup
- **Do NOT use** `pnpm test:integration` — the `--project integration` flag is broken in vitest 4.0.18
- The test app (`tests/integration/test-app.ts`) calls `buildCms()` + `createServer()` from `@valencets/cms`
- Root `package.json` must use `workspace:*` for `@valencets/*` deps or tests will import stale published packages
