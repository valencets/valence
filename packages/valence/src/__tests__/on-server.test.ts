import { describe, it, expect, vi } from 'vitest'
import { defineConfig } from '../define-config.js'
import type { ValenceConfig, OnServerContext } from '../define-config.js'
import type { Server } from 'node:http'

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

describe('onServer callback in defineConfig', () => {
  it('accepts a config without onServer and resolves successfully', () => {
    const result = defineConfig(minimalConfig)
    expect(result.isOk()).toBe(true)
  })

  it('accepts a config with a sync onServer callback and resolves successfully', () => {
    const callback = vi.fn((_ctx: OnServerContext) => undefined)
    const result = defineConfig({ ...minimalConfig, onServer: callback })
    expect(result.isOk()).toBe(true)
  })

  it('accepts a config with an async onServer callback and resolves successfully', () => {
    const callback = vi.fn(async (_ctx: OnServerContext): Promise<void> => {
      await Promise.resolve()
    })
    const result = defineConfig({ ...minimalConfig, onServer: callback })
    expect(result.isOk()).toBe(true)
  })

  it('preserves the onServer callback in the resolved config', () => {
    const callback = vi.fn((_ctx: OnServerContext) => undefined)
    const result = defineConfig({ ...minimalConfig, onServer: callback })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().onServer).toBe(callback)
  })

  it('resolved config has onServer as undefined when not provided', () => {
    const result = defineConfig(minimalConfig)
    expect(result.unwrap().onServer).toBeUndefined()
  })

  it('onServer callback receives the expected context shape when called', () => {
    const callback = vi.fn((_ctx: OnServerContext) => undefined)
    defineConfig({ ...minimalConfig, onServer: callback })

    // The callback is preserved in config — simulate calling it with a mock context
    // to verify it accepts the correct shape
    const mockServer = {} as Server
    const mockPool = {} as OnServerContext['pool']
    const mockCms = {} as OnServerContext['cms']

    const mockRegisterRoute = vi.fn()
    callback({ server: mockServer, pool: mockPool, cms: mockCms, registerRoute: mockRegisterRoute })

    expect(callback).toHaveBeenCalledWith({
      server: mockServer,
      pool: mockPool,
      cms: mockCms,
      registerRoute: mockRegisterRoute
    })
  })

  it('async onServer callback can be awaited', async () => {
    let resolved = false
    const callback = async (_ctx: OnServerContext): Promise<void> => {
      await Promise.resolve()
      resolved = true
    }

    const result = defineConfig({ ...minimalConfig, onServer: callback })
    const resolvedConfig = result.unwrap()

    const mockServer = {} as Server
    const mockPool = {} as OnServerContext['pool']
    const mockCms = {} as OnServerContext['cms']

    // Ensure we can await the callback
    await resolvedConfig.onServer?.({ server: mockServer, pool: mockPool, cms: mockCms, registerRoute: vi.fn() })
    expect(resolved).toBe(true)
  })
})

describe('OnServerContext type', () => {
  it('OnServerContext is exported from define-config', async () => {
    // Type-level test: if the import at the top of this file compiles,
    // OnServerContext is exported. We do a runtime check via a structural assertion.
    const mockCtx: OnServerContext = {
      server: {} as Server,
      pool: {} as OnServerContext['pool'],
      cms: {} as OnServerContext['cms'],
      registerRoute: vi.fn()
    }
    expect(mockCtx).toHaveProperty('server')
    expect(mockCtx).toHaveProperty('pool')
    expect(mockCtx).toHaveProperty('cms')
  })
})
