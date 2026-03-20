import { describe, it, expect } from 'vitest'
import { generateCreateTableSql } from '../db/migration-generator.js'
import { generateZodSchema } from '../validation/zod-generator.js'
import { generateSearchMigration } from '../db/search-migration.js'
import { runFieldHooks } from '../hooks/field-hook-runner.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import type { HookArgs } from '../hooks/hook-types.js'

// --- Migration generator with layout fields ---

describe('generateCreateTableSql() with layout fields', () => {
  it('generates columns for children of tabs field — no tabs column', () => {
    const col = collection({
      slug: 'articles',
      fields: [
        field.tabs({
          name: 'content_tabs',
          tabs: [
            {
              label: 'Content',
              fields: [
                field.text({ name: 'title', required: true }),
                field.text({ name: 'body' })
              ]
            },
            {
              label: 'SEO',
              fields: [
                field.text({ name: 'metaTitle' }),
                field.number({ name: 'metaScore' })
              ]
            }
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(col)
    expect(sql).toContain('"title" TEXT NOT NULL')
    expect(sql).toContain('"body" TEXT')
    expect(sql).toContain('"metaTitle" TEXT')
    expect(sql).toContain('"metaScore" INTEGER')
    expect(sql).not.toContain('"content_tabs"')
  })

  it('generates columns for children of row field — no row column', () => {
    const col = collection({
      slug: 'contacts',
      fields: [
        field.row({
          name: 'name_row',
          fields: [
            field.text({ name: 'firstName', required: true }),
            field.text({ name: 'lastName', required: true })
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(col)
    expect(sql).toContain('"firstName" TEXT NOT NULL')
    expect(sql).toContain('"lastName" TEXT NOT NULL')
    expect(sql).not.toContain('"name_row"')
  })

  it('generates columns for children of collapsible field — no collapsible column', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.collapsible({
          name: 'advanced',
          label: 'Advanced Settings',
          fields: [
            field.text({ name: 'internalNotes' }),
            field.boolean({ name: 'featured' })
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(col)
    expect(sql).toContain('"internalNotes" TEXT')
    expect(sql).toContain('"featured" BOOLEAN')
    expect(sql).not.toContain('"advanced"')
  })

  it('generates columns for deeply nested fields across layout types', () => {
    const col = collection({
      slug: 'pages',
      fields: [
        field.tabs({
          name: 'page_tabs',
          tabs: [
            {
              label: 'Content',
              fields: [
                field.row({
                  name: 'title_row',
                  fields: [
                    field.text({ name: 'title', required: true }),
                    field.text({ name: 'subtitle' })
                  ]
                }),
                field.collapsible({
                  name: 'meta_section',
                  label: 'Meta',
                  fields: [
                    field.text({ name: 'metaDescription' })
                  ]
                })
              ]
            }
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(col)
    expect(sql).toContain('"title" TEXT NOT NULL')
    expect(sql).toContain('"subtitle" TEXT')
    expect(sql).toContain('"metaDescription" TEXT')
    expect(sql).not.toContain('"page_tabs"')
    expect(sql).not.toContain('"title_row"')
    expect(sql).not.toContain('"meta_section"')
  })

  it('mixes layout and non-layout fields correctly', () => {
    const col = collection({
      slug: 'blog_posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.tabs({
          name: 'extra_tabs',
          tabs: [
            {
              label: 'Extra',
              fields: [field.text({ name: 'summary' })]
            }
          ]
        }),
        field.boolean({ name: 'published' })
      ]
    })
    const sql = generateCreateTableSql(col)
    expect(sql).toContain('"title" TEXT NOT NULL')
    expect(sql).toContain('"summary" TEXT')
    expect(sql).toContain('"published" BOOLEAN')
    expect(sql).not.toContain('"extra_tabs"')
  })

  it('generates FK constraints for relation children inside layout fields', () => {
    const col = collection({
      slug: 'articles',
      fields: [
        field.tabs({
          name: 'meta_tabs',
          tabs: [
            {
              label: 'Meta',
              fields: [
                field.relation({ name: 'author', relationTo: 'users', required: true })
              ]
            }
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(col)
    expect(sql).toContain('"author" UUID NOT NULL')
    expect(sql).toContain('FOREIGN KEY ("author") REFERENCES "users"("id")')
  })

  it('generates indexes for indexed children inside layout fields', () => {
    const col = collection({
      slug: 'products',
      fields: [
        field.row({
          name: 'product_row',
          fields: [
            field.text({ name: 'sku', index: true })
          ]
        })
      ]
    })
    const sql = generateCreateTableSql(col)
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_products_sku"')
  })
})

// --- Zod generator with layout fields ---

describe('generateZodSchema() with layout fields', () => {
  it('validates children of tabs as flat fields', () => {
    const fields = [
      field.tabs({
        name: 'content_tabs',
        tabs: [
          {
            label: 'Content',
            fields: [field.text({ name: 'title', required: true })]
          },
          {
            label: 'SEO',
            fields: [field.text({ name: 'metaTitle' })]
          }
        ]
      })
    ]
    const schema = generateZodSchema(fields)
    const valid = schema.safeParse({ title: 'Hello', metaTitle: 'Meta' })
    expect(valid.success).toBe(true)
  })

  it('rejects missing required field nested inside tabs', () => {
    const fields = [
      field.tabs({
        name: 'content_tabs',
        tabs: [
          {
            label: 'Content',
            fields: [field.text({ name: 'title', required: true })]
          }
        ]
      })
    ]
    const schema = generateZodSchema(fields)
    const result = schema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('validates children of row field at parent level', () => {
    const fields = [
      field.row({
        name: 'name_row',
        fields: [
          field.text({ name: 'firstName', required: true }),
          field.text({ name: 'lastName', required: true })
        ]
      })
    ]
    const schema = generateZodSchema(fields)
    const valid = schema.safeParse({ firstName: 'John', lastName: 'Doe' })
    expect(valid.success).toBe(true)
    const invalid = schema.safeParse({ firstName: 'John' })
    expect(invalid.success).toBe(false)
  })

  it('validates children of collapsible field at parent level', () => {
    const fields = [
      field.collapsible({
        name: 'advanced',
        label: 'Advanced',
        fields: [
          field.text({ name: 'slug', required: true })
        ]
      })
    ]
    const schema = generateZodSchema(fields)
    const valid = schema.safeParse({ slug: 'my-page' })
    expect(valid.success).toBe(true)
    const invalid = schema.safeParse({})
    expect(invalid.success).toBe(false)
  })

  it('does not expose the layout container field itself as a key', () => {
    const fields = [
      field.tabs({
        name: 'main_tabs',
        tabs: [
          { label: 'Tab A', fields: [field.text({ name: 'fieldA' })] }
        ]
      })
    ]
    const schema = generateZodSchema(fields)
    const shapeKeys = Object.keys(schema.shape)
    expect(shapeKeys).not.toContain('main_tabs')
    expect(shapeKeys).toContain('fieldA')
  })

  it('validates deeply nested fields across layout types', () => {
    const fields = [
      field.tabs({
        name: 'outer',
        tabs: [
          {
            label: 'Main',
            fields: [
              field.row({
                name: 'inner_row',
                fields: [
                  field.text({ name: 'deepTitle', required: true }),
                  field.number({ name: 'deepCount' })
                ]
              })
            ]
          }
        ]
      })
    ]
    const schema = generateZodSchema(fields)
    const valid = schema.safeParse({ deepTitle: 'Hello', deepCount: 5 })
    expect(valid.success).toBe(true)
    const invalid = schema.safeParse({ deepCount: 5 })
    expect(invalid.success).toBe(false)
  })
})

// --- Field hook runner with layout fields ---

describe('runFieldHooks() with layout fields', () => {
  it('runs hooks on fields nested inside tabs', async () => {
    const fields = [
      field.tabs({
        name: 'content_tabs',
        tabs: [
          {
            label: 'Content',
            fields: [
              {
                type: 'text' as const,
                name: 'title',
                hooks: {
                  beforeChange: [({ data }: HookArgs) => ({ ...data, title: 'hooked' })]
                }
              }
            ]
          }
        ]
      })
    ]
    const result = await runFieldHooks('beforeChange', fields, { title: 'original' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ title: 'hooked' })
  })

  it('runs hooks on fields nested inside row', async () => {
    const calls: string[] = []
    const fields = [
      field.row({
        name: 'name_row',
        fields: [
          {
            type: 'text' as const,
            name: 'firstName',
            hooks: {
              beforeChange: [({ data }: HookArgs) => {
                calls.push('firstName')
                return { ...data, firstName: 'transformed' }
              }]
            }
          },
          {
            type: 'text' as const,
            name: 'lastName',
            hooks: {
              beforeChange: [({ data }: HookArgs) => {
                calls.push('lastName')
                return { ...data, lastName: 'transformed' }
              }]
            }
          }
        ]
      })
    ]
    const result = await runFieldHooks('beforeChange', fields, { firstName: 'John', lastName: 'Doe' })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['firstName', 'lastName'])
    expect(result._unsafeUnwrap()).toEqual({ firstName: 'transformed', lastName: 'transformed' })
  })

  it('runs hooks on fields nested inside collapsible', async () => {
    const fields = [
      field.collapsible({
        name: 'advanced',
        label: 'Advanced',
        fields: [
          {
            type: 'text' as const,
            name: 'slug',
            hooks: {
              beforeChange: [({ data }: HookArgs) => ({
                ...data,
                slug: (data['slug'] as string ?? '').toLowerCase().replace(/\s+/g, '-')
              })]
            }
          }
        ]
      })
    ]
    const result = await runFieldHooks('beforeChange', fields, { slug: 'My Article Title' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ slug: 'my-article-title' })
  })

  it('runs hooks on deeply nested layout fields', async () => {
    const calls: string[] = []
    const fields = [
      field.tabs({
        name: 'outer',
        tabs: [
          {
            label: 'Main',
            fields: [
              field.row({
                name: 'inner_row',
                fields: [
                  {
                    type: 'text' as const,
                    name: 'deepField',
                    hooks: {
                      beforeChange: [({ data }: HookArgs) => {
                        calls.push('deepField')
                        return { ...data, deepField: 'deep-hooked' }
                      }]
                    }
                  }
                ]
              })
            ]
          }
        ]
      })
    ]
    const result = await runFieldHooks('beforeChange', fields, { deepField: 'original' })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['deepField'])
    expect(result._unsafeUnwrap()).toEqual({ deepField: 'deep-hooked' })
  })
})

// --- Search migration with layout fields ---

describe('generateSearchMigration() with layout fields', () => {
  it('includes text children of tabs in search vector', () => {
    const col = collection({
      slug: 'articles',
      fields: [
        field.tabs({
          name: 'content_tabs',
          tabs: [
            {
              label: 'Content',
              fields: [
                field.text({ name: 'title' }),
                field.text({ name: 'body' })
              ]
            },
            {
              label: 'SEO',
              fields: [
                field.text({ name: 'metaTitle' })
              ]
            }
          ]
        })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('"title"')
    expect(sql).toContain('"body"')
    expect(sql).toContain('"metaTitle"')
  })

  it('includes text children of row in search vector', () => {
    const col = collection({
      slug: 'contacts',
      fields: [
        field.row({
          name: 'name_row',
          fields: [
            field.text({ name: 'firstName' }),
            field.text({ name: 'lastName' })
          ]
        })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('"firstName"')
    expect(sql).toContain('"lastName"')
  })

  it('includes text children of collapsible in search vector', () => {
    const col = collection({
      slug: 'pages',
      fields: [
        field.collapsible({
          name: 'seo_section',
          label: 'SEO',
          fields: [
            field.text({ name: 'metaDescription' })
          ]
        })
      ]
    })
    const result = generateSearchMigration(col)
    expect(result.isOk()).toBe(true)
    const sql = result._unsafeUnwrap()
    expect(sql).toContain('"metaDescription"')
  })
})
