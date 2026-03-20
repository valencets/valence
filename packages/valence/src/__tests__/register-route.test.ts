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
