import { ok, err, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { RouterErrorCode, resolveConfig } from './router-types.js'
import type { RouterConfig, RouterError, NavigationDetail, ResolvedRouterConfig, NavigationPerformance } from './router-types.js'
import { parseHtml, extractFragment, extractTitle, swapContent } from './fragment-swap.js'
import { initPrefetch } from './prefetch.js'
import type { PrefetchHandle } from './prefetch.js'

export interface RouterHandle {
  readonly destroy: () => void
  readonly navigate: (url: string) => ResultAsync<void, RouterError>
  readonly prefetch: (url: string) => ResultAsync<void, RouterError>
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

function performNavigation (
  url: string,
  config: ResolvedRouterConfig,
  fetchFn: typeof fetch,
  prefetchHandle: PrefetchHandle
): ResultAsync<NavigationResult, RouterError> {
  // Check prefetch cache first
  const cached = prefetchHandle.getCached(url)
  let source: NavigationPerformance['source'] = 'network'

  if (cached.isOk()) {
    source = 'prefetch'
    const result = processHtml(cached.value.html, config.contentSelector)
    return ResultAsync.fromSafePromise<NavigationResult, RouterError>(
      Promise.resolve(result.isOk()
        ? { source, version: null, title: result.value }
        : result as unknown as NavigationResult
      )
    ).andThen(() => result.isErr() ? err(result.error) : ok({ source, version: null, title: result.value }))
  }

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

  function navigate (url: string): ResultAsync<void, RouterError> {
    const fromUrl = window.location.href
    const detail: NavigationDetail = { fromUrl, toUrl: url }

    const allowed = dispatchNavigationEvent('inertia:before-navigate', detail)
    if (!allowed) {
      return ResultAsync.fromSafePromise(Promise.resolve(undefined))
    }

    const startTime = performance.now()

    return performNavigation(url, resolved, fetchFn, prefetchHandle)
      .map((navResult) => {
        const durationMs = Math.round(performance.now() - startTime)
        window.history.pushState({ url }, '', url)
        window.scrollTo(0, 0)

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

    performNavigation(url, resolved, fetchFn, prefetchHandle)
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
    },
    navigate,
    prefetch: prefetchHandle.prefetchUrl
  }

  return ok(handle)
}
