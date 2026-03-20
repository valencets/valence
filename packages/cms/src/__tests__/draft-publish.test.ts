import { describe, it, expect } from 'vitest'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { StatusCode } from '../schema/types.js'

describe('StatusCode', () => {
  it('has draft and published values', () => {
    expect(StatusCode.DRAFT).toBe('draft')
    expect(StatusCode.PUBLISHED).toBe('published')
  })

  it('is frozen', () => {
    expect(Object.isFrozen(StatusCode)).toBe(true)
  })
})

describe('collection() with versions', () => {
  it('accepts versions config with drafts enabled', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title', required: true })],
      versions: { drafts: true }
    })
    expect(posts.versions?.drafts).toBe(true)
  })

  it('accepts versions config with maxPerDoc', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: true, maxPerDoc: 10 }
    })
    expect(posts.versions?.maxPerDoc).toBe(10)
  })

  it('allows omitting versions (non-versioned collection)', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(posts.versions).toBeUndefined()
  })
})
