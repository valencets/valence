import { test, expect } from '@playwright/test'
import { ListPage } from './pages/list.page.js'

test.describe('Schema views', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('dashboard sidebar shows collection links', async ({ page }) => {
    await page.goto('/admin')
    const sidebar = page.locator('nav, aside, [class*="sidebar"]')
    await expect(sidebar.getByRole('link', { name: 'posts', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'users', exact: true })).toBeVisible()
  })

  test('collection list page has heading', async ({ page }) => {
    const list = new ListPage(page)
    await list.goto('posts')
    await expect(list.heading).toBeVisible()
  })

  test('clicking sidebar collection navigates to list', async ({ page }) => {
    await page.goto('/admin')
    const sidebar = page.locator('nav, aside, [class*="sidebar"]')
    await sidebar.getByRole('link', { name: 'posts', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/posts/)
  })
})
