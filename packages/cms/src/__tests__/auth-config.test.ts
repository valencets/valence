import { describe, it, expect } from 'vitest'
import { isAuthEnabled, getAuthConfig } from '../auth/auth-config.js'
import type { AuthConfig } from '../auth/auth-config.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('isAuthEnabled()', () => {
  it('returns true for collections with auth: true', () => {
    const users = collection({
      slug: 'users',
      auth: true,
      fields: [field.text({ name: 'name' })]
    })
    expect(isAuthEnabled(users)).toBe(true)
  })

  it('returns false for collections without auth', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(isAuthEnabled(posts)).toBe(false)
  })
})

describe('getAuthConfig()', () => {
  it('returns default auth config', () => {
    const config = getAuthConfig({})
    expect(config.tokenExpiration).toBe(7200)
    expect(config.maxLoginAttempts).toBe(5)
    expect(config.lockTime).toBe(600)
  })

  it('accepts overrides', () => {
    const config = getAuthConfig({ tokenExpiration: 3600, maxLoginAttempts: 3 })
    expect(config.tokenExpiration).toBe(3600)
    expect(config.maxLoginAttempts).toBe(3)
    expect(config.lockTime).toBe(600)
  })
})

describe('AuthConfig', () => {
  it('satisfies the interface', () => {
    const config: AuthConfig = {
      tokenExpiration: 7200,
      maxLoginAttempts: 5,
      lockTime: 600
    }
    expect(config.tokenExpiration).toBe(7200)
  })
})
