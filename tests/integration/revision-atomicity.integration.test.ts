import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createPool, closePool } from '@valencets/db'
import type { DbPool } from '@valencets/db'
import { collection, field, createLocalApi, createCollectionRegistry, createGlobalRegistry } from '@valencets/cms'
import { createAdminSql, getTestDbConfig } from './db-helpers.js'

const TEST_DB = 'valence_revision_atomicity_test'

// Mirrors the schema the scaffold ships (packages/valence/src/cli.ts):
// document_revisions is a shared, append-only history table with a unique
// (collection_slug, document_id, revision_number) key.
const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "document_revisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "collection_slug" TEXT NOT NULL,
  "document_id" UUID NOT NULL,
  "revision_number" INT NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("collection_slug", "document_id", "revision_number")
);
`

let pool: DbPool

function makeApi (): ReturnType<typeof createLocalApi> {
  const collections = createCollectionRegistry()
  collections.register(collection({
    slug: 'posts',
    timestamps: true,
    fields: [field.text({ name: 'title', required: true })]
  }))
  return createLocalApi(pool, collections, createGlobalRegistry())
}

async function seedPost (title: string): Promise<string> {
  const api = makeApi()
  const created = await api.create({ collection: 'posts', data: { title } })
  return created.match((doc) => String(doc.id), (e) => { throw new Error(e.message) })
}

async function readTitle (id: string): Promise<string | null> {
  const rows = await pool.sql.unsafe('SELECT "title" FROM "posts" WHERE "id" = $1', [id]) as Array<{ title: string }>
  return rows[0]?.title ?? null
}

async function revisionCount (id: string): Promise<number> {
  const rows = await pool.sql.unsafe(
    'SELECT COUNT(*)::int AS n FROM "document_revisions" WHERE "document_id" = $1', [id]
  ) as Array<{ n: number }>
  return rows[0]?.n ?? 0
}

beforeAll(async () => {
  const adminSql = createAdminSql()
  const existing = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}`
  if (existing.length > 0) {
    await adminSql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()`
    await adminSql.unsafe(`DROP DATABASE ${TEST_DB}`)
  }
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB}`)
  await adminSql.end()

  pool = createPool(getTestDbConfig(TEST_DB))
  await pool.sql.unsafe(INIT_SQL)
}, 30_000)

afterAll(async () => {
  await closePool(pool)
  const adminSql = createAdminSql()
  await adminSql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()`
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await adminSql.end()
}, 15_000)

beforeEach(async () => {
  await pool.sql.unsafe('DELETE FROM "document_revisions"')
  await pool.sql.unsafe('DELETE FROM "posts"')
})

describe('CRUD + revision atomicity (#334)', () => {
  it('writes the document update and its revision together', async () => {
    const id = await seedPost('v1')
    const api = makeApi()

    const updated = await api.update({ collection: 'posts', id, data: { title: 'v2' }, createRevision: true })
    expect(updated.isOk()).toBe(true)

    expect(await readTitle(id)).toBe('v2')
    expect(await revisionCount(id)).toBe(1)
  })

  it('increments revision_number across successive updates', async () => {
    const id = await seedPost('v1')
    const api = makeApi()

    await api.update({ collection: 'posts', id, data: { title: 'v2' }, createRevision: true })
    await api.update({ collection: 'posts', id, data: { title: 'v3' }, createRevision: true })

    const rows = await pool.sql.unsafe(
      'SELECT "revision_number" FROM "document_revisions" WHERE "document_id" = $1 ORDER BY "revision_number"', [id]
    ) as Array<{ revision_number: number }>
    expect(rows.map(r => r.revision_number)).toEqual([1, 2])
  })

  it('rolls the document update back when the revision insert fails', async () => {
    const id = await seedPost('original')
    const api = makeApi()

    // Force the revision step to fail deterministically: make the table
    // unreachable for the duration of the write. The document UPDATE has
    // already run inside the same transaction — atomicity means it must NOT
    // survive the failed revision insert.
    await pool.sql.unsafe('ALTER TABLE "document_revisions" RENAME TO "document_revisions_bak"')
    try {
      const result = await api.update({ collection: 'posts', id, data: { title: 'should-not-persist' }, createRevision: true })
      expect(result.isErr()).toBe(true)
      expect(await readTitle(id)).toBe('original')
    } finally {
      await pool.sql.unsafe('ALTER TABLE "document_revisions_bak" RENAME TO "document_revisions"')
    }
  })

  it('does not write a revision when createRevision is not requested', async () => {
    const id = await seedPost('v1')
    const api = makeApi()

    await api.update({ collection: 'posts', id, data: { title: 'v2' } })

    expect(await readTitle(id)).toBe('v2')
    expect(await revisionCount(id)).toBe(0)
  })
})
