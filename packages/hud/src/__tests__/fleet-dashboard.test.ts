import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

beforeAll(async () => {
  if (customElements.get('hud-status') === undefined) {
    await import('../components/HudStatus.js')
  }
  if (customElements.get('hud-panel') === undefined) {
    await import('../components/HudPanel.js')
  }
  if (customElements.get('hud-table') === undefined) {
    await import('../components/HudTable.js')
  }
  if (customElements.get('hud-fleet-dashboard') === undefined) {
    await import('../layouts/FleetDashboard.js')
  }
})

function createElement (): HTMLElement {
  return document.createElement('hud-fleet-dashboard')
}

function attach (el: HTMLElement): HTMLElement {
  document.body.appendChild(el)
  return el
}

describe('FleetDashboard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('registers as custom element hud-fleet-dashboard', () => {
    expect(customElements.get('hud-fleet-dashboard')).toBeDefined()
  })

  it('renders a header with FLEET OVERVIEW text', () => {
    const el = attach(createElement())
    expect(el.textContent).toContain('FLEET OVERVIEW')
  })

  it('contains 3 hud-panels for summary metrics', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    expect(panels.length).toBe(3)
  })

  it('contains a hud-table for site listing directly on the dashboard', () => {
    const el = attach(createElement())
    const table = el.querySelector('hud-table')
    expect(table).not.toBeNull()
    // Table should not be wrapped in a hud-panel to avoid gray end caps
    expect(table?.closest('hud-panel')).toBeNull()
  })

  it('renders a section header for the table', () => {
    const el = attach(createElement())
    expect(el.textContent).toContain('Active Fleet Sites')
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

describe('FleetDashboard data fetching', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function mockFleetFetch (): void {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/fleet/sites')) {
        return new Response(JSON.stringify([
          {
            site_id: 'site_acme',
            business_type: 'barbershop',
            date: '2026-03-10',
            session_count: 247,
            pageview_count: 1200,
            conversion_count: 45,
            status: 'healthy',
            last_synced: '2026-03-10T12:00:00Z'
          }
        ]))
      }
      return new Response('[]')
    })
  }

  it('fetches fleet data on connectedCallback', async () => {
    mockFleetFetch()
    attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('holds placeholders on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network error')
    })
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    // Should still render without crashing
    expect(el.querySelector('hud-panel')).not.toBeNull()
  })
})
