import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Visual: Login page', () => {
  test('login page matches snapshot', async ({ page }) => {
    await page.goto('/admin/login')
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('login-page.png')
  })

  test('login form with error matches snapshot', async ({ page }) => {
    await page.goto('/admin/login')
    await page.evaluate(() => document.fonts.ready)

    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: /sign\s*in/i }).click()

    await page.locator('.km-error').waitFor({ state: 'visible' })
    await expect(page).toHaveScreenshot('login-page-error.png')
  })
})
