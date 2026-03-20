import { test, expect } from '@playwright/test'
import { EditPage } from '../pages/edit.page.js'

test.describe('Visual: Edit form', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('new post form matches snapshot', async ({ page }) => {
    const edit = new EditPage(page)
    await edit.gotoNew('posts')
    await expect(edit.heading).toBeVisible()
    await page.locator('[contenteditable]').first().waitFor({ state: 'visible' }).catch(() => {})
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('edit-new-post.png')
  })
})
