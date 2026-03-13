import { ok, err, ResultAsync } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'
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
  const cache = new Map<string, CachedResponse>()
  const inFlight = new Set<string>()

  let lastX = 0
  let lastY = 0
  let lastTime = 0
  let intentTimer: ReturnType<typeof setTimeout> | null = null
  let intentUrl: string | null = null

  function evictOldest (): void {
    if (cache.size >= config.prefetchCacheCapacity) {
      const oldest = cache.keys().next()
      if (!oldest.done) {
        cache.delete(oldest.value)
      }
    }
  }

  function prefetchUrl (url: string): ResultAsync<void, RouterError> {
    if (cache.has(url)) return ResultAsync.fromSafePromise(Promise.resolve(undefined))
    if (inFlight.has(url)) return ResultAsync.fromSafePromise(Promise.resolve(undefined))

    inFlight.add(url)

    const fetchPromise = config.enableFragmentProtocol
      ? fetchFn(url, { headers: { 'X-Inertia-Fragment': '1' } })
      : fetchFn(url)

    return ResultAsync.fromPromise(
      fetchPromise,
      (): RouterError => ({
        code: RouterErrorCode.PREFETCH_FAILED,
        message: `Prefetch failed for ${url}`
      })
    ).andThen((response) => {
      inFlight.delete(url)

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
      cache.set(url, {
        url,
        html,
        timestamp: Date.now()
      })
      return undefined
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

    const href = anchor.getAttribute('href') ?? ''
    if (href === '' || href.startsWith('#')) {
      clearIntent()
      return
    }

    // Normalize to pathname + search (strip hash fragment) for consistent cache keys
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
      inFlight.clear()
    },
    prefetchUrl,
    getCached,
    clearCache () {
      cache.clear()
    },
    cacheSize () {
      return cache.size
    }
  }

  return ok(handle)
}
