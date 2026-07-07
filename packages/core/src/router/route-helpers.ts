// Route helper utilities for building typed URLs and triggering navigation.
// Full type safety with autocomplete is achieved when users import ValenceRoutes
// from their generated .valence/routes.d.ts.

import { ResultAsync } from '@valencets/resultkit'
import { initRouter } from './push-state.js'
import type { RouterHandle } from './push-state.js'
import { resolveConfig } from './router-types.js'

export interface NavigateOptions {
  readonly replace?: boolean
  readonly handle?: RouterHandle
}

function getNavigatedUrl (event: Event): string | null {
  if (!('detail' in event)) return null
  const detail = Reflect.get(event, 'detail')
  if (typeof detail !== 'object' || detail === null) return null

  const toUrl = Reflect.get(detail, 'toUrl')
  return typeof toUrl === 'string' ? toUrl : null
}

// Matches :paramName segments (colon followed by word chars, bounded by / . ? # or end)
const PARAM_PATTERN = /:([A-Za-z_][A-Za-z0-9_]*)(?=\/|\.|\?|#|$)/g

/**
 * Build a URL by replacing :param segments in path with values from params.
 * Unmatched params leave the segment intact.
 */
export function routeUrl (path: string, params: Record<string, string>): string {
  return path.replace(PARAM_PATTERN, (_match, name: string) => {
    const value = params[name]
    return value !== undefined ? encodeURIComponent(value) : `:${name}`
  })
}

/**
 * Build the URL from path+params then trigger pushState navigation.
 * Accepts an optional fetch override for testing.
 */
export function navigateTo (
  path: string,
  params: Record<string, string>,
  opts?: NavigateOptions,
  fetchFn: typeof fetch = globalThis.fetch
): void {
  const url = routeUrl(path, params)
  const config = resolveConfig()

  const handle = opts?.handle ?? (() => {
    const routerResult = initRouter(undefined, fetchFn)
    return routerResult.isOk() ? routerResult.value : null
  })()
  if (handle === null) return
  const activeHandle = handle

  const ownsHandle = opts?.handle === undefined
  let navigationSettled = false
  let cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null

  function cleanup (): void {
    if (navigationSettled) return
    navigationSettled = true
    document.removeEventListener('valence:navigated', unlistenNav)
    if (cleanupTimeoutId !== null) {
      clearTimeout(cleanupTimeoutId)
      cleanupTimeoutId = null
    }
    if (ownsHandle) {
      activeHandle.destroy()
    }
  }

  const unlistenNav = (e: Event) => {
    if (navigationSettled || opts?.replace !== true) return
    if (getNavigatedUrl(e) === url) {
      window.history.replaceState({ url }, '', url)
      document.removeEventListener('valence:navigated', unlistenNav)
    }
  }

  if (opts?.replace === true) {
    document.addEventListener('valence:navigated', unlistenNav)
  }

  cleanupTimeoutId = setTimeout(cleanup, config.navigationTimeoutMs)

  ResultAsync.fromPromise(
    activeHandle.navigate(url).match(
      () => undefined,
      () => undefined
    ),
    () => null
  ).match(
    cleanup,
    cleanup
  )
}
