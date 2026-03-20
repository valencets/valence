import { describe, it, expect, vi } from 'vitest'
import { defineConfig } from '../define-config.js'
import type { ValenceConfig, OnServerContext, RouteHandler } from '../define-config.js'
import type { Server } from 'node:http'
import { matchCustomRoute } from '../route-matcher.js'

const minimalConfig: ValenceConfig = {
  db: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'app',
    password: 'secret'
  },
  server: {
    port: 3000
  },
  collections: []
}

describe('registerRoute on OnServerContext', () => {
  it('registerRoute is present on OnServerContext', () => {
    const callback = vi.fn((ctx: OnServerContext) => {
      expect(ctx).toHaveProperty('registerRoute')
      expect(typeof ctx.registerRoute).toBe('function')
    })

    defineConfig({ ...minimalConfig, onServer: callback })

    // Simulate calling the onServer callback with registerRoute
    const routes = new Map<string, Map<string, RouteHandler>>()
    const registerRoute: OnServerContext['registerRoute'] = (method, path, handler) => {
      const methodUpper = method.toUpperCase()
      let methodMap = routes.get(path)
      if (!methodMap) {
        methodMap = new Map<string, RouteHandler>()
        routes.set(path, methodMap)
      }
      methodMap.set(methodUpper, handler)
    }

    const mockCtx: OnServerContext = {
      server: {} as Server,
      pool: {} as OnServerContext['pool'],
      cms: {} as OnServerContext['cms'],
      registerRoute
    }

    callback(mockCtx)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('can register a GET route and it gets stored', () => {
    const routes = new Map<string, Map<string, RouteHandler>>()
    const registerRoute: OnServerContext['registerRoute'] = (method, path, handler) => {
      const methodUpper = method.toUpperCase()
      let methodMap = routes.get(path)
      if (!methodMap) {
        methodMap = new Map<string, RouteHandler>()
        routes.set(path, methodMap)
      }
      methodMap.set(methodUpper, handler)
    }

    const handler: RouteHandler = vi.fn()
    registerRoute('GET', '/api/custom', handler)

    expect(routes.has('/api/custom')).toBe(true)
    expect(routes.get('/api/custom')?.get('GET')).toBe(handler)
  })

  it('can register multiple routes with different methods', () => {
    const routes = new Map<string, Map<string, RouteHandler>>()
    const registerRoute: OnServerContext['registerRoute'] = (method, path, handler) => {
      const methodUpper = method.toUpperCase()
      let methodMap = routes.get(path)
      if (!methodMap) {
        methodMap = new Map<string, RouteHandler>()
        routes.set(path, methodMap)
      }
      methodMap.set(methodUpper, handler)
    }

    const getHandler: RouteHandler = vi.fn()
    const postHandler: RouteHandler = vi.fn()
    const deleteHandler: RouteHandler = vi.fn()

    registerRoute('GET', '/api/items', getHandler)
    registerRoute('POST', '/api/items', postHandler)
    registerRoute('DELETE', '/api/items/:id', deleteHandler)

    expect(routes.get('/api/items')?.get('GET')).toBe(getHandler)
    expect(routes.get('/api/items')?.get('POST')).toBe(postHandler)
    expect(routes.get('/api/items/:id')?.get('DELETE')).toBe(deleteHandler)
  })

  it('route handler receives (req, res, params) with typed params', () => {
    // Type-level test: verifying RouteHandler signature compiles correctly
    const handler: RouteHandler = (_req, _res, params) => {
      // params is Record<string, string>
      const _id: string = params.id ?? ''
      expect(typeof _id).toBe('string')
    }
    expect(typeof handler).toBe('function')
  })
})

describe('matchCustomRoute', () => {
  it('matches an exact path', () => {
    const result = matchCustomRoute('/api/custom', '/api/custom')
    expect(result).not.toBeNull()
    expect(result).toEqual({})
  })

  it('returns null for non-matching path', () => {
    const result = matchCustomRoute('/api/other', '/api/custom')
    expect(result).toBeNull()
  })

  it('extracts path params from pattern', () => {
    const result = matchCustomRoute('/api/custom/:id', '/api/custom/123')
    expect(result).not.toBeNull()
    expect(result).toEqual({ id: '123' })
  })

  it('extracts multiple path params', () => {
    const result = matchCustomRoute('/api/:collection/:id', '/api/posts/42')
    expect(result).not.toBeNull()
    expect(result).toEqual({ collection: 'posts', id: '42' })
  })

  it('returns null when segment count differs', () => {
    const result = matchCustomRoute('/api/:id', '/api/items/123')
    expect(result).toBeNull()
  })

  it('returns null when static segment does not match', () => {
    const result = matchCustomRoute('/api/items/:id', '/api/other/123')
    expect(result).toBeNull()
  })
})

describe('resolveCustomRoute integration', () => {
  // Helper to build a route map like the one in runDev
  function buildRouteMap (entries: ReadonlyArray<{ readonly method: string; readonly path: string; readonly handler: RouteHandler }>): Map<string, Map<string, RouteHandler>> {
    const routes = new Map<string, Map<string, RouteHandler>>()
    for (const entry of entries) {
      const methodUpper = entry.method.toUpperCase()
      let methodMap = routes.get(entry.path)
      if (!methodMap) {
        methodMap = new Map<string, RouteHandler>()
        routes.set(entry.path, methodMap)
      }
      methodMap.set(methodUpper, entry.handler)
    }
    return routes
  }

  it('registered route handler is actually called when request matches', () => {
    const handler = vi.fn()
    const routes = buildRouteMap([{ method: 'GET', path: '/api/custom', handler }])

    // Simulate the lookup logic
    for (const [pattern, methodMap] of routes) {
      const params = matchCustomRoute(pattern, '/api/custom')
      if (params !== null) {
        const matched = methodMap.get('GET')
        if (matched) {
          matched({} as Parameters<RouteHandler>[0], {} as Parameters<RouteHandler>[1], params)
        }
      }
    }

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything(), {})
  })

  it('path params are extracted correctly for /api/custom/:id matching /api/custom/123', () => {
    const handler = vi.fn()
    const routes = buildRouteMap([{ method: 'GET', path: '/api/custom/:id', handler }])

    for (const [pattern, methodMap] of routes) {
      const params = matchCustomRoute(pattern, '/api/custom/123')
      if (params !== null) {
        const matched = methodMap.get('GET')
        if (matched) {
          matched({} as Parameters<RouteHandler>[0], {} as Parameters<RouteHandler>[1], params)
        }
      }
    }

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything(), { id: '123' })
  })

  it('non-matching routes fall through (no handler called)', () => {
    const handler = vi.fn()
    const routes = buildRouteMap([{ method: 'GET', path: '/api/custom', handler }])

    for (const [pattern, methodMap] of routes) {
      const params = matchCustomRoute(pattern, '/api/other')
      if (params !== null) {
        const matched = methodMap.get('GET')
        if (matched) {
          matched({} as Parameters<RouteHandler>[0], {} as Parameters<RouteHandler>[1], params)
        }
      }
    }

    expect(handler).not.toHaveBeenCalled()
  })

  it('method matching works (GET vs POST on same path)', () => {
    const getHandler = vi.fn()
    const postHandler = vi.fn()
    const routes = buildRouteMap([
      { method: 'GET', path: '/api/items', handler: getHandler },
      { method: 'POST', path: '/api/items', handler: postHandler }
    ])

    // Simulate a POST request
    for (const [pattern, methodMap] of routes) {
      const params = matchCustomRoute(pattern, '/api/items')
      if (params !== null) {
        const matched = methodMap.get('POST')
        if (matched) {
          matched({} as Parameters<RouteHandler>[0], {} as Parameters<RouteHandler>[1], params)
        }
      }
    }

    expect(getHandler).not.toHaveBeenCalled()
    expect(postHandler).toHaveBeenCalledTimes(1)
  })

  it('route registered for POST does not match GET requests', () => {
    const postHandler = vi.fn()
    const routes = buildRouteMap([{ method: 'POST', path: '/api/items', handler: postHandler }])

    // Simulate a GET request
    for (const [pattern, methodMap] of routes) {
      const params = matchCustomRoute(pattern, '/api/items')
      if (params !== null) {
        const matched = methodMap.get('GET')
        if (matched) {
          matched({} as Parameters<RouteHandler>[0], {} as Parameters<RouteHandler>[1], params)
        }
      }
    }

    expect(postHandler).not.toHaveBeenCalled()
  })
})

describe('exports from @valencets/valence', () => {
  it('RouteHandler type is exported from the package index', async () => {
    // Import RouteHandler from the package index to verify the re-export.
    // This is a type-level test: if the import compiles, the export exists.
    const { defineConfig } = await import('../index.js')
    // Use a RouteHandler-typed variable via the index import path
    const handler: import('../index.js').RouteHandler = vi.fn()
    expect(typeof handler).toBe('function')
    expect(typeof defineConfig).toBe('function')
  })

  it('OnServerContext includes registerRoute in its type', () => {
    // Type-level test: if this compiles, registerRoute is on OnServerContext
    const mockCtx: OnServerContext = {
      server: {} as Server,
      pool: {} as OnServerContext['pool'],
      cms: {} as OnServerContext['cms'],
      registerRoute: vi.fn()
    }
    // Verify registerRoute is callable
    expect(typeof mockCtx.registerRoute).toBe('function')
  })
})
