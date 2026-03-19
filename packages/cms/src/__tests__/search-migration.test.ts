import { describe, it, expect } from 'vitest'
import { generateSearchMigration } from '../db/search-migration.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('generateSearchMigration()', () => {
  it('generates ALTER TABLE with search_vector column', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.richtext({ name: 'body' })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('ALTER TABLE "posts"')
    expect(sql).toContain('search_vector TSVECTOR')
  })

  it('generates GIN index on search_vector', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('CREATE INDEX')
    expect(sql).toContain('USING GIN')
    expect(sql).toContain('search_vector')
  })

  it('generates trigger function that concatenates text fields', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.textarea({ name: 'summary' }),
        field.richtext({ name: 'body' }),
        field.boolean({ name: 'published' })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('CREATE OR REPLACE FUNCTION')
    expect(sql).toContain('to_tsvector')
    expect(sql).toContain('title')
    expect(sql).toContain('summary')
    expect(sql).toContain('body')
    // boolean fields should NOT be in the search vector
    expect(sql).not.toContain("'published'")
  })

  it('generates trigger on INSERT and UPDATE', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('CREATE TRIGGER')
    expect(sql).toContain('BEFORE INSERT OR UPDATE')
  })

  it('auto-detects text-type fields: text, textarea, richtext, slug, email', () => {
    const col = collection({
      slug: 'contacts',
      fields: [
        field.text({ name: 'name', required: true }),
        field.slug({ name: 'slug', required: true }),
        field.email({ name: 'email' }),
        field.number({ name: 'age' }),
        field.boolean({ name: 'active' }),
        field.date({ name: 'created' })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    // text-type fields included
    expect(sql).toContain('name')
    expect(sql).toContain('slug')
    expect(sql).toContain('email')
    // non-text fields excluded from tsvector concatenation
    expect(sql).not.toContain("'age'")
    expect(sql).not.toContain("'active'")
    expect(sql).not.toContain("'created'")
  })

  it('uses explicit search.fields when provided', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.text({ name: 'subtitle' }),
        field.richtext({ name: 'body' })
      ],
      search: { fields: ['title', 'body'] }
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('NEW."title"')
    expect(sql).toContain('NEW."body"')
    // subtitle not included since explicit fields were given
    expect(sql).not.toContain('NEW."subtitle"')
  })

  it('uses custom language from search config', () => {
    const col = collection({
      slug: 'articles',
      fields: [
        field.text({ name: 'titre', required: true })
      ],
      search: { language: 'french' }
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain("'french'")
  })

  it('defaults to english language', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain("'english'")
  })

  it('returns Err when no searchable fields found', () => {
    const col = collection({
      slug: 'flags',
      fields: [
        field.boolean({ name: 'active' }),
        field.number({ name: 'priority' })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('no searchable')
  })

  it('generates COALESCE for nullable fields', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.textarea({ name: 'summary' })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('COALESCE')
  })
})
