import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateVelocity,
  initPrefetch
} from '../prefetch.js'
import type { PrefetchHandle } from '../prefetch.js'
import { RouterErrorCode, resolveConfig } from '../router-types.js'
import type { ResolvedRouterConfig } from '../router-types.js'

function createMockFetch (html: string, contentType = 'text/html'): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(new Response(html, {
      status: 200,
      headers: { 'Content-Type': contentType }
    }))
  )
}

function createFailingFetch (): typeof fetch {
  return vi.fn<typeof fetch>().mockRejectedValue(new Error('Network error'))
}

describe('calculateVelocity', () => {
  it('returns correct velocity for known values', () => {
    // distance = sqrt((30-0)^2 + (40-0)^2) = 50, time = 100
    const v = calculateVelocity(0, 0, 0, 30, 40, 100)
    expect(v).toBeCloseTo(0.5, 5)
  })

  it('returns 0 for identical positions', () => {
    const v = calculateVelocity(10, 20, 0, 10, 20, 100)
    expect(v).toBe(0)
  })

  it('returns 0 when time delta is 0', () => {
    const v = calculateVelocity(0, 0, 100, 30, 40, 100)
    expect(v).toBe(0)
  })

  it('returns higher velocity for faster movement', () => {
    const slow = calculateVelocity(0, 0, 0, 10, 0, 100)
    const fast = calculateVelocity(0, 0, 0, 10, 0, 10)
    expect(fast).toBeGreaterThan(slow)
  })
})

describe('initPrefetch', () => {
  let config: ResolvedRouterConfig
  let handle: PrefetchHandle | null

  beforeEach(() => {
    config = resolveConfig()
    handle = null
  })

  afterEach(() => {
    if (handle !== null) {
      handle.destroy()
    }
  })

  it('returns Ok with handle', () => {
    const result = initPrefetch(config)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      handle = result.value
      expect(typeof handle.destroy).toBe('function')
      expect(typeof handle.prefetchUrl).toBe('function')
      expect(typeof handle.getCached).toBe('function')
      expect(typeof handle.clearCache).toBe('function')
      expect(typeof handle.cacheSize).toBe('function')
    }
  })

  it('attaches mousemove listener on init', () => {
    const spy = vi.spyOn(document.body, 'addEventListener')
    const result = initPrefetch(config)
    if (result.isOk()) handle = result.value

    expect(spy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    spy.mockRestore()
  })

  it('destroy removes listener', () => {
    const spy = vi.spyOn(document.body, 'removeEventListener')
    const result = initPrefetch(config)
    if (result.isOk()) {
      handle = result.value
      handle.destroy()
      handle = null
    }

    expect(spy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    spy.mockRestore()
  })
})

describe('prefetchUrl', () => {
  let config: ResolvedRouterConfig
  let handle: PrefetchHandle | null

  beforeEach(() => {
    config = resolveConfig()
    handle = null
  })

  afterEach(() => {
    if (handle !== null) {
      handle.destroy()
    }
  })

  it('fetches URL and caches result', async () => {
    const mockFetch = createMockFetch('<main>Page</main>')
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    const prefetchResult = await handle!.prefetchUrl('/about')
    expect(prefetchResult.isOk()).toBe(true)
    expect(handle!.cacheSize()).toBe(1)

    const cached = handle!.getCached('/about')
    expect(cached.isOk()).toBe(true)
    if (cached.isOk()) {
      expect(cached.value.html).toBe('<main>Page</main>')
      expect(cached.value.url).toBe('/about')
    }
  })

  it('sends X-Valence-Fragment header when fragment protocol enabled', async () => {
    const fragmentConfig = resolveConfig({ enableFragmentProtocol: true })
    const mockFetch = createMockFetch('<p>Fragment</p>')
    const result = initPrefetch(fragmentConfig, mockFetch)
    if (result.isOk()) handle = result.value

    await handle!.prefetchUrl('/frag')
    expect(mockFetch).toHaveBeenCalledWith('/frag', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Valence-Fragment': '1' })
    }))
  })

  it('does not send fragment header when protocol disabled', async () => {
    const noFragConfig = resolveConfig({ enableFragmentProtocol: false })
    const mockFetch = createMockFetch('<main>Full</main>')
    const result = initPrefetch(noFragConfig, mockFetch)
    if (result.isOk()) handle = result.value

    await handle!.prefetchUrl('/full')
    expect(mockFetch).toHaveBeenCalledWith('/full')
  })

  it('returns Err on network failure', async () => {
    const mockFetch = createFailingFetch()
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    const prefetchResult = await handle!.prefetchUrl('/fail')
    expect(prefetchResult.isErr()).toBe(true)
    if (prefetchResult.isErr()) {
      expect(prefetchResult.error.code).toBe(RouterErrorCode.PREFETCH_FAILED)
    }
  })

  it('returns Err on non-HTML response', async () => {
    const mockFetch = createMockFetch('{"data": 1}', 'application/json')
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    const prefetchResult = await handle!.prefetchUrl('/api')
    expect(prefetchResult.isErr()).toBe(true)
    if (prefetchResult.isErr()) {
      expect(prefetchResult.error.code).toBe(RouterErrorCode.NOT_HTML_RESPONSE)
    }
  })

  it('returns Err on non-ok status', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/html' } }))
    )
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    const prefetchResult = await handle!.prefetchUrl('/missing')
    expect(prefetchResult.isErr()).toBe(true)
    if (prefetchResult.isErr()) {
      expect(prefetchResult.error.code).toBe(RouterErrorCode.FETCH_FAILED)
    }
  })
})

describe('cache behavior', () => {
  let handle: PrefetchHandle | null

  afterEach(() => {
    if (handle !== null) {
      handle.destroy()
    }
  })

  it('getCached returns Err(CACHE_MISS) for unknown URL', () => {
    const config = resolveConfig()
    const result = initPrefetch(config)
    if (result.isOk()) handle = result.value

    const cached = handle!.getCached('/unknown')
    expect(cached.isErr()).toBe(true)
    if (cached.isErr()) {
      expect(cached.error.code).toBe(RouterErrorCode.CACHE_MISS)
    }
  })

  it('getCached evicts expired entries', async () => {
    const config = resolveConfig({ prefetchTtlMs: 50 })
    const mockFetch = createMockFetch('<main>Temp</main>')
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    await handle!.prefetchUrl('/temp')
    expect(handle!.getCached('/temp').isOk()).toBe(true)

    // Wait for TTL to expire
    await new Promise(resolve => { setTimeout(resolve, 60) })

    const cached = handle!.getCached('/temp')
    expect(cached.isErr()).toBe(true)
    if (cached.isErr()) {
      expect(cached.error.code).toBe(RouterErrorCode.CACHE_MISS)
    }
  })

  it('evicts oldest entry when at capacity', async () => {
    const config = resolveConfig({ prefetchCacheCapacity: 2 })
    const mockFetch = createMockFetch('<main>Page</main>')
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    await handle!.prefetchUrl('/a')
    await handle!.prefetchUrl('/b')
    await handle!.prefetchUrl('/c')

    expect(handle!.cacheSize()).toBe(2)
    expect(handle!.getCached('/a').isErr()).toBe(true)
    expect(handle!.getCached('/b').isOk()).toBe(true)
    expect(handle!.getCached('/c').isOk()).toBe(true)
  })

  it('clearCache empties cache', async () => {
    const config = resolveConfig()
    const mockFetch = createMockFetch('<main>Page</main>')
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    await handle!.prefetchUrl('/x')
    expect(handle!.cacheSize()).toBe(1)

    handle!.clearCache()
    expect(handle!.cacheSize()).toBe(0)
  })

  it('cacheSize returns correct count', async () => {
    const config = resolveConfig()
    const mockFetch = createMockFetch('<main>Page</main>')
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    expect(handle!.cacheSize()).toBe(0)
    await handle!.prefetchUrl('/one')
    expect(handle!.cacheSize()).toBe(1)
    await handle!.prefetchUrl('/two')
    expect(handle!.cacheSize()).toBe(2)
  })

  it('duplicate prefetch does not increase cache size', async () => {
    const config = resolveConfig()
    const mockFetch = createMockFetch('<main>Page</main>')
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    await handle!.prefetchUrl('/same')
    await handle!.prefetchUrl('/same')
    expect(handle!.cacheSize()).toBe(1)
  })
})

describe('hover intent', () => {
  let handle: PrefetchHandle | null

  afterEach(() => {
    if (handle !== null) {
      handle.destroy()
    }
    document.body.innerHTML = ''
  })

  it('slow hover over link triggers prefetch', async () => {
    const mockFetch = createMockFetch('<main>Prefetched</main>')
    const config = resolveConfig({ velocityThreshold: 0.3, intentDurationMs: 20 })
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    const link = document.createElement('a')
    link.href = '/target'
    document.body.appendChild(link)

    // Simulate slow mouse movement over the link
    link.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 100
    }))

    // Small movement after intentDurationMs -- below velocity threshold
    await new Promise(resolve => { setTimeout(resolve, 30) })
    link.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 101,
      clientY: 101
    }))

    // Wait for fetch to complete
    await new Promise(resolve => { setTimeout(resolve, 50) })
    expect(mockFetch).toHaveBeenCalledWith('/target', expect.anything())
  })

  it('fast mouse movement does not trigger prefetch', async () => {
    const mockFetch = createMockFetch('<main>Page</main>')
    const config = resolveConfig({ velocityThreshold: 0.3, intentDurationMs: 20 })
    const result = initPrefetch(config, mockFetch)
    if (result.isOk()) handle = result.value

    const link = document.createElement('a')
    link.href = '/fast-target'
    document.body.appendChild(link)

    // Simulate fast mouse movement
    link.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 100
    }))

    // Large movement in very short time -- above velocity threshold
    link.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500
    }))

    await new Promise(resolve => { setTimeout(resolve, 50) })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('only N concurrent prefetch requests fire (budget)', async () => {
    const config = resolveConfig({ maxConcurrentPrefetches: 2 })
    const resolvers: Array<(value: Response) => void> = []
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const result = initPrefetch(config, mockFetch)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    handle = result.value

    // Fire 3 prefetch requests — only 2 should start
    handle.prefetchUrl('/page-1')
    handle.prefetchUrl('/page-2')
    handle.prefetchUrl('/page-3')

    await new Promise(resolve => { setTimeout(resolve, 10) })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('queued prefetch starts when slot opens', async () => {
    const config = resolveConfig({ maxConcurrentPrefetches: 1 })
    const resolvers: Array<(value: Response) => void> = []
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const result = initPrefetch(config, mockFetch)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    handle = result.value

    // Fire 2 requests — first starts, second queued
    handle.prefetchUrl('/page-1')
    handle.prefetchUrl('/page-2')

    await new Promise(resolve => { setTimeout(resolve, 10) })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Complete the first — should start the second
    resolvers[0]!(new Response('<main>Page 1</main>', { status: 200, headers: { 'Content-Type': 'text/html' } }))
    await new Promise(resolve => { setTimeout(resolve, 10) })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('queued items fire in order', async () => {
    const config = resolveConfig({ maxConcurrentPrefetches: 1 })
    const fetchedUrls: string[] = []
    const resolvers: Array<(value: Response) => void> = []
    const mockFetch = vi.fn<typeof fetch>().mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      fetchedUrls.push(urlStr)
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const result = initPrefetch(config, mockFetch)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    handle = result.value

    handle.prefetchUrl('/page-a')
    handle.prefetchUrl('/page-b')
    handle.prefetchUrl('/page-c')

    await new Promise(resolve => { setTimeout(resolve, 10) })
    expect(fetchedUrls).toEqual(['/page-a'])

    // Complete first
    resolvers[0]!(new Response('<main>A</main>', { status: 200, headers: { 'Content-Type': 'text/html' } }))
    await new Promise(resolve => { setTimeout(resolve, 10) })
    expect(fetchedUrls).toEqual(['/page-a', '/page-b'])

    // Complete second
    resolvers[1]!(new Response('<main>B</main>', { status: 200, headers: { 'Content-Type': 'text/html' } }))
    await new Promise(resolve => { setTimeout(resolve, 10) })
    expect(fetchedUrls).toEqual(['/page-a', '/page-b', '/page-c'])
  })

  it('failed prefetch frees slot for queued items', async () => {
    const config = resolveConfig({ maxConcurrentPrefetches: 1 })
    const rejecters: Array<(reason: Error) => void> = []
    const resolvers: Array<(value: Response) => void> = []
    let callCount = 0
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<Response>((_resolve, reject) => {
          rejecters.push(reject)
        })
      }
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const result = initPrefetch(config, mockFetch)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    handle = result.value

    handle.prefetchUrl('/fail')
    handle.prefetchUrl('/succeed')

    await new Promise(resolve => { setTimeout(resolve, 10) })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Fail the first — should free slot and start second
    rejecters[0]!(new Error('Network error'))
    await new Promise(resolve => { setTimeout(resolve, 10) })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('clearCache clears pending queue', async () => {
    const config = resolveConfig({ maxConcurrentPrefetches: 1 })
    const resolvers: Array<(value: Response) => void> = []
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const result = initPrefetch(config, mockFetch)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    handle = result.value

    handle.prefetchUrl('/page-1')
    handle.prefetchUrl('/page-2')
    handle.prefetchUrl('/page-3')

    await new Promise(resolve => { setTimeout(resolve, 10) })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Clear cache should also clear the pending queue
    handle.clearCache()

    // Complete the in-flight request
    resolvers[0]!(new Response('<main>Done</main>', { status: 200, headers: { 'Content-Type': 'text/html' } }))
    await new Promise(resolve => { setTimeout(resolve, 10) })

    // The queued items should NOT have started
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('destroy clears pending queue', async () => {
    const config = resolveConfig({ maxConcurrentPrefetches: 1 })
    const resolvers: Array<(value: Response) => void> = []
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => {
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const result = initPrefetch(config, mockFetch)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    handle = result.value

    handle.prefetchUrl('/page-1')
    handle.prefetchUrl('/page-2')

    await new Promise(resolve => { setTimeout(resolve, 10) })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    handle.destroy()
    handle = null

    // Complete the in-flight — queued should NOT start since destroyed
    resolvers[0]!(new Response('<main>Done</main>', { status: 200, headers: { 'Content-Type': 'text/html' } }))
    await new Promise(resolve => { setTimeout(resolve, 10) })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
