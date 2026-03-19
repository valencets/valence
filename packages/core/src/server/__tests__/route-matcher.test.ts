import { describe, it, expect } from 'vitest'
import { matchRoute } from '../route-matcher.js'

describe('matchRoute', () => {
  it('exact match returns pattern with empty params', () => {
    const result = matchRoute('/hello', ['/hello', '/world'])
    expect(result).toEqual({ pattern: '/hello', params: {} })
  })

  it('/users/:id matches /users/123', () => {
    const result = matchRoute('/users/123', ['/users/:id'])
    expect(result).toEqual({ pattern: '/users/:id', params: { id: '123' } })
  })

  it('/admin/:slug/:id/edit extracts both params', () => {
    const result = matchRoute('/admin/posts/42/edit', ['/admin/:slug/:id/edit'])
    expect(result).toEqual({
      pattern: '/admin/:slug/:id/edit',
      params: { slug: 'posts', id: '42' }
    })
  })

  it('mismatched segment count returns null', () => {
    const result = matchRoute('/a/b/c', ['/a/b'])
    expect(result).toBeNull()
  })

  it('mismatched literal segment returns null', () => {
    const result = matchRoute('/users/123', ['/posts/:id'])
    expect(result).toBeNull()
  })

  it('multiple patterns, first match wins', () => {
    const result = matchRoute('/users/123', ['/posts/:id', '/users/:id', '/users/:uid'])
    expect(result).toEqual({ pattern: '/users/:id', params: { id: '123' } })
  })

  it('no :param patterns means only exact matches attempted', () => {
    const result = matchRoute('/users/123', ['/hello', '/world'])
    expect(result).toBeNull()
  })

  it('exact match takes priority over param match', () => {
    const result = matchRoute('/users/me', ['/users/:id', '/users/me'])
    expect(result).toEqual({ pattern: '/users/me', params: {} })
  })
})
