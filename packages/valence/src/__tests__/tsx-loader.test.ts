import { describe, it, expect, vi, afterEach } from 'vitest'

// We test that registerTsxLoader exists and calls node:module register()
// with the correct arguments.

describe('registerTsxLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is exported from config-loader', async () => {
    const mod = await import('../config-loader.js')
    expect(typeof mod.registerTsxLoader).toBe('function')
  })

  it('calls node:module register with tsx/esm', async () => {
    const moduleNs = await import('node:module')
    const registerSpy = vi.spyOn(moduleNs, 'register').mockImplementation(() => undefined as never)

    const { registerTsxLoader } = await import('../config-loader.js')
    registerTsxLoader()

    expect(registerSpy).toHaveBeenCalledOnce()
    expect(registerSpy).toHaveBeenCalledWith('tsx/esm', expect.anything())
  })

  it('is idempotent — second call does not register again', async () => {
    const moduleNs = await import('node:module')
    const registerSpy = vi.spyOn(moduleNs, 'register').mockImplementation(() => undefined as never)

    // Need a fresh module to reset the guard
    vi.resetModules()
    const { registerTsxLoader } = await import('../config-loader.js')
    registerTsxLoader()
    registerTsxLoader()

    expect(registerSpy).toHaveBeenCalledOnce()
  })
})

describe('runDev registers tsx loader', () => {
  it('cli.ts source calls registerTsxLoader before loadUserConfig', async () => {
    const { readFileSync } = await import('node:fs')
    const cliSource = readFileSync(
      new URL('../cli.ts', import.meta.url).pathname.replace('/dist/', '/src/'),
      'utf-8'
    )
    // registerTsxLoader must appear in the imports or top of runDev
    expect(cliSource).toContain('registerTsxLoader')

    // It should be called before loadUserConfig in the runDev function
    const registerIdx = cliSource.indexOf('registerTsxLoader()')
    const loadConfigIdx = cliSource.indexOf('loadUserConfig()', registerIdx)
    expect(registerIdx).toBeGreaterThan(-1)
    expect(loadConfigIdx).toBeGreaterThan(registerIdx)
  })
})
