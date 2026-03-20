import { test, expect } from '@playwright/test'

test.describe('Error handling', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('nonexistent API endpoint returns 404 JSON', async ({ page }) => {
    const response = await page.goto('/api/nonexistent')
    expect(response?.status()).toBe(404)
    const body = await page.textContent('body')
    expect(body).toContain('Not found')
  })

  test('browser back navigation works', async ({ page }) => {
    await page.goto('/admin')
    const sidebar = page.locator('nav, aside, [class*="sidebar"]')
    await sidebar.getByRole('link', { name: 'posts', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/posts/)
    await page.goBack()
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('editing nonexistent post returns 404', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const response = await page.goto(`/admin/posts/${fakeId}/edit`)
    expect(response?.status()).toBe(404)
  })

  test('nonexistent collection returns 404', async ({ page }) => {
    const response = await page.goto('/admin/nonexistent-collection')
    expect(response?.status()).toBe(404)
  })

  test('creating post with duplicate slug shows error', async ({ page }) => {
    // The seeded "welcome-post" slug already exists — submitting a duplicate triggers a DB error
    await page.goto('/admin/posts/new')
    await page.locator('input[name="title"]').fill('Duplicate Slug Test')
    await page.locator('input[name="slug"]').fill('welcome-post')
    await page.locator('button[type="submit"].btn-primary').click()

    // Server should return 400 with error toast (unique constraint violation)
    const toast = page.locator('.toast-error')
    await expect(toast).toBeVisible({ timeout: 5000 })
    const toastText = await page.locator('.toast-message').textContent()
    expect(toastText).toBeTruthy()
  })
})
