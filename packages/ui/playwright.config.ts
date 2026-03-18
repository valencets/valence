import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 10_000,
  use: {
    baseURL: 'http://localhost:5188'
  },
  webServer: {
    command: 'npx vite --port 5188 --strictPort',
    port: 5188,
    reuseExistingServer: true
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
})
