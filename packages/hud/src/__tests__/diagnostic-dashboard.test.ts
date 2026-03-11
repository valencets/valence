import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

beforeAll(async () => {
  if (customElements.get('hud-sparkline') === undefined) {
    await import('../components/HudSparkline.js')
  }
  if (customElements.get('hud-metric') === undefined) {
    await import('../components/HudMetric.js')
  }
  if (customElements.get('hud-status') === undefined) {
    await import('../components/HudStatus.js')
  }
  if (customElements.get('hud-panel') === undefined) {
    await import('../components/HudPanel.js')
  }
  if (customElements.get('hud-diagnostic-dashboard') === undefined) {
    await import('../layouts/DiagnosticDashboard.js')
  }
})

function createElement (attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement('hud-diagnostic-dashboard')
  if (attrs !== undefined) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
  }
  return el
}

function attach (el: HTMLElement): HTMLElement {
  document.body.appendChild(el)
  return el
}

describe('DiagnosticDashboard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element hud-diagnostic-dashboard', () => {
    expect(customElements.get('hud-diagnostic-dashboard')).toBeDefined()
  })

  it('contains 6 hud-panel children', () => {
    const el = attach(createElement({ gate: 'open' }))
    const panels = el.querySelectorAll('hud-panel')
    expect(panels.length).toBe(6)
  })

  it('has panels with correct labels', () => {
    const el = attach(createElement({ gate: 'open' }))
    const panels = el.querySelectorAll('hud-panel')
    const labels = Array.from(panels).map(p => p.getAttribute('label'))
    expect(labels).toContain('Ingestion')
    expect(labels).toContain('Rejection')
    expect(labels).toContain('Pipeline Latency')
    expect(labels).toContain('Buffer Sat')
    expect(labels).toContain('DB Size')
    expect(labels).toContain('Aggregation Lag')
  })

  it('each panel contains a hud-metric', () => {
    const el = attach(createElement({ gate: 'open' }))
    const panels = el.querySelectorAll('hud-panel')
    for (const panel of panels) {
      expect(panel.querySelector('hud-metric')).not.toBeNull()
    }
  })

  it('each panel contains a hud-status', () => {
    const el = attach(createElement({ gate: 'open' }))
    const panels = el.querySelectorAll('hud-panel')
    for (const panel of panels) {
      expect(panel.querySelector('hud-status')).not.toBeNull()
    }
  })

  it('is hidden by default when gate is not open', () => {
    const el = attach(createElement())
    expect(el.style.display).toBe('none')
  })

  it('is visible when gate="open"', () => {
    const el = attach(createElement({ gate: 'open' }))
    expect(el.style.display).not.toBe('none')
  })

  it('toggles visibility on gate attribute change', () => {
    const el = attach(createElement())
    expect(el.style.display).toBe('none')

    el.setAttribute('gate', 'open')
    expect(el.style.display).not.toBe('none')
  })

  it('has connectedMoveCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { connectedMoveCallback: unknown }).connectedMoveCallback).toBe('function')
  })

  it('hides again when gate removed', () => {
    const el = attach(createElement({ gate: 'open' }))
    expect(el.style.display).not.toBe('none')

    el.removeAttribute('gate')
    expect(el.style.display).toBe('none')
  })
})

describe('DiagnosticDashboard data fetching', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function mockFetch (): void {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        period_start: '2026-03-01',
        payloads_accepted: 5200,
        payloads_rejected: 48,
        avg_processing_ms: 3.2,
        buffer_saturation_pct: 12
      }))
    })
  }

  it('fetches ingestion health on connectedCallback', async () => {
    mockFetch()
    attach(createElement({ gate: 'open' }))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('updates ingestion metric after fetch', async () => {
    mockFetch()
    const el = attach(createElement({ gate: 'open' }))
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const ingestion = Array.from(panels).find(p => p.getAttribute('label') === 'Ingestion')
    const metric = ingestion?.querySelector('hud-metric')
    // Should show payloads_accepted as the ingestion rate
    expect(metric?.getAttribute('value')).not.toBe('--/hr')
  })

  it('holds placeholders on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    const el = attach(createElement({ gate: 'open' }))
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const ingestion = Array.from(panels).find(p => p.getAttribute('label') === 'Ingestion')
    const metric = ingestion?.querySelector('hud-metric')
    expect(metric?.getAttribute('value')).toBe('--/hr')
  })
})
