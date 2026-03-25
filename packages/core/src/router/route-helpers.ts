// Route helper utilities for building typed URLs and triggering navigation.
// Full type safety with autocomplete is achieved when users import ValenceRoutes
// from their generated .valence/routes.d.ts.

import { ResultAsync } from '@valencets/resultkit'
import { initRouter } from './push-state.js'

export interface NavigateOptions {
  readonly replace?: boolean
  readonly scroll?: 'top' | 'preserve'
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
    return value !== undefined ? value : `:${name}`
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

  // We delegate to the router's click-based navigation event system.
  // Dispatch valence:before-navigate so any existing router handles it,
  // and initialise a minimal router handle to drive navigation.
  const routerResult = initRouter(undefined, fetchFn)
  if (routerResult.isErr()) return

  const handle = routerResult.value
  let navigationSettled = false

  const unlistenNav = (e: Event) => {
    if (navigationSettled || opts?.replace !== true) return
    const detail = (e as CustomEvent).detail as { toUrl: string } | undefined
    if (detail?.toUrl === url) {
      window.history.replaceState({ url }, '', url)
      document.removeEventListener('valence:navigated', unlistenNav)
    }
  }

  if (opts?.replace === true) {
    document.addEventListener('valence:navigated', unlistenNav)
  }

  ResultAsync.fromPromise(
    handle.navigate(url).match(
      () => undefined,
      () => undefined
    ),
    () => null
  ).match(
    () => {
      navigationSettled = true
      document.removeEventListener('valence:navigated', unlistenNav)
      handle.destroy()
    },
    () => {
      navigationSettled = true
      document.removeEventListener('valence:navigated', unlistenNav)
      handle.destroy()
    }
  )
}
