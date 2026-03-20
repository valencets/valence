import { test, expect } from '@playwright/test'
import { ListPage } from './pages/list.page.js'
import { EditPage } from './pages/edit.page.js'
import { DashboardPage } from './pages/dashboard.page.js'

test.describe('Content CRUD', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('dashboard shows collection cards', async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()
    await expect(dashboard.heading).toHaveText('Dashboard')
    await expect(page.getByRole('link', { name: 'posts', exact: true })).toBeVisible()
  })

  test('navigate to collection list shows entries', async ({ page }) => {
    const list = new ListPage(page)
    await list.goto('posts')
    await expect(list.heading).toBeVisible()
    const count = await list.getRowCount()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('sidebar nav links to collections', async ({ page }) => {
    await page.goto('/admin')
    const sidebar = page.locator('nav, aside, [class*="sidebar"]')
    await expect(sidebar.getByRole('link', { name: 'posts', exact: true })).toBeVisible()
  })

  test('create a new post through the form', async ({ page }) => {
    const edit = new EditPage(page)
    await edit.gotoNew('posts')
    await expect(edit.heading).toHaveText(/New/)

    await edit.fillField('title', 'E2E Test Post')
    await edit.fillField('slug', 'e2e-test-post')
    await edit.save()

    // Should redirect to list with success toast
    await expect(page).toHaveURL(/\/admin\/posts/)
    const list = new ListPage(page)
    await expect(list.toast).toBeVisible()
    await expect(list.toastMessage).toContainText('created successfully')

    // New post should appear in the table
    const tableText = await page.locator('table').textContent()
    expect(tableText).toContain('E2E Test Post')
  })

  test('edit an existing post', async ({ page }) => {
    // Navigate to the list and click edit on the first row
    const list = new ListPage(page)
    await list.goto('posts')
    await list.clickEditOnRow(0)

    await expect(page).toHaveURL(/\/admin\/posts\/.*\/edit/)
    const edit = new EditPage(page)
    await expect(edit.heading).toHaveText(/Edit/)

    // Verify form is pre-filled
    const currentTitle = await edit.getFieldValue('title')
    expect(currentTitle).toBeTruthy()

    // Update the title
    await edit.fillField('title', 'Updated E2E Title')
    await edit.save()

    // Should redirect to list with success toast
    await expect(page).toHaveURL(/\/admin\/posts/)
    await expect(list.toast).toBeVisible()
    await expect(list.toastMessage).toContainText('updated successfully')

    // Updated title should be in the table
    const tableText = await page.locator('table').textContent()
    expect(tableText).toContain('Updated E2E Title')
  })

  test('delete a post via the dialog', async ({ page }) => {
    // First create a post to delete
    const edit = new EditPage(page)
    await edit.gotoNew('posts')
    await edit.fillField('title', 'Delete Me Post')
    await edit.fillField('slug', 'delete-me-post')
    await edit.save()
    await expect(page).toHaveURL(/\/admin\/posts/)

    // Find the post in the list and click edit
    const deleteLink = page.locator('table tbody tr', { hasText: 'Delete Me Post' }).locator('.action-link')
    await deleteLink.click()
    await expect(page).toHaveURL(/\/admin\/posts\/.*\/edit/)

    // Click delete trigger → confirm dialog → confirm
    await edit.confirmDelete()

    // Should redirect to list with success toast
    await expect(page).toHaveURL(/\/admin\/posts/)
    const list = new ListPage(page)
    await expect(list.toast).toBeVisible()
    await expect(list.toastMessage).toContainText('deleted')

    // Post should no longer be in the table
    const tableText = await page.locator('table').textContent() ?? ''
    expect(tableText).not.toContain('Delete Me Post')
  })

  test('create form requires title and slug', async ({ page }) => {
    const edit = new EditPage(page)
    await edit.gotoNew('posts')

    // Submit empty form — browser validation should prevent submission
    // Fill only title (skip slug which is required)
    await edit.fillField('title', 'No Slug Post')
    await edit.save()

    // Should stay on the new page (slug is required, browser blocks submission)
    // or get a validation error from the server
    const url = page.url()
    const isStillOnNew = url.includes('/new')
    const hasError = await page.locator('.toast-error').count() > 0

    expect(isStillOnNew || hasError).toBe(true)
  })

  test('clicking New button from list navigates to create form', async ({ page }) => {
    const list = new ListPage(page)
    await list.goto('posts')
    await list.clickCreate()
    await expect(page).toHaveURL(/\/admin\/posts\/new/)
    const edit = new EditPage(page)
    await expect(edit.heading).toHaveText(/New/)
    await expect(edit.saveButton).toHaveText('Create')
  })
})
