import { ok, err, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { RouterErrorCode, resolveConfig } from './router-types.js'
import type { RouterConfig, RouterError, NavigationDetail, ResolvedRouterConfig, NavigationPerformance } from './router-types.js'
import { parseHtml, extractFragment, extractTitle, swapContent } from './fragment-swap.js'
import { initPrefetch } from './prefetch.js'
import type { PrefetchHandle } from './prefetch.js'
import { initPageCache } from './page-cache.js'
import type { PageCacheHandle } from './page-cache.js'

export interface RouterHandle {
  readonly destroy: () => void
  readonly navigate: (url: string) => ResultAsync<void, RouterError>
  readonly prefetch: (url: string) => ResultAsync<void, RouterError>
  readonly clearPageCache: () => void
  readonly pageCacheSize: () => number
}

export function shouldIntercept (event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (anchor.target === '_blank') return false
  if (anchor.hasAttribute('data-inertia-ignore')) return false
  if (anchor.hasAttribute('download')) return false

  const href = anchor.getAttribute('href') ?? ''
  if (href.startsWith('#')) return false

  // External origin check
  if (anchor.origin !== window.location.origin) return false

  return true
}

function dispatchNavigationEvent (name: string, detail: NavigationDetail): boolean {
  const event = new CustomEvent(name, {
    bubbles: true,
    cancelable: name === 'inertia:before-navigate',
    detail
  })
  return document.dispatchEvent(event)
}

interface NavigationResult {
  readonly source: NavigationPerformance['source']
  readonly version: string | null
  readonly title: string | null
}

function isNoCachePath (url: string, noCachePaths: ReadonlyArray<string>): boolean {
  for (const prefix of noCachePaths) {
    if (url.startsWith(prefix)) return true
  }
  return false
}

function performNavigation (
  url: string,
  config: ResolvedRouterConfig,
  fetchFn: typeof fetch,
  prefetchHandle: PrefetchHandle,
  pageCacheHandle: PageCacheHandle
): ResultAsync<NavigationResult, RouterError> {
  const skipCache = isNoCachePath(url, config.noCachePaths)

  // 1. Check page cache first
  if (!skipCache) {
    const pageCached = pageCacheHandle.get(url)
    if (pageCached.isOk()) {
      const result = processHtml(pageCached.value.html, config.contentSelector)
      if (result.isOk()) {
        return ResultAsync.fromSafePromise(
          Promise.resolve({ source: 'cache' as const, version: pageCached.value.version, title: result.value })
        )
      }
    }
  }

  // 2. Check prefetch cache
  const prefetched = prefetchHandle.getCached(url)
  if (prefetched.isOk()) {
    const result = processHtml(prefetched.value.html, config.contentSelector)
    if (result.isOk()) {
      // Promote to page cache
      if (!skipCache) {
        pageCacheHandle.set(url, {
          url,
          html: prefetched.value.html,
          timestamp: Date.now(),
          version: pageCacheHandle.getVersion(),
          title: result.value
        })
      }
      return ResultAsync.fromSafePromise(
        Promise.resolve({ source: 'prefetch' as const, version: null, title: result.value })
      )
    }
  }

  // 3. Network fetch
  const fetchPromise = config.enableFragmentProtocol
    ? fetchFn(url, { headers: { 'X-Inertia-Fragment': '1' } })
    : fetchFn(url)

  return ResultAsync.fromPromise(
    fetchPromise.then((response) => {
      if (!response.ok) {
        return Promise.reject(new Error(`Fetch returned status ${String(response.status)}`))
      }
      const version = response.headers.get('X-Inertia-Version')
      const titleHeader = response.headers.get('X-Inertia-Title')
      return response.text().then((html) => ({ html, version, titleHeader }))
    }),
    (): RouterError => ({
      code: RouterErrorCode.FETCH_FAILED,
      message: `Navigation fetch failed for ${url}`
    })
  ).andThen(({ html, version, titleHeader }) => {
    const result = processHtml(html, config.contentSelector)
    if (result.isErr()) return err(result.error)

    const title = titleHeader ?? result.value

    // Store in page cache (unless admin path)
    if (!skipCache) {
      pageCacheHandle.set(url, {
        url,
        html,
        timestamp: Date.now(),
        version,
        title
      })
    }

    // Update version tracking
    if (version !== null) {
      pageCacheHandle.setVersion(version)
    }

    return ok({ source: 'network' as const, version, title })
  })
}

function processHtml (html: string, contentSelector: string): Result<string | null, RouterError> {
  const docResult = parseHtml(html)
  if (docResult.isErr()) return err(docResult.error)

  const doc = docResult.value
  const fragmentResult = extractFragment(doc, contentSelector)
  if (fragmentResult.isErr()) return err(fragmentResult.error)

  const liveContainer = document.querySelector(contentSelector)
  if (liveContainer === null) {
    return err({
      code: RouterErrorCode.SELECTOR_MISS,
      message: `Live container not found: ${contentSelector}`
    })
  }

  document.dispatchEvent(new CustomEvent('inertia:before-swap'))

  const swapResult = swapContent(liveContainer, fragmentResult.value)
  if (swapResult.isErr()) return err(swapResult.error)

  document.dispatchEvent(new CustomEvent('inertia:after-swap'))

  const title = extractTitle(doc)
  if (title !== null) {
    document.title = title
  }

  return ok(title)
}

export function initRouter (
  config?: RouterConfig,
  fetchFn: typeof fetch = globalThis.fetch
): Result<RouterHandle, RouterError> {
  const resolved = resolveConfig(config)

  const prefetchResult = initPrefetch(resolved, fetchFn)
  if (prefetchResult.isErr()) return err(prefetchResult.error)
  const prefetchHandle = prefetchResult.value

  const pageCacheHandle = initPageCache(resolved)

  // Seed version from DOM if available
  const versionAttr = document.documentElement.getAttribute('data-inertia-version')
  if (versionAttr !== null) {
    pageCacheHandle.setVersion(versionAttr)
  }

  function navigate (url: string): ResultAsync<void, RouterError> {
    const fromUrl = window.location.href
    const detail: NavigationDetail = { fromUrl, toUrl: url }

    const allowed = dispatchNavigationEvent('inertia:before-navigate', detail)
    if (!allowed) {
      return ResultAsync.fromSafePromise(Promise.resolve(undefined))
    }

    const startTime = performance.now()

    return performNavigation(url, resolved, fetchFn, prefetchHandle, pageCacheHandle)
      .map((navResult) => {
        const durationMs = Math.round(performance.now() - startTime)
        window.history.pushState({ url }, '', url)
        window.scrollTo(0, 0)

        // Version mismatch detection — also clear prefetch cache
        if (navResult.version !== null) {
          const currentVer = pageCacheHandle.getVersion()
          if (currentVer !== null && currentVer !== navResult.version) {
            prefetchHandle.clearCache()
          }
          pageCacheHandle.setVersion(navResult.version)
        }

        const perfDetail: NavigationPerformance = {
          source: navResult.source,
          durationMs,
          fromUrl,
          toUrl: url
        }
        document.dispatchEvent(new CustomEvent('inertia:navigated', {
          bubbles: true,
          detail: perfDetail
        }))
        return undefined
      })
  }

  function onPopstate (event: Event): void {
    const popEvent = event as PopStateEvent
    const state = popEvent.state as { url?: string } | null
    const url = state?.url ?? window.location.href

    const startTime = performance.now()

    performNavigation(url, resolved, fetchFn, prefetchHandle, pageCacheHandle)
      .map((navResult) => {
        const durationMs = Math.round(performance.now() - startTime)
        const perfDetail: NavigationPerformance = {
          source: navResult.source,
          durationMs,
          fromUrl: '',
          toUrl: url
        }
        document.dispatchEvent(new CustomEvent('inertia:navigated', {
          bubbles: true,
          detail: perfDetail
        }))
        return undefined
      })
  }

  function onClick (event: Event): void {
    const mouseEvent = event as MouseEvent
    const target = mouseEvent.target as Element | null
    if (target === null) return

    const anchor = target.closest('a[href]') as HTMLAnchorElement | null
    if (anchor === null) return

    if (!shouldIntercept(mouseEvent, anchor)) return

    mouseEvent.preventDefault()

    const url = anchor.getAttribute('href') ?? anchor.pathname
    navigate(url)
  }

  document.body.addEventListener('click', onClick)
  window.addEventListener('popstate', onPopstate)

  const handle: RouterHandle = {
    destroy () {
      document.body.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopstate)
      prefetchHandle.destroy()
      pageCacheHandle.invalidateAll()
    },
    navigate,
    prefetch: prefetchHandle.prefetchUrl,
    clearPageCache () {
      pageCacheHandle.invalidateAll()
    },
    pageCacheSize () {
      return pageCacheHandle.size()
    }
  }

  return ok(handle)
}
