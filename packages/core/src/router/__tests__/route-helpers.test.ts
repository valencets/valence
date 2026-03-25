import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { routeUrl, navigateTo } from '../route-helpers.js'
import type { NavigateOptions } from '../route-helpers.js'

describe('routeUrl', () => {
  it('returns path unchanged when no params', () => {
    expect(routeUrl('/about', {})).toBe('/about')
  })

  it('replaces a single :param segment', () => {
    expect(routeUrl('/posts/:id', { id: '42' })).toBe('/posts/42')
  })

  it('replaces multiple :param segments', () => {
    expect(routeUrl('/users/:userId/posts/:postId', { userId: '1', postId: '99' })).toBe('/users/1/posts/99')
  })

  it('leaves unmatched :param segments intact', () => {
    expect(routeUrl('/posts/:id', {})).toBe('/posts/:id')
  })

  it('only replaces provided params, leaves others intact', () => {
    expect(routeUrl('/users/:userId/posts/:postId', { userId: '7' })).toBe('/users/7/posts/:postId')
  })

  it('handles param at start of path', () => {
    expect(routeUrl('/:section/overview', { section: 'settings' })).toBe('/settings/overview')
  })

  it('handles path with trailing slash', () => {
    expect(routeUrl('/posts/:id/', { id: '5' })).toBe('/posts/5/')
  })

  it('does not replace partial word matches', () => {
    // :id should not be replaced inside :identifier
    expect(routeUrl('/posts/:identifier', { id: 'X' })).toBe('/posts/:identifier')
  })

  it('preserves query string segments that look like params', () => {
    expect(routeUrl('/posts/:id?filter=:foo', { id: '3' })).toBe('/posts/3?filter=:foo')
  })

  it('URL-encodes param values before interpolation', () => {
    expect(routeUrl('/posts/:id', { id: 'a/b?x=1#y' })).toBe('/posts/a%2Fb%3Fx%3D1%23y')
  })
})

describe('navigateTo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    const main = document.createElement('main')
    document.body.appendChild(main)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('builds URL from path and params then dispatches valence:before-navigate', () => {
    const events: CustomEvent[] = []
    const listener = (e: Event) => events.push(e as CustomEvent)
    document.addEventListener('valence:before-navigate', listener)

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body><main>content</main></body></html>', { status: 200 })
    )

    navigateTo('/posts/:id', { id: '7' }, undefined, mockFetch)

    document.removeEventListener('valence:before-navigate', listener)

    expect(events).toHaveLength(1)
    const detail = events[0]?.detail as { toUrl: string }
    expect(detail.toUrl).toBe('/posts/7')
  })

  it('navigates to plain path with no params', () => {
    const events: CustomEvent[] = []
    const listener = (e: Event) => events.push(e as CustomEvent)
    document.addEventListener('valence:before-navigate', listener)

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body><main>content</main></body></html>', { status: 200 })
    )

    navigateTo('/about', {}, undefined, mockFetch)

    document.removeEventListener('valence:before-navigate', listener)

    expect(events).toHaveLength(1)
    const detail = events[0]?.detail as { toUrl: string }
    expect(detail.toUrl).toBe('/about')
  })

  it('accepts replace NavigateOptions without error', () => {
    const opts: NavigateOptions = { replace: true }
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body><main>ok</main></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html', 'X-Valence-Fragment': '1' }
      })
    )
    // Should not throw
    navigateTo('/about', {}, opts, mockFetch)
  })

  it('dispatches encoded navigation urls', () => {
    const events: CustomEvent[] = []
    const listener = (e: Event) => events.push(e as CustomEvent)
    document.addEventListener('valence:before-navigate', listener)

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body><main>ok</main></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html', 'X-Valence-Fragment': '1' }
      })
    )

    navigateTo('/posts/:id', { id: 'a/b?x=1#y' }, undefined, mockFetch)

    document.removeEventListener('valence:before-navigate', listener)
    expect(events).toHaveLength(1)
    const detail = events[0]?.detail as { toUrl: string }
    expect(detail.toUrl).toBe('/posts/a%2Fb%3Fx%3D1%23y')
  })

  it('completes a content swap before tearing down navigation', async () => {
    const main = document.querySelector('main') as HTMLElement
    main.innerHTML = '<p>old</p>'

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body><main><p>new</p></main></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html', 'X-Valence-Fragment': '1' }
      })
    )

    navigateTo('/posts/:id', { id: '7' }, undefined, mockFetch)

    await vi.waitFor(() => {
      expect(main.querySelector('p')?.textContent).toBe('new')
    })
  })

  it('replace option rewrites history after successful navigation', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')
    const main = document.querySelector('main') as HTMLElement
    main.innerHTML = '<p>old</p>'

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body><main><p>new</p></main></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html', 'X-Valence-Fragment': '1' }
      })
    )

    navigateTo('/posts/:id', { id: '9' }, { replace: true }, mockFetch)

    await vi.waitFor(() => {
      expect(main.querySelector('p')?.textContent).toBe('new')
    })

    await vi.waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({ url: '/posts/9' }, '', '/posts/9')
    })
  })

  it('ignores malformed valence:navigated detail when replace handling is active', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}))

    navigateTo('/posts/:id', { id: '12' }, { replace: true }, mockFetch)
    replaceStateSpy.mockClear()

    document.dispatchEvent(new CustomEvent('valence:navigated', {
      detail: { toUrl: 12 }
    }))

    expect(replaceStateSpy).not.toHaveBeenCalled()
  })

  it('cleans up replace listener when navigation never settles', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}))
    replaceStateSpy.mockClear()

    navigateTo('/posts/:id', { id: '11' }, { replace: true }, mockFetch)

    await vi.advanceTimersByTimeAsync(8000)

    document.dispatchEvent(new CustomEvent('valence:navigated', {
      detail: { toUrl: '/posts/11' }
    }))

    expect(replaceStateSpy.mock.calls.some((call) => call[2] === '/posts/11')).toBe(false)
  })

  it('does not use detail casts in navigateTo', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(`${process.cwd()}/src/router/route-helpers.ts`, 'utf-8')

    expect(source).not.toContain('(e as CustomEvent).detail as { toUrl: string } | undefined')
  })
})
