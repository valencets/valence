import { describe, it, expect } from 'vitest'
import { collection } from '../schema/collection.js'
import type { AdminConfig } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('AdminConfig — displayField', () => {
  it('accepts displayField as a string', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title' }),
        field.text({ name: 'slug' })
      ],
      admin: {
        displayField: 'title'
      }
    })
    expect(posts.admin?.displayField).toBe('title')
  })

  it('preserves displayField through collection()', () => {
    const config = collection({
      slug: 'articles',
      fields: [
        field.text({ name: 'heading' }),
        field.text({ name: 'body' })
      ],
      admin: {
        displayField: 'heading'
      }
    })
    expect(config.admin?.displayField).toBe('heading')
  })

  it('allows AdminConfig without displayField (backward compat)', () => {
    const config = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      admin: {
        group: 'Content'
      }
    })
    expect(config.admin?.displayField).toBeUndefined()
  })

  it('allows AdminConfig with only displayField and no other props', () => {
    const adminConf: AdminConfig = {
      displayField: 'name'
    }
    expect(adminConf.displayField).toBe('name')
  })
})

describe('AdminConfig — listFields', () => {
  it('accepts listFields as a readonly string array', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title' }),
        field.text({ name: 'status' }),
        field.text({ name: 'author' })
      ],
      admin: {
        listFields: ['title', 'status', 'author']
      }
    })
    expect(posts.admin?.listFields).toEqual(['title', 'status', 'author'])
  })

  it('preserves listFields through collection()', () => {
    const config = collection({
      slug: 'pages',
      fields: [
        field.text({ name: 'title' }),
        field.text({ name: 'slug' }),
        field.boolean({ name: 'published' })
      ],
      admin: {
        listFields: ['title', 'slug']
      }
    })
    expect(config.admin?.listFields).toEqual(['title', 'slug'])
  })

  it('allows AdminConfig without listFields (backward compat)', () => {
    const config = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      admin: {
        hidden: true
      }
    })
    expect(config.admin?.listFields).toBeUndefined()
  })

  it('allows empty listFields array', () => {
    const adminConf: AdminConfig = {
      listFields: []
    }
    expect(adminConf.listFields).toEqual([])
  })

  it('allows AdminConfig with listFields alone', () => {
    const adminConf: AdminConfig = {
      listFields: ['name', 'email', 'createdAt']
    }
    expect(adminConf.listFields).toHaveLength(3)
    expect(adminConf.listFields?.[0]).toBe('name')
  })
})

describe('AdminConfig — combined displayField + listFields', () => {
  it('accepts both displayField and listFields together', () => {
    const config = collection({
      slug: 'members',
      fields: [
        field.text({ name: 'name' }),
        field.text({ name: 'email' }),
        field.text({ name: 'role' })
      ],
      admin: {
        displayField: 'name',
        listFields: ['name', 'email', 'role']
      }
    })
    expect(config.admin?.displayField).toBe('name')
    expect(config.admin?.listFields).toEqual(['name', 'email', 'role'])
  })

  it('accepts displayField + listFields alongside existing admin props', () => {
    const config = collection({
      slug: 'products',
      fields: [
        field.text({ name: 'title' }),
        field.text({ name: 'sku' }),
        field.text({ name: 'price' })
      ],
      admin: {
        group: 'Catalog',
        hidden: false,
        position: 1,
        displayField: 'title',
        listFields: ['title', 'sku', 'price']
      }
    })
    expect(config.admin?.group).toBe('Catalog')
    expect(config.admin?.displayField).toBe('title')
    expect(config.admin?.listFields).toEqual(['title', 'sku', 'price'])
  })
})

describe('AdminConfig — backward compatibility', () => {
  it('existing config with only group/hidden/position still works', () => {
    const config = collection({
      slug: 'legacy',
      fields: [field.text({ name: 'title' })],
      admin: {
        group: 'Old',
        hidden: false,
        position: 2
      }
    })
    expect(config.admin?.group).toBe('Old')
    expect(config.admin?.hidden).toBe(false)
    expect(config.admin?.position).toBe(2)
  })

  it('collection without admin property still works', () => {
    const config = collection({
      slug: 'bare',
      fields: [field.text({ name: 'title' })]
    })
    expect(config.admin).toBeUndefined()
  })
})
