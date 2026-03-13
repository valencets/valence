import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

beforeAll(async () => {
  if (customElements.get('hud-sparkline') === undefined) {
    await import('../components/HudSparkline.js')
  }
  if (customElements.get('hud-metric') === undefined) {
    await import('../components/HudMetric.js')
  }
  if (customElements.get('hud-panel') === undefined) {
    await import('../components/HudPanel.js')
  }
  if (customElements.get('hud-fleet-comparison') === undefined) {
    await import('../layouts/FleetComparison.js')
  }
})

function createElement (): HTMLElement {
  return document.createElement('hud-fleet-comparison')
}

function attach (el: HTMLElement): HTMLElement {
  document.body.appendChild(el)
  return el
}

describe('FleetComparison', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('registers as custom element hud-fleet-comparison', () => {
    expect(customElements.get('hud-fleet-comparison')).toBeDefined()
  })

  it('renders a header with FLEET COMPARISON text', () => {
    const el = attach(createElement())
    expect(el.textContent).toContain('FLEET COMPARISON')
  })

  it('contains a hud-panel', () => {
    const el = attach(createElement())
    expect(el.querySelector('hud-panel')).not.toBeNull()
  })

  it('contains hud-metric components', () => {
    const el = attach(createElement())
    const metrics = el.querySelectorAll('hud-metric')
    expect(metrics.length).toBeGreaterThanOrEqual(2)
  })

  it('does not duplicate DOM on disconnect + reconnect', () => {
    const el = attach(createElement())
    const panelCount = el.querySelectorAll('hud-panel').length

    el.remove()
    document.body.appendChild(el)

    expect(el.querySelectorAll('hud-panel').length).toBe(panelCount)
  })

  it('has connectedMoveCallback as no-op', () => {
    const el = attach(createElement())
    expect(typeof (el as Record<string, unknown>).connectedMoveCallback).toBe('function')
  })
})

describe('FleetComparison mobile layout', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('uses single column grid on narrow viewports', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    window.dispatchEvent(new Event('resize'))

    const el = attach(createElement())
    const grids = el.querySelectorAll('div')
    const panelGrid = Array.from(grids).find(d =>
      d.style.display === 'grid' && d.querySelectorAll('hud-panel').length > 0
    )
    expect(panelGrid?.style.gridTemplateColumns).toBe('1fr')
  })
})

describe('FleetComparison data fetching', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('fetches comparison data on connectedCallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify([{
        business_type: 'barbershop',
        avg_sessions: 150,
        avg_conversions: 12,
        top_performer_site_id: 'site_acme',
        sparkline_data: [10, 20, 15, 25]
      }]))
    )
    attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(globalThis.fetch).toHaveBeenCalled()
  })
})
