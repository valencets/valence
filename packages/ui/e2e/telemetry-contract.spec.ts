import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/index.html')
  await page.waitForFunction(() =>
    customElements.get('val-button') !== undefined &&
    customElements.get('val-input') !== undefined &&
    customElements.get('val-checkbox') !== undefined &&
    customElements.get('val-toggle') !== undefined &&
    customElements.get('val-select') !== undefined
  )
})

test.describe('telemetry contract — cross-component', () => {
  test('document-level listener captures val:interaction from all component types', async ({ page }) => {
    // Mount one of each interactive component
    await page.evaluate(() => {
      const root = document.getElementById('test-root')!
      root.innerHTML = ''

      const btn = document.createElement('val-button')
      btn.textContent = 'Click'
      root.appendChild(btn)

      const input = document.createElement('val-input')
      input.setAttribute('name', 'field')
      root.appendChild(input)

      const cb = document.createElement('val-checkbox')
      root.appendChild(cb)

      const toggle = document.createElement('val-toggle')
      root.appendChild(toggle)

      const select = document.createElement('val-select')
      const opt = document.createElement('option')
      opt.setAttribute('value', 'x')
      opt.textContent = 'X'
      select.appendChild(opt)
      root.appendChild(select)
    })

    // Collect events via a single document-level listener (the telemetry pattern)
    const events = await page.evaluate(() => {
      return new Promise<Array<{ component: string, action: string, timestamp: number }>>(resolve => {
        const collected: Array<{ component: string, action: string, timestamp: number }> = []
        document.addEventListener('val:interaction', ((e: CustomEvent) => {
          collected.push({
            component: e.detail.component,
            action: e.detail.action,
            timestamp: e.detail.timestamp
          })
          if (collected.length === 5) resolve(collected)
        }) as EventListener)

        // Trigger each component
        const btn = document.querySelector('val-button')!
        btn.shadowRoot!.querySelector('button')!.click()

        const input = document.querySelector('val-input')!
        const inner = input.shadowRoot!.querySelector('input')!
        inner.value = 'a'
        inner.dispatchEvent(new Event('input', { bubbles: true }))

        document.querySelector('val-checkbox')!.click()
        document.querySelector('val-toggle')!.click()

        const sel = document.querySelector('val-select')!
        sel.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
        sel.shadowRoot!.querySelector<HTMLElement>('.option')!.click()

        // Timeout fallback
        setTimeout(() => resolve(collected), 500)
      })
    })

    // Every event must have the InteractionBase fields
    expect(events.length).toBeGreaterThanOrEqual(5)
    for (const evt of events) {
      expect(evt.component).toBeTruthy()
      expect(evt.action).toBeTruthy()
      expect(evt.timestamp).toBeGreaterThan(0)
    }

    // Verify we captured events from distinct component types
    const components = new Set(events.map(e => e.component))
    expect(components.size).toBeGreaterThanOrEqual(4)
  })

  test('val:interaction events are composed (cross shadow DOM boundary)', async ({ page }) => {
    await page.evaluate(() => {
      const root = document.getElementById('test-root')!
      root.innerHTML = ''
      const btn = document.createElement('val-button')
      btn.textContent = 'Test'
      root.appendChild(btn)
    })

    const captured = await page.evaluate(() => {
      return new Promise<boolean>(resolve => {
        // Listen on document — events must cross shadow DOM
        document.addEventListener('val:interaction', () => resolve(true), { once: true })
        const btn = document.querySelector('val-button')!
        btn.shadowRoot!.querySelector('button')!.click()
        setTimeout(() => resolve(false), 200)
      })
    })

    expect(captured).toBe(true)
  })
})
