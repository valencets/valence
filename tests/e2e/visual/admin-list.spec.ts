import { test, expect } from '@playwright/test'
import { ListPage } from '../pages/list.page.js'

test.describe('Visual: List view', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('posts list page matches snapshot', async ({ page }) => {
    const list = new ListPage(page)
    await list.goto('posts')
    await expect(list.heading).toBeVisible()
    await list.rows.first().waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('list-posts.png')
  })
})
