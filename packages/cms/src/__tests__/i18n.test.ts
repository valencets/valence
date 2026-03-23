import { describe, it, expect } from 'vitest'
import { buildCms } from '../config/cms-config.js'
import type { CmsConfig } from '../config/cms-config.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

describe('localization config', () => {
  it('accepts valid localization config', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ],
      localization: {
        defaultLocale: 'en',
        locales: [
          { code: 'en', label: 'English' },
          { code: 'es', label: 'Spanish' }
        ]
      }
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
  })

  it('rejects when defaultLocale is not in locales array', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ],
      localization: {
        defaultLocale: 'fr',
        locales: [
          { code: 'en', label: 'English' },
          { code: 'es', label: 'Spanish' }
        ]
      }
    }
    const result = buildCms(config)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_INPUT')
    expect(result.unwrapErr().message).toContain('defaultLocale')
  })

  it('rejects when locales array is empty', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ],
      localization: {
        defaultLocale: 'en',
        locales: []
      }
    }
    const result = buildCms(config)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('INVALID_INPUT')
  })

  it('works without localization config (optional)', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ]
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
  })

  it('accepts fallback option', () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      ],
      localization: {
        defaultLocale: 'en',
        locales: [
          { code: 'en', label: 'English' },
          { code: 'es', label: 'Spanish' }
        ],
        fallback: true
      }
    }
    const result = buildCms(config)
    expect(result.isOk()).toBe(true)
  })
})
