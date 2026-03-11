import { describe, it, expect } from 'vitest'
import {
  RouterErrorCode,
  resolveConfig
} from '../router-types.js'
import type {
  RouterError,
  RouterConfig,
  ResolvedRouterConfig,
  CachedResponse,
  NavigationDetail
} from '../router-types.js'

describe('RouterErrorCode', () => {
  it('contains all expected error codes', () => {
    expect(RouterErrorCode.FETCH_FAILED).toBe('FETCH_FAILED')
    expect(RouterErrorCode.PARSE_FAILED).toBe('PARSE_FAILED')
    expect(RouterErrorCode.SELECTOR_MISS).toBe('SELECTOR_MISS')
    expect(RouterErrorCode.INVALID_URL).toBe('INVALID_URL')
    expect(RouterErrorCode.CACHE_MISS).toBe('CACHE_MISS')
    expect(RouterErrorCode.PREFETCH_FAILED).toBe('PREFETCH_FAILED')
    expect(RouterErrorCode.NOT_HTML_RESPONSE).toBe('NOT_HTML_RESPONSE')
  })

  it('all values are strings', () => {
    for (const value of Object.values(RouterErrorCode)) {
      expect(typeof value).toBe('string')
    }
  })

  it('all values are unique', () => {
    const values = Object.values(RouterErrorCode)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

describe('resolveConfig', () => {
  it('returns all defaults when called with no args', () => {
    const config = resolveConfig()
    expect(config.contentSelector).toBe('main')
    expect(config.prefetchCacheCapacity).toBe(32)
    expect(config.prefetchTtlMs).toBe(30_000)
    expect(config.velocityThreshold).toBe(0.3)
    expect(config.intentDurationMs).toBe(80)
  })

  it('returns all defaults when called with empty object', () => {
    const config = resolveConfig({})
    expect(config.contentSelector).toBe('main')
    expect(config.prefetchCacheCapacity).toBe(32)
    expect(config.prefetchTtlMs).toBe(30_000)
    expect(config.velocityThreshold).toBe(0.3)
    expect(config.intentDurationMs).toBe(80)
  })

  it('merges partial overrides correctly', () => {
    const config = resolveConfig({ contentSelector: '#app', prefetchTtlMs: 60_000 })
    expect(config.contentSelector).toBe('#app')
    expect(config.prefetchTtlMs).toBe(60_000)
    expect(config.prefetchCacheCapacity).toBe(32)
    expect(config.velocityThreshold).toBe(0.3)
    expect(config.intentDurationMs).toBe(80)
  })

  it('overrides all fields when fully specified', () => {
    const partial: RouterConfig = {
      contentSelector: '.content',
      prefetchCacheCapacity: 64,
      prefetchTtlMs: 10_000,
      velocityThreshold: 0.5,
      intentDurationMs: 120
    }
    const config = resolveConfig(partial)
    expect(config.contentSelector).toBe('.content')
    expect(config.prefetchCacheCapacity).toBe(64)
    expect(config.prefetchTtlMs).toBe(10_000)
    expect(config.velocityThreshold).toBe(0.5)
    expect(config.intentDurationMs).toBe(120)
  })

  it('default contentSelector is main', () => {
    const config = resolveConfig()
    expect(config.contentSelector).toBe('main')
  })

  it('default prefetchCacheCapacity is 32', () => {
    const config = resolveConfig()
    expect(config.prefetchCacheCapacity).toBe(32)
  })

  it('returned config satisfies ResolvedRouterConfig type', () => {
    const config: ResolvedRouterConfig = resolveConfig()
    expect(config).toBeDefined()
  })

  it('RouterError satisfies interface shape', () => {
    const error: RouterError = {
      code: RouterErrorCode.FETCH_FAILED,
      message: 'network error'
    }
    expect(error.code).toBe('FETCH_FAILED')
    expect(error.message).toBe('network error')
  })

  it('CachedResponse satisfies interface shape', () => {
    const cached: CachedResponse = {
      url: '/about',
      html: '<main>About</main>',
      timestamp: Date.now()
    }
    expect(cached.url).toBe('/about')
  })

  it('NavigationDetail satisfies interface shape', () => {
    const detail: NavigationDetail = {
      fromUrl: '/home',
      toUrl: '/about'
    }
    expect(detail.fromUrl).toBe('/home')
    expect(detail.toUrl).toBe('/about')
  })
})
