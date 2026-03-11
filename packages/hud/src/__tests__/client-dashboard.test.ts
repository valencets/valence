import { describe, it, expect, beforeAll, afterEach } from 'vitest'

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
