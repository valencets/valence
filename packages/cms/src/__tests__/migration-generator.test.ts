import { describe, it, expect } from 'vitest'
import { generateCreateTable, generateCreateTableSql } from '../db/migration-generator.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('generateCreateTableSql()', () => {
  it('generates CREATE TABLE with id, timestamps, and soft delete', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true, unique: true })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "posts"')
    expect(sql).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()')
    expect(sql).toContain('"title" TEXT NOT NULL')
    expect(sql).toContain('"slug" TEXT NOT NULL UNIQUE')
    expect(sql).toContain('"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    expect(sql).toContain('"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    expect(sql).toContain('"deleted_at" TIMESTAMPTZ')
  })

  it('omits timestamps when timestamps: false', () => {
    const logs = collection({
      slug: 'logs',
      fields: [field.text({ name: 'msg' })],
      timestamps: false
    })
    const sql = generateCreateTableSql(logs)
    expect(sql).not.toContain('created_at')
    expect(sql).not.toContain('updated_at')
    expect(sql).toContain('"deleted_at"')
  })

  it('handles number fields with hasDecimals', () => {
    const products = collection({
      slug: 'products',
      fields: [
        field.number({ name: 'price', hasDecimals: true }),
        field.number({ name: 'stock' })
      ]
    })
    const sql = generateCreateTableSql(products)
    expect(sql).toContain('"price" NUMERIC')
    expect(sql).toContain('"stock" INTEGER')
  })

  it('handles select fields with CHECK constraint', () => {
    const pages = collection({
      slug: 'pages',
      fields: [
        field.select({
          name: 'status',
          required: true,
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' }
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(pages)
    expect(sql).toContain('"status" TEXT NOT NULL')
    expect(sql).toContain('CHECK')
    expect(sql).toContain("'draft'")
    expect(sql).toContain("'published'")
  })

  it('handles relation fields as UUID references', () => {
    const comments = collection({
      slug: 'comments',
      fields: [
        field.relation({ name: 'author', relationTo: 'users', required: true }),
        field.text({ name: 'body', required: true })
      ]
    })
    const sql = generateCreateTableSql(comments)
    expect(sql).toContain('"author" UUID NOT NULL')
    expect(sql).toContain('REFERENCES "users"("id")')
  })

  it('handles media fields as UUID references', () => {
    const articles = collection({
      slug: 'articles',
      fields: [
        field.media({ name: 'cover', relationTo: 'media' })
      ]
    })
    const sql = generateCreateTableSql(articles)
    expect(sql).toContain('"cover" UUID')
    expect(sql).toContain('REFERENCES "media"("id")')
  })

  it('handles group fields as JSONB', () => {
    const pages = collection({
      slug: 'pages',
      fields: [
        field.group({
          name: 'seo',
          fields: [
            field.text({ name: 'metaTitle' }),
            field.textarea({ name: 'metaDescription' })
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(pages)
    expect(sql).toContain('"seo" JSONB')
  })

  it('generates CREATE INDEX for indexed fields', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', index: true }),
        field.date({ name: 'publishedAt', index: true })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('CREATE INDEX')
    expect(sql).toContain('idx_posts_title')
    expect(sql).toContain('idx_posts_publishedAt')
  })

  it('generates CREATE INDEX for relation FK fields', () => {
    const comments = collection({
      slug: 'comments',
      fields: [
        field.relation({ name: 'post', relationTo: 'posts' })
      ]
    })
    const sql = generateCreateTableSql(comments)
    expect(sql).toContain('CREATE INDEX')
    expect(sql).toContain('idx_comments_post')
  })
})

describe('generateCreateTableSql() with upload config', () => {
  it('injects focalX and focalY columns when focalPoint is true', () => {
    const media = collection({
      slug: 'media',
      upload: { focalPoint: true },
      fields: [field.text({ name: 'alt' })]
    })
    const sql = generateCreateTableSql(media)
    expect(sql).toContain('"focalX" NUMERIC DEFAULT 0.5')
    expect(sql).toContain('"focalY" NUMERIC DEFAULT 0.5')
  })

  it('injects sizes JSONB column when imageSizes is configured', () => {
    const media = collection({
      slug: 'media',
      upload: {
        imageSizes: [
          { name: 'thumbnail', width: 150, height: 150 }
        ]
      },
      fields: [field.text({ name: 'alt' })]
    })
    const sql = generateCreateTableSql(media)
    expect(sql).toContain('"sizes" JSONB')
  })

  it('injects both focal and sizes columns when both configured', () => {
    const media = collection({
      slug: 'media',
      upload: {
        focalPoint: true,
        imageSizes: [{ name: 'thumb', width: 100, height: 100 }]
      },
      fields: [field.text({ name: 'alt' })]
    })
    const sql = generateCreateTableSql(media)
    expect(sql).toContain('"focalX" NUMERIC DEFAULT 0.5')
    expect(sql).toContain('"focalY" NUMERIC DEFAULT 0.5')
    expect(sql).toContain('"sizes" JSONB')
  })

  it('does NOT inject image columns for upload: true (boolean)', () => {
    const media = collection({
      slug: 'media',
      upload: true,
      fields: [field.text({ name: 'alt' })]
    })
    const sql = generateCreateTableSql(media)
    expect(sql).not.toContain('focalX')
    expect(sql).not.toContain('focalY')
    expect(sql).not.toContain('"sizes"')
  })

  it('does NOT inject image columns for non-upload collections', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).not.toContain('focalX')
    expect(sql).not.toContain('sizes')
  })

  it('places image columns before timestamps', () => {
    const media = collection({
      slug: 'media',
      upload: { focalPoint: true },
      fields: [field.text({ name: 'alt' })]
    })
    const sql = generateCreateTableSql(media)
    const focalIdx = sql.indexOf('focalX')
    const createdIdx = sql.indexOf('created_at')
    expect(focalIdx).toBeLessThan(createdIdx)
  })
})

describe('generateCreateTableSql() with versions', () => {
  it('injects _status column with CHECK constraint when versions.drafts is true', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title', required: true })],
      versions: { drafts: true }
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('"_status" TEXT NOT NULL DEFAULT \'draft\'')
    expect(sql).toContain('CHECK ("_status" IN (\'draft\', \'published\'))')
  })

  it('injects publish_at column when versions.drafts is true', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: true }
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('"publish_at" TIMESTAMPTZ')
  })

  it('does NOT inject status columns when versions is undefined', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).not.toContain('_status')
    expect(sql).not.toContain('publish_at')
  })

  it('does NOT inject status columns when versions.drafts is false', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: false }
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).not.toContain('_status')
    expect(sql).not.toContain('publish_at')
  })

  it('places _status and publish_at before timestamps', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: true }
    })
    const sql = generateCreateTableSql(posts)
    const statusIdx = sql.indexOf('_status')
    const createdIdx = sql.indexOf('created_at')
    expect(statusIdx).toBeLessThan(createdIdx)
  })
})

describe('generateCreateTableSql() with localization', () => {
  it('produces JSONB for a localized text field when hasLocalization is true', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true, localized: true }),
        field.text({ name: 'slug', required: true })
      ]
    })
    const sql = generateCreateTableSql(posts, true)
    expect(sql).toContain('"title" JSONB NOT NULL')
    expect(sql).toContain('"slug" TEXT NOT NULL')
  })

  it('produces JSONB for a localized number field', () => {
    const products = collection({
      slug: 'products',
      fields: [
        field.number({ name: 'price', localized: true }),
        field.number({ name: 'stock' })
      ]
    })
    const sql = generateCreateTableSql(products, true)
    expect(sql).toContain('"price" JSONB')
    expect(sql).toContain('"stock" INTEGER')
  })

  it('uses normal types when hasLocalization is false even if field has localized: true', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', localized: true })
      ]
    })
    const sql = generateCreateTableSql(posts, false)
    expect(sql).toContain('"title" TEXT')
    expect(sql).not.toContain('JSONB')
  })

  it('uses normal types when hasLocalization is omitted', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', localized: true })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('"title" TEXT')
  })

  it('fields already JSONB stay JSONB when localized', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.json({ name: 'metadata', localized: true })
      ]
    })
    const sql = generateCreateTableSql(posts, true)
    expect(sql).toContain('"metadata" JSONB')
  })
})

describe('generateCreateTable()', () => {
  it('returns up and down SQL strings', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    const result = generateCreateTable(posts)
    expect(result.isOk()).toBe(true)
    const migration = result.unwrap()
    expect(migration.up).toContain('CREATE TABLE')
    expect(migration.down).toContain('DROP TABLE')
    expect(migration.down).toContain('"posts"')
  })

  it('includes a migration name with timestamp prefix', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    const result = generateCreateTable(posts)
    expect(result.isOk()).toBe(true)
    const migration = result.unwrap()
    expect(migration.name).toMatch(/^\d+_create_posts$/)
  })
})

describe('generateCreateTableSql() with search_vector', () => {
  it('includes search_vector TSVECTOR column when collection has text fields', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('"search_vector" TSVECTOR')
  })

  it('includes GIN index on search_vector when collection has text fields', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "posts_search_idx"')
    expect(sql).toContain('USING GIN (search_vector)')
  })

  it('includes trigger function when collection has text fields', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('CREATE OR REPLACE FUNCTION')
    expect(sql).toContain('posts_search_update')
    expect(sql).toContain('RETURNS trigger')
  })

  it('includes trigger referencing all searchable fields', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.textarea({ name: 'body' }),
        field.email({ name: 'contact' })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain("COALESCE(NEW.\"title\", '')")
    expect(sql).toContain("COALESCE(NEW.\"body\", '')")
    expect(sql).toContain("COALESCE(NEW.\"contact\", '')")
  })

  it('includes BEFORE INSERT OR UPDATE trigger', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true })
      ]
    })
    const sql = generateCreateTableSql(posts)
    expect(sql).toContain('BEFORE INSERT OR UPDATE ON "posts"')
    expect(sql).toContain('CREATE TRIGGER "posts_search_update"')
  })

  it('does NOT include search_vector for collections with only boolean/number fields', () => {
    const metrics = collection({
      slug: 'metrics',
      fields: [
        field.number({ name: 'count' }),
        field.boolean({ name: 'active' })
      ]
    })
    const sql = generateCreateTableSql(metrics)
    expect(sql).not.toContain('search_vector')
    expect(sql).not.toContain('GIN')
    expect(sql).not.toContain('TRIGGER')
  })

  it('does NOT include search_vector for collections with only relation/date fields', () => {
    const events = collection({
      slug: 'events',
      fields: [
        field.date({ name: 'startDate' }),
        field.relation({ name: 'author', relationTo: 'users' })
      ]
    })
    const sql = generateCreateTableSql(events)
    expect(sql).not.toContain('search_vector')
  })

  it('includes search_vector for textarea fields', () => {
    const pages = collection({
      slug: 'pages',
      fields: [
        field.textarea({ name: 'description' })
      ]
    })
    const sql = generateCreateTableSql(pages)
    expect(sql).toContain('"search_vector" TSVECTOR')
  })

  it('includes search_vector for richtext fields', () => {
    const articles = collection({
      slug: 'articles',
      fields: [
        field.richtext({ name: 'content' })
      ]
    })
    const sql = generateCreateTableSql(articles)
    expect(sql).toContain('"search_vector" TSVECTOR')
  })

  it('includes search_vector for email fields', () => {
    const contacts = collection({
      slug: 'contacts',
      fields: [
        field.email({ name: 'email' })
      ]
    })
    const sql = generateCreateTableSql(contacts)
    expect(sql).toContain('"search_vector" TSVECTOR')
  })
})
