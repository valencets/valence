import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

describe('registerTsxLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is exported from config-loader', async () => {
    const mod = await import('../config-loader.js')
    expect(typeof mod.registerTsxLoader).toBe('function')
  })

  it('returns a promise', async () => {
    const { registerTsxLoader } = await import('../config-loader.js')
    const result = registerTsxLoader()
    expect(result).toBeInstanceOf(Promise)
    await result
  })

  it('does not throw when called', async () => {
    const { registerTsxLoader } = await import('../config-loader.js')
    // Should not reject — tsx/esm/api is available as a dependency
    await expect(registerTsxLoader()).resolves.toBeUndefined()
  })

  it('source uses tsx/esm/api register, not node:module register', () => {
    const source = readFileSync(
      new URL('../config-loader.ts', import.meta.url).pathname.replace('/dist/', '/src/'),
      'utf-8'
    )
    // Must dynamically import tsx/esm/api
    expect(source).toContain('tsx/esm/api')
    // Must call register() from the tsx API
    expect(source).toMatch(/import\s*\(\s*['"]tsx\/esm\/api['"]/)
    // Must NOT use node:module register for tsx loading
    expect(source).not.toMatch(/register\s*\(\s*['"]tsx\/esm['"]/)
  })

  it('source has idempotency guard', () => {
    const source = readFileSync(
      new URL('../config-loader.ts', import.meta.url).pathname.replace('/dist/', '/src/'),
      'utf-8'
    )
    // Must have a guard variable and early return
    expect(source).toContain('tsxRegistered')
    expect(source).toMatch(/if\s*\(\s*tsxRegistered\s*\)\s*return/)
  })
})

describe('runDev registers tsx loader', () => {
  it('cli.ts imports registerTsxLoader from config-loader', () => {
    const cliSource = readFileSync(
      new URL('../cli.ts', import.meta.url).pathname.replace('/dist/', '/src/'),
      'utf-8'
    )
    expect(cliSource).toMatch(/import\s+\{[^}]*registerTsxLoader[^}]*\}\s+from\s+['"].\/config-loader\.js['"]/)
  })

  it('cli.ts awaits registerTsxLoader before loadUserConfig in runDev', () => {
    const cliSource = readFileSync(
      new URL('../cli.ts', import.meta.url).pathname.replace('/dist/', '/src/'),
      'utf-8'
    )
    // Must await the call
    const awaitIdx = cliSource.indexOf('await registerTsxLoader()')
    expect(awaitIdx).toBeGreaterThan(-1)
    // loadUserConfig must come after
    const loadConfigIdx = cliSource.indexOf('loadUserConfig()', awaitIdx)
    expect(loadConfigIdx).toBeGreaterThan(awaitIdx)
  })
})
