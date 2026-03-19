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

function getWrittenFiles (pattern: string): Array<{ path: string; content: string }> {
  return mockedWriteFile.mock.calls
    .filter(c => String(c[0]).includes(pattern))
    .map(c => ({ path: String(c[0]), content: String(c[1]) }))
}

describe('page scaffold from collections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generates list page for posts collection', async () => {
    await run(['init', 'test-app', '-y'])
    const files = getWrittenFiles('pages/posts/ui/index.html')
    expect(files).toHaveLength(1)
    const html = files[0]!.content
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('--val-')
    expect(html).toContain('/api/posts')
  })

  it('generates detail page for posts collection', async () => {
    await run(['init', 'test-app', '-y'])
    const files = getWrittenFiles('pages/posts/ui/detail.html')
    expect(files).toHaveLength(1)
    const html = files[0]!.content
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('/api/posts/')
  })

  it('list page uses Valence design tokens', async () => {
    await run(['init', 'test-app', '-y'])
    const files = getWrittenFiles('pages/posts/ui/index.html')
    const html = files[0]!.content
    expect(html).toContain('var(--val-color-')
    expect(html).toContain('var(--val-font-')
  })

  it('does not generate pages for auth collections (users)', async () => {
    await run(['init', 'test-app', '-y'])
    const userPages = getWrittenFiles('pages/users/')
    expect(userPages).toHaveLength(0)
  })

  it('list page links to detail pages', async () => {
    await run(['init', 'test-app', '-y'])
    const files = getWrittenFiles('pages/posts/ui/index.html')
    const html = files[0]!.content
    expect(html).toContain('/posts/')
  })
})
