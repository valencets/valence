import { describe, it, expect, vi } from 'vitest'
import { defineConfig } from '../define-config.js'
import type { ValenceConfig, RouteConfig } from '../define-config.js'
import { setOutletHeader, isFragmentRequest } from '../outlet-header.js'
import type { ServerResponse, IncomingMessage } from 'node:http'

const minimalConfig: ValenceConfig = {
  db: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'app',
    password: 'secret'
  },
  server: { port: 3000 },
  collections: []
}

describe('RouteConfig outlet and layout fields', () => {
  it('accepts route with outlet property', () => {
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/dashboard', outlet: 'main' }]
    })
    expect(result.isOk()).toBe(true)
  })

  it('accepts route with layout property', () => {
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/dashboard', layout: 'app-shell' }]
    })
    expect(result.isOk()).toBe(true)
  })

  it('accepts route with both outlet and layout', () => {
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/dashboard', outlet: 'content', layout: 'app-shell' }]
    })
    expect(result.isOk()).toBe(true)
  })

  it('passes outlet through to resolved config', () => {
    const routes: readonly RouteConfig[] = [
      { path: '/page', outlet: 'main' }
    ]
    const result = defineConfig({ ...minimalConfig, routes })
    const resolved = result.unwrap()
    expect(resolved.routes?.[0]?.outlet).toBe('main')
  })

  it('passes layout through to resolved config', () => {
    const routes: readonly RouteConfig[] = [
      { path: '/page', layout: 'app-shell' }
    ]
    const result = defineConfig({ ...minimalConfig, routes })
    const resolved = result.unwrap()
    expect(resolved.routes?.[0]?.layout).toBe('app-shell')
  })

  it('outlet defaults to undefined when not provided', () => {
    const routes: readonly RouteConfig[] = [
      { path: '/about' }
    ]
    const result = defineConfig({ ...minimalConfig, routes })
    const resolved = result.unwrap()
    expect(resolved.routes?.[0]?.outlet).toBeUndefined()
  })

  it('layout defaults to undefined when not provided', () => {
    const routes: readonly RouteConfig[] = [
      { path: '/about' }
    ]
    const result = defineConfig({ ...minimalConfig, routes })
    const resolved = result.unwrap()
    expect(resolved.routes?.[0]?.layout).toBeUndefined()
  })
})

describe('setOutletHeader', () => {
  function makeMockResponse (): ServerResponse {
    const headers: Record<string, string> = {}
    const res = {
      setHeader: vi.fn((name: string, value: string) => {
        headers[name] = value
      }),
      getHeader: vi.fn((name: string) => headers[name]),
      _headers: headers
    }
    return res as unknown as ServerResponse
  }

  it('sets X-Valence-Outlet header with the outlet name', () => {
    const res = makeMockResponse()
    setOutletHeader(res, 'main')
    expect(res.setHeader).toHaveBeenCalledWith('X-Valence-Outlet', 'main')
  })

  it('sets X-Valence-Outlet header with sidebar name', () => {
    const res = makeMockResponse()
    setOutletHeader(res, 'sidebar')
    expect(res.setHeader).toHaveBeenCalledWith('X-Valence-Outlet', 'sidebar')
  })

  it('does not set header when outlet is undefined', () => {
    const res = makeMockResponse()
    setOutletHeader(res, undefined)
    expect(res.setHeader).not.toHaveBeenCalled()
  })
})

describe('isFragmentRequest', () => {
  it('returns true when X-Valence-Fragment is 1', () => {
    const req = {
      headers: { 'x-valence-fragment': '1' }
    } as unknown as IncomingMessage
    expect(isFragmentRequest(req)).toBe(true)
  })

  it('returns false when X-Valence-Fragment is missing', () => {
    const req = {
      headers: {}
    } as unknown as IncomingMessage
    expect(isFragmentRequest(req)).toBe(false)
  })

  it('returns false when X-Valence-Fragment is not "1"', () => {
    const req = {
      headers: { 'x-valence-fragment': 'true' }
    } as unknown as IncomingMessage
    expect(isFragmentRequest(req)).toBe(false)
  })
})
