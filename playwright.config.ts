import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['blob'], ['github']]
    : [['html', { open: 'on-failure' }]],

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
      threshold: 0.2
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
