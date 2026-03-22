import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import supertest from 'supertest'
import postgres from 'postgres'
import { createPool, closePool } from '@valencets/db'
import type { DbPool } from '@valencets/db'
import { collection, field } from '@valencets/cms'
import { startTestApp } from './test-app.js'
import type { TestApp } from './test-app.js'

const TEST_DB = 'valence_crud_integration_test'

const postsCollection = collection({
  slug: 'posts',
  access: { read: () => true, create: () => true, update: () => true, delete: () => true },
  timestamps: true,
  fields: [
    field.text({ name: 'title', required: true }),
    field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
    field.textarea({ name: 'body' }),
    field.boolean({ name: 'published' }),
    field.date({ name: 'publishedAt' })
  ]
})

const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "body" TEXT,
  "published" BOOLEAN DEFAULT false,
  "publishedAt" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);
`

let pool: DbPool
let app: TestApp
let request: supertest.Agent

beforeAll(async () => {
  const adminSql = postgres({ database: 'postgres', max: 2 })
  const existing = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}`
  if (existing.length > 0) {
    await adminSql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
    `
    await adminSql.unsafe(`DROP DATABASE ${TEST_DB}`)
  }
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB}`)
  await adminSql.end()

  pool = createPool({
    host: 'localhost',
    port: 5432,
    database: TEST_DB,
    username: '',
    password: '',
    max: 5,
    idle_timeout: 10,
    connect_timeout: 5
  })
  await pool.sql.unsafe(INIT_SQL)

  app = await startTestApp({ pool, collections: [postsCollection] })
  request = supertest.agent(app.server)
}, 30_000)

afterAll(async () => {
  await app.close()
  await closePool(pool)
  const adminSql = postgres({ database: 'postgres', max: 2 })
  await adminSql`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
  `
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await adminSql.end()
}, 15_000)

beforeEach(async () => {
  await pool.sql.unsafe('DELETE FROM "posts"')
})

interface PostData {
  readonly title: string
  readonly slug: string
  readonly body?: string
  readonly published?: boolean
  readonly publishedAt?: string
}

async function createPost (data: PostData): Promise<supertest.Response> {
  return request
    .post('/api/posts')
    .set('Content-Type', 'application/json')
    .send(data)
}

describe('CMS CRUD integration tests', () => {
  describe('POST /api/posts (create)', () => {
    it('returns 201 with created document for valid data', async () => {
      const res = await createPost({
        title: 'Hello World',
        slug: 'hello-world',
        body: 'First post!',
        published: false
      })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        title: 'Hello World',
        slug: 'hello-world',
        body: 'First post!',
        published: false
      })
      expect(res.body.id).toBeDefined()
    })

    it('returns 400 for missing required field (title)', async () => {
      const res = await createPost({ slug: 'no-title', body: 'Missing title' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBeDefined()
    })

    it('returns 400 for missing required field (slug)', async () => {
      const res = await createPost({ title: 'No Slug', body: 'Missing slug' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBeDefined()
    })

    it('returns 415 without Content-Type header', async () => {
      const res = await request.post('/api/posts').send('{"title":"test"}')
      expect(res.status).toBe(415)
    })
  })

  describe('GET /api/posts (list)', () => {
    it('returns all posts', async () => {
      await createPost({ title: 'Post A', slug: 'post-a' })
      await createPost({ title: 'Post B', slug: 'post-b' })

      const res = await request.get('/api/posts').expect(200)

      expect(res.body.docs).toHaveLength(2)
      expect(res.body.docs[0].title).toBeDefined()
    })

    it('returns paginated results with page param', async () => {
      for (let i = 1; i <= 5; i++) {
        await createPost({ title: `Post ${i}`, slug: `post-${i}` })
      }
      const res = await request.get('/api/posts?page=1&limit=2').expect(200)
      expect(res.body.docs).toHaveLength(2)
      expect(res.body.totalDocs).toBe(5)
      expect(res.body.totalPages).toBe(3)
      expect(res.body.hasNextPage).toBe(true)
      expect(res.body.hasPrevPage).toBe(false)
    })

    it('sorts by field', async () => {
      await createPost({ title: 'Zebra', slug: 'zebra' })
      await createPost({ title: 'Apple', slug: 'apple' })
      const res = await request.get('/api/posts?sort=title&dir=asc').expect(200)
      expect(res.body.docs[0].title).toBe('Apple')
      expect(res.body.docs[1].title).toBe('Zebra')
    })

    it('filters by field value', async () => {
      await createPost({ title: 'Draft', slug: 'draft', published: false })
      await createPost({ title: 'Published', slug: 'published', published: true })
      const res = await request.get('/api/posts?published=true').expect(200)
      expect(res.body.docs).toHaveLength(1)
      expect(res.body.docs[0].title).toBe('Published')
    })

    it('returns 400 for invalid sort field', async () => {
      const res = await request.get('/api/posts?sort=nonexistent')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Invalid sort field/)
    })
  })

  describe('GET /api/posts/:id (read)', () => {
    it('returns 200 with document for valid ID', async () => {
      const createRes = await createPost({ title: 'Find Me', slug: 'find-me' })
      const id = createRes.body.id

      const res = await request.get(`/api/posts/${id}`).expect(200)

      expect(res.body).toMatchObject({ id, title: 'Find Me', slug: 'find-me' })
    })

    it('returns 404 for nonexistent ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const res = await request.get(`/api/posts/${fakeId}`)
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/posts/:id (update)', () => {
    it('returns 200 with updated document', async () => {
      const createRes = await createPost({ title: 'Original', slug: 'original' })
      const id = createRes.body.id

      const res = await request
        .patch(`/api/posts/${id}`)
        .set('Content-Type', 'application/json')
        .send({ title: 'Updated' })
        .expect(200)

      expect(res.body.title).toBe('Updated')
      expect(res.body.slug).toBe('original')
    })

    it('supports partial update (only changed fields)', async () => {
      const createRes = await createPost({
        title: 'Full',
        slug: 'full',
        body: 'Keep me',
        published: false
      })
      const id = createRes.body.id

      const res = await request
        .patch(`/api/posts/${id}`)
        .set('Content-Type', 'application/json')
        .send({ published: true })
        .expect(200)

      expect(res.body.published).toBe(true)
      expect(res.body.body).toBe('Keep me')
      expect(res.body.title).toBe('Full')
    })
  })

  describe('DELETE /api/posts/:id (soft delete)', () => {
    it('returns 200 and document is excluded from list', async () => {
      const createRes = await createPost({ title: 'Delete Me', slug: 'delete-me' })
      const id = createRes.body.id

      await request.delete(`/api/posts/${id}`).expect(200)

      const listRes = await request.get('/api/posts').expect(200)
      const found = (listRes.body.docs as Array<{ id: string }>).find(p => p.id === id)
      expect(found).toBeUndefined()
    })

    it('deleted document returns 404 on direct access', async () => {
      const createRes = await createPost({ title: 'Gone', slug: 'gone' })
      const id = createRes.body.id

      await request.delete(`/api/posts/${id}`).expect(200)
      await request.get(`/api/posts/${id}`).expect(404)
    })
  })
})
