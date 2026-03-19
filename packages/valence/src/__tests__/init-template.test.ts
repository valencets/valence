import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile } from 'node:fs/promises'
import { run } from '../cli.js'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => undefined)
}))

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => Buffer.from(''))
}))

const mockedWriteFile = vi.mocked(writeFile)

function getWrittenFile (filename: string): string {
  const call = mockedWriteFile.mock.calls.find(c => String(c[0]).endsWith(filename))
  if (!call) throw new Error(`File ${filename} was not written`)
  return String(call[1])
}

describe('init template collections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('valence.config.ts includes posts collection with richtext body', async () => {
    await run(['init', 'test-app', '-y'])
    const config = getWrittenFile('valence.config.ts')
    expect(config).toContain("slug: 'posts'")
    expect(config).toContain("field.richtext({ name: 'body'")
  })

  it('valence.config.ts posts has title, slug, published, publishedAt', async () => {
    await run(['init', 'test-app', '-y'])
    const config = getWrittenFile('valence.config.ts')
    expect(config).toContain("field.text({ name: 'title', required: true })")
    expect(config).toContain("field.slug({ name: 'slug'")
    expect(config).toContain("field.boolean({ name: 'published'")
    expect(config).toContain("field.date({ name: 'publishedAt'")
  })

  it('valence.config.ts includes users collection with auth', async () => {
    await run(['init', 'test-app', '-y'])
    const config = getWrittenFile('valence.config.ts')
    expect(config).toContain("slug: 'users'")
    expect(config).toContain('auth: true')
  })

  it('valence.config.ts does NOT include categories, pages, or tags', async () => {
    await run(['init', 'test-app', '-y'])
    const config = getWrittenFile('valence.config.ts')
    expect(config).not.toContain("slug: 'categories'")
    expect(config).not.toContain("slug: 'pages'")
    expect(config).not.toMatch(/^\s*collection\(\{[^}]*slug:\s*'tags'/m)
  })

  it('valence.config.ts posts has no category relation', async () => {
    await run(['init', 'test-app', '-y'])
    const config = getWrittenFile('valence.config.ts')
    expect(config).not.toContain("relationTo: 'categories'")
  })

  it('valence.config.ts has exactly 2 collections', async () => {
    await run(['init', 'test-app', '-y'])
    const config = getWrittenFile('valence.config.ts')
    const collectionMatches = config.match(/collection\(\{/g)
    expect(collectionMatches).toHaveLength(2)
  })
})

describe('init migration SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('migration includes posts and users tables', async () => {
    await run(['init', 'test-app', '-y'])
    const sql = getWrittenFile('001-init.sql')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "posts"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"')
  })

  it('migration does NOT include categories or pages tables', async () => {
    await run(['init', 'test-app', '-y'])
    const sql = getWrittenFile('001-init.sql')
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS "categories"')
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS "pages"')
  })

  it('posts table has body, published, and publishedAt columns', async () => {
    await run(['init', 'test-app', '-y'])
    const sql = getWrittenFile('001-init.sql')
    expect(sql).toContain('"body" TEXT')
    expect(sql).toContain('"published" BOOLEAN')
    expect(sql).toContain('"publishedAt" TIMESTAMPTZ')
  })

  it('posts table has no category FK column', async () => {
    await run(['init', 'test-app', '-y'])
    const sql = getWrittenFile('001-init.sql')
    expect(sql).not.toContain('"category" UUID')
  })

  it('migration includes telemetry tables', async () => {
    await run(['init', 'test-app', '-y'])
    const sql = getWrittenFile('001-init.sql')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "sessions"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "events"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "daily_summaries"')
  })

  it('migration includes document_revisions table', async () => {
    await run(['init', 'test-app', '-y'])
    const sql = getWrittenFile('001-init.sql')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "document_revisions"')
  })
})
