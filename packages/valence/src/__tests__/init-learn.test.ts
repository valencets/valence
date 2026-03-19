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

function getWrittenFile (filename: string): string | null {
  const call = mockedWriteFile.mock.calls.find(c => String(c[0]).endsWith(filename))
  if (!call) return null
  return String(call[1])
}

function wasFileWritten (filename: string): boolean {
  return mockedWriteFile.mock.calls.some(c => String(c[0]).endsWith(filename))
}

describe('init --learn flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates .valence/learn.json when --learn is passed', async () => {
    await run(['init', 'test-learn', '--learn', '-y'])
    expect(wasFileWritten('learn.json')).toBe(true)
    const content = getWrittenFile('learn.json')!
    const parsed = JSON.parse(content)
    expect(parsed.enabled).toBe(true)
    expect(parsed.steps['visit-admin'].completed).toBe(false)
  })

  it('does not create learn.json with just -y (no --learn)', async () => {
    await run(['init', 'test-no-learn', '-y'])
    expect(wasFileWritten('learn.json')).toBe(false)
  })

  it('adds .valence/ to .gitignore when --learn is used', async () => {
    await run(['init', 'test-learn-gi', '--learn', '-y'])
    const gitignore = getWrittenFile('.gitignore')!
    expect(gitignore).toContain('.valence/')
  })

  it('uses enriched config template with teaching comments when --learn', async () => {
    await run(['init', 'test-learn-cfg', '--learn', '-y'])
    const config = getWrittenFile('valence.config.ts')!
    expect(config).toContain('LEARN MODE')
    expect(config).toContain('tags')
  })

  it('normal config template has no LEARN MODE comments', async () => {
    await run(['init', 'test-normal', '-y'])
    const config = getWrittenFile('valence.config.ts')!
    expect(config).not.toContain('LEARN MODE')
  })

  it('learn.json has initial counts of zero for fresh project', async () => {
    await run(['init', 'test-counts', '--learn', '-y'])
    const content = getWrittenFile('learn.json')!
    const parsed = JSON.parse(content)
    expect(parsed.initialCounts.posts).toBe(0)
    expect(parsed.initialCounts.users).toBe(0)
  })

  it('--yes takes precedence: -y without --learn means no learn mode', async () => {
    await run(['init', 'test-yes-only', '-y'])
    expect(wasFileWritten('learn.json')).toBe(false)
  })
})
