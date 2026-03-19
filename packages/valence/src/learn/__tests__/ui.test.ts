import { describe, it, expect } from 'vitest'
import { renderLearnPage } from '../ui.js'
import { createInitialProgress } from '../state.js'
import type { LearnProgress } from '../types.js'

function freshProgress (): LearnProgress {
  return createInitialProgress({ posts: 1, users: 0 })
}

function progressWith (completedIds: ReadonlyArray<string>): LearnProgress {
  const base = freshProgress()
  const steps = { ...base.steps }
  for (const id of completedIds) {
    steps[id as keyof typeof steps] = { completed: true, completedAt: new Date().toISOString() }
  }
  return { ...base, steps }
}

describe('renderLearnPage', () => {
  it('returns valid HTML document', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes Valence Learn title', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('Valence Learn')
  })

  it('shows progress bar with 0 of 6 for fresh progress', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('0 of 6')
  })

  it('shows progress bar with correct count for partially completed', () => {
    const progress = progressWith(['visit-admin', 'create-post', 'hit-api'])
    const html = renderLearnPage(progress, 3000)
    expect(html).toContain('3 of 6')
  })

  it('shows 6 of 6 and celebration when all complete', () => {
    const progress = progressWith([
      'visit-admin', 'create-post', 'hit-api',
      'add-collection', 'create-user', 'create-file'
    ])
    const html = renderLearnPage(progress, 3000)
    expect(html).toContain('6 of 6')
    expect(html).toContain('complete')
  })

  it('includes step titles for all 6 steps', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('Visit the Admin Panel')
    expect(html).toContain('Create a Post')
    expect(html).toContain('Hit the REST API')
    expect(html).toContain('Add a New Collection')
    expect(html).toContain('Create an Admin User')
    expect(html).toContain('Create a Custom TypeScript File')
  })

  it('includes polling script targeting /_learn/api/progress', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('/_learn/api/progress')
  })

  it('includes copy button functionality', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('clipboard')
  })

  it('includes footer links to admin and docs', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('/admin')
    expect(html).toContain('Documentation')
  })

  it('uses dark theme colors', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('--val-color-bg')
    expect(html).toContain('--val-color-primary')
  })

  it('includes exit learn mode link', () => {
    const html = renderLearnPage(freshProgress(), 3000)
    expect(html).toContain('Exit Learn Mode')
  })

  it('includes correct port in API URL links', () => {
    const html = renderLearnPage(freshProgress(), 4000)
    expect(html).toContain('localhost:4000/api/posts')
  })
})
