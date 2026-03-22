import { describe, it, expect, vi } from 'vitest'
import { buildCms } from '../config/cms-config.js'
import type { CmsConfig } from '../config/cms-config.js'
import type { Plugin, PluginObject } from '../config/plugin.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { global } from '../schema/global.js'
import { makeMockPool } from './test-helpers.js'

describe('buildCms()', () => {
  it('returns Ok with CmsInstance', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({
          slug: 'posts',
          fields: [field.text({ name: 'title', required: true })]
        })
      ]
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
    const cms = result._unsafeUnwrap()
    expect(cms.api).toBeDefined()
    expect(cms.collections.has('posts')).toBe(true)
  })

  it('registers globals', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [],
      globals: [
        global({ slug: 'site-settings', fields: [field.text({ name: 'siteName' })] })
      ]
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().globals.has('site-settings')).toBe(true)
  })

  it('returns Err on duplicate collection slug', () => {
    const posts = collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [posts, posts]
    }
    const result = buildCms(config)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('DUPLICATE_SLUG')
  })

  it('auto-injects auth fields on auth-enabled collections', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'users', auth: true, fields: [field.text({ name: 'name' })] })
      ]
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
    const cms = result._unsafeUnwrap()
    const users = cms.collections.get('users')
    expect(users.isOk()).toBe(true)
    const fieldNames = users._unsafeUnwrap().fields.map(f => f.name)
    expect(fieldNames).toContain('email')
    expect(fieldNames).toContain('password_hash')
  })

  it('applies plugins in order', () => {
    const calls: number[] = []
    const plugin1: Plugin = (cfg) => { calls.push(1); return cfg }
    const plugin2: Plugin = (cfg) => { calls.push(2); return cfg }
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [],
      plugins: [plugin1, plugin2]
    }
    buildCms(config)
    expect(calls).toEqual([1, 2])
  })

  it('plugins can add collections', () => {
    const addPagesPlugin: Plugin = (cfg) => ({
      ...cfg,
      collections: [
        ...cfg.collections,
        collection({ slug: 'pages', fields: [field.text({ name: 'title' })] })
      ]
    })
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ],
      plugins: [addPagesPlugin]
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
    const cms = result._unsafeUnwrap()
    expect(cms.collections.has('posts')).toBe(true)
    expect(cms.collections.has('pages')).toBe(true)
  })

  it('accepts object plugins with name and transform', () => {
    const plugin: PluginObject = {
      name: 'add-pages',
      transform: (cfg) => ({
        ...cfg,
        collections: [
          ...cfg.collections,
          collection({ slug: 'pages', fields: [field.text({ name: 'title' })] })
        ]
      })
    }
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ],
      plugins: [plugin]
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
    const cms = result._unsafeUnwrap()
    expect(cms.collections.has('posts')).toBe(true)
    expect(cms.collections.has('pages')).toBe(true)
  })

  it('mixes function and object plugins in order', () => {
    const calls: string[] = []
    const fnPlugin: Plugin = (cfg) => { calls.push('fn'); return cfg }
    const objPlugin: PluginObject = {
      name: 'obj-plugin',
      transform: (cfg) => { calls.push('obj'); return cfg }
    }
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [],
      plugins: [fnPlugin, objPlugin]
    }
    buildCms(config)
    expect(calls).toEqual(['fn', 'obj'])
  })

  it('collects hooks from object plugins', () => {
    const onInit = vi.fn()
    const onReady = vi.fn()
    const plugin: PluginObject = {
      name: 'lifecycle-plugin',
      transform: (cfg) => cfg,
      hooks: { onInit, onReady }
    }
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [],
      plugins: [plugin]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.pluginHooks).toHaveLength(1)
    expect(cms.pluginHooks[0]?.onInit).toBe(onInit)
    expect(cms.pluginHooks[0]?.onReady).toBe(onReady)
  })

  it('skips hooks for object plugins without hooks', () => {
    const plugin: PluginObject = {
      name: 'no-hooks',
      transform: (cfg) => cfg
    }
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [],
      plugins: [plugin]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.pluginHooks).toHaveLength(0)
  })

  it('returns empty pluginHooks when no plugins configured', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: []
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.pluginHooks).toHaveLength(0)
  })

  it('collects hooks from multiple object plugins in order', () => {
    const hooks1 = { onInit: vi.fn() }
    const hooks2 = { onReady: vi.fn() }
    const plugin1: PluginObject = { name: 'p1', transform: (cfg) => cfg, hooks: hooks1 }
    const plugin2: PluginObject = { name: 'p2', transform: (cfg) => cfg, hooks: hooks2 }
    const fnPlugin: Plugin = (cfg) => cfg
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [],
      plugins: [plugin1, fnPlugin, plugin2]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.pluginHooks).toHaveLength(2)
    expect(cms.pluginHooks[0]?.onInit).toBe(hooks1.onInit)
    expect(cms.pluginHooks[1]?.onReady).toBe(hooks2.onReady)
  })
})

describe('CmsInstance', () => {
  it('exposes restRoutes', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.restRoutes).toBeDefined()
    expect(cms.restRoutes.has('/api/posts')).toBe(true)
  })

  it('exposes adminRoutes', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.adminRoutes).toBeDefined()
    expect(cms.adminRoutes.has('/admin')).toBe(true)
  })

  it('registers auth routes when auth collection exists', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'users', auth: true, fields: [field.text({ name: 'name' })] })
      ]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.restRoutes.has('/api/users/login')).toBe(true)
    expect(cms.restRoutes.has('/api/users/logout')).toBe(true)
    expect(cms.restRoutes.has('/api/users/me')).toBe(true)
  })

  it('registers media routes when upload config provided', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'media', upload: true, fields: [field.text({ name: 'alt' })] })
      ],
      uploadDir: '/tmp/uploads'
    }
    const cms = buildCms(config)._unsafeUnwrap()
    expect(cms.restRoutes.has('/media/upload')).toBe(true)
    expect(cms.restRoutes.has('/media/:filename')).toBe(true)
  })
})

describe('buildCms() requireAuth forwarding', () => {
  it('forwards requireAuth to admin routes so handlers check session', async () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      requireAuth: true,
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    const handler = cms.adminRoutes.get('/admin')?.GET
    expect(handler).toBeDefined()

    const req = { headers: {}, url: '/admin', method: 'GET' }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: '/admin/login' })
  })

  it('admin routes require auth by default when requireAuth is not set', async () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    const handler = cms.adminRoutes.get('/admin')?.GET
    expect(handler).toBeDefined()

    const req = { headers: {}, url: '/admin', method: 'GET' }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => {}),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    // Default is auth-required: unauthenticated requests redirect to login
    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: '/admin/login' })
  })

  it('admin routes allow open access when requireAuth is explicitly false', async () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      requireAuth: false,
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    const handler = cms.adminRoutes.get('/admin')?.GET
    expect(handler).toBeDefined()

    const req = { headers: {}, url: '/admin', method: 'GET' }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => {}),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    // Explicit requireAuth: false should allow open access
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })
})
