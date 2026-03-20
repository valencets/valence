/**
 * Checks whether a URL string has a trailing slash that should be stripped.
 * Returns the cleaned URL (path + query string) for a 301 redirect,
 * or null if no redirect is needed (root "/" or no trailing slash).
 */
export function stripTrailingSlash (url: string): string | null {
  const qsIndex = url.indexOf('?')
  const pathname = qsIndex === -1 ? url : url.slice(0, qsIndex)
  const qs = qsIndex === -1 ? '' : url.slice(qsIndex)

  if (pathname === '/' || !pathname.endsWith('/')) return null

  const cleaned = pathname.slice(0, -1)
  return cleaned + qs
}
