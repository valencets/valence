import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir } from 'node:fs/promises'
import { run } from '../cli.js'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => undefined)
}))

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => Buffer.from(''))
}))

const mockedWriteFile = vi.mocked(writeFile)
const mockedMkdir = vi.mocked(mkdir)

function getWrittenFile (filename: string): string | undefined {
  const call = mockedWriteFile.mock.calls.find(c => String(c[0]).endsWith(filename))
  if (!call) return undefined
  return String(call[1])
}

function getDirsCreated (): string[] {
  return mockedMkdir.mock.calls.map(c => String(c[0]))
}

describe('FSD scaffold during init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates src/app/ directory', async () => {
    await run(['init', 'test-app', '-y'])
    const dirs = getDirsCreated()
    expect(dirs.some(d => d.endsWith('src/app'))).toBe(true)
  })

  it('creates src/pages/home/ui/ directory', async () => {
    await run(['init', 'test-app', '-y'])
    const dirs = getDirsCreated()
    expect(dirs.some(d => d.endsWith('src/pages/home/ui'))).toBe(true)
  })

  it('creates src/entities/posts/ directories', async () => {
    await run(['init', 'test-app', '-y'])
    const dirs = getDirsCreated()
    expect(dirs.some(d => d.endsWith('src/entities/posts/api'))).toBe(true)
    expect(dirs.some(d => d.endsWith('src/entities/posts/model'))).toBe(true)
  })

  it('creates src/features/ directory', async () => {
    await run(['init', 'test-app', '-y'])
    const dirs = getDirsCreated()
    expect(dirs.some(d => d.endsWith('src/features'))).toBe(true)
  })

  it('creates src/shared/api/ and src/shared/ui/ directories', async () => {
    await run(['init', 'test-app', '-y'])
    const dirs = getDirsCreated()
    expect(dirs.some(d => d.endsWith('src/shared/api'))).toBe(true)
    expect(dirs.some(d => d.endsWith('src/shared/ui'))).toBe(true)
  })

  it('writes src/pages/home/ui/index.html', async () => {
    await run(['init', 'test-app', '-y'])
    const html = getWrittenFile('index.html')
    expect(html).toBeDefined()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('--val-')
  })

  it('writes src/app/styles.css with Valence design tokens', async () => {
    await run(['init', 'test-app', '-y'])
    const css = getWrittenFile('styles.css')
    expect(css).toBeDefined()
    expect(css).toContain('--val-')
  })

  it('writes src/shared/api/base-client.ts', async () => {
    await run(['init', 'test-app', '-y'])
    const client = getWrittenFile('base-client.ts')
    expect(client).toBeDefined()
    expect(client).toContain('// @generated')
    expect(client).toContain('apiClient')
  })

  it('writes src/entities/posts/model/types.ts', async () => {
    await run(['init', 'test-app', '-y'])
    const types = getWrittenFile('types.ts')
    expect(types).toBeDefined()
    expect(types).toContain('// @generated')
    expect(types).toContain('interface Post')
  })

  it('writes src/entities/posts/api/client.ts', async () => {
    await run(['init', 'test-app', '-y'])
    const client = mockedWriteFile.mock.calls.find(
      c => String(c[0]).includes('entities/posts/api/client.ts')
    )
    expect(client).toBeDefined()
    const content = String(client![1])
    expect(content).toContain('// @generated')
    expect(content).toContain('posts')
  })

  it('does not scaffold entities for auth collections (users)', async () => {
    await run(['init', 'test-app', '-y'])
    const dirs = getDirsCreated()
    expect(dirs.some(d => d.includes('entities/users'))).toBe(false)
  })

  it('does not create templates/ directory', async () => {
    await run(['init', 'test-app', '-y'])
    const dirs = getDirsCreated()
    expect(dirs.some(d => d.endsWith('/templates'))).toBe(false)
  })
})
