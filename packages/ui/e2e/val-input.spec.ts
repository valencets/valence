import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/index.html')
  await page.waitForFunction(() => customElements.get('val-input') !== undefined)
})

test.describe('val-input — real browser', () => {
  async function mount (page: import('@playwright/test').Page, attrs?: Record<string, string>) {
    await page.evaluate((a) => {
      const root = document.getElementById('test-root')!
      root.innerHTML = ''
      const el = document.createElement('val-input')
      el.setAttribute('name', 'test-field')
      if (a) {
        for (const [k, v] of Object.entries(a)) el.setAttribute(k, v)
      }
      root.appendChild(el)
    }, attrs)
    return page.locator('val-input')
  }

  test('renders shadow DOM with input element', async ({ page }) => {
    await mount(page)
    const input = page.locator('val-input input')
    await expect(input).toBeVisible()
  })

  test('types into input and reads value', async ({ page }) => {
    await mount(page)
    const input = page.locator('val-input input')
    await input.fill('hello world')
    const value = await page.evaluate(() => {
      return (document.querySelector('val-input') as HTMLElement & { value: string }).value
    })
    expect(value).toBe('hello world')
  })

  test('syncs type attribute to inner input', async ({ page }) => {
    await mount(page, { type: 'email' })
    const type = await page.locator('val-input input').getAttribute('type')
    expect(type).toBe('email')
  })

  test('disabled attribute prevents interaction', async ({ page }) => {
    await mount(page, { disabled: '' })
    const disabled = await page.locator('val-input input').isDisabled()
    expect(disabled).toBe(true)
  })

  test('emits val:interaction on input event (composed through shadow)', async ({ page }) => {
    await mount(page)
    const detail = await page.evaluate(() => {
      return new Promise<{ action: string, value: string }>(resolve => {
        document.addEventListener('val:interaction', ((e: CustomEvent) => {
          resolve(e.detail)
        }) as EventListener, { once: true })
        const el = document.querySelector('val-input')!
        const input = el.shadowRoot!.querySelector('input')!
        input.value = 'typed'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    })
    expect(detail.action).toBe('input')
    expect(detail.value).toBe('typed')
  })

  test('focus ring shows on focus-visible', async ({ page }) => {
    await mount(page)
    const input = page.locator('val-input input')
    await page.keyboard.press('Tab')
    const boxShadow = await input.evaluate(el => getComputedStyle(el).boxShadow)
    // Focus ring should be applied (non-empty box-shadow)
    expect(boxShadow).not.toBe('none')
  })
})
