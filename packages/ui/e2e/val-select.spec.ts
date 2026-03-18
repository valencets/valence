import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/index.html')
  await page.waitForFunction(() => customElements.get('val-select') !== undefined)
})

test.describe('val-select — real browser', () => {
  async function mount (page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      const root = document.getElementById('test-root')!
      root.innerHTML = ''
      const el = document.createElement('val-select')
      el.setAttribute('placeholder', 'Pick one')
      for (const [value, label] of [['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma']]) {
        const opt = document.createElement('option')
        opt.setAttribute('value', value!)
        opt.textContent = label!
        el.appendChild(opt)
      }
      root.appendChild(el)
    })
    return page.locator('val-select')
  }

  test('renders shadow DOM with trigger and listbox', async ({ page }) => {
    const el = await mount(page)
    const trigger = el.locator('button.trigger')
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAttribute('role', 'combobox')
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toHaveAttribute('aria-controls', 'listbox')
  })

  test('shows placeholder text', async ({ page }) => {
    await mount(page)
    const text = page.locator('val-select .trigger-text')
    await expect(text).toHaveText('Pick one')
  })

  test('opens listbox on click with correct ARIA', async ({ page }) => {
    const el = await mount(page)
    const trigger = el.locator('button.trigger')
    await trigger.click()
    await expect(el).toHaveAttribute('open', '')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const options = el.locator('[role="option"]')
    await expect(options).toHaveCount(3)
    await expect(options.first()).toHaveText('Alpha')
  })

  test('selects option on click and updates ARIA', async ({ page }) => {
    const el = await mount(page)
    const trigger = el.locator('button.trigger')
    await trigger.click()

    await el.locator('[role="option"]').nth(1).click()

    await expect(el).not.toHaveAttribute('open')
    await expect(el.locator('.trigger-text')).toHaveText('Beta')
    const selected = await page.evaluate(() => {
      return document.querySelector('val-select')!.shadowRoot!
        .querySelector('[aria-selected="true"]')?.textContent
    })
    expect(selected).toBe('Beta')
  })

  test('keyboard: ArrowDown opens, arrows navigate, Enter selects', async ({ page }) => {
    const el = await mount(page)
    const trigger = el.locator('button.trigger')
    await trigger.focus()

    await page.keyboard.press('ArrowDown')
    await expect(el).toHaveAttribute('open', '')

    await page.keyboard.press('ArrowDown')
    const activeDesc = await trigger.getAttribute('aria-activedescendant')
    expect(activeDesc).toBe('opt-0')

    await page.keyboard.press('ArrowDown')
    const activeDesc2 = await trigger.getAttribute('aria-activedescendant')
    expect(activeDesc2).toBe('opt-1')

    await page.keyboard.press('Enter')
    await expect(el).not.toHaveAttribute('open')
    await expect(el.locator('.trigger-text')).toHaveText('Beta')
  })

  test('keyboard: Escape closes without selecting', async ({ page }) => {
    const el = await mount(page)
    const trigger = el.locator('button.trigger')
    await trigger.click()
    await expect(el).toHaveAttribute('open', '')

    await page.keyboard.press('Escape')
    await expect(el).not.toHaveAttribute('open')
    await expect(el.locator('.trigger-text')).toHaveText('Pick one')
  })

  test('emits val:interaction composed through shadow DOM', async ({ page }) => {
    await mount(page)
    const detail = await page.evaluate(() => {
      return new Promise<{ action: string, value: string }>(resolve => {
        document.addEventListener('val:interaction', ((e: CustomEvent) => {
          resolve(e.detail)
        }) as EventListener, { once: true })
        const el = document.querySelector('val-select')!
        const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
        trigger.click()
        const opt = el.shadowRoot!.querySelectorAll('.option')[2] as HTMLElement
        opt.click()
      })
    })
    expect(detail.action).toBe('change')
    expect(detail.value).toBe('c')
  })
})
