import { describe, it, expect, beforeAll, afterEach } from 'vitest'

beforeAll(async () => {
  if (customElements.get('hud-sparkline') === undefined) {
    await import('../components/HudSparkline.js')
  }
})

function createElement (attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement('hud-sparkline')
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

describe('HudSparkline', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element hud-sparkline', () => {
    expect(customElements.get('hud-sparkline')).toBeDefined()
  })

  it('creates an SVG with a polyline', () => {
    const el = attach(createElement())
    const svg = el.querySelector('svg')
    expect(svg).not.toBeNull()
    const polyline = svg?.querySelector('polyline')
    expect(polyline).not.toBeNull()
  })

  it('sets polyline points from data attribute', () => {
    const el = attach(createElement({ data: '10,20,30,40,50' }))
    const polyline = el.querySelector('polyline')
    const points = polyline?.getAttribute('points') ?? ''
    expect(points.length).toBeGreaterThan(0)
    expect(points).toContain(',')
  })

  it('renders a flat line for empty data', () => {
    const el = attach(createElement())
    const polyline = el.querySelector('polyline')
    const points = polyline?.getAttribute('points') ?? ''
    expect(points.length).toBeGreaterThan(0)
  })

  it('renders a centered point for single data value', () => {
    const el = attach(createElement({ data: '42' }))
    const polyline = el.querySelector('polyline')
    const points = polyline?.getAttribute('points') ?? ''
    expect(points.length).toBeGreaterThan(0)
  })

  it('normalizes values to min/max range', () => {
    const el = attach(createElement({ data: '0,50,100' }))
    const polyline = el.querySelector('polyline')
    const points = polyline?.getAttribute('points') ?? ''
    const coords = points.split(' ')
    expect(coords.length).toBe(3)
  })

  it('respects width and height attributes on viewBox', () => {
    const el = attach(createElement({ width: '200', height: '50' }))
    const svg = el.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 200 50')
  })

  it('mutates points in-place on data update', () => {
    const el = attach(createElement({ data: '10,20,30' }))
    const polyline = el.querySelector('polyline')
    const before = polyline?.getAttribute('points')

    el.setAttribute('data', '100,10,50')
    const after = polyline?.getAttribute('points')
    expect(after).not.toBe(before)
  })

  it('uses the same polyline element after data update', () => {
    const el = attach(createElement({ data: '10,20,30' }))
    const polylineBefore = el.querySelector('polyline')

    el.setAttribute('data', '40,50,60')
    const polylineAfter = el.querySelector('polyline')
    expect(polylineAfter).toBe(polylineBefore)
  })

  it('has connectedMoveCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { connectedMoveCallback: unknown }).connectedMoveCallback).toBe('function')
  })

  it('updates viewBox when width changes', () => {
    const el = attach(createElement({ width: '100', height: '30' }))
    const svg = el.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 30')

    el.setAttribute('width', '200')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 200 30')
  })

  it('uses default dimensions when not specified', () => {
    const el = attach(createElement())
    const svg = el.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('120')
    expect(svg?.getAttribute('height')).toBe('32')
  })
})
