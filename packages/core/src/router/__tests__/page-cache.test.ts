import { describe, it, expect, beforeEach } from 'vitest'
import { initPageCache } from '../page-cache.js'
import type { PageCacheHandle } from '../page-cache.js'
import { resolveConfig, RouterErrorCode } from '../router-types.js'

describe('initPageCache', () => {
  let handle: PageCacheHandle

  beforeEach(() => {
    sessionStorage.clear()
    handle = initPageCache(resolveConfig())
  })

  it('returns a handle with expected methods', () => {
    expect(typeof handle.get).toBe('function')
    expect(typeof handle.set).toBe('function')
    expect(typeof handle.invalidateAll).toBe('function')
    expect(typeof handle.invalidateUrl).toBe('function')
    expect(typeof handle.size).toBe('function')
    expect(typeof handle.getVersion).toBe('function')
    expect(typeof handle.setVersion).toBe('function')
  })

  it('starts with size 0', () => {
    expect(handle.size()).toBe(0)
  })

  it('get returns CACHE_MISS for unknown url', () => {
    const result = handle.get('/unknown')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.CACHE_MISS)
    }
  })

  it('set then get returns the cached entry', () => {
    handle.set('/about', {
      url: '/about',
      html: '<p>About</p>',
      timestamp: Date.now(),
      version: null,
      title: 'About'
    })
    expect(handle.size()).toBe(1)
    const result = handle.get('/about')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.html).toBe('<p>About</p>')
      expect(result.value.title).toBe('About')
    }
  })

  it('returns CACHE_STALE for expired entries', () => {
    const config = resolveConfig({ pageCacheTtlMs: 100 })
    const h = initPageCache(config)
    h.set('/old', {
      url: '/old',
      html: '<p>Old</p>',
      timestamp: Date.now() - 200,
      version: null,
      title: null
    })
    const result = h.get('/old')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.CACHE_STALE)
    }
  })

  it('expired entry is removed from cache', () => {
    const config = resolveConfig({ pageCacheTtlMs: 100 })
    const h = initPageCache(config)
    h.set('/old', {
      url: '/old',
      html: '<p>Old</p>',
      timestamp: Date.now() - 200,
      version: null,
      title: null
    })
    h.get('/old')
    expect(h.size()).toBe(0)
  })

  it('evicts oldest entry when capacity exceeded', () => {
    const config = resolveConfig({ pageCacheCapacity: 2 })
    const h = initPageCache(config)
    const now = Date.now()

    h.set('/a', { url: '/a', html: 'a', timestamp: now - 20, version: null, title: null })
    h.set('/b', { url: '/b', html: 'b', timestamp: now - 10, version: null, title: null })
    h.set('/c', { url: '/c', html: 'c', timestamp: now, version: null, title: null })

    expect(h.size()).toBe(2)
    // /a should have been evicted (oldest timestamp)
    expect(h.get('/a').isErr()).toBe(true)
    expect(h.get('/b').isOk()).toBe(true)
    expect(h.get('/c').isOk()).toBe(true)
  })

  it('invalidateAll clears all entries', () => {
    handle.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: null, title: null })
    handle.set('/b', { url: '/b', html: 'b', timestamp: Date.now(), version: null, title: null })
    expect(handle.size()).toBe(2)
    handle.invalidateAll()
    expect(handle.size()).toBe(0)
  })

  it('invalidateUrl removes a single entry', () => {
    handle.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: null, title: null })
    handle.set('/b', { url: '/b', html: 'b', timestamp: Date.now(), version: null, title: null })
    handle.invalidateUrl('/a')
    expect(handle.size()).toBe(1)
    expect(handle.get('/a').isErr()).toBe(true)
    expect(handle.get('/b').isOk()).toBe(true)
  })

  it('invalidateUrl is a no-op for unknown url', () => {
    handle.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: null, title: null })
    handle.invalidateUrl('/unknown')
    expect(handle.size()).toBe(1)
  })

  it('getVersion returns null initially', () => {
    expect(handle.getVersion()).toBeNull()
  })

  it('setVersion stores the version', () => {
    handle.setVersion('abc')
    expect(handle.getVersion()).toBe('abc')
  })

  it('setVersion with same value does NOT invalidate cache', () => {
    handle.setVersion('v1')
    handle.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: 'v1', title: null })
    handle.setVersion('v1')
    expect(handle.size()).toBe(1)
  })

  it('setVersion with different value invalidates all entries', () => {
    handle.setVersion('v1')
    handle.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: 'v1', title: null })
    handle.set('/b', { url: '/b', html: 'b', timestamp: Date.now(), version: 'v1', title: null })
    expect(handle.size()).toBe(2)
    handle.setVersion('v2')
    expect(handle.size()).toBe(0)
    expect(handle.getVersion()).toBe('v2')
  })

  it('updating an existing url overwrites the entry', () => {
    handle.set('/a', { url: '/a', html: 'old', timestamp: Date.now(), version: null, title: null })
    handle.set('/a', { url: '/a', html: 'new', timestamp: Date.now(), version: null, title: null })
    expect(handle.size()).toBe(1)
    const result = handle.get('/a')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.html).toBe('new')
    }
  })
})

describe('page-cache sessionStorage persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('persists entries to sessionStorage on set', () => {
    const h = initPageCache(resolveConfig())
    h.set('/a', { url: '/a', html: 'a', timestamp: 1000, version: null, title: 'A' })
    const stored = sessionStorage.getItem('valence:page-cache')
    expect(stored).not.toBeNull()
    const data = JSON.parse(stored!)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0][0]).toBe('/a')
    expect(data.entries[0][1].html).toBe('a')
  })

  it('restores entries from sessionStorage on init', () => {
    const seed = {
      version: 'v1',
      entries: [['/x', { url: '/x', html: '<p>X</p>', timestamp: Date.now(), version: 'v1', title: 'X' }]]
    }
    sessionStorage.setItem('valence:page-cache', JSON.stringify(seed))
    const h = initPageCache(resolveConfig())
    expect(h.size()).toBe(1)
    expect(h.getVersion()).toBe('v1')
    const result = h.get('/x')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.html).toBe('<p>X</p>')
    }
  })

  it('clears sessionStorage on invalidateAll', () => {
    const h = initPageCache(resolveConfig())
    h.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: null, title: null })
    expect(sessionStorage.getItem('valence:page-cache')).not.toBeNull()
    h.invalidateAll()
    const data = JSON.parse(sessionStorage.getItem('valence:page-cache')!)
    expect(data.entries).toHaveLength(0)
  })

  it('removes entry from sessionStorage on invalidateUrl', () => {
    const h = initPageCache(resolveConfig())
    h.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: null, title: null })
    h.set('/b', { url: '/b', html: 'b', timestamp: Date.now(), version: null, title: null })
    h.invalidateUrl('/a')
    const data = JSON.parse(sessionStorage.getItem('valence:page-cache')!)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0][0]).toBe('/b')
  })

  it('skips restore if sessionStorage is empty', () => {
    const h = initPageCache(resolveConfig())
    expect(h.size()).toBe(0)
    expect(h.getVersion()).toBeNull()
  })

  it('skips restore if sessionStorage has invalid JSON', () => {
    sessionStorage.setItem('valence:page-cache', '{{not valid json')
    const h = initPageCache(resolveConfig())
    expect(h.size()).toBe(0)
  })

  it('respects capacity limit when restoring', () => {
    const entries = Array.from({ length: 20 }, (_, i) => [
      `/${i}`, { url: `/${i}`, html: `${i}`, timestamp: Date.now(), version: null, title: null }
    ])
    sessionStorage.setItem('valence:page-cache', JSON.stringify({ version: null, entries }))
    const h = initPageCache(resolveConfig({ pageCacheCapacity: 5 }))
    expect(h.size()).toBe(5)
  })

  it('persist is no-op when persistPageCache is false', () => {
    const h = initPageCache(resolveConfig({ persistPageCache: false }))
    h.set('/a', { url: '/a', html: 'a', timestamp: Date.now(), version: null, title: null })
    expect(sessionStorage.getItem('valence:page-cache')).toBeNull()
  })

  it('setVersion persists to sessionStorage', () => {
    const h = initPageCache(resolveConfig())
    h.setVersion('v2')
    const data = JSON.parse(sessionStorage.getItem('valence:page-cache')!)
    expect(data.version).toBe('v2')
  })
})
