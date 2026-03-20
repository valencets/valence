import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config-loader.js', () => ({
  registerTsxLoader: vi.fn(async () => {}),
  loadEnvConfig: vi.fn(() => ({
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: 'test'
  })),
  loadUserConfig: vi.fn(async () => null)
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
})
