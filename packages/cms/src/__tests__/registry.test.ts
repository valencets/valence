import { describe, it, expect } from 'vitest'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { global } from '../schema/global.js'
import { field } from '../schema/fields.js'
import { CmsErrorCode } from '../schema/types.js'

describe('CollectionRegistry', () => {
  it('registers and retrieves a collection', () => {
    const registry = createCollectionRegistry()
    const pages = collection({
      slug: 'pages',
      fields: [field.text({ name: 'title' })]
    })
    const result = registry.register(pages)
    expect(result.isOk()).toBe(true)

    const found = registry.get('pages')
    expect(found.isOk()).toBe(true)
    expect(found.unwrap().slug).toBe('pages')
  })

  it('returns DUPLICATE_SLUG when registering the same slug twice', () => {
    const registry = createCollectionRegistry()
    const pages = collection({
      slug: 'pages',
      fields: [field.text({ name: 'title' })]
    })
    registry.register(pages)
    const result = registry.register(pages)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.DUPLICATE_SLUG)
  })

  it('returns NOT_FOUND for unknown slug', () => {
    const registry = createCollectionRegistry()
    const result = registry.get('nonexistent')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.NOT_FOUND)
  })

  it('returns all registered collections', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({ slug: 'pages', fields: [field.text({ name: 'title' })] }))
    registry.register(collection({ slug: 'posts', fields: [field.text({ name: 'title' })] }))
    const all = registry.getAll()
    expect(all).toHaveLength(2)
    const slugs = all.map(c => c.slug)
    expect(slugs).toContain('pages')
    expect(slugs).toContain('posts')
  })

  it('has() returns true for registered, false for unknown', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({ slug: 'pages', fields: [field.text({ name: 'title' })] }))
    expect(registry.has('pages')).toBe(true)
    expect(registry.has('nope')).toBe(false)
  })
})

describe('GlobalRegistry', () => {
  it('registers and retrieves a global', () => {
    const registry = createGlobalRegistry()
    const settings = global({
      slug: 'site-settings',
      fields: [field.text({ name: 'siteName' })]
    })
    const result = registry.register(settings)
    expect(result.isOk()).toBe(true)

    const found = registry.get('site-settings')
    expect(found.isOk()).toBe(true)
    expect(found.unwrap().slug).toBe('site-settings')
  })

  it('returns DUPLICATE_SLUG for duplicate global slug', () => {
    const registry = createGlobalRegistry()
    const settings = global({ slug: 'settings', fields: [] })
    registry.register(settings)
    const result = registry.register(settings)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.DUPLICATE_SLUG)
  })

  it('returns NOT_FOUND for unknown slug', () => {
    const registry = createGlobalRegistry()
    const result = registry.get('nope')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.NOT_FOUND)
  })

  it('getAll returns all registered globals', () => {
    const registry = createGlobalRegistry()
    registry.register(global({ slug: 'nav', fields: [] }))
    registry.register(global({ slug: 'footer', fields: [] }))
    expect(registry.getAll()).toHaveLength(2)
  })
})
