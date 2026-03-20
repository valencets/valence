import type { RouteHandler } from './define-config.js'

/**
 * Match a URL pathname against a route pattern with optional `:param` segments.
 * Returns a Record of extracted params on match, or null if no match.
 */
export function matchCustomRoute (pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/')
  const pathParts = pathname.split('/')
  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]
    const up = pathParts[i]
    if (pp !== undefined && pp.startsWith(':')) {
      params[pp.slice(1)] = up ?? ''
    } else if (pp !== up) {
      return null
    }
  }
  return params
}

export interface CustomRouteMatch {
  readonly handler: RouteHandler
  readonly params: Record<string, string>
}

/**
 * Resolve a custom route from the route map. Checks each registered pattern
 * for a match and verifies the HTTP method. Returns the handler and params
 * on match, or null if no registered route matches.
 */
export function resolveCustomRoute (
  routes: Map<string, Map<string, RouteHandler>>,
  method: string,
  pathname: string
): CustomRouteMatch | null {
  for (const [pattern, methodMap] of routes) {
    const params = matchCustomRoute(pattern, pathname)
    if (params !== null) {
      const handler = methodMap.get(method.toUpperCase())
      if (handler) {
        return { handler, params }
      }
    }
  }
  return null
}
