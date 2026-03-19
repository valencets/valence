import { describe, it, expect } from 'vitest'
import { resolvePageRoute, resolvePageRouteWithParam } from '../page-router.js'

describe('resolvePageRoute', () => {
  it('maps / to src/pages/home/ui/index.html', () => {
    const result = resolvePageRoute('/', '/tmp/project/src')
    expect(result).toBe('/tmp/project/src/pages/home/ui/index.html')
  })

  it('maps /about to src/pages/about/ui/index.html', () => {
    const result = resolvePageRoute('/about', '/tmp/project/src')
    expect(result).toBe('/tmp/project/src/pages/about/ui/index.html')
  })

  it('maps /posts to src/pages/posts/ui/index.html', () => {
    const result = resolvePageRoute('/posts', '/tmp/project/src')
    expect(result).toBe('/tmp/project/src/pages/posts/ui/index.html')
  })

  it('maps /posts/:id to src/pages/posts/ui/detail.html', () => {
    const result = resolvePageRoute('/posts/abc-123', '/tmp/project/src')
    expect(result).toBe('/tmp/project/src/pages/posts/ui/detail.html')
  })

  it('returns null for paths with too many segments', () => {
    const result = resolvePageRoute('/a/b/c', '/tmp/project/src')
    expect(result).toBeNull()
  })

  it('rejects path traversal attempts', () => {
    const result = resolvePageRoute('/../etc/passwd', '/tmp/project/src')
    expect(result).toBeNull()
  })

  it('rejects paths with null bytes', () => {
    const result = resolvePageRoute('/home\0', '/tmp/project/src')
    expect(result).toBeNull()
  })

  it('extracts route param from two-segment paths', () => {
    const result = resolvePageRouteWithParam('/posts/my-slug', '/tmp/project/src')
    expect(result).not.toBeNull()
    expect(result!.param).toBe('my-slug')
  })

  it('rejects malformed percent-encoding', () => {
    const result = resolvePageRoute('/%C0', '/tmp/project/src')
    expect(result).toBeNull()
  })

  it('returns null param for single-segment paths', () => {
    const result = resolvePageRouteWithParam('/about', '/tmp/project/src')
    expect(result).not.toBeNull()
    expect(result!.param).toBeNull()
  })
})
