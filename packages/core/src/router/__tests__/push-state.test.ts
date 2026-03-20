import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  shouldIntercept,
  initRouter
} from '../push-state.js'
import type { RouterHandle } from '../push-state.js'

function createMockFetch (html: string, extraHeaders?: Record<string, string>): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', ...extraHeaders }
    }))
  )
}

function createAnchor (href: string, attrs?: Record<string, string>): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  if (attrs !== undefined) {
    for (const [key, value] of Object.entries(attrs)) {
      a.setAttribute(key, value)
    }
  }
  document.body.appendChild(a)
  return a
}

function clickAnchor (el: HTMLElement, opts?: Partial<MouseEventInit>): MouseEvent {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    ...opts
  })
  el.dispatchEvent(event)
  return event
}

describe('shouldIntercept', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns true for same-origin relative link', () => {
    const a = createAnchor('/about')
    const event = new MouseEvent('click', { bubbles: true })
    expect(shouldIntercept(event, a)).toBe(true)
  })

  it('returns false for external link', () => {
    const a = createAnchor('https://external.example.com/page')
    const event = new MouseEvent('click', { bubbles: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for hash-only link', () => {
    const a = createAnchor('#section')
    const event = new MouseEvent('click', { bubbles: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for meta+click', () => {
    const a = createAnchor('/about')
    const event = new MouseEvent('click', { bubbles: true, metaKey: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for ctrl+click', () => {
    const a = createAnchor('/about')
    const event = new MouseEvent('click', { bubbles: true, ctrlKey: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for shift+click', () => {
    const a = createAnchor('/about')
    const event = new MouseEvent('click', { bubbles: true, shiftKey: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for alt+click', () => {
    const a = createAnchor('/about')
    const event = new MouseEvent('click', { bubbles: true, altKey: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for target="_blank"', () => {
    const a = createAnchor('/about', { target: '_blank' })
    const event = new MouseEvent('click', { bubbles: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for data-valence-ignore', () => {
    const a = createAnchor('/about', { 'data-valence-ignore': '' })
    const event = new MouseEvent('click', { bubbles: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })

  it('returns false for download attribute', () => {
    const a = createAnchor('/file.pdf', { download: '' })
    const event = new MouseEvent('click', { bubbles: true })
    expect(shouldIntercept(event, a)).toBe(false)
  })
})

describe('initRouter', () => {
  let handle: RouterHandle | null

  beforeEach(() => {
    handle = null
    // Set a known initial URL
    window.history.replaceState({ url: '/' }, '', '/')
    document.title = 'Initial'
  })

  afterEach(() => {
    if (handle !== null) {
      handle.destroy()
    }
    document.body.innerHTML = ''
  })

  it('returns Ok with handle', () => {
    const mockFetch = createMockFetch('<html><head><title>Test</title></head><body><main>Content</main></body></html>')
    const result = initRouter({}, mockFetch)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      handle = result.value
      expect(typeof handle.destroy).toBe('function')
      expect(typeof handle.navigate).toBe('function')
      expect(typeof handle.prefetch).toBe('function')
    }
  })

  it('attaches click and popstate listeners', () => {
    const clickSpy = vi.spyOn(document.body, 'addEventListener')
    const popstateSpy = vi.spyOn(window, 'addEventListener')
    const mockFetch = createMockFetch('<main>Test</main>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    expect(clickSpy).toHaveBeenCalledWith('click', expect.any(Function))
    expect(popstateSpy).toHaveBeenCalledWith('popstate', expect.any(Function))

    clickSpy.mockRestore()
    popstateSpy.mockRestore()
  })

  it('destroy removes all listeners', () => {
    const clickRemoveSpy = vi.spyOn(document.body, 'removeEventListener')
    const popstateRemoveSpy = vi.spyOn(window, 'removeEventListener')
    const mockFetch = createMockFetch('<main>Test</main>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) {
      handle = result.value
      handle.destroy()
      handle = null
    }

    expect(clickRemoveSpy).toHaveBeenCalledWith('click', expect.any(Function))
    expect(popstateRemoveSpy).toHaveBeenCalledWith('popstate', expect.any(Function))

    clickRemoveSpy.mockRestore()
    popstateRemoveSpy.mockRestore()
  })

  it('click on internal link calls pushState', async () => {
    const mockFetch = createMockFetch('<html><head><title>About</title></head><body><main><p>About page</p></main></body></html>')
    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    // Set up live main element
    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/about')
    clickAnchor(link)

    // Wait for async navigation to complete
    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(pushStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/about' }),
      '',
      '/about'
    )
    pushStateSpy.mockRestore()
  })

  it('click on internal link swaps main content', async () => {
    const mockFetch = createMockFetch('<html><head><title>About</title></head><body><main><p>About page</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/about')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(document.querySelector('main p')?.textContent).toBe('About page')
  })

  it('click on internal link updates document.title', async () => {
    const mockFetch = createMockFetch('<html><head><title>About Us</title></head><body><main><p>About</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/about')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(document.title).toBe('About Us')
  })

  it('click on external link does NOT prevent default', () => {
    const mockFetch = createMockFetch('<main>Test</main>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const link = createAnchor('https://external.example.com')
    const event = clickAnchor(link)

    // External links should not be intercepted
    expect(event.defaultPrevented).toBe(false)
  })

  it('dispatches valence:before-navigate before navigation', async () => {
    const mockFetch = createMockFetch('<html><head><title>Nav</title></head><body><main><p>Nav</p></main></body></html>')
    const beforeNavHandler = vi.fn()

    document.addEventListener('valence:before-navigate', beforeNavHandler)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/nav')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(beforeNavHandler).toHaveBeenCalledTimes(1)
    document.removeEventListener('valence:before-navigate', beforeNavHandler)
  })

  it('valence:before-navigate is cancelable and aborts navigation', async () => {
    const mockFetch = createMockFetch('<html><head><title>Blocked</title></head><body><main><p>Blocked</p></main></body></html>')

    document.addEventListener('valence:before-navigate', (e) => {
      e.preventDefault()
    }, { once: true })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/blocked')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    // Content should NOT have changed
    expect(document.querySelector('main p')?.textContent).toBe('Home')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('dispatches valence:navigated after success', async () => {
    const mockFetch = createMockFetch('<html><head><title>Done</title></head><body><main><p>Done</p></main></body></html>')
    const navigatedHandler = vi.fn()

    document.addEventListener('valence:navigated', navigatedHandler)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/done')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(navigatedHandler).toHaveBeenCalledTimes(1)
    document.removeEventListener('valence:navigated', navigatedHandler)
  })

  it('popstate triggers fragment swap', async () => {
    const mockFetch = createMockFetch('<html><head><title>Back</title></head><body><main><p>Previous page</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Current</p>'
    document.body.appendChild(main)

    // Simulate popstate (back/forward navigation)
    window.dispatchEvent(new PopStateEvent('popstate', {
      state: { url: '/previous' }
    }))

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(mockFetch).toHaveBeenCalledWith('/previous', expect.anything())
    expect(document.querySelector('main p')?.textContent).toBe('Previous page')
  })

  it('popstate uses location.href when state is null', async () => {
    const mockFetch = createMockFetch('<html><head><title>Loc</title></head><body><main><p>Location page</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Current</p>'
    document.body.appendChild(main)

    window.dispatchEvent(new PopStateEvent('popstate', {
      state: null
    }))

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(mockFetch).toHaveBeenCalled()
  })

  it('navigate() performs programmatic navigation', async () => {
    const mockFetch = createMockFetch('<html><head><title>Programmatic</title></head><body><main><p>Programmatic</p></main></body></html>')
    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const navResult = await handle!.navigate('/programmatic')
    expect(navResult.isOk()).toBe(true)

    expect(pushStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/programmatic' }),
      '',
      '/programmatic'
    )
    expect(document.querySelector('main p')?.textContent).toBe('Programmatic')

    pushStateSpy.mockRestore()
  })

  it('dispatches valence:before-swap before fragment swap', async () => {
    const mockFetch = createMockFetch('<html><head><title>Swap</title></head><body><main><p>Swapped</p></main></body></html>')
    const beforeSwapHandler = vi.fn()

    document.addEventListener('valence:before-swap', beforeSwapHandler)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/swap')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(beforeSwapHandler).toHaveBeenCalledTimes(1)
    // Before-swap fires before content changes, so by the time the handler is called,
    // the old content should still be in the DOM
    document.removeEventListener('valence:before-swap', beforeSwapHandler)
  })

  it('dispatches valence:after-swap after fragment swap', async () => {
    const mockFetch = createMockFetch('<html><head><title>Swap</title></head><body><main><p>Swapped</p></main></body></html>')
    const afterSwapHandler = vi.fn()
    let contentAtSwap = ''

    document.addEventListener('valence:after-swap', () => {
      contentAtSwap = document.querySelector('main p')?.textContent ?? ''
      afterSwapHandler()
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/swap-after')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(afterSwapHandler).toHaveBeenCalledTimes(1)
    // After-swap fires after content is replaced
    expect(contentAtSwap).toBe('Swapped')
  })

  it('before-swap fires before content changes', async () => {
    const mockFetch = createMockFetch('<html><head><title>Order</title></head><body><main><p>New content</p></main></body></html>')
    let contentDuringBeforeSwap = ''

    document.addEventListener('valence:before-swap', () => {
      contentDuringBeforeSwap = document.querySelector('main p')?.textContent ?? ''
    }, { once: true })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Old content</p>'
    document.body.appendChild(main)

    const link = createAnchor('/order')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(contentDuringBeforeSwap).toBe('Old content')
  })

  it('handles bare fragment response without main wrapper', async () => {
    const mockFetch = createMockFetch('<section><p>Fragment content</p></section>', {
      'X-Valence-Title': 'About | Valence Studio'
    })

    const result = initRouter({ enableFragmentProtocol: true }, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/about')

    expect(document.querySelector('main section p')?.textContent).toBe('Fragment content')
    expect(document.title).toBe('About | Valence Studio')
  })

  it('sends X-Valence-Fragment header on navigation', async () => {
    const mockFetch = createMockFetch('<html><head><title>Frag</title></head><body><main><p>Fragment</p></main></body></html>')

    const result = initRouter({ enableFragmentProtocol: true }, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/frag')

    expect(mockFetch).toHaveBeenCalledWith('/frag', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Valence-Fragment': '1' })
    }))
  })

  it('does not send fragment header when protocol disabled', async () => {
    const mockFetch = createMockFetch('<html><head><title>Full</title></head><body><main><p>Full</p></main></body></html>')

    const result = initRouter({ enableFragmentProtocol: false }, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/full')

    expect(mockFetch).toHaveBeenCalledWith('/full', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('valence:navigated event includes performance metadata', async () => {
    const mockFetch = createMockFetch('<html><head><title>Perf</title></head><body><main><p>Perf</p></main></body></html>')
    let eventDetail: unknown = null

    document.addEventListener('valence:navigated', ((e: CustomEvent) => {
      eventDetail = e.detail
    }) as EventListener, { once: true })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/perf')

    expect(eventDetail).toBeDefined()
    const detail = eventDetail as { source: string; durationMs: number; fromUrl: string; toUrl: string }
    expect(detail.source).toBe('network')
    expect(typeof detail.durationMs).toBe('number')
    expect(detail.durationMs).toBeGreaterThanOrEqual(0)
    expect(detail.toUrl).toBe('/perf')
  })

  it('stores visited pages in page cache', async () => {
    const mockFetch = createMockFetch('<html><head><title>Cached</title></head><body><main><p>Cached</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/cached')
    expect(handle!.pageCacheSize()).toBe(1)
  })

  it('cache hit serves instantly without blocking on network (SWR revalidates in background)', async () => {
    const mockFetch = createMockFetch('<html><head><title>Cached</title></head><body><main><p>Cached</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/cached2')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second visit serves from cache (instant) but SWR fires background fetch
    await handle!.navigate('/cached2')
    // Content served immediately from cache
    expect(document.querySelector('main p')?.textContent).toBe('Cached')

    // Background revalidation fires asynchronously
    await new Promise(resolve => { setTimeout(resolve, 50) })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('cache hit reports source as cache in navigated event', async () => {
    const mockFetch = createMockFetch('<html><head><title>Src</title></head><body><main><p>Source</p></main></body></html>')
    let lastSource = ''

    document.addEventListener('valence:navigated', ((e: CustomEvent) => {
      lastSource = e.detail.source
    }) as EventListener)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/src-test')
    expect(lastSource).toBe('network')

    await handle!.navigate('/src-test')
    expect(lastSource).toBe('cache')
  })

  it('background revalidation fires after cache hit', async () => {
    let fetchCount = 0
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      fetchCount++
      return Promise.resolve(new Response('<html><head><title>BG</title></head><body><main><p>BG</p></main></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }))
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    // First visit -- network fetch
    await handle!.navigate('/bg-test')
    expect(fetchCount).toBe(1)

    // Second visit -- cache hit, but background revalidation fires
    await handle!.navigate('/bg-test')
    // Allow background fetch to fire
    await new Promise(resolve => { setTimeout(resolve, 50) })
    expect(fetchCount).toBe(2)
  })

  it('background revalidation re-swaps DOM when content changed', async () => {
    let callCount = 0
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      callCount++
      const html = callCount === 1
        ? '<html><head><title>V1</title></head><body><main><p>Version 1</p></main></body></html>'
        : '<html><head><title>V2</title></head><body><main><p>Version 2</p></main></body></html>'
      return Promise.resolve(new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }))
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/swr-test')
    expect(document.querySelector('main p')?.textContent).toBe('Version 1')

    // Second visit -- cache serves V1, background fetches V2
    await handle!.navigate('/swr-test')
    // Wait for background revalidation
    await new Promise(resolve => { setTimeout(resolve, 100) })
    expect(document.querySelector('main p')?.textContent).toBe('Version 2')
  })

  it('background revalidation does NOT re-swap when content is same', async () => {
    const mockFetch = createMockFetch('<html><head><title>Same</title></head><body><main><p>Same</p></main></body></html>')
    let swapCount = 0

    document.addEventListener('valence:after-swap', () => { swapCount++ })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/no-re-swap')
    const afterFirst = swapCount

    await handle!.navigate('/no-re-swap')
    await new Promise(resolve => { setTimeout(resolve, 100) })
    // Only the cache-hit swap should fire, background should not re-swap (same content)
    expect(swapCount).toBe(afterFirst + 1)
  })

  it('admin paths are not cached', async () => {
    const mockFetch = createMockFetch('<html><head><title>Admin</title></head><body><main><p>Admin</p></main></body></html>')

    const result = initRouter({ noCachePaths: ['/admin'] }, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/admin/hud')
    expect(handle!.pageCacheSize()).toBe(0)
  })

  it('reads initial version from data-valence-version on html element', async () => {
    document.documentElement.setAttribute('data-valence-version', 'test-v1')

    const mockFetch = createMockFetch('<html><head><title>Ver</title></head><body><main><p>Ver</p></main></body></html>')
    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    // Navigate -- should store in cache
    await handle!.navigate('/ver-test')
    expect(handle!.pageCacheSize()).toBe(1)

    document.documentElement.removeAttribute('data-valence-version')
  })

  it('version mismatch from response header invalidates page cache', async () => {
    document.documentElement.setAttribute('data-valence-version', 'old-version')

    const mockFetch = createMockFetch(
      '<html><head><title>New</title></head><body><main><p>New</p></main></body></html>',
      { 'X-Valence-Version': 'new-version' }
    )
    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    // First nav -- response has new-version, mismatches old-version seeded from DOM
    // performNavigation stores in cache, then navigate() calls setVersion which
    // detects mismatch and invalidates all entries
    await handle!.navigate('/page-a')
    // Cache was purged by version mismatch
    expect(handle!.pageCacheSize()).toBe(0)

    // Second nav with same version -- no mismatch now, entry survives
    await handle!.navigate('/page-b')
    expect(handle!.pageCacheSize()).toBe(1)

    document.documentElement.removeAttribute('data-valence-version')
  })

  it('clearPageCache empties the cache', async () => {
    const mockFetch = createMockFetch('<html><head><title>Clear</title></head><body><main><p>Clear</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/clear-test')
    expect(handle!.pageCacheSize()).toBe(1)

    handle!.clearPageCache()
    expect(handle!.pageCacheSize()).toBe(0)
  })

  it('navigation scrolls to top', async () => {
    const mockFetch = createMockFetch('<html><head><title>Scroll</title></head><body><main><p>Scrolled</p></main></body></html>')
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/scroll')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(scrollSpy).toHaveBeenCalledWith(0, 0)
    scrollSpy.mockRestore()
  })

  it('non-admin paths ARE cached even when noCachePaths includes /admin', async () => {
    const mockFetch = createMockFetch('<html><head><title>Public</title></head><body><main><p>Public</p></main></body></html>')

    const result = initRouter({ noCachePaths: ['/admin'] }, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/about')
    expect(handle!.pageCacheSize()).toBe(1)
  })

  it('noCachePaths supports multiple prefixes', async () => {
    const mockFetch = createMockFetch('<html><head><title>API</title></head><body><main><p>API</p></main></body></html>')

    const result = initRouter({ noCachePaths: ['/admin', '/api'] }, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    await handle!.navigate('/api/status')
    expect(handle!.pageCacheSize()).toBe(0)
  })

  it('background revalidation does not leak unhandled rejections on fetch failure', async () => {
    let callCount = 0
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(new Response('<html><head><title>OK</title></head><body><main><p>OK</p></main></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }))
      }
      // Background revalidation fetch fails
      return Promise.reject(new Error('network down'))
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    // First visit -- caches
    await handle!.navigate('/revalidate-fail')
    expect(callCount).toBe(1)

    // Second visit -- cache hit triggers background revalidation which fails
    await handle!.navigate('/revalidate-fail')
    // Wait for background fetch to settle -- should NOT throw unhandled rejection
    await new Promise(resolve => { setTimeout(resolve, 100) })
    expect(callCount).toBe(2)
  })

  it('rapid sequential navigations: earlier fetches receive abort signal', async () => {
    const receivedSignals: Array<AbortSignal | undefined> = []
    const mockFetch = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      receivedSignals.push(init?.signal ?? undefined)
      return Promise.resolve(new Response(
        '<html><head><title>Nav</title></head><body><main><p>Nav</p></main></body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      ))
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    // Fire 3 rapid navigations
    handle!.navigate('/page-a')
    handle!.navigate('/page-b')
    await handle!.navigate('/page-c')

    // All fetches should receive an AbortSignal
    expect(receivedSignals.length).toBeGreaterThanOrEqual(1)
    for (const signal of receivedSignals) {
      expect(signal).toBeInstanceOf(AbortSignal)
    }

    // Earlier signals should be aborted, last should not
    const lastSignal = receivedSignals[receivedSignals.length - 1]
    expect(lastSignal?.aborted).toBe(false)
    if (receivedSignals.length > 1) {
      expect(receivedSignals[0]?.aborted).toBe(true)
    }
  })

  it('failed fetch returns error after retries exhausted', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError('Failed to fetch')
    )

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    // Navigate — all retries will fail
    const navResult = await handle!.navigate('/fail-page')

    // Should have returned an error (implementation will fall back to location.href)
    expect(navResult.isErr()).toBe(true)
  })

  it('click sets aria-busy and data-val-loading on anchor', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(new Response(
            '<html><head><title>Loading</title></head><body><main><p>Loaded</p></main></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          ))
        }, 50)
      })
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/loading')
    clickAnchor(link)

    // Immediately after click, loading state should be set
    expect(link.getAttribute('aria-busy')).toBe('true')
    expect(link.hasAttribute('data-val-loading')).toBe(true)

    await new Promise(resolve => { setTimeout(resolve, 100) })
  })

  it('successful navigation removes loading attributes', async () => {
    const mockFetch = createMockFetch('<html><head><title>Done</title></head><body><main><p>Done</p></main></body></html>')

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/done')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(link.hasAttribute('aria-busy')).toBe(false)
    expect(link.hasAttribute('data-val-loading')).toBe(false)
  })

  it('failed navigation removes loading attributes', async () => {
    vi.useFakeTimers()

    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError('Failed to fetch')
    )

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/fail')
    clickAnchor(link)

    // Advance past retry backoff (immediate + 1s delay + final attempt)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(0)

    expect(link.hasAttribute('aria-busy')).toBe(false)
    expect(link.hasAttribute('data-val-loading')).toBe(false)

    vi.useRealTimers()
  })

  it('double-click on same URL while in-flight is ignored', async () => {
    let fetchCallCount = 0
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      fetchCallCount++
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(new Response(
            '<html><head><title>Click</title></head><body><main><p>Click</p></main></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          ))
        }, 50)
      })
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/double')
    clickAnchor(link)
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 100) })

    // Only one navigation should have been initiated
    // (first click navigates, second click is ignored as duplicate)
    expect(fetchCallCount).toBe(1)
  })

  it('click on different URL starts new navigation (previous aborted)', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      return Promise.resolve(new Response(
        `<html><head><title>${urlStr}</title></head><body><main><p>${urlStr}</p></main></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      ))
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const linkA = createAnchor('/page-a')
    const linkB = createAnchor('/page-b')
    clickAnchor(linkA)
    clickAnchor(linkB)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    // linkA should have loading cleared (navigation was superseded)
    expect(linkA.hasAttribute('aria-busy')).toBe(false)
    expect(linkA.hasAttribute('data-val-loading')).toBe(false)
  })

  it('loading timeout clears attributes after 8s', async () => {
    vi.useFakeTimers()

    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      // Never resolves — simulates a hung request
      return new Promise(() => {})
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/timeout')
    clickAnchor(link)

    expect(link.getAttribute('aria-busy')).toBe('true')

    // Advance past the 8s safety timeout
    await vi.advanceTimersByTimeAsync(8000)

    expect(link.hasAttribute('aria-busy')).toBe(false)
    expect(link.hasAttribute('data-val-loading')).toBe(false)

    vi.useRealTimers()
  })

  it('destroy() clears loading state', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      return new Promise(() => {}) // never resolves
    })

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/destroy-loading')
    clickAnchor(link)

    expect(link.getAttribute('aria-busy')).toBe('true')

    handle!.destroy()
    handle = null

    expect(link.hasAttribute('aria-busy')).toBe(false)
    expect(link.hasAttribute('data-val-loading')).toBe(false)
  })
})

describe('auth redirect handling', () => {
  let handle: RouterHandle | null = null

  beforeEach(() => {
    handle = null
    window.history.replaceState({ url: '/' }, '', '/')
    document.title = 'Initial'
  })

  afterEach(() => {
    if (handle !== null) {
      handle.destroy()
    }
    document.body.innerHTML = ''
  })

  it('401 with X-Valence-Redirect triggers full page navigation', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(new Response('{"error":"Unauthorized"}', {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Valence-Redirect': '/login?returnTo=/admin'
        }
      }))
    )

    const result = initRouter({ enableFragmentProtocol: true }, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const navResult = await handle!.navigate('/admin')

    expect(navResult.isErr()).toBe(true)
    if (navResult.isErr()) {
      expect(navResult.error.code).toBe('AUTH_REDIRECT')
      expect(navResult.error.message).toContain('/login?returnTo=/admin')
    }
  })

  it('401 without X-Valence-Redirect follows normal error path', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(new Response('{"error":"Unauthorized"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }))
    )

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const navResult = await handle!.navigate('/admin')
    expect(navResult.isErr()).toBe(true)
    if (navResult.isErr()) {
      expect(navResult.error.code).toBe('FETCH_FAILED')
    }
  })

  it('403 follows normal error path', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(new Response('{"error":"Forbidden"}', {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }))
    )

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const navResult = await handle!.navigate('/admin')
    expect(navResult.isErr()).toBe(true)
    if (navResult.isErr()) {
      expect(navResult.error.code).toBe('FETCH_FAILED')
    }
  })
})
