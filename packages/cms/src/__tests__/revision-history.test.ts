import { describe, it, expect } from 'vitest'
import { saveRevision, getRevisions, getRevision } from '../db/revision-queries.js'
import { renderRevisionList, renderRevisionDiff } from '../admin/revision-view.js'

describe('saveRevision()', () => {
  it('is a function', () => {
    expect(typeof saveRevision).toBe('function')
  })
})

describe('getRevisions()', () => {
  it('is a function', () => {
    expect(typeof getRevisions).toBe('function')
  })
})

describe('getRevision()', () => {
  it('is a function', () => {
    expect(typeof getRevision).toBe('function')
  })
})

describe('renderRevisionList()', () => {
  it('renders empty state when no revisions', () => {
    const html = renderRevisionList('posts', 'abc', [])
    expect(html).toContain('No revisions')
  })

  it('renders revision rows with timestamps', () => {
    const revisions = [
      { id: 'r1', revision_number: 2, created_at: '2026-03-19T12:00:00Z' },
      { id: 'r2', revision_number: 1, created_at: '2026-03-19T11:00:00Z' }
    ]
    const html = renderRevisionList('posts', 'abc', revisions)
    expect(html).toContain('Revision 2')
    expect(html).toContain('Revision 1')
    expect(html).toContain('/admin/posts/abc/history/')
  })

  it('links back to edit page', () => {
    const html = renderRevisionList('posts', 'abc', [])
    expect(html).toContain('/admin/posts/abc/edit')
  })
})

describe('renderRevisionDiff()', () => {
  it('shows field-by-field comparison', () => {
    const oldData = { title: 'Old Title', body: 'Same body' }
    const newData = { title: 'New Title', body: 'Same body' }
    const html = renderRevisionDiff('posts', 'abc', 1, oldData, newData)
    expect(html).toContain('Old Title')
    expect(html).toContain('New Title')
    expect(html).toContain('title')
  })

  it('highlights changed fields', () => {
    const oldData = { title: 'Old' }
    const newData = { title: 'New' }
    const html = renderRevisionDiff('posts', 'abc', 1, oldData, newData)
    expect(html).toContain('diff-changed')
  })

  it('does not highlight unchanged fields', () => {
    const oldData = { title: 'Same' }
    const newData = { title: 'Same' }
    const html = renderRevisionDiff('posts', 'abc', 1, oldData, newData)
    expect(html).not.toContain('diff-changed')
  })

  it('links back to history list', () => {
    const html = renderRevisionDiff('posts', 'abc', 1, {}, {})
    expect(html).toContain('/admin/posts/abc/history')
  })
})
