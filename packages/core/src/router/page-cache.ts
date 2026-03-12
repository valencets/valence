import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { RouterErrorCode } from './router-types.js'
import type { RouterError, ResolvedRouterConfig, PageCacheEntry } from './router-types.js'

export interface PageCacheHandle {
  readonly get: (url: string) => Result<PageCacheEntry, RouterError>
  readonly set: (url: string, entry: PageCacheEntry) => void
  readonly invalidateAll: () => void
  readonly invalidateUrl: (url: string) => void
  readonly size: () => number
  readonly getVersion: () => string | null
  readonly setVersion: (version: string) => void
}

export function initPageCache (config: ResolvedRouterConfig): PageCacheHandle {
  const cache = new Map<string, PageCacheEntry>()
  let currentVersion: string | null = null

  function evictOldest (): void {
    if (cache.size < config.pageCacheCapacity) return

    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey !== null) {
      cache.delete(oldestKey)
    }
  }

  function get (url: string): Result<PageCacheEntry, RouterError> {
    const entry = cache.get(url)
    if (entry === undefined) {
      return err({
        code: RouterErrorCode.CACHE_MISS,
        message: `No page cache entry for ${url}`
      })
    }

    const age = Date.now() - entry.timestamp
    if (age > config.pageCacheTtlMs) {
      cache.delete(url)
      return err({
        code: RouterErrorCode.CACHE_STALE,
        message: `Page cache entry expired for ${url}`
      })
    }

    return ok(entry)
  }

  function set (url: string, entry: PageCacheEntry): void {
    if (cache.has(url)) {
      cache.delete(url)
    } else {
      evictOldest()
    }
    cache.set(url, entry)
  }

  function invalidateAll (): void {
    cache.clear()
  }

  function invalidateUrl (url: string): void {
    cache.delete(url)
  }

  function size (): number {
    return cache.size
  }

  function getVersion (): string | null {
    return currentVersion
  }

  function setVersion (version: string): void {
    if (currentVersion !== null && currentVersion !== version) {
      invalidateAll()
    }
    currentVersion = version
  }

  return {
    get,
    set,
    invalidateAll,
    invalidateUrl,
    size,
    getVersion,
    setVersion
  }
}
