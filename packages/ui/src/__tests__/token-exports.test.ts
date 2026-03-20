import { describe, it, expect } from 'vitest'

describe('token sheet exports', () => {
  it('exports createTokenSheet from main entry', async () => {
    const mod = await import('../index.js')
    expect(typeof mod.createTokenSheet).toBe('function')
  })

  it('exports mergeTokenSheets from main entry', async () => {
    const mod = await import('../index.js')
    expect(typeof mod.mergeTokenSheets).toBe('function')
  })

  it('exports ThemeMode from main entry', async () => {
    const mod = await import('../index.js')
    expect(mod.ThemeMode).toBeDefined()
  })

  it('exports lightTokenSheet from main entry', async () => {
    const mod = await import('../index.js')
    expect(mod.lightTokenSheet).toBeDefined()
  })

  it('exports darkTokenSheet from main entry', async () => {
    const mod = await import('../index.js')
    expect(mod.darkTokenSheet).toBeDefined()
  })
})
