import { describe, it, expect } from 'vitest'
import { collection } from '../schema/collection.js'
import type { AdminConfig } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('AdminConfig on collection()', () => {
  it('accepts admin config with group, hidden, and position', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      admin: {
        group: 'Content',
        hidden: false,
        position: 1
      }
    })
    expect(posts.admin?.group).toBe('Content')
    expect(posts.admin?.hidden).toBe(false)
    expect(posts.admin?.position).toBe(1)
  })

  it('admin config is optional (backward compat)', () => {
    const pages = collection({
      slug: 'pages',
      fields: [field.text({ name: 'title' })]
    })
    expect(pages.admin).toBeUndefined()
  })

  it('all three admin properties are independently optional', () => {
    const groupOnly = collection({
      slug: 'a',
      fields: [field.text({ name: 'title' })],
      admin: { group: 'Content' }
    })
    expect(groupOnly.admin?.group).toBe('Content')
    expect(groupOnly.admin?.hidden).toBeUndefined()
    expect(groupOnly.admin?.position).toBeUndefined()

    const hiddenOnly = collection({
      slug: 'b',
      fields: [field.text({ name: 'title' })],
      admin: { hidden: true }
    })
    expect(hiddenOnly.admin?.hidden).toBe(true)
    expect(hiddenOnly.admin?.group).toBeUndefined()
    expect(hiddenOnly.admin?.position).toBeUndefined()

    const positionOnly = collection({
      slug: 'c',
      fields: [field.text({ name: 'title' })],
      admin: { position: 5 }
    })
    expect(positionOnly.admin?.position).toBe(5)
    expect(positionOnly.admin?.group).toBeUndefined()
    expect(positionOnly.admin?.hidden).toBeUndefined()
  })

  it('AdminConfig type is importable', () => {
    const config: AdminConfig = { group: 'Settings', hidden: true, position: 10 }
    expect(config.group).toBe('Settings')
  })
})
