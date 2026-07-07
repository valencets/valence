import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { swapOutletContent, extractOutletFragment } from '../outlet-swap.js'
import { RouterErrorCode } from '../router-types.js'
import '../val-outlet.js'

function createMockFetch (html: string, extraHeaders?: Record<string, string>): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'X-Valence-Fragment': '1', ...extraHeaders }
    }))
  )
}

describe('extractOutletFragment', () => {
  it('extracts outlet content by name from parsed doc', () => {
    const html = '<html><body><val-outlet name="main"><p>Main content</p></val-outlet></body></html>'
    const result = extractOutletFragment(html, 'main')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.querySelector('p')?.textContent).toBe('Main content')
    }
  })

  it('extracts unnamed (default) outlet content', () => {
    const html = '<html><body><val-outlet><p>Default content</p></val-outlet></body></html>'
    const result = extractOutletFragment(html, undefined)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.querySelector('p')?.textContent).toBe('Default content')
    }
  })

  it('returns SELECTOR_MISS when named outlet not found', () => {
    const html = '<html><body><main><p>No outlet</p></main></body></html>'
    const result = extractOutletFragment(html, 'main')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.SELECTOR_MISS)
    }
  })

  it('returns PARSE_FAILED for empty HTML', () => {
    const result = extractOutletFragment('', 'main')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.PARSE_FAILED)
    }
  })

  it('falls back to body content when no outlet in doc but outlet exists in live DOM', () => {
    // Fragment response has no val-outlet wrapper -- just raw content
    const html = '<p>Fragment only</p>'
    const result = extractOutletFragment(html, undefined)
    // Should succeed by using doc body
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.querySelector('p')?.textContent).toBe('Fragment only')
    }
  })
})

describe('swapOutletContent', () => {
  let liveMain: HTMLElement

  beforeEach(() => {
    liveMain = document.createElement('main')
    document.body.appendChild(liveMain)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('swaps content of named outlet in live DOM', () => {
    const outlet = document.createElement('val-outlet') as HTMLElement
    outlet.setAttribute('name', 'main')
    outlet.innerHTML = '<p>Old</p>'
    liveMain.appendChild(outlet)

    const newHtml = '<val-outlet name="main"><p>New</p></val-outlet>'
    const result = swapOutletContent(document.body, 'main', newHtml)
    expect(result.isOk()).toBe(true)
    expect(outlet.querySelector('p')?.textContent).toBe('New')
  })

  it('swaps content of default (unnamed) outlet', () => {
    const outlet = document.createElement('val-outlet') as HTMLElement
    outlet.innerHTML = '<p>Old default</p>'
    liveMain.appendChild(outlet)

    const newHtml = '<val-outlet><p>New default</p></val-outlet>'
    const result = swapOutletContent(document.body, undefined, newHtml)
    expect(result.isOk()).toBe(true)
    expect(outlet.querySelector('p')?.textContent).toBe('New default')
  })

  it('returns SELECTOR_MISS when outlet not found in live DOM', () => {
    // No val-outlet in DOM
    liveMain.innerHTML = '<p>No outlet</p>'
    const newHtml = '<val-outlet name="sidebar"><p>Sidebar content</p></val-outlet>'
    const result = swapOutletContent(document.body, 'sidebar', newHtml)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.SELECTOR_MISS)
    }
  })

  it('swaps named outlets independently', () => {
    const mainOutlet = document.createElement('val-outlet') as HTMLElement
    mainOutlet.setAttribute('name', 'main')
    mainOutlet.innerHTML = '<p>Main old</p>'
    const sidebarOutlet = document.createElement('val-outlet') as HTMLElement
    sidebarOutlet.setAttribute('name', 'sidebar')
    sidebarOutlet.innerHTML = '<p>Sidebar old</p>'
    liveMain.appendChild(mainOutlet)
    liveMain.appendChild(sidebarOutlet)

    const newMainHtml = '<val-outlet name="main"><p>Main new</p></val-outlet>'
    const result = swapOutletContent(document.body, 'main', newMainHtml)
    expect(result.isOk()).toBe(true)

    // Main updated, sidebar unchanged
    expect(mainOutlet.querySelector('p')?.textContent).toBe('Main new')
    expect(sidebarOutlet.querySelector('p')?.textContent).toBe('Sidebar old')
  })

  it('accepts raw fragment HTML (no val-outlet wrapper) and swaps into unnamed outlet', () => {
    const outlet = document.createElement('val-outlet') as HTMLElement
    outlet.innerHTML = '<p>Old</p>'
    liveMain.appendChild(outlet)

    // Raw fragment without outlet wrapper
    const newHtml = '<p>Raw content</p>'
    const result = swapOutletContent(document.body, undefined, newHtml)
    expect(result.isOk()).toBe(true)
    expect(outlet.querySelector('p')?.textContent).toBe('Raw content')
  })
})

describe('initRouter outlet header support', () => {
  // These tests verify that the router checks for X-Valence-Outlet response header
  // and routes the fragment content to the correct outlet in the live DOM

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('dispatches outlet swap when X-Valence-Outlet header is present', async () => {
    const { initRouter } = await import('../push-state.js')

    const outletHtml = '<val-outlet name="content"><p>Outlet content</p></val-outlet>'
    const mockFetch = createMockFetch(outletHtml, {
      'X-Valence-Outlet': 'content',
      'X-Valence-Fragment': '1'
    })

    const main = document.createElement('main')
    document.body.appendChild(main)
    const outlet = document.createElement('val-outlet') as HTMLElement
    outlet.setAttribute('name', 'content')
    outlet.innerHTML = '<p>Old outlet content</p>'
    main.appendChild(outlet)

    const result = initRouter({}, mockFetch)
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const handle = result.value
      const navResult = await handle.navigate('/page')
      expect(navResult.isOk()).toBe(true)
      expect(outlet.querySelector('p')?.textContent).toBe('Outlet content')
      handle.destroy()
    }
  })

  it('rejects outlet swap responses without fragment header when fragment protocol is enabled', async () => {
    const { initRouter } = await import('../push-state.js')

    const outletHtml = '<val-outlet name="content"><p>Outlet content</p></val-outlet>'
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(new Response(outletHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'X-Valence-Outlet': 'content'
        }
      }))
    )

    const main = document.createElement('main')
    document.body.appendChild(main)
    const outlet = document.createElement('val-outlet') as HTMLElement
    outlet.setAttribute('name', 'content')
    outlet.innerHTML = '<p>Old outlet content</p>'
    main.appendChild(outlet)

    const result = initRouter({ enableFragmentProtocol: true }, mockFetch)
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const handle = result.value
      const navResult = await handle.navigate('/page')
      expect(navResult.isErr()).toBe(true)
      expect(outlet.querySelector('p')?.textContent).toBe('Old outlet content')
      handle.destroy()
    }
  })

  it('falls back to full content swap when outlet not found in DOM', async () => {
    const { initRouter } = await import('../push-state.js')

    const html = '<html><head><title>Page</title></head><body><main><p>Full page content</p></main></body></html>'
    const mockFetch = createMockFetch(html, {
      'X-Valence-Outlet': 'missing-outlet'
    })

    const main = document.createElement('main')
    main.innerHTML = '<p>Old content</p>'
    document.body.appendChild(main)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) {
      const handle = result.value
      await handle.navigate('/page')
      // Falls back to full content swap
      expect(main.querySelector('p')?.textContent).toBe('Full page content')
      handle.destroy()
    }
  })

  it('uses standard content swap when no X-Valence-Outlet header', async () => {
    const { initRouter } = await import('../push-state.js')

    const html = '<html><head><title>Standard</title></head><body><main><p>Standard content</p></main></body></html>'
    const mockFetch = createMockFetch(html)

    const main = document.createElement('main')
    main.innerHTML = '<p>Old</p>'
    document.body.appendChild(main)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) {
      const handle = result.value
      await handle.navigate('/standard')
      expect(main.querySelector('p')?.textContent).toBe('Standard content')
      handle.destroy()
    }
  })
})
