import { createAbortableFetch } from './fetch-retry.js'
import { initScrollRestore } from './scroll-restore.js'
import { ok, err, ResultAsync } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { RouterErrorCode, resolveConfig } from './router-types.js'
import type { RouterConfig, RouterError, NavigationDetail, ResolvedRouterConfig, NavigationPerformance } from './router-types.js'
import { parseHtml, extractFragment, extractTitle, swapContent, getCsrfToken } from './fragment-swap.js'
import { initPrefetch } from './prefetch.js'
import type { PrefetchHandle } from './prefetch.js'
import { initPageCache } from './page-cache.js'
import { wrapInTransition, supportsViewTransitions } from './view-transitions.js'
import type { PageCacheHandle } from './page-cache.js'
import { swapOutletContent } from './outlet-swap.js'

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
  if (anchor.hasAttribute('data-valence-ignore')) return false
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
    cancelable: name === 'valence:before-navigate',
    detail
  })
  return document.dispatchEvent(event)
}

interface NavigationResult {
  readonly source: NavigationPerformance['source']
  readonly version: string | null
  readonly title: string | null
  readonly outletName?: string | undefined
}

function csrfHeaders (): Record<string, string> {
  const token = getCsrfToken()
  if (token === undefined) return {}
  return { 'X-CSRF-Token': token }
}

function revalidateInBackground (
  url: string,
  config: ResolvedRouterConfig,
  fetchFn: typeof fetch,
  pageCacheHandle: PageCacheHandle,
  cachedHtml: string
): void {
  const fetchPromise = config.enableFragmentProtocol
    ? fetchFn(url, { headers: { 'X-Valence-Fragment': '1', ...csrfHeaders() } })
    : fetchFn(url)

  fetchPromise
    .then((response) => {
      if (!response.ok) return
      const version = response.headers.get('X-Valence-Version')
      return response.text().then((html) => ({ html, version }))
    })
    .then((result) => {
      if (result === undefined) return

      // Update version tracking
      if (result.version !== null) {
        pageCacheHandle.setVersion(result.version)
      }

      // Same content -- no re-swap needed
      if (result.html === cachedHtml) return

      // User navigated away -- don't re-swap
      const currentPath = window.location.pathname
      const urlPath = url.startsWith('/') ? url : new URL(url, window.location.origin).pathname
      if (currentPath !== urlPath) return

      // Content changed -- update cache and re-swap
      const titleHeader = null
      pageCacheHandle.set(url, {
        url,
        html: result.html,
        timestamp: Date.now(),
        version: result.version,
        title: titleHeader
      })

      processHtml(result.html, config.contentSelector)
    })
    .catch(() => {
      // Background revalidation is fire-and-forget -- log but don't propagate
    })
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
  rawFetchFn: typeof fetch,
  prefetchHandle: PrefetchHandle,
  pageCacheHandle: PageCacheHandle
): ResultAsync<NavigationResult, RouterError> {
  const skipCache = isNoCachePath(url, config.noCachePaths)

  // 1. Check page cache first -- serve instantly, revalidate in background
  if (!skipCache) {
    const pageCached = pageCacheHandle.get(url)
    if (pageCached.isOk()) {
      const result = processHtml(pageCached.value.html, config.contentSelector, config.enableViewTransitions)
      if (result.isOk()) {
        revalidateInBackground(url, config, rawFetchFn, pageCacheHandle, pageCached.value.html)
        return ResultAsync.fromSafePromise(
          Promise.resolve({ source: 'cache' as const, version: pageCached.value.version, title: result.value })
        )
      }
    }
  }

  // 2. Check prefetch cache
  const prefetched = prefetchHandle.getCached(url)
  if (prefetched.isOk()) {
    const result = processHtml(prefetched.value.html, config.contentSelector, config.enableViewTransitions)
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
    ? fetchFn(url, { headers: { 'X-Valence-Fragment': '1', ...csrfHeaders() } })
    : fetchFn(url)

  return ResultAsync.fromPromise(
    fetchPromise.then((response) => {
      if (response.status === 401) {
        const redirectUrl = response.headers.get('X-Valence-Redirect')
        if (redirectUrl !== null) {
          window.location.href = redirectUrl
          const authError = new Error(`Auth redirect to ${redirectUrl}`)
          Object.assign(authError, { code: RouterErrorCode.AUTH_REDIRECT })
          return Promise.reject(authError)
        }
      }
      if (!response.ok) {
        return Promise.reject(new Error(`Fetch returned status ${String(response.status)}`))
      }
      const version = response.headers.get('X-Valence-Version')
      const titleHeader = response.headers.get('X-Valence-Title')
      const outletName = response.headers.get('X-Valence-Outlet') ?? undefined
      return response.text().then((html) => ({ html, version, titleHeader, outletName }))
    }),
    (reason): RouterError => {
      if (reason instanceof Error) {
        const coded = reason as Error & { code?: string }
        if (coded.code !== undefined) {
          return { code: coded.code as RouterErrorCode, message: reason.message }
        }
      }
      return {
        code: RouterErrorCode.FETCH_FAILED,
        message: `Navigation fetch failed for ${url}`
      }
    }
  ).andThen(({ html, version, titleHeader, outletName }) => {
    const result = processHtml(html, config.contentSelector, config.enableViewTransitions, outletName)
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

    return ok({ source: 'network' as const, version, title, outletName })
  })
}

function processHtml (
  html: string,
  contentSelector: string,
  enableViewTransitions: boolean = false,
  outletName?: string
): Result<string | null, RouterError> {
  // Outlet-targeted swap: route content to a named val-outlet instead of full swap
  if (outletName !== undefined) {
    const liveRoot = document.querySelector(contentSelector) ?? document.body
    const outletSwapResult = swapOutletContent(liveRoot, outletName, html)

    // If outlet not found in live DOM, fall back to full content swap below
    if (outletSwapResult.isOk()) {
      const docResult = parseHtml(html)
      const title = docResult.isOk() ? extractTitle(docResult.value) : null
      return ok(title)
    }

    if (outletSwapResult.error.code !== RouterErrorCode.SELECTOR_MISS) {
      return err(outletSwapResult.error)
    }
    // SELECTOR_MISS from outlet means outlet not in DOM -- fall through to full swap
  }

  const docResult = parseHtml(html)
  if (docResult.isErr()) return err(docResult.error)

  const doc = docResult.value
  const fragmentResult = extractFragment(doc, contentSelector)

  // If selector miss, this is likely a bare fragment response (no shell).
  // Fall back to doc.body which contains the fragment content.
  const fragment = fragmentResult.isOk()
    ? fragmentResult.value
    : doc.body

  const liveContainer = document.querySelector(contentSelector)
  if (liveContainer === null) {
    return err({
      code: RouterErrorCode.SELECTOR_MISS,
      message: `Live container not found: ${contentSelector}`
    })
  }

  document.dispatchEvent(new CustomEvent('valence:before-swap'))

  if (enableViewTransitions && supportsViewTransitions()) {
    wrapInTransition(() => {
      swapContent(liveContainer, fragment)
      document.dispatchEvent(new CustomEvent('valence:after-swap'))
    }, liveContainer)
  } else {
    const swapResult = swapContent(liveContainer, fragment)
    if (swapResult.isErr()) return err(swapResult.error)
    document.dispatchEvent(new CustomEvent('valence:after-swap'))
  }

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
  const abortableFetch = createAbortableFetch(fetchFn)
  const scrollRestore = initScrollRestore()

  // Click debouncing + loading state
  let activeNavigationUrl: string | null = null
  let activeAnchor: HTMLAnchorElement | null = null
  let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null

  function setLoadingState (anchor: HTMLAnchorElement, url: string): void {
    clearLoadingState()
    activeNavigationUrl = url
    activeAnchor = anchor
    anchor.setAttribute('aria-busy', 'true')
    anchor.setAttribute('data-val-loading', '')
    loadingTimeoutId = setTimeout(clearLoadingState, resolved.navigationTimeoutMs)
  }

  function clearLoadingState (): void {
    if (activeAnchor !== null) {
      activeAnchor.removeAttribute('aria-busy')
      activeAnchor.removeAttribute('data-val-loading')
    }
    activeAnchor = null
    activeNavigationUrl = null
    if (loadingTimeoutId !== null) {
      clearTimeout(loadingTimeoutId)
      loadingTimeoutId = null
    }
  }

  // Seed version from DOM if available
  const versionAttr = document.documentElement.getAttribute('data-valence-version')
  if (versionAttr !== null) {
    pageCacheHandle.setVersion(versionAttr)
  }

  function navigate (url: string, hash?: string): ResultAsync<void, RouterError> {
    const fromUrl = window.location.href
    const detail: NavigationDetail = { fromUrl, toUrl: url }

    const allowed = dispatchNavigationEvent('valence:before-navigate', detail)
    if (!allowed) {
      return ResultAsync.fromSafePromise(Promise.resolve(undefined))
    }

    const startTime = performance.now()

    scrollRestore.saveCurrentPosition()
    abortableFetch.abort()
    return performNavigation(url, resolved, abortableFetch.fetch, fetchFn, prefetchHandle, pageCacheHandle)
      .map((navResult) => {
        const durationMs = Math.round(performance.now() - startTime)
        const pushUrl = hash !== undefined ? url + hash : url
        window.history.pushState({ url }, '', pushUrl)
        if (hash === undefined || !scrollRestore.scrollToHash(hash)) { window.scrollTo(0, 0) }

        // Apply title from header (fragment responses) or parsed HTML
        if (navResult.title !== null) {
          document.title = navResult.title
        }

        // Version mismatch detection -- also clear prefetch cache
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
        document.dispatchEvent(new CustomEvent('valence:navigated', {
          bubbles: true,
          detail: perfDetail
        }))
        clearLoadingState()
        return undefined
      })
      .mapErr((error) => {
        clearLoadingState()
        return error
      })
  }

  function onPopstate (event: Event): void {
    const popEvent = event as PopStateEvent
    const state = popEvent.state as { url?: string } | null
    const url = state?.url ?? window.location.href

    const startTime = performance.now()

    performNavigation(url, resolved, abortableFetch.fetch, fetchFn, prefetchHandle, pageCacheHandle)
      .map((navResult) => {
        const durationMs = Math.round(performance.now() - startTime)

        if (navResult.title !== null) {
          document.title = navResult.title
        }

        const perfDetail: NavigationPerformance = {
          source: navResult.source,
          durationMs,
          fromUrl: '',
          toUrl: url
        }
        document.dispatchEvent(new CustomEvent('valence:navigated', {
          bubbles: true,
          detail: perfDetail
        }))
        scrollRestore.restorePosition(popEvent.state)
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

    // Use pathname + search (strips hash fragment) so cache keys are consistent
    // /about#contact and /about resolve to the same server resource
    const url = anchor.pathname + anchor.search
    const hash = anchor.hash !== '' ? anchor.hash : undefined

    // Ignore duplicate click on same URL while navigation is in-flight
    if (activeNavigationUrl === url) return

    setLoadingState(anchor, url)
    navigate(url, hash)
  }

  document.body.addEventListener('click', onClick)
  window.addEventListener('popstate', onPopstate)

  const handle: RouterHandle = {
    destroy () {
      document.body.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopstate)
      prefetchHandle.destroy()
      abortableFetch.abort()
      scrollRestore.destroy()
      clearLoadingState()
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
