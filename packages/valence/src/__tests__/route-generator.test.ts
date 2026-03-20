import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCollectionRoutes, buildGeneratedRouteMap } from '../route-generator.js'
import type { GeneratedRoute } from '../route-generator.js'
import type { CollectionConfig } from '@valencets/cms'
import type { RouteConfig } from '../define-config.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

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

// -- buildGeneratedRouteMap --

const makeRes = (): ServerResponse => {
  const res = {
    writeHead: vi.fn(),
    end: vi.fn(),
    getHeader: vi.fn(),
    setHeader: vi.fn()
  }
  return res as unknown as ServerResponse
}

const makeReq = (overrides: Partial<{ headers: Record<string, string>, method: string }> = {}): IncomingMessage => {
  return {
    headers: {},
    method: 'GET',
    ...overrides
  } as unknown as IncomingMessage
}

describe('buildGeneratedRouteMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a Map with entries for each generated route', () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts', method: 'GET', collection: 'posts', type: 'list' },
      { path: '/posts/:id', method: 'GET', collection: 'posts', type: 'detail' }
    ]
    const map = buildGeneratedRouteMap(routes, '/fake/project')
    expect(map.size).toBe(2)
    expect(map.has('/posts')).toBe(true)
    expect(map.has('/posts/:id')).toBe(true)
  })

  it('each route entry has a GET handler', () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts', method: 'GET', collection: 'posts', type: 'list' }
    ]
    const map = buildGeneratedRouteMap(routes, '/fake/project')
    const methodMap = map.get('/posts')
    expect(methodMap).toBeDefined()
    expect(typeof methodMap?.get('GET')).toBe('function')
  })

  it('returns empty map for empty routes array', () => {
    const map = buildGeneratedRouteMap([], '/fake/project')
    expect(map.size).toBe(0)
  })

  it('serves JSON response when no HTML template exists', async () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts', method: 'GET', collection: 'posts', type: 'list' }
    ]
    const map = buildGeneratedRouteMap(routes, '/nonexistent/project/dir')
    const handler = map.get('/posts')?.get('GET')
    expect(handler).toBeDefined()

    const req = makeReq()
    const res = makeRes()
    await handler?.(req, res, {})

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': expect.stringContaining('application/json')
    }))
    expect(res.end).toHaveBeenCalled()
  })

  it('JSON response contains collection name and type', async () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts', method: 'GET', collection: 'posts', type: 'list' }
    ]
    const map = buildGeneratedRouteMap(routes, '/nonexistent/project/dir')
    const handler = map.get('/posts')?.get('GET')

    const req = makeReq()
    const res = makeRes()
    await handler?.(req, res, {})

    const body = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(body) as { collection: string, type: string }
    expect(parsed.collection).toBe('posts')
    expect(parsed.type).toBe('list')
  })

  it('JSON response for detail route includes params', async () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts/:id', method: 'GET', collection: 'posts', type: 'detail' }
    ]
    const map = buildGeneratedRouteMap(routes, '/nonexistent/project/dir')
    const handler = map.get('/posts/:id')?.get('GET')

    const req = makeReq()
    const res = makeRes()
    await handler?.(req, res, { id: '42' })

    const body = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(body) as { params: { id: string } }
    expect(parsed.params).toEqual({ id: '42' })
  })

  it('detects X-Valence-Fragment header and includes fragment flag in JSON', async () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts', method: 'GET', collection: 'posts', type: 'list' }
    ]
    const map = buildGeneratedRouteMap(routes, '/nonexistent/project/dir')
    const handler = map.get('/posts')?.get('GET')

    const req = makeReq({ headers: { 'x-valence-fragment': 'true' } })
    const res = makeRes()
    await handler?.(req, res, {})

    const body = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(body) as { fragment: boolean }
    expect(parsed.fragment).toBe(true)
  })

  it('fragment flag is false when X-Valence-Fragment header is absent', async () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts', method: 'GET', collection: 'posts', type: 'list' }
    ]
    const map = buildGeneratedRouteMap(routes, '/nonexistent/project/dir')
    const handler = map.get('/posts')?.get('GET')

    const req = makeReq()
    const res = makeRes()
    await handler?.(req, res, {})

    const body = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(body) as { fragment: boolean }
    expect(parsed.fragment).toBe(false)
  })

  it('handles multiple collections each getting their own entries', () => {
    const routes: readonly GeneratedRoute[] = [
      { path: '/posts', method: 'GET', collection: 'posts', type: 'list' },
      { path: '/posts/:id', method: 'GET', collection: 'posts', type: 'detail' },
      { path: '/authors', method: 'GET', collection: 'authors', type: 'list' },
      { path: '/authors/:id', method: 'GET', collection: 'authors', type: 'detail' }
    ]
    const map = buildGeneratedRouteMap(routes, '/nonexistent/project/dir')
    expect(map.size).toBe(4)
    expect(map.has('/authors')).toBe(true)
    expect(map.has('/authors/:id')).toBe(true)
  })
})
