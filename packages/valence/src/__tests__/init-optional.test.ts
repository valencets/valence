import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile } from 'node:fs/promises'
import { run } from '../cli.js'

// The optional-everything init: a Valence app is routes + pages by
// default. The CMS (database, collections, REST, admin) is opt-in — and
// the CLI scaffolds a Valence app only, no third-party framework choices.

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => undefined)
}))

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => Buffer.from('')),
  execFileSync: vi.fn(() => Buffer.from(''))
}))

const mockedWriteFile = vi.mocked(writeFile)

function getWrittenFile (filename: string): string {
  const call = mockedWriteFile.mock.calls.find(c => String(c[0]).endsWith(filename))
  if (!call) throw new Error(`File ${filename} was not written`)
  return String(call[1])
}

function wasWritten (filename: string): boolean {
  return mockedWriteFile.mock.calls.some(c => String(c[0]).endsWith(filename))
}

describe('minimal init (--minimal)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('scaffolds a config without db, collections, or admin', async () => {
    await run(['init', 'my-site', '-y', '--minimal'])
    const config = getWrittenFile('valence.config.ts')
    expect(config).toContain('defineConfig')
    expect(config).not.toContain('db:')
    expect(config).not.toContain('collection(')
    expect(config).not.toContain('admin:')
    expect(config).toContain('routes:')
  })

  it('writes no migrations and no docker-compose', async () => {
    await run(['init', 'my-site', '-y', '--minimal'])
    expect(wasWritten('001-init.sql')).toBe(false)
    expect(wasWritten('docker-compose.yml')).toBe(false)
  })

  it('writes an .env without database variables but with a CSPRNG secret', async () => {
    await run(['init', 'my-site', '-y', '--minimal'])
    const env = getWrittenFile('.env')
    expect(env).not.toContain('DB_HOST')
    expect(env).not.toContain('DB_PASSWORD')
    expect(env).toMatch(/CMS_SECRET=[0-9a-f]{64}/)
    expect(env).toContain('PORT=')
  })

  it('scaffolds a starter page instead of the CMS source tree', async () => {
    await run(['init', 'my-site', '-y', '--minimal'])
    expect(wasWritten('index.html')).toBe(true)
  })
})

describe('the CLI builds Valence apps only', () => {
  it('cli source offers no third-party framework choices', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.ts'),
      'utf-8'
    )
    expect(source).not.toMatch(/astro/i)
    expect(source).not.toMatch(/frontend framework/i)
    expect(source).not.toMatch(/react/i)
  })
})

describe('cms init provisions the database properly', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('writes a docker-compose.yml so postgres can be stood up when absent', async () => {
    await run(['init', 'test-app', '-y', '--no-db', '--no-migrate', '--no-seed'])
    const compose = getWrittenFile('docker-compose.yml')
    expect(compose).toContain('postgres:16')
    expect(compose).toContain('POSTGRES_DB: test_app')
    expect(compose).toContain('POSTGRES_USER: postgres')
  })

  it('keeps the full CMS scaffold when the CMS is chosen', async () => {
    await run(['init', 'test-app', '-y'])
    const config = getWrittenFile('valence.config.ts')
    expect(config).toContain("slug: 'posts'")
    expect(config).toContain('admin:')
    expect(wasWritten('001-init.sql')).toBe(true)
  })
})
