import { ok, err, fromThrowable } from 'neverthrow'
import type { Result } from 'neverthrow'
import { RouterErrorCode } from './router-types.js'
import type { RouterError, ResolvedRouterConfig, PageCacheEntry } from './router-types.js'

const STORAGE_KEY = 'inertia:page-cache'

interface CacheStorageData {
  readonly version: string | null
  readonly entries: ReadonlyArray<readonly [string, PageCacheEntry]>
}

// System boundary: sessionStorage is external input
const parseJson = fromThrowable(
  (raw: string): CacheStorageData => JSON.parse(raw) as CacheStorageData,
  (): RouterError => ({ code: RouterErrorCode.PARSE_FAILED, message: 'Invalid cache storage' })
)

function hasSessionStorage (): boolean {
  return typeof sessionStorage !== 'undefined'
}

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

  function persist (): void {
    if (!config.persistPageCache || !hasSessionStorage()) return
    const data: CacheStorageData = {
      version: currentVersion,
      entries: Array.from(cache.entries())
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function restore (): void {
    if (!config.persistPageCache || !hasSessionStorage()) return
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) return

    const result = parseJson(raw)
    if (result.isErr()) return
    const data = result.value

    if (!Array.isArray(data.entries)) return
    currentVersion = data.version ?? null
    for (const [key, entry] of data.entries) {
      if (cache.size >= config.pageCacheCapacity) break
      cache.set(key, entry)
    }
  }

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
    persist()
  }

  function invalidateAll (): void {
    cache.clear()
    persist()
  }

  function invalidateUrl (url: string): void {
    cache.delete(url)
    persist()
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
    persist()
  }

  // Restore from sessionStorage on init
  restore()

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
