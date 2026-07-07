import { ok, err, fromThrowable } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { RouterErrorCode } from './router-types.js'
import type { RouterError, ResolvedRouterConfig, PageCacheEntry } from './router-types.js'

const STORAGE_KEY = 'valence:page-cache'

interface CacheStorageData {
  readonly version: string | null
  readonly entries: ReadonlyArray<readonly [string, PageCacheEntry]>
}

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
interface JsonObject {
  readonly [key: string]: JsonValue | undefined
}
type JsonArray = ReadonlyArray<JsonValue>

// System boundary: sessionStorage is external input
const parseJson = fromThrowable(
  (raw: string): JsonValue => JSON.parse(raw) as JsonValue,
  (): RouterError => ({ code: RouterErrorCode.PARSE_FAILED, message: 'Invalid cache storage' })
)

function hasSessionStorage (): boolean {
  return typeof sessionStorage !== 'undefined'
}

function isJsonObject (value: JsonValue): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
}

function toPageCacheEntry (value: JsonValue): PageCacheEntry | null {
  if (!isJsonObject(value)) return null

  const { url, html, timestamp, version, title } = value
  if (typeof url !== 'string') return null
  if (typeof html !== 'string') return null
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null
  if (version !== null && typeof version !== 'string') return null
  if (title !== null && typeof title !== 'string') return null

  return {
    url,
    html,
    timestamp,
    version: version ?? null,
    title: title ?? null
  }
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
    if (!isJsonObject(data)) return

    const version = data.version
    const entries = data.entries
    if ((version !== null && typeof version !== 'string') || !Array.isArray(entries)) return

    currentVersion = version ?? null
    for (const restored of entries) {
      if (cache.size >= config.pageCacheCapacity) break
      if (!Array.isArray(restored) || restored.length !== 2) continue

      const [key, restoredEntry] = restored
      if (typeof key !== 'string') continue
      const entry = toPageCacheEntry(restoredEntry)
      if (entry === null) continue

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
