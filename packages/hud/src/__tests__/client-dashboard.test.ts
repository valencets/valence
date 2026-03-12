import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

beforeAll(async () => {
  if (customElements.get('hud-sparkline') === undefined) {
    await import('../components/HudSparkline.js')
  }
  if (customElements.get('hud-metric') === undefined) {
    await import('../components/HudMetric.js')
  }
  if (customElements.get('hud-bar') === undefined) {
    await import('../components/HudBar.js')
  }
  if (customElements.get('hud-table') === undefined) {
    await import('../components/HudTable.js')
  }
  if (customElements.get('hud-timerange') === undefined) {
    await import('../components/HudTimeRange.js')
  }
  if (customElements.get('hud-panel') === undefined) {
    await import('../components/HudPanel.js')
  }
  if (customElements.get('hud-client-dashboard') === undefined) {
    await import('../layouts/ClientDashboard.js')
  }
})

function createElement (): HTMLElement {
  return document.createElement('hud-client-dashboard')
}

function attach (el: HTMLElement): HTMLElement {
  document.body.appendChild(el)
  return el
}

describe('ClientDashboard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element hud-client-dashboard', () => {
    expect(customElements.get('hud-client-dashboard')).toBeDefined()
  })

  it('contains 5 hud-panel children', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    expect(panels.length).toBe(5)
  })

  it('has panels with correct labels', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    const labels = Array.from(panels).map(p => p.getAttribute('label'))
    expect(labels).toContain('Visitors')
    expect(labels).toContain('Leads')
    expect(labels).toContain('Top Pages')
    expect(labels).toContain('Lead Actions')
    expect(labels).toContain('Traffic Sources')
  })

  it('contains a hud-timerange', () => {
    const el = attach(createElement())
    expect(el.querySelector('hud-timerange')).not.toBeNull()
  })

  it('has hud-metric in Visitors panel', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    const visitors = Array.from(panels).find(p => p.getAttribute('label') === 'Visitors')
    expect(visitors?.querySelector('hud-metric')).not.toBeNull()
  })

  it('has hud-metric in Leads panel', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    const leads = Array.from(panels).find(p => p.getAttribute('label') === 'Leads')
    expect(leads?.querySelector('hud-metric')).not.toBeNull()
  })

  it('has hud-table in Top Pages panel', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    const topPages = Array.from(panels).find(p => p.getAttribute('label') === 'Top Pages')
    expect(topPages?.querySelector('hud-table')).not.toBeNull()
  })

  it('has hud-bar components in Lead Actions panel', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    const actions = Array.from(panels).find(p => p.getAttribute('label') === 'Lead Actions')
    const bars = actions?.querySelectorAll('hud-bar')
    expect(bars?.length).toBeGreaterThanOrEqual(3)
  })

  it('has hud-bar components in Traffic Sources panel', () => {
    const el = attach(createElement())
    const panels = el.querySelectorAll('hud-panel')
    const sources = Array.from(panels).find(p => p.getAttribute('label') === 'Traffic Sources')
    const bars = sources?.querySelectorAll('hud-bar')
    expect(bars?.length).toBeGreaterThanOrEqual(1)
  })

  it('does not duplicate DOM on disconnect + reconnect', () => {
    const el = attach(createElement())
    expect(el.querySelectorAll('hud-panel').length).toBe(5)

    // Simulate fragment swap: disconnect then reconnect
    el.remove()
    document.body.appendChild(el)

    expect(el.querySelectorAll('hud-panel').length).toBe(5)
  })

  it('hud-bar inside hud-panel renders DOM only once', () => {
    const panel = document.createElement('hud-panel') as HTMLElement
    panel.setAttribute('label', 'Test')
    const bar = document.createElement('hud-bar') as HTMLElement
    bar.setAttribute('label', 'Phone')
    bar.setAttribute('value', '10')
    bar.setAttribute('percent', '50')
    panel.appendChild(bar)
    document.body.appendChild(panel)

    // Bar should have exactly 2 direct children: header div + track div
    expect(bar.children.length).toBe(2)
  })

  it('hud-metric inside hud-panel renders DOM only once', () => {
    const panel = document.createElement('hud-panel') as HTMLElement
    panel.setAttribute('label', 'Test')
    const metric = document.createElement('hud-metric') as HTMLElement
    metric.setAttribute('value', '42')
    panel.appendChild(metric)
    document.body.appendChild(panel)

    // Metric should have exactly 4 children: label, value, sparkline, delta
    expect(metric.children.length).toBe(4)
  })

  it('hud-table inside hud-panel renders single table', () => {
    const panel = document.createElement('hud-panel') as HTMLElement
    panel.setAttribute('label', 'Test')
    const table = document.createElement('hud-table') as HTMLElement
    table.setAttribute('columns', JSON.stringify([{ label: 'Page', key: 'path' }]))
    table.setAttribute('rows', '[]')
    panel.appendChild(table)
    document.body.appendChild(panel)

    expect(table.querySelectorAll('table').length).toBe(1)
    expect(table.querySelectorAll('thead').length).toBe(1)
  })

  it('responds to hud-period-change event', () => {
    const el = attach(createElement())
    const timerange = el.querySelector('hud-timerange')
    let eventFired = false

    el.addEventListener('hud-period-change', () => {
      eventFired = true
    })

    const btn = timerange?.querySelector('button')
    btn?.click()
    expect(eventFired).toBe(true)
  })
})

describe('ClientDashboard data fetching', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function mockFetch (): void {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/summaries/sessions')) {
        return new Response(JSON.stringify({
          period_start: '2026-03-01',
          period_end: '2026-03-08',
          total_sessions: 142,
          unique_referrers: 5,
          device_breakdown: { mobile: 80, desktop: 50, tablet: 12 }
        }))
      }
      if (url.includes('/api/summaries/events')) {
        return new Response(JSON.stringify({
          period_start: '2026-03-01',
          period_end: '2026-03-08',
          event_category: 'INTENT_LEAD',
          total_count: 23,
          unique_sessions: 18
        }))
      }
      if (url.includes('/api/summaries/conversions')) {
        return new Response(JSON.stringify({
          period_start: '2026-03-01',
          period_end: '2026-03-08',
          intent_type: 'INTENT_LEAD',
          total_count: 23,
          top_sources: [{ referrer: 'google', count: 15 }]
        }))
      }
      return new Response('{}')
    })
  }

  it('fetches data on connectedCallback', async () => {
    mockFetch()
    attach(createElement())
    // Allow microtasks to settle
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('updates visitor metric after fetch', async () => {
    mockFetch()
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const visitors = Array.from(panels).find(p => p.getAttribute('label') === 'Visitors')
    const metric = visitors?.querySelector('hud-metric')
    expect(metric?.getAttribute('value')).toBe('142')
  })

  it('updates leads metric after fetch', async () => {
    mockFetch()
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const leads = Array.from(panels).find(p => p.getAttribute('label') === 'Leads')
    const metric = leads?.querySelector('hud-metric')
    expect(metric?.getAttribute('value')).toBe('23')
  })

  it('holds placeholders on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const visitors = Array.from(panels).find(p => p.getAttribute('label') === 'Visitors')
    const metric = visitors?.querySelector('hud-metric')
    expect(metric?.getAttribute('value')).toBe('--')
  })

  it('refreshes data on hud-period-change', async () => {
    mockFetch()
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const callCount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    // Dispatch period change
    el.querySelector('hud-timerange')?.dispatchEvent(
      new CustomEvent('hud-period-change', { detail: { period: '30D' }, bubbles: true })
    )
    await new Promise(resolve => setTimeout(resolve, 50))
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount)
  })
})

describe('ClientDashboard breakdown wiring', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function mockFetchWithBreakdowns (): void {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/summaries/sessions')) {
        return new Response(JSON.stringify({
          period_start: '2026-03-01',
          period_end: '2026-03-08',
          total_sessions: 142,
          unique_referrers: 5,
          device_breakdown: {
            mobile: 80,
            desktop: 50,
            tablet: 12
          }
        }))
      }
      if (url.includes('/api/summaries/events')) {
        return new Response(JSON.stringify({
          period_start: '2026-03-01',
          period_end: '2026-03-08',
          event_category: 'INTENT_LEAD',
          total_count: 23,
          unique_sessions: 18
        }))
      }
      if (url.includes('/api/summaries/conversions')) {
        return new Response(JSON.stringify({
          period_start: '2026-03-01',
          period_end: '2026-03-08',
          intent_type: 'INTENT_LEAD',
          total_count: 23,
          top_sources: [{
            referrer: 'google',
            count: 15
          }]
        }))
      }
      if (url.includes('/api/breakdowns/pages')) {
        return new Response(JSON.stringify({
          pages: [
            { path: '/', count: 500 },
            { path: '/about', count: 120 },
            { path: '/pricing', count: 80 }
          ]
        }))
      }
      if (url.includes('/api/breakdowns/sources')) {
        return new Response(JSON.stringify({
          sources: [
            { category: 'Search', count: 200, percent: 67 },
            { category: 'Direct', count: 100, percent: 33 }
          ]
        }))
      }
      if (url.includes('/api/breakdowns/actions')) {
        return new Response(JSON.stringify({
          actions: [
            { action: 'LEAD_PHONE', count: 12 },
            { action: 'LEAD_EMAIL', count: 8 }
          ]
        }))
      }
      return new Response('{}')
    })
  }

  it('populates Top Pages table after fetch', async () => {
    mockFetchWithBreakdowns()
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const topPages = Array.from(panels).find(p => p.getAttribute('label') === 'Top Pages')
    const table = topPages?.querySelector('hud-table')
    const rows = table?.getAttribute('rows')
    expect(rows).not.toBe('[]')
    const parsed = JSON.parse(rows ?? '[]')
    expect(parsed.length).toBeGreaterThanOrEqual(1)
    expect(parsed[0].path).toBe('/')
  })

  it('updates Traffic Sources bars after fetch', async () => {
    mockFetchWithBreakdowns()
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const sources = Array.from(panels).find(p => p.getAttribute('label') === 'Traffic Sources')
    const bars = sources?.querySelectorAll('hud-bar')
    const searchBar = Array.from(bars ?? []).find(b => b.getAttribute('label') === 'Search')
    expect(searchBar).toBeDefined()
    expect(searchBar?.getAttribute('value')).not.toBe('--')
  })

  it('updates Lead Actions bars after fetch', async () => {
    mockFetchWithBreakdowns()
    const el = attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const panels = el.querySelectorAll('hud-panel')
    const actions = Array.from(panels).find(p => p.getAttribute('label') === 'Lead Actions')
    const bars = actions?.querySelectorAll('hud-bar')
    const phoneBar = Array.from(bars ?? []).find(b => b.getAttribute('label') === 'Phone')
    expect(phoneBar).toBeDefined()
    expect(phoneBar?.getAttribute('value')).not.toBe('--')
  })

  it('calls breakdown API endpoints', async () => {
    mockFetchWithBreakdowns()
    attach(createElement())
    await new Promise(resolve => setTimeout(resolve, 50))
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]))
    expect(calls.some(u => u.includes('/api/breakdowns/pages'))).toBe(true)
    expect(calls.some(u => u.includes('/api/breakdowns/sources'))).toBe(true)
    expect(calls.some(u => u.includes('/api/breakdowns/actions'))).toBe(true)
  })
})
