import { describe, it, expect, vi } from 'vitest'
import { buildCms } from '../config/cms-config.js'
import type { CmsConfig } from '../config/cms-config.js'
import type { Plugin } from '../config/plugin.js'
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

  it('admin routes work without auth when requireAuth is not set', async () => {
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
    // Should return 200 (renders dashboard), not redirect
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })
})
