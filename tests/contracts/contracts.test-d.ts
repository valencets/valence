import { describe, it, expectTypeOf } from 'vitest'
import type { Result, ResultAsync } from 'neverthrow'
import { makeMockPool, createPool, closePool } from '@valencets/db'
import type { DbPool, DbConfig, DbError } from '@valencets/db'
import {
  collection,
  field,
  createCollectionRegistry,
  generateCreateTableSql,
  createQueryBuilder,
  buildCms,
  hashPassword,
  verifyPassword
} from '@valencets/cms'
import type {
  CollectionConfig,
  FieldConfig,
  CmsInstance,
  CmsError,
  CollectionRegistry,
  QueryBuilderFactory
} from '@valencets/cms'

// ── db package ────────────────────────────────────────────────────────────────

describe('db type contracts', () => {
  it('createPool returns DbPool', () => {
    const config: DbConfig = { host: 'localhost', port: 5432, database: 'test', max: 1 }
    expectTypeOf(createPool(config)).toEqualTypeOf<DbPool>()
  })

  it('closePool accepts DbPool and returns ResultAsync<void, DbError>', () => {
    const pool = makeMockPool()
    expectTypeOf(closePool(pool)).toEqualTypeOf<ResultAsync<void, DbError>>()
  })

  it('DbPool has sql property', () => {
    expectTypeOf<DbPool>().toHaveProperty('sql')
  })
})

// ── cms schema ────────────────────────────────────────────────────────────────

describe('cms schema type contracts', () => {
  it('collection() returns CollectionConfig', () => {
    const col = collection({ slug: 'posts', fields: [] })
    expectTypeOf(col).toEqualTypeOf<CollectionConfig>()
  })

  it('field.text() returns FieldConfig', () => {
    const f = field.text({ name: 'title' })
    expectTypeOf(f).toMatchTypeOf<FieldConfig>()
  })

  it('field.number() returns FieldConfig', () => {
    const f = field.number({ name: 'count' })
    expectTypeOf(f).toMatchTypeOf<FieldConfig>()
  })

  it('field.boolean() returns FieldConfig', () => {
    const f = field.boolean({ name: 'active' })
    expectTypeOf(f).toMatchTypeOf<FieldConfig>()
  })

  it('generateCreateTableSql returns string', () => {
    const col = collection({ slug: 'posts', fields: [] })
    expectTypeOf(generateCreateTableSql(col)).toEqualTypeOf<string>()
  })
})

// ── buildCms ──────────────────────────────────────────────────────────────────

describe('buildCms type contracts', () => {
  it('buildCms returns Result<CmsInstance, CmsError>', () => {
    const pool = makeMockPool()
    const result = buildCms({ db: pool, collections: [] })
    expectTypeOf(result).toEqualTypeOf<Result<CmsInstance, CmsError>>()
  })
})

// ── registry ──────────────────────────────────────────────────────────────────

describe('registry type contracts', () => {
  it('createCollectionRegistry returns CollectionRegistry', () => {
    expectTypeOf(createCollectionRegistry()).toEqualTypeOf<CollectionRegistry>()
  })

  it('registry.register returns Result<CollectionConfig, CmsError>', () => {
    const registry = createCollectionRegistry()
    const col = collection({ slug: 'x', fields: [] })
    expectTypeOf(registry.register(col)).toEqualTypeOf<Result<CollectionConfig, CmsError>>()
  })

  it('registry.get returns Result<CollectionConfig, CmsError>', () => {
    const registry = createCollectionRegistry()
    expectTypeOf(registry.get('x')).toEqualTypeOf<Result<CollectionConfig, CmsError>>()
  })

  it('registry.getAll returns readonly CollectionConfig[]', () => {
    const registry = createCollectionRegistry()
    expectTypeOf(registry.getAll()).toEqualTypeOf<readonly CollectionConfig[]>()
  })
})

// ── queryBuilder ──────────────────────────────────────────────────────────────

describe('queryBuilder type contracts', () => {
  it('createQueryBuilder returns QueryBuilderFactory', () => {
    const pool = makeMockPool()
    const registry = createCollectionRegistry()
    expectTypeOf(createQueryBuilder(pool, registry)).toEqualTypeOf<QueryBuilderFactory>()
  })
})

// ── auth ──────────────────────────────────────────────────────────────────────

describe('auth type contracts', () => {
  it('hashPassword returns ResultAsync<string, CmsError>', () => {
    expectTypeOf(hashPassword('pw')).toEqualTypeOf<ResultAsync<string, CmsError>>()
  })

  it('verifyPassword returns ResultAsync<boolean, CmsError>', () => {
    expectTypeOf(verifyPassword('pw', 'hash')).toEqualTypeOf<ResultAsync<boolean, CmsError>>()
  })
})
