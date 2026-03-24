import { defineConfig, devices } from '@playwright/test'

const playwrightOutputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results'
const playwrightReportDir = process.env.PLAYWRIGHT_REPORT_DIR ?? 'playwright-report'

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: playwrightOutputDir,
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['blob'], ['github']]
    : [['html', { open: 'on-failure', outputFolder: playwrightReportDir }]],

  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}',

  globalSetup: './tests/e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3111',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    animations: 'disabled'
  },

  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      threshold: 0.2,
      maxDiffPixelRatio: 0.05
    }
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
