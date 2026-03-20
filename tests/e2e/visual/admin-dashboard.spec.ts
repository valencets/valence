import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/dashboard.page.js'

test.describe('Visual: Dashboard', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('dashboard page matches snapshot', async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await expect(dashboard.heading).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('dashboard-page.png')
  })
})
