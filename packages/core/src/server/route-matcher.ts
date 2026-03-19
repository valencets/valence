export interface RouteMatch {
  readonly pattern: string
  readonly params: Readonly<Record<string, string>>
}

export function matchRoute (
  pathname: string,
  patterns: Iterable<string>
): RouteMatch | null {
  const patternList = Array.from(patterns)

  // Fast path: exact match first
  for (const pattern of patternList) {
    if (pattern === pathname) {
      return { pattern, params: {} }
    }
  }

  // Pattern match with param extraction
  const pathSegments = pathname.split('/')

  for (const pattern of patternList) {
    const patternSegments = pattern.split('/')
    if (patternSegments.length !== pathSegments.length) continue

    const params: Record<string, string> = {}
    let matched = true

    for (let i = 0; i < patternSegments.length; i++) {
      const seg = patternSegments[i]!
      const val = pathSegments[i]!
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = val
      } else if (seg !== val) {
        matched = false
        break
      }
    }

    if (matched) {
      return { pattern, params }
    }
  }

  return null
}
