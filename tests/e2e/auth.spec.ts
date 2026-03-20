import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login.page.js'

test.describe('Auth flow (unauthenticated)', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('admin@test.local', 'admin123')
    await expect(page).toHaveURL('/admin')
    await expect(page.locator('h1')).toHaveText('Dashboard')
  })

  test('login with wrong password shows error', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('admin@test.local', 'wrongpassword')
    await expect(login.errorMessage).toBeVisible()
    const error = await login.getError()
    expect(error).toContain('Invalid email or password')
  })

  test('login form has required fields', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    const emailRequired = await login.emailInput.getAttribute('required')
    expect(emailRequired).not.toBeNull()
    const passwordRequired = await login.passwordInput.getAttribute('required')
    expect(passwordRequired).not.toBeNull()
  })
})

test.describe('Auth flow (authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('authenticated user sees dashboard', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('h1')).toHaveText('Dashboard')
  })

  test('logout endpoint destroys session', async ({ page }) => {
    // POST to logout — verify it redirects to login
    const response = await page.request.post('/admin/logout', { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    expect(response.headers()['location']).toBe('/admin/login')
  })
})
