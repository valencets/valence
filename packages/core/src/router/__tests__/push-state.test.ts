import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  shouldIntercept,
  initRouter
} from '../push-state.js'
import type { RouterHandle } from '../push-state.js'

function createMockFetch (html: string): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
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

  it('returns false for data-inertia-ignore', () => {
    const a = createAnchor('/about', { 'data-inertia-ignore': '' })
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

  it('dispatches inertia:before-navigate before navigation', async () => {
    const mockFetch = createMockFetch('<html><head><title>Nav</title></head><body><main><p>Nav</p></main></body></html>')
    const beforeNavHandler = vi.fn()

    document.addEventListener('inertia:before-navigate', beforeNavHandler)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/nav')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(beforeNavHandler).toHaveBeenCalledTimes(1)
    document.removeEventListener('inertia:before-navigate', beforeNavHandler)
  })

  it('inertia:before-navigate is cancelable and aborts navigation', async () => {
    const mockFetch = createMockFetch('<html><head><title>Blocked</title></head><body><main><p>Blocked</p></main></body></html>')

    document.addEventListener('inertia:before-navigate', (e) => {
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

  it('dispatches inertia:navigated after success', async () => {
    const mockFetch = createMockFetch('<html><head><title>Done</title></head><body><main><p>Done</p></main></body></html>')
    const navigatedHandler = vi.fn()

    document.addEventListener('inertia:navigated', navigatedHandler)

    const result = initRouter({}, mockFetch)
    if (result.isOk()) handle = result.value

    const main = document.createElement('main')
    main.innerHTML = '<p>Home</p>'
    document.body.appendChild(main)

    const link = createAnchor('/done')
    clickAnchor(link)

    await new Promise(resolve => { setTimeout(resolve, 50) })

    expect(navigatedHandler).toHaveBeenCalledTimes(1)
    document.removeEventListener('inertia:navigated', navigatedHandler)
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

    expect(mockFetch).toHaveBeenCalledWith('/previous')
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

  it('dispatches inertia:before-swap before fragment swap', async () => {
    const mockFetch = createMockFetch('<html><head><title>Swap</title></head><body><main><p>Swapped</p></main></body></html>')
    const beforeSwapHandler = vi.fn()

    document.addEventListener('inertia:before-swap', beforeSwapHandler)

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
    document.removeEventListener('inertia:before-swap', beforeSwapHandler)
  })

  it('dispatches inertia:after-swap after fragment swap', async () => {
    const mockFetch = createMockFetch('<html><head><title>Swap</title></head><body><main><p>Swapped</p></main></body></html>')
    const afterSwapHandler = vi.fn()
    let contentAtSwap = ''

    document.addEventListener('inertia:after-swap', () => {
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

    document.addEventListener('inertia:before-swap', () => {
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
})
