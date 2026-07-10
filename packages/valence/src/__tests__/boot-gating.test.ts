import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// The optional-everything boot: `valence start` derives what to mount from
// the config alone. A routes-only app boots with no database, no CMS, no
// admin, and no CMS_SECRET; database features refuse to boot without a
// database and NAME the feature that demanded it.

const listen = vi.fn((_port: number, cb?: () => void) => { if (cb) cb(); return fakeServer })
const fakeServer = { listen, close: vi.fn() }

vi.mock('node:http', () => ({
  createServer: vi.fn(() => fakeServer)
}))

vi.mock('../config-loader.js', () => ({
  registerTsxLoader: vi.fn(async () => {}),
  loadEnvConfig: vi.fn(() => null),
  loadUserConfig: vi.fn(async () => ({ collections: [] }))
}))

vi.mock('../codegen/regenerate.js', () => ({
  ensureGeneratedModules: vi.fn(async () => {}),
  regenerateFromConfig: vi.fn()
}))

class ExitError extends Error {
  constructor (public readonly code: number) {
    super(`process.exit(${code})`)
  }
}

describe('runStart — optional-everything boot', () => {
  const originalExit = process.exit
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.exit = ((code: number) => { throw new ExitError(code) }) as never
    delete process.env.CMS_SECRET
  })

  afterEach(() => {
    process.exit = originalExit
    if (originalEnv.CMS_SECRET !== undefined) process.env.CMS_SECRET = originalEnv.CMS_SECRET
  })

  it('boots a routes-only app with no database and no CMS_SECRET', async () => {
    const { loadUserConfig } = await import('../config-loader.js')
    vi.mocked(loadUserConfig).mockResolvedValueOnce({
      collections: [],
      routes: [{ path: '/api/hello', loader: async () => ({ data: { ok: true } }) }]
    })

    const { runStart } = await import('../cli.js')

    let exitCode: number | undefined
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: string[]) => { errors.push(args.join(' ')) }
    try {
      await runStart()
    } catch (err) {
      if (err instanceof ExitError) exitCode = err.code
    }
    console.error = originalError

    expect(exitCode).toBeUndefined()
    expect(listen).toHaveBeenCalled()
    expect(errors).toHaveLength(0)
  })

  it('refuses to boot collections without a database, naming the feature', async () => {
    process.env.CMS_SECRET = 'f'.repeat(64)
    const { loadUserConfig } = await import('../config-loader.js')
    vi.mocked(loadUserConfig).mockResolvedValueOnce({
      collections: [{ slug: 'posts', fields: [], timestamps: true }] as never
    })

    const { runStart } = await import('../cli.js')

    let exitCode: number | undefined
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: string[]) => { errors.push(args.join(' ')) }
    try {
      await runStart()
    } catch (err) {
      if (err instanceof ExitError) exitCode = err.code
    }
    console.error = originalError

    expect(exitCode).toBe(1)
    const message = errors.join(' ')
    expect(message).toContain('collections')
    expect(message).toContain('database')
  })
})

describe('boot gating source guards', () => {
  function cliSource (): string {
    return readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.ts'),
      'utf-8'
    ).replace(/\r\n/g, '\n')
  }

  it('both pipelines gate the admin panel behind the boot plan', () => {
    const mounts = cliSource().match(/plan\.mountAdmin/g) ?? []
    expect(mounts.length).toBeGreaterThanOrEqual(2)
  })

  it('dev provisions the dev database only when the plan needs it', () => {
    const source = cliSource()
    const devBody = source.slice(source.indexOf('async function runDev'), source.indexOf('// -- start --'))
    const planAt = devBody.indexOf('planBoot(')
    const provisionAt = devBody.indexOf('ensureDevDatabase(')
    expect(planAt).toBeGreaterThan(-1)
    expect(provisionAt).toBeGreaterThan(planAt)
  })

  it('the secret guard runs only when the plan requires a secret', () => {
    const guards = cliSource().match(/plan\.requiresSecret/g) ?? []
    expect(guards.length).toBeGreaterThanOrEqual(1)
  })
})
