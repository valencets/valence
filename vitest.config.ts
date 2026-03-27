import { defineConfig } from 'vitest/config'

// This monorepo uses per-package vitest configs with different test environments.
// Running `npx vitest` from root delegates to `pnpm test` which runs each
// package with its own config (happy-dom for browser, node for server).
//
// This root config scopes to server-side packages that run in node environment.
// Browser packages (core, ui, telemetry, reactive) must be run via `pnpm test`
// or from their package directory to get the correct happy-dom environment.
export default defineConfig({
  test: {
    include: [
      'packages/store/src/**/__tests__/**/*.test.ts',
      'packages/cms/src/**/__tests__/**/*.test.ts',
      'packages/db/src/**/__tests__/**/*.test.ts',
      'packages/graphql/src/**/__tests__/**/*.test.ts',
      'packages/plugin-*/src/**/__tests__/**/*.test.ts',
      'packages/valence/src/**/__tests__/**/*.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/integration/**',
      '**/*.spec.ts',
      'tests/**'
    ]
  }
})
