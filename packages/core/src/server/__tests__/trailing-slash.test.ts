import { describe, it, expect } from 'vitest'
import { stripTrailingSlash } from '../trailing-slash.js'

describe('stripTrailingSlash', () => {
  it('returns null for root path (no redirect needed)', () => {
    expect(stripTrailingSlash('/')).toBe(null)
  })

  it('returns null when path has no trailing slash', () => {
    expect(stripTrailingSlash('/admin')).toBe(null)
  })

  it('strips trailing slash from simple path', () => {
    expect(stripTrailingSlash('/admin/')).toBe('/admin')
  })

  it('strips trailing slash from nested path', () => {
    expect(stripTrailingSlash('/admin/posts/')).toBe('/admin/posts')
  })

  it('strips trailing slash from deeply nested path', () => {
    expect(stripTrailingSlash('/api/collections/posts/123/')).toBe('/api/collections/posts/123')
  })

  it('preserves query string when stripping trailing slash', () => {
    expect(stripTrailingSlash('/admin/?page=2')).toBe('/admin?page=2')
  })

  it('preserves complex query string when stripping trailing slash', () => {
    expect(stripTrailingSlash('/api/posts/?page=2&sort=desc')).toBe('/api/posts?page=2&sort=desc')
  })

  it('returns null for path without trailing slash but with query string', () => {
    expect(stripTrailingSlash('/admin?page=2')).toBe(null)
  })

  it('returns null for root path with query string', () => {
    expect(stripTrailingSlash('/?foo=bar')).toBe(null)
  })

  it('handles path that is just double slash', () => {
    expect(stripTrailingSlash('//')).toBe('/')
  })
})
