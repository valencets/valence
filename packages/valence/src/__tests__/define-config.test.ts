import { describe, it, expect } from 'vitest'
import { defineConfig } from '../define-config.js'
import type { ValenceConfig } from '../define-config.js'

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

describe('defineConfig', () => {
  it('returns Ok for minimal valid config', () => {
    const result = defineConfig(minimalConfig)
    expect(result.isOk()).toBe(true)
  })

  it('resolved config has db pool settings with defaults', () => {
    const result = defineConfig(minimalConfig)
    const resolved = result._unsafeUnwrap()
    expect(resolved.db.max).toBe(10)
    expect(resolved.db.idle_timeout).toBe(30)
    expect(resolved.db.connect_timeout).toBe(10)
  })

  it('resolved config has server host defaulting to 0.0.0.0', () => {
    const result = defineConfig(minimalConfig)
    const resolved = result._unsafeUnwrap()
    expect(resolved.server.host).toBe('0.0.0.0')
  })

  it('returns Err for missing db', () => {
    const result = defineConfig({ server: { port: 3000 }, collections: [] } as never)
    expect(result.isErr()).toBe(true)
  })

  it('returns Err for missing server', () => {
    const result = defineConfig({
      db: { host: 'localhost', port: 5432, database: 'x', username: 'x', password: 'x' },
      collections: []
    } as never)
    expect(result.isErr()).toBe(true)
  })

  it('accepts optional telemetry config', () => {
    const result = defineConfig({
      ...minimalConfig,
      telemetry: {
        enabled: true,
        endpoint: '/api/telemetry',
        siteId: 'my-site'
      }
    })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().telemetry?.enabled).toBe(true)
  })

  it('accepts optional admin config', () => {
    const result = defineConfig({
      ...minimalConfig,
      admin: {
        pathPrefix: '/admin',
        requireAuth: true
      }
    })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().admin?.pathPrefix).toBe('/admin')
  })

  it('accepts optional media config', () => {
    const result = defineConfig({
      ...minimalConfig,
      media: {
        uploadDir: './uploads',
        maxUploadBytes: 10_000_000
      }
    })
    expect(result.isOk()).toBe(true)
  })

  it('returns Err for invalid server port', () => {
    const result = defineConfig({
      ...minimalConfig,
      server: { port: 0 }
    })
    expect(result.isErr()).toBe(true)
  })

  it('passes through collections array', () => {
    const result = defineConfig(minimalConfig)
    expect(result._unsafeUnwrap().collections).toEqual([])
  })

  it('defaults telemetry to undefined when not provided', () => {
    const result = defineConfig(minimalConfig)
    expect(result._unsafeUnwrap().telemetry).toBeUndefined()
  })
})

describe('defineConfig collection validation', () => {
  it('rejects invalid collection slug', () => {
    const result = defineConfig({
      ...minimalConfig,
      collections: [
        { slug: 'Bad Slug', fields: [], timestamps: true }
      ]
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
    }
  })

  it('rejects duplicate collection slugs', () => {
    const result = defineConfig({
      ...minimalConfig,
      collections: [
        { slug: 'posts', fields: [], timestamps: true },
        { slug: 'posts', fields: [], timestamps: true }
      ]
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('DUPLICATE_COLLECTION_SLUG')
    }
  })

  it('rejects slugFrom referencing non-existent field', () => {
    const result = defineConfig({
      ...minimalConfig,
      collections: [
        {
          slug: 'posts',
          fields: [
            { type: 'slug' as const, name: 'slug', slugFrom: 'missing-field' }
          ],
          timestamps: true
        }
      ]
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_SLUG_FROM')
    }
  })

  it('accepts valid collection with proper slug and slugFrom', () => {
    const result = defineConfig({
      ...minimalConfig,
      collections: [
        {
          slug: 'blog-posts',
          fields: [
            { type: 'text' as const, name: 'title' },
            { type: 'slug' as const, name: 'slug', slugFrom: 'title' }
          ],
          timestamps: true
        }
      ]
    })
    expect(result.isOk()).toBe(true)
  })
})
