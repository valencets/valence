import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for flaky test detection.
 * Runs each test 5 times to surface non-deterministic failures.
 * Used by the weekly flaky-detection CI job and `pnpm test:flaky:detect`.
 *
 * Tests that fail on some runs but pass on others are candidates for
 * quarantine — add them to flaky-tests.json with @flaky tag.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,

  // Run each test 5 times to surface flakiness
  repeatEach: 5,

  // No retries — we want to see raw failure rates, not auto-healed results
  retries: 0,

  // Single worker to avoid resource contention masking real flakiness
  workers: 1,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report-flaky' }],
    ['json', { outputFile: 'flaky-detection-report.json' }]
  ],

  globalSetup: './tests/e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3111',
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    }
  ]
})
