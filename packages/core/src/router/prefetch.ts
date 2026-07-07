import { ok, err, ResultAsync, fromThrowable } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { RouterErrorCode } from './router-types.js'
import type { RouterError, ResolvedRouterConfig, CachedResponse } from './router-types.js'

export interface PrefetchHandle {
  readonly destroy: () => void
  readonly prefetchUrl: (url: string) => ResultAsync<void, RouterError>
  readonly getCached: (url: string) => Result<CachedResponse, RouterError>
  readonly clearCache: () => void
  readonly cacheSize: () => number
}

export function calculateVelocity (
  x1: number, y1: number, t1: number,
  x2: number, y2: number, t2: number
): number {
  const dt = t2 - t1
  if (dt <= 0) return 0
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy) / dt
}

export function initPrefetch (
  config: ResolvedRouterConfig,
  fetchFn: typeof fetch = globalThis.fetch
): Result<PrefetchHandle, RouterError> {
  const safeNewUrl = fromThrowable((value: string) => new URL(value, window.location.origin), () => null)
  const cache = new Map<string, CachedResponse>()
  const inFlight = new Set<string>()
  const pendingQueue: string[] = []
  const pendingSet = new Set<string>()

  let lastX = 0
  let lastY = 0
  let lastTime = 0
  let intentTimer: ReturnType<typeof setTimeout> | null = null
  let intentUrl: string | null = null

  function normalizePrefetchUrl (url: string): Result<string, RouterError> {
    const normalized = safeNewUrl(url)
    if (normalized.isErr() || normalized.value === null) {
      return err({
        code: RouterErrorCode.PREFETCH_FAILED,
        message: `Prefetch requires valid URL: ${url}`
      })
    }

    if (normalized.value.origin !== window.location.origin) {
      return err({
        code: RouterErrorCode.PREFETCH_FAILED,
        message: `Prefetch requires same-origin URL: ${url}`
      })
    }

    return ok(normalized.value.pathname + normalized.value.search)
  }

  function isPrefetchableAnchor (anchor: HTMLAnchorElement): boolean {
    if (anchor.target === '_blank') return false
    if (anchor.hasAttribute('data-valence-ignore')) return false
    if (anchor.hasAttribute('download')) return false

    const href = anchor.getAttribute('href') ?? ''
    if (href === '' || href.startsWith('#')) return false

    return anchor.origin === window.location.origin
  }

  function evictOldest (): void {
    if (cache.size >= config.prefetchCacheCapacity) {
      const oldest = cache.keys().next()
      if (!oldest.done) {
        cache.delete(oldest.value)
      }
    }
  }

  function drainQueue (): void {
    if (pendingQueue.length === 0) return
    if (inFlight.size >= config.maxConcurrentPrefetches) return
    const next = pendingQueue.shift()
    if (next !== undefined) {
      pendingSet.delete(next)
      prefetchUrl(next)
    }
  }

  function prefetchUrl (url: string): ResultAsync<void, RouterError> {
    const normalized = normalizePrefetchUrl(url)
    if (normalized.isErr()) {
      return ResultAsync.fromSafePromise(Promise.resolve(undefined)).andThen(() => err(normalized.error))
    }

    const cacheKey = normalized.value

    if (cache.has(cacheKey)) return ResultAsync.fromSafePromise(Promise.resolve(undefined))
    if (inFlight.has(cacheKey)) return ResultAsync.fromSafePromise(Promise.resolve(undefined))

    // Budget check -- queue if at capacity
    if (inFlight.size >= config.maxConcurrentPrefetches) {
      if (!pendingSet.has(cacheKey)) {
        pendingQueue.push(cacheKey)
        pendingSet.add(cacheKey)
      }
      return ResultAsync.fromSafePromise(Promise.resolve(undefined))
    }

    inFlight.add(cacheKey)

    const fetchPromise = config.enableFragmentProtocol
      ? fetchFn(cacheKey, { headers: { 'X-Valence-Fragment': '1' } })
      : fetchFn(cacheKey)

    return ResultAsync.fromPromise(
      fetchPromise,
      (): RouterError => ({
        code: RouterErrorCode.PREFETCH_FAILED,
        message: `Prefetch failed for ${cacheKey}`
      })
    ).andThen((response) => {
      inFlight.delete(cacheKey)

      if (!response.ok) {
        return err({
          code: RouterErrorCode.FETCH_FAILED,
          message: `Fetch returned status ${String(response.status)}`
        })
      }

      const contentType = response.headers.get('Content-Type') ?? ''
      if (!contentType.includes('text/html')) {
        return err({
          code: RouterErrorCode.NOT_HTML_RESPONSE,
          message: `Response is not HTML: ${contentType}`
        })
      }

      return ResultAsync.fromPromise(
        response.text(),
        (): RouterError => ({
          code: RouterErrorCode.PREFETCH_FAILED,
          message: 'Failed to read response body'
        })
      )
    }).map((html) => {
      evictOldest()
      cache.set(cacheKey, {
        url: cacheKey,
        html,
        timestamp: Date.now()
      })
      drainQueue()
      return undefined
    }).mapErr((error) => {
      inFlight.delete(cacheKey)
      drainQueue()
      return error
    })
  }

  function getCached (url: string): Result<CachedResponse, RouterError> {
    const entry = cache.get(url)
    if (entry === undefined) {
      return err({
        code: RouterErrorCode.CACHE_MISS,
        message: `No cached response for ${url}`
      })
    }

    const age = Date.now() - entry.timestamp
    if (age > config.prefetchTtlMs) {
      cache.delete(url)
      return err({
        code: RouterErrorCode.CACHE_MISS,
        message: `Cached response expired for ${url}`
      })
    }

    return ok(entry)
  }

  function onMouseMove (event: Event): void {
    const mouseEvent = event as MouseEvent
    const target = mouseEvent.target as Element | null
    if (target === null) return

    const anchor = target.closest('a[href]') as HTMLAnchorElement | null
    if (anchor === null) {
      clearIntent()
      return
    }

    if (!isPrefetchableAnchor(anchor)) {
      clearIntent()
      return
    }

    const normalizedUrl = anchor.pathname + anchor.search

    const now = performance.now()
    const velocity = calculateVelocity(lastX, lastY, lastTime, mouseEvent.clientX, mouseEvent.clientY, now)

    lastX = mouseEvent.clientX
    lastY = mouseEvent.clientY
    lastTime = now

    if (velocity > config.velocityThreshold) {
      clearIntent()
      return
    }

    if (intentUrl === normalizedUrl) return

    clearIntent()
    intentUrl = normalizedUrl
    intentTimer = setTimeout(() => {
      if (intentUrl !== null) {
        prefetchUrl(intentUrl)
      }
    }, config.intentDurationMs)
  }

  function clearIntent (): void {
    if (intentTimer !== null) {
      clearTimeout(intentTimer)
      intentTimer = null
    }
    intentUrl = null
  }

  document.body.addEventListener('mousemove', onMouseMove)

  const handle: PrefetchHandle = {
    destroy () {
      document.body.removeEventListener('mousemove', onMouseMove)
      clearIntent()
      cache.clear()
      pendingQueue.length = 0
      pendingSet.clear()
      inFlight.clear()
    },
    prefetchUrl,
    getCached,
    clearCache () {
      cache.clear()
      pendingQueue.length = 0
      pendingSet.clear()
    },
    cacheSize () {
      return cache.size
    }
  }

  return ok(handle)
}
