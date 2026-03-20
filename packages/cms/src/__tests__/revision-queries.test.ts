import { describe, it, expect } from 'vitest'
import { saveRevision, getRevisions, getRevision } from '../db/revision-queries.js'
import { makeMockPool, makeSequentialPool, makeErrorPool } from './test-helpers.js'

describe('saveRevision()', () => {
  it('increments revision number from max', async () => {
    const pool = makeSequentialPool([
      [{ max: 3 }],
      [{ id: 'r1', collection_slug: 'posts', document_id: 'doc1', revision_number: 4, data: {}, created_at: '2026-03-19' }]
    ])

    const result = await saveRevision(pool, 'posts', 'doc1', { title: 'v4' })
    expect(result.isOk()).toBe(true)
    result.match(
      rev => {
        expect(rev.revision_number).toBe(4)
        expect(rev.collection_slug).toBe('posts')
      },
      () => { throw new Error('unexpected err') }
    )
  })

  it('starts at revision 1 when no prior revisions exist', async () => {
    const pool = makeSequentialPool([
      [{ max: null }],
      [{ id: 'r1', collection_slug: 'posts', document_id: 'doc1', revision_number: 1, data: {}, created_at: '2026-03-19' }]
    ])

    const result = await saveRevision(pool, 'posts', 'doc1', { title: 'first' })
    expect(result.isOk()).toBe(true)
    result.match(
      rev => { expect(rev.revision_number).toBe(1) },
      () => { throw new Error('unexpected err') }
    )
  })

  it('returns Err on database error', async () => {
    const pool = makeErrorPool(new Error('DB connection lost'))
    const result = await saveRevision(pool, 'posts', 'doc1', { title: 'fail' })
    expect(result.isErr()).toBe(true)
  })
})

describe('getRevisions()', () => {
  it('returns array of revisions', async () => {
    const pool = makeMockPool([
      { id: 'r2', collection_slug: 'posts', document_id: 'doc1', revision_number: 2, data: '{}', created_at: '2026-03-19T12:00:00Z' },
      { id: 'r1', collection_slug: 'posts', document_id: 'doc1', revision_number: 1, data: '{}', created_at: '2026-03-19T11:00:00Z' }
    ])

    const result = await getRevisions(pool, 'posts', 'doc1')
    expect(result.isOk()).toBe(true)
    result.match(
      rows => {
        expect(rows).toHaveLength(2)
        expect(rows[0]?.revision_number).toBe(2)
      },
      () => { throw new Error('unexpected err') }
    )
  })

  it('returns empty array when no revisions exist', async () => {
    const pool = makeMockPool([])
    const result = await getRevisions(pool, 'posts', 'doc1')
    expect(result.isOk()).toBe(true)
    result.match(
      rows => { expect(rows).toHaveLength(0) },
      () => { throw new Error('unexpected err') }
    )
  })

  it('returns Err on database error', async () => {
    const pool = makeErrorPool(new Error('DB error'))
    const result = await getRevisions(pool, 'posts', 'doc1')
    expect(result.isErr()).toBe(true)
  })
})

describe('getRevision()', () => {
  it('returns single revision by number', async () => {
    const pool = makeMockPool([
      { id: 'r1', collection_slug: 'posts', document_id: 'doc1', revision_number: 1, data: '{"title":"v1"}', created_at: '2026-03-19' }
    ])

    const result = await getRevision(pool, 'posts', 'doc1', 1)
    expect(result.isOk()).toBe(true)
    result.match(
      rev => {
        expect(rev).not.toBeNull()
        expect(rev?.revision_number).toBe(1)
      },
      () => { throw new Error('unexpected err') }
    )
  })

  it('returns null when revision not found', async () => {
    const pool = makeMockPool([])
    const result = await getRevision(pool, 'posts', 'doc1', 99)
    expect(result.isOk()).toBe(true)
    result.match(
      rev => { expect(rev).toBeNull() },
      () => { throw new Error('unexpected err') }
    )
  })

  it('returns Err on database error', async () => {
    const pool = makeErrorPool(new Error('timeout'))
    const result = await getRevision(pool, 'posts', 'doc1', 1)
    expect(result.isErr()).toBe(true)
  })
})
