import { join, normalize, resolve } from 'node:path'
import { fromThrowable } from '@valencets/resultkit'

const safeDecodeURIComponent = fromThrowable(
  decodeURIComponent,
  () => null
)

interface PageRouteResult {
  readonly path: string
  readonly param: string | null
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

function isValidSegment (segment: string): boolean {
  return SLUG_PATTERN.test(segment) && !segment.includes('..')
}

export function resolvePageRouteWithParam (pathname: string, srcDir: string): PageRouteResult | null {
  // Reject null bytes and control characters
  if (pathname.includes('\0')) return null
  for (let i = 0; i < pathname.length; i++) {
    const code = pathname.charCodeAt(i)
    if (code >= 1 && code <= 0x1f) return null
  }

  // Decode URI — reject malformed percent-encoding
  const decodeResult = safeDecodeURIComponent(pathname)
  const decoded = decodeResult.isOk() ? decodeResult.value : null
  if (decoded === null) return null

  // Check for traversal
  if (decoded.includes('..')) return null

  // Normalize
  const normalized = normalize(decoded)

  // Split into segments, filter empty
  const segments = normalized.split('/').filter(s => s.length > 0)

  // / → home page
  if (segments.length === 0) {
    return { path: join(srcDir, 'pages', 'home', 'ui', 'index.html'), param: null }
  }

  // /slug → page index or list
  if (segments.length === 1) {
    const seg = segments[0]!
    if (!isValidSegment(seg)) return null
    // Resolve and verify no traversal
    const resolved = resolve(srcDir, 'pages', seg, 'ui', 'index.html')
    if (!resolved.startsWith(resolve(srcDir))) return null
    return { path: join(srcDir, 'pages', seg, 'ui', 'index.html'), param: null }
  }

  // /slug/:param → detail page
  if (segments.length === 2) {
    const collection = segments[0]!
    const param = segments[1]!
    if (!isValidSegment(collection)) return null
    const detailPath = join(srcDir, 'pages', collection, 'ui', 'detail.html')
    const resolved = resolve(srcDir, 'pages', collection, 'ui', 'detail.html')
    if (!resolved.startsWith(resolve(srcDir))) return null
    return { path: detailPath, param }
  }

  return null
}

export function resolvePageRoute (pathname: string, srcDir: string): string | null {
  const result = resolvePageRouteWithParam(pathname, srcDir)
  return result !== null ? result.path : null
}
