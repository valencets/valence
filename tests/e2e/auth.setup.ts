import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('admin@test.local')
  await page.getByLabel('Password').fill('admin123')
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await page.waitForURL('/admin')
  await page.context().storageState({ path: 'tests/e2e/.auth/user.json' })
})
