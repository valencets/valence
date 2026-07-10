import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config-loader.js', () => ({
  registerTsxLoader: vi.fn(async () => {}),
  // No database anywhere: tests that pass the secret guard stop at the
  // db-refusal gate instead of touching real infrastructure.
  loadEnvConfig: vi.fn(() => null),
  // Collections make the boot plan require a secret — the guard must run
  // before anything resolves a database.
  loadUserConfig: vi.fn(async () => ({
    collections: [{ slug: 'posts', fields: [], timestamps: true }]
  }))
}))

class ExitError extends Error {
  constructor (public readonly code: number) {
    super(`process.exit(${code})`)
  }
}

describe('runStart CMS_SECRET guard', () => {
  const originalExit = process.exit
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.exit = ((code: number) => { throw new ExitError(code) }) as never
    delete process.env.CMS_SECRET
  })

  afterEach(() => {
    process.exit = originalExit
    if (originalEnv.CMS_SECRET !== undefined) {
      process.env.CMS_SECRET = originalEnv.CMS_SECRET
    }
    vi.clearAllMocks()
  })

  it('exits with code 1 when CMS_SECRET is not set', async () => {
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: string[]) => { errors.push(args.join(' ')) }

    const { runStart } = await import('../cli.js')

    let exitCode: number | undefined
    try {
      await runStart()
    } catch (err) {
      if (err instanceof ExitError) {
        exitCode = err.code
      }
    }

    console.error = originalError

    expect(exitCode).toBe(1)
    expect(errors.some((e) => e.includes('CMS_SECRET'))).toBe(true)
  })

  it('exits with code 1 when CMS_SECRET is the dev fallback "dev-secret"', async () => {
    process.env.CMS_SECRET = 'dev-secret'
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: string[]) => { errors.push(args.join(' ')) }

    const { runStart } = await import('../cli.js')

    let exitCode: number | undefined
    try {
      await runStart()
    } catch (err) {
      if (err instanceof ExitError) {
        exitCode = err.code
      }
    }

    console.error = originalError

    expect(exitCode).toBe(1)
    expect(errors.some((e) => e.includes('CMS_SECRET'))).toBe(true)
  })

  it('exits with code 1 when CMS_SECRET is shorter than 32 characters', async () => {
    process.env.CMS_SECRET = 'too-short-to-sign-anything'
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: string[]) => { errors.push(args.join(' ')) }

    const { runStart } = await import('../cli.js')

    let exitCode: number | undefined
    try {
      await runStart()
    } catch (err) {
      if (err instanceof ExitError) {
        exitCode = err.code
      }
    }

    console.error = originalError

    expect(exitCode).toBe(1)
    expect(errors.some((e) => e.includes('CMS_SECRET'))).toBe(true)
  })

  it('boots past the secret guard with a strong secret (fails later on the CMS, not CMS_SECRET)', async () => {
    process.env.CMS_SECRET = 'f'.repeat(64)
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: string[]) => { errors.push(args.join(' ')) }

    const { runStart } = await import('../cli.js')

    let exitCode: number | undefined
    try {
      await runStart()
    } catch (err) {
      if (err instanceof ExitError) {
        exitCode = err.code
      }
    }

    console.error = originalError

    expect(exitCode).toBe(1)
    expect(errors.some((e) => e.includes('CMS_SECRET'))).toBe(false)
    expect(errors.some((e) => e.includes('database'))).toBe(true)
  })
})
