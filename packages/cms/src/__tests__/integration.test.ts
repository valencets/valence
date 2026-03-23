import { describe, it, expect } from 'vitest'
import { buildCms } from '../config/cms-config.js'
import { collection } from '../schema/collection.js'
import { global } from '../schema/global.js'
import { field } from '../schema/fields.js'
import { generateCreateTableSql } from '../db/migration-generator.js'
import { generateZodSchema } from '../validation/zod-generator.js'
import { renderListView } from '../admin/list-view.js'
import { renderEditView } from '../admin/edit-view.js'
import { makeMockPool } from './test-helpers.js'

describe('CMS integration: schema → migration → validation → query → admin', () => {
  const pages = collection({
    slug: 'pages',
    labels: { singular: 'Page', plural: 'Pages' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true, unique: true }),
      field.boolean({ name: 'published' }),
      field.select({
        name: 'status',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' }
        ]
      }),
      field.textarea({ name: 'body' }),
      field.group({
        name: 'seo',
        fields: [
          field.text({ name: 'metaTitle' }),
          field.textarea({ name: 'metaDescription' })
        ]
      })
    ]
  })

  it('generates valid CREATE TABLE SQL from schema', () => {
    const sql = generateCreateTableSql(pages)
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "pages"')
    expect(sql).toContain('"title" TEXT NOT NULL')
    expect(sql).toContain('"slug" TEXT NOT NULL UNIQUE')
    expect(sql).toContain('"published" BOOLEAN')
    expect(sql).toContain('"status" TEXT')
    expect(sql).toContain('"body" TEXT')
    expect(sql).toContain('"seo" JSONB')
    expect(sql).toContain('"id" UUID PRIMARY KEY')
    expect(sql).toContain('"created_at" TIMESTAMPTZ')
    expect(sql).toContain('"deleted_at" TIMESTAMPTZ')
  })

  it('generates Zod schema that validates documents', () => {
    const schema = generateZodSchema(pages.fields)
    const valid = schema.safeParse({ title: 'Hello', slug: 'hello', status: 'draft' })
    expect(valid.success).toBe(true)

    const missingRequired = schema.safeParse({ slug: 'hello' })
    expect(missingRequired.success).toBe(false)

    const badStatus = schema.safeParse({ title: 'Hi', slug: 'hi', status: 'invalid' })
    expect(badStatus.success).toBe(false)
  })

  it('buildCms registers collections and creates API + routes', () => {
    const pool = makeMockPool()
    const result = buildCms({
      db: pool,
      secret: 'test',
      collections: [pages],
      globals: [global({ slug: 'site-settings', fields: [field.text({ name: 'siteName' })] })]
    })
    expect(result.isOk()).toBe(true)
    const cms = result.unwrap()

    expect(cms.collections.has('pages')).toBe(true)
    expect(cms.globals.has('site-settings')).toBe(true)
    expect(cms.restRoutes.has('/api/pages')).toBe(true)
    expect(cms.restRoutes.has('/api/pages/:id')).toBe(true)
    expect(cms.adminRoutes.has('/admin')).toBe(true)
    expect(cms.adminRoutes.has('/admin/pages')).toBe(true)
    expect(cms.adminRoutes.has('/admin/pages/new')).toBe(true)
  })

  it('query builder creates, reads, and deletes via mock pool', async () => {
    const insertedRow = { id: 'page-1', title: 'Home', slug: 'home', published: 'true' }
    const pool = makeMockPool([insertedRow])
    const result = buildCms({ db: pool, secret: 'test', collections: [pages] })
    const cms = result.unwrap()

    const createResult = await cms.api.create({ collection: 'pages', data: { title: 'Home', slug: 'home' } })
    expect(createResult.isOk()).toBe(true)
    expect(createResult.unwrap()).toEqual(insertedRow)

    const findResult = await cms.api.findByID({ collection: 'pages', id: 'page-1' })
    expect(findResult.isOk()).toBe(true)

    const deleteResult = await cms.api.delete({ collection: 'pages', id: 'page-1' })
    expect(deleteResult.isOk()).toBe(true)
  })

  it('admin renders list and edit views from schema', () => {
    const docs = [
      { id: '1', title: 'Home', slug: 'home', published: 'true', status: 'published', body: '', seo: '{}' }
    ]
    const listHtml = renderListView({ col: pages, docs })
    expect(listHtml).toContain('Home')
    expect(listHtml).toContain('/admin/pages/1/edit')

    const editHtml = renderEditView(pages, docs[0] ?? null)
    expect(editHtml).toContain('<form')
    expect(editHtml).toContain('name="title"')
    expect(editHtml).toContain('value="Home"')
    expect(editHtml).toContain('<select')
    expect(editHtml).toContain('selected')

    const newHtml = renderEditView(pages, null)
    expect(newHtml).toContain('<form')
    expect(newHtml).toContain('Create')
  })

  it('auth-enabled collection gets email and password_hash injected', () => {
    const users = collection({
      slug: 'users',
      auth: true,
      fields: [field.text({ name: 'name', required: true })]
    })
    const pool = makeMockPool()
    const result = buildCms({ db: pool, secret: 'test', collections: [users] })
    expect(result.isOk()).toBe(true)
    const cms = result.unwrap()
    const userConfig = cms.collections.get('users').unwrap()
    const fieldNames = userConfig.fields.map(f => f.name)
    expect(fieldNames).toContain('name')
    expect(fieldNames).toContain('email')
    expect(fieldNames).toContain('password_hash')
  })
})
