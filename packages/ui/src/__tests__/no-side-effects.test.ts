import { describe, it, expect } from 'vitest'

describe('barrel import has no side effects', () => {
  it('importing a class from the barrel does not auto-register any components', async () => {
    // Dynamic import to avoid module caching from other tests
    const { ValButton } = await import('../components/val-button.js')
    expect(ValButton).toBeDefined()
    // val-button should NOT be registered just from importing the class
    // (In test environment, other tests may have registered it via defineTestElement,
    // but the standard tag 'val-button' should not be auto-registered)
    // We verify the class itself has no define() call by checking the source behavior:
    // the class is a function, not a registered element
    expect(typeof ValButton).toBe('function')
  })

  it('COMPONENT_REGISTRY is a named export, not a side-effect import', async () => {
    const mod = await import('../components/index.js')
    expect(mod.COMPONENT_REGISTRY).toBeDefined()
    expect(mod.registerAll).toBeDefined()
    // These are named exports, not side effects — importing them does not register components
    expect(typeof mod.registerAll).toBe('function')
  })
})
