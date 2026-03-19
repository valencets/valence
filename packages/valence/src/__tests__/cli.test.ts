import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { run } from '../cli.js'
import { existsSync } from 'node:fs'
import { rm, readFile, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('CLI', () => {
  it('prints usage when no command given', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => { logs.push(msg) }
    await run([])
    console.log = originalLog
    expect(logs.some((l) => l.includes('Usage:'))).toBe(true)
  })

  it('prints usage for unknown command', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => { logs.push(msg) }
    await run(['nonexistent'])
    console.log = originalLog
    expect(logs.some((l) => l.includes('Usage:'))).toBe(true)
  })
})

describe('valence init', () => {
  let testDir: string
  let originalCwd: string
  let originalLog: typeof console.log

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'valence-init-'))
    originalCwd = process.cwd()
    originalLog = console.log
    console.log = () => {}
    process.chdir(testDir)
  })

  afterEach(async () => {
    console.log = originalLog
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  it('creates project directory with expected structure', async () => {
    await run(['init', 'myapp'])
    const dir = join(testDir, 'myapp')

    expect(existsSync(join(dir, 'package.json'))).toBe(true)
    expect(existsSync(join(dir, 'valence.config.ts'))).toBe(true)
    expect(existsSync(join(dir, 'tsconfig.json'))).toBe(true)
    expect(existsSync(join(dir, 'collections'))).toBe(true)
    expect(existsSync(join(dir, 'migrations'))).toBe(true)
    expect(existsSync(join(dir, 'public'))).toBe(true)
  })

  it('package.json has valence dependency and scripts', async () => {
    await run(['init', 'hello'])
    const pkg = JSON.parse(await readFile(join(testDir, 'hello', 'package.json'), 'utf-8'))

    expect(pkg.dependencies['@valencets/valence']).toBeDefined()
    expect(pkg.scripts.dev).toBe('valence dev')
    expect(pkg.scripts.build).toBe('valence build')
    expect(pkg.scripts.migrate).toBe('valence migrate')
  })

  it('config uses defineConfig with a posts collection', async () => {
    await run(['init', 'mysite'])
    const config = await readFile(join(testDir, 'mysite', 'valence.config.ts'), 'utf-8')

    expect(config).toContain('defineConfig')
    expect(config).toContain("slug: 'posts'")
    expect(config).toContain('field.text')
  })

  it('defaults project name to my-valence-app when not specified', async () => {
    await run(['init'])
    expect(existsSync(join(testDir, 'my-valence-app', 'package.json'))).toBe(true)
  })

  it('creates .env.example with database connection', async () => {
    await run(['init', 'testproj'])
    expect(existsSync(join(testDir, 'testproj', '.env.example'))).toBe(true)
    const env = await readFile(join(testDir, 'testproj', '.env.example'), 'utf-8')
    expect(env).toContain('DB_HOST')
  })

  it('creates .gitignore', async () => {
    await run(['init', 'testproj'])
    expect(existsSync(join(testDir, 'testproj', '.gitignore'))).toBe(true)
    const gitignore = await readFile(join(testDir, 'testproj', '.gitignore'), 'utf-8')
    expect(gitignore).toContain('node_modules')
    expect(gitignore).toContain('dist')
    expect(gitignore).toContain('.env')
  })
})
