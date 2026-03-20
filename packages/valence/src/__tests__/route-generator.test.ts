import { describe, it, expect } from 'vitest'
import { generateCollectionRoutes } from '../route-generator.js'
import type { GeneratedRoute } from '../route-generator.js'
import type { CollectionConfig } from '@valencets/cms'
import type { RouteConfig } from '../define-config.js'

const makeCollection = (overrides: Partial<CollectionConfig> = {}): CollectionConfig => ({
  slug: 'posts',
  fields: [{ type: 'text', name: 'title' }],
  timestamps: true,
  ...overrides
})

describe('generateCollectionRoutes', () => {
  it('returns list and detail routes for a single collection', () => {
    const result = generateCollectionRoutes([makeCollection()])
    expect(result).toHaveLength(2)
  })

  it('generates a GET list route at /{slug}', () => {
    const result = generateCollectionRoutes([makeCollection()])
    const listRoute = result.find((r) => r.type === 'list')
    expect(listRoute).toBeDefined()
    expect(listRoute?.path).toBe('/posts')
    expect(listRoute?.method).toBe('GET')
    expect(listRoute?.collection).toBe('posts')
    expect(listRoute?.type).toBe('list')
  })

  it('generates a GET detail route at /{slug}/:id', () => {
    const result = generateCollectionRoutes([makeCollection()])
    const detailRoute = result.find((r) => r.type === 'detail')
    expect(detailRoute).toBeDefined()
    expect(detailRoute?.path).toBe('/posts/:id')
    expect(detailRoute?.method).toBe('GET')
    expect(detailRoute?.collection).toBe('posts')
    expect(detailRoute?.type).toBe('detail')
  })

  it('generates routes for multiple collections', () => {
    const result = generateCollectionRoutes([
      makeCollection({ slug: 'posts' }),
      makeCollection({ slug: 'authors' })
    ])
    expect(result).toHaveLength(4)
    const paths = result.map((r) => r.path)
    expect(paths).toContain('/posts')
    expect(paths).toContain('/posts/:id')
    expect(paths).toContain('/authors')
    expect(paths).toContain('/authors/:id')
  })

  it('returns empty array for empty collections', () => {
    const result = generateCollectionRoutes([])
    expect(result).toHaveLength(0)
  })

  it('uses collection slug in the path', () => {
    const result = generateCollectionRoutes([makeCollection({ slug: 'blog-posts' })])
    const paths = result.map((r) => r.path)
    expect(paths).toContain('/blog-posts')
    expect(paths).toContain('/blog-posts/:id')
  })

  it('skips auto-generated list route when custom route has same path', () => {
    const customRoutes: readonly RouteConfig[] = [
      { path: '/posts', method: 'GET', handler: () => { /* noop */ } }
    ]
    const result = generateCollectionRoutes([makeCollection()], customRoutes)
    const listRoutes = result.filter((r) => r.path === '/posts')
    expect(listRoutes).toHaveLength(0)
  })

  it('keeps detail route when only list route is overridden', () => {
    const customRoutes: readonly RouteConfig[] = [
      { path: '/posts', method: 'GET', handler: () => { /* noop */ } }
    ]
    const result = generateCollectionRoutes([makeCollection()], customRoutes)
    const detailRoute = result.find((r) => r.path === '/posts/:id')
    expect(detailRoute).toBeDefined()
    expect(detailRoute?.type).toBe('detail')
  })

  it('skips auto-generated detail route when custom route has same path', () => {
    const customRoutes: readonly RouteConfig[] = [
      { path: '/posts/:id', method: 'GET', handler: () => { /* noop */ } }
    ]
    const result = generateCollectionRoutes([makeCollection()], customRoutes)
    const detailRoutes = result.filter((r) => r.path === '/posts/:id')
    expect(detailRoutes).toHaveLength(0)
  })

  it('skips both auto-generated routes when custom routes cover both paths', () => {
    const customRoutes: readonly RouteConfig[] = [
      { path: '/posts', method: 'GET' },
      { path: '/posts/:id', method: 'GET' }
    ]
    const result = generateCollectionRoutes([makeCollection()], customRoutes)
    expect(result).toHaveLength(0)
  })

  it('returns readonly array of GeneratedRoute objects', () => {
    const result = generateCollectionRoutes([makeCollection()])
    const route = result[0] as GeneratedRoute
    expect(typeof route.path).toBe('string')
    expect(typeof route.method).toBe('string')
    expect(typeof route.collection).toBe('string')
    expect(route.type === 'list' || route.type === 'detail').toBe(true)
  })

  it('no-op when customRoutes is undefined', () => {
    const result = generateCollectionRoutes([makeCollection()], undefined)
    expect(result).toHaveLength(2)
  })
})
