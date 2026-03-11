import { describe, it, expect, beforeAll, afterEach } from 'vitest'

beforeAll(async () => {
  if (customElements.get('hud-timerange') === undefined) {
    await import('../components/HudTimeRange.js')
  }
})

function createElement (attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement('hud-timerange')
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

describe('HudTimeRange', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element hud-timerange', () => {
    expect(customElements.get('hud-timerange')).toBeDefined()
  })

  it('renders 4 buttons', () => {
    const el = attach(createElement())
    const buttons = el.querySelectorAll('button')
    expect(buttons.length).toBe(4)
  })

  it('renders correct period labels', () => {
    const el = attach(createElement())
    const buttons = el.querySelectorAll('button')
    const labels = Array.from(buttons).map(b => b.textContent)
    expect(labels).toEqual(['Today', '7d', '30d', '90d'])
  })

  it('sets active state from period attribute', () => {
    const el = attach(createElement({ period: '30D' }))
    const buttons = el.querySelectorAll('button')
    const active = Array.from(buttons).find(b => b.dataset.period === '30D')
    expect(active?.style.backgroundColor).not.toBe('transparent')
  })

  it('defaults to 7D active', () => {
    const el = attach(createElement())
    const buttons = el.querySelectorAll('button')
    const active = Array.from(buttons).find(b => b.dataset.period === '7D')
    expect(active?.style.backgroundColor).not.toBe('transparent')
  })

  it('dispatches hud-period-change event on click', () => {
    const el = attach(createElement())
    let receivedPeriod = ''
    el.addEventListener('hud-period-change', ((e: CustomEvent) => {
      receivedPeriod = e.detail.period
    }) as EventListener)

    const btn30d = el.querySelectorAll('button')[2]
    btn30d?.click()
    expect(receivedPeriod).toBe('30D')
  })

  it('event bubbles', () => {
    const el = attach(createElement())
    let bubbled = false
    document.body.addEventListener('hud-period-change', () => {
      bubbled = true
    })

    const btn = el.querySelector('button')
    btn?.click()
    expect(bubbled).toBe(true)
  })

  it('only one button is active at a time', () => {
    const el = attach(createElement({ period: 'TODAY' }))
    const buttons = el.querySelectorAll('button')
    const nonTransparent = Array.from(buttons).filter(b => b.style.backgroundColor !== 'transparent')
    expect(nonTransparent.length).toBe(1)
  })

  it('has role="group" and aria-label', () => {
    const el = attach(createElement())
    expect(el.getAttribute('role')).toBe('group')
    expect(el.getAttribute('aria-label')).toBe('Time range')
  })

  it('updates active on period attribute change', () => {
    const el = attach(createElement({ period: '7D' }))
    el.setAttribute('period', '90D')
    const buttons = el.querySelectorAll('button')
    const active = Array.from(buttons).find(b => b.dataset.period === '90D')
    expect(active?.style.backgroundColor).not.toBe('transparent')
  })

  it('has connectedMoveCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { connectedMoveCallback: unknown }).connectedMoveCallback).toBe('function')
  })
})
