import { describe, it, expect } from 'vitest'
import { COMPONENT_REGISTRY, registerAll } from '../components/register.js'

describe('registerAll', () => {
  it('COMPONENT_REGISTRY contains all 23 components', () => {
    expect(Object.keys(COMPONENT_REGISTRY).length).toBe(23)
  })

  it('every registry entry has a valid tag name', () => {
    for (const tag of Object.keys(COMPONENT_REGISTRY)) {
      expect(tag).toMatch(/^val-[a-z-]+$/)
    }
  })

  it('every registry entry is a constructor', () => {
    for (const ctor of Object.values(COMPONENT_REGISTRY)) {
      expect(typeof ctor).toBe('function')
      expect(ctor.prototype).toBeDefined()
    }
  })

  it('registerAll defines all components', () => {
    registerAll()
    for (const tag of Object.keys(COMPONENT_REGISTRY)) {
      expect(customElements.get(tag)).toBeDefined()
    }
  })

  it('registerAll is idempotent — calling twice does not throw', () => {
    registerAll()
    expect(() => registerAll()).not.toThrow()
  })
})
