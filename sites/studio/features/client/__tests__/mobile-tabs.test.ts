// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterEach } from 'vitest'

function buildMobileComparison (): HTMLElement {
  const container = document.createElement('div')
  container.className = 'mobile-comparison'

  const tabs = document.createElement('div')
  tabs.className = 'mobile-tabs'

  const panels: string[] = ['inertia', 'wix', 'agency']
  const labels: string[] = ['Inertia', 'Wix/SQ', 'Agency']

  for (let i = 0; i < panels.length; i++) {
    const btn = document.createElement('button')
    btn.className = i === 0 ? 'mobile-tab active' : 'mobile-tab'
    btn.setAttribute('data-tab', panels[i])
    btn.textContent = labels[i]
    tabs.appendChild(btn)
  }
  container.appendChild(tabs)

  for (let i = 0; i < panels.length; i++) {
    const panel = document.createElement('div')
    panel.className = i === 0 ? 'mobile-panel active' : 'mobile-panel'
    panel.setAttribute('data-panel', panels[i])
    panel.innerHTML = '<div class="mobile-row"><div class="mobile-row-label">Test</div><div class="mobile-row-value">Value</div></div>'
    container.appendChild(panel)
  }

  return container
}

describe('initMobileTabs', () => {
  let initMobileTabs: typeof import('../mobile-tabs.js').initMobileTabs

  beforeAll(async () => {
    const mod = await import('../mobile-tabs.js')
    initMobileTabs = mod.initMobileTabs
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('switches active tab on click', () => {
    const el = buildMobileComparison()
    document.body.appendChild(el)
    initMobileTabs()

    const wixTab = el.querySelector('[data-tab="wix"]') as HTMLElement
    wixTab.click()

    expect(wixTab.classList.contains('active')).toBe(true)
    const inertiaTab = el.querySelector('[data-tab="inertia"]') as HTMLElement
    expect(inertiaTab.classList.contains('active')).toBe(false)
  })

  it('shows matching panel on tab click', () => {
    const el = buildMobileComparison()
    document.body.appendChild(el)
    initMobileTabs()

    const wixTab = el.querySelector('[data-tab="wix"]') as HTMLElement
    wixTab.click()

    const wixPanel = el.querySelector('[data-panel="wix"]') as HTMLElement
    const inertiaPanel = el.querySelector('[data-panel="inertia"]') as HTMLElement
    expect(wixPanel.classList.contains('active')).toBe(true)
    expect(inertiaPanel.classList.contains('active')).toBe(false)
  })

  it('clicking agency tab deactivates all others', () => {
    const el = buildMobileComparison()
    document.body.appendChild(el)
    initMobileTabs()

    const agencyTab = el.querySelector('[data-tab="agency"]') as HTMLElement
    agencyTab.click()

    const tabs = el.querySelectorAll('.mobile-tab')
    for (const tab of tabs) {
      if (tab === agencyTab) {
        expect(tab.classList.contains('active')).toBe(true)
      } else {
        expect(tab.classList.contains('active')).toBe(false)
      }
    }

    const panels = el.querySelectorAll('.mobile-panel')
    for (const panel of panels) {
      if ((panel as HTMLElement).dataset.panel === 'agency') {
        expect(panel.classList.contains('active')).toBe(true)
      } else {
        expect(panel.classList.contains('active')).toBe(false)
      }
    }
  })

  it('is a no-op if no mobile-comparison exists', () => {
    // Should not throw
    initMobileTabs()
  })
})
