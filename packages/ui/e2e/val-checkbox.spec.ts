import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/index.html')
  await page.waitForFunction(() => customElements.get('val-checkbox') !== undefined)
})

test.describe('val-checkbox — real browser', () => {
  async function mount (page: import('@playwright/test').Page, attrs?: Record<string, string>) {
    await page.evaluate((a) => {
      const root = document.getElementById('test-root')!
      root.innerHTML = ''
      const el = document.createElement('val-checkbox')
      el.textContent = 'Accept terms'
      if (a) {
        for (const [k, v] of Object.entries(a)) el.setAttribute(k, v)
      }
      root.appendChild(el)
    }, attrs)
    return page.locator('val-checkbox')
  }

  test('renders shadow DOM with checkbox role', async ({ page }) => {
    await mount(page)
    const box = page.locator('val-checkbox [role="checkbox"]')
    await expect(box).toBeVisible()
    await expect(box).toHaveAttribute('aria-checked', 'false')
  })

  test('toggles on click', async ({ page }) => {
    const el = await mount(page)
    await el.click()
    const box = page.locator('val-checkbox [role="checkbox"]')
    await expect(box).toHaveAttribute('aria-checked', 'true')
    await el.click()
    await expect(box).toHaveAttribute('aria-checked', 'false')
  })

  test('toggles on Space key', async ({ page }) => {
    await mount(page)
    const box = page.locator('val-checkbox [role="checkbox"]')
    await box.focus()
    await page.keyboard.press('Space')
    await expect(box).toHaveAttribute('aria-checked', 'true')
  })

  test('focus ring shows on keyboard focus', async ({ page }) => {
    await mount(page)
    const box = page.locator('val-checkbox [role="checkbox"]')
    await page.keyboard.press('Tab')
    const boxShadow = await box.evaluate(el => getComputedStyle(el).boxShadow)
    expect(boxShadow).not.toBe('none')
  })

  test('emits val:interaction composed through shadow DOM', async ({ page }) => {
    await mount(page)
    const detail = await page.evaluate(() => {
      return new Promise<{ action: string, checked: boolean }>(resolve => {
        document.addEventListener('val:interaction', ((e: CustomEvent) => {
          resolve(e.detail)
        }) as EventListener, { once: true })
        document.querySelector('val-checkbox')!.click()
      })
    })
    expect(detail.action).toBe('change')
    expect(detail.checked).toBe(true)
  })
})
