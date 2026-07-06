import { describe, it, expect, vi, beforeEach } from 'vitest'
import { regenerateFromConfig } from '../codegen/regenerate.js'
import { collection, field } from '@valencets/cms'
import { field as storeField } from '@valencets/store'
import { join } from 'node:path'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (path: string) => {
    if (String(path).endsWith('types.ts') || String(path).endsWith('client.ts') || String(path).endsWith('base-client.ts')) {
      return '// @generated — regenerated from valence.config.ts. DO NOT EDIT.'
    }
    throw new Error('ENOENT')
  })
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    // Simulate that entity dirs already exist for 'posts'
    return String(path).includes('entities/posts')
  })
}))

const { writeFile } = await import('node:fs/promises')
const mockedWriteFile = vi.mocked(writeFile)

describe('regenerateFromConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('regenerates @generated type and client files', async () => {
    const collections = [
      collection({
        slug: 'posts',
        fields: [
          field.text({ name: 'title', required: true }),
          field.slug({ name: 'slug', required: true })
        ]
      })
    ]

    const result = await regenerateFromConfig('/tmp/project', collections)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.updated.length).toBeGreaterThan(0)
    }
  })

  it('skips user-edited files (no @generated marker)', async () => {
    const { readFile } = await import('node:fs/promises')
    const mockedReadFile = vi.mocked(readFile)
    // Override to return user content for types.ts
    mockedReadFile.mockImplementation(async (path: string) => {
      if (String(path).includes('types.ts')) {
        return '// Custom user types - do not overwrite'
      }
      return '// @generated — regenerated from valence.config.ts. DO NOT EDIT.'
    })

    const collections = [
      collection({
        slug: 'posts',
        fields: [field.text({ name: 'title', required: true })]
      })
    ]

    const result = await regenerateFromConfig('/tmp/project', collections)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.skipped.length).toBeGreaterThan(0)
    }
  })

  it('regenerates shared base-client.ts', async () => {
    const collections = [
      collection({
        slug: 'posts',
        fields: [field.text({ name: 'title', required: true })]
      })
    ]

    await regenerateFromConfig('/tmp/project', collections)

    const baseClientWrite = mockedWriteFile.mock.calls.find(
      c => String(c[0]).includes('base-client.ts')
    )
    expect(baseClientWrite).toBeDefined()
  })

  it('skips auth collections for entity generation', async () => {
    const collections = [
      collection({
        slug: 'users',
        auth: true,
        fields: [field.text({ name: 'name', required: true })]
      })
    ]

    const result = await regenerateFromConfig('/tmp/project', collections)
    expect(result.isOk()).toBe(true)

    const userEntityWrite = mockedWriteFile.mock.calls.find(
      c => String(c[0]).includes('entities/users')
    )
    expect(userEntityWrite).toBeUndefined()
  })
})

describe('store module regeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes a generated typed module per store under src/shared/stores', async () => {
    const stores = [{
      slug: 'cart',
      scope: 'session' as const,
      fields: [storeField.number({ name: 'count', default: 0 })],
      mutations: {
        increment: {
          input: [storeField.number({ name: 'amount' })],
          server: async () => {}
        }
      }
    }]

    const result = await regenerateFromConfig('/tmp/project', [], stores)
    expect(result.isOk()).toBe(true)

    const storeWrite = mockedWriteFile.mock.calls.find(
      c => String(c[0]).includes(join('shared', 'stores', 'cart.ts'))
    )
    expect(storeWrite).toBeDefined()
    const content = String(storeWrite![1])
    expect(content.startsWith('// @generated')).toBe(true)
    expect(content).toContain('createCartStore')
    expect(content).toContain('CartState')
  })

  it('skips invalid store definitions without failing the run', async () => {
    const stores = [{
      slug: 'Bad Slug',
      scope: 'session' as const,
      fields: [storeField.number({ name: 'count', default: 0 })],
      mutations: {}
    }]

    const result = await regenerateFromConfig('/tmp/project', [], stores)
    expect(result.isOk()).toBe(true)

    const storeWrite = mockedWriteFile.mock.calls.find(
      c => String(c[0]).includes(join('shared', 'stores'))
    )
    expect(storeWrite).toBeUndefined()
  })

  it('generates nothing store-related when stores are omitted', async () => {
    const collections = [
      collection({
        slug: 'posts',
        fields: [field.text({ name: 'title', required: true })]
      })
    ]

    const result = await regenerateFromConfig('/tmp/project', collections)
    expect(result.isOk()).toBe(true)

    const storeWrite = mockedWriteFile.mock.calls.find(
      c => String(c[0]).includes(join('shared', 'stores'))
    )
    expect(storeWrite).toBeUndefined()
  })
})
