import { describe, it, expect } from 'vitest'
import { injectAuthFields, getAuthFields } from '../auth/auth-config.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('getAuthFields()', () => {
  it('returns email and password_hash fields', () => {
    const fields = getAuthFields()
    const names = fields.map(f => f.name)
    expect(names).toContain('email')
    expect(names).toContain('password_hash')
  })

  it('email is required and unique', () => {
    const emailField = getAuthFields().find(f => f.name === 'email')
    expect(emailField?.required).toBe(true)
    expect(emailField?.unique).toBe(true)
  })

  it('password_hash is hidden', () => {
    const pwField = getAuthFields().find(f => f.name === 'password_hash')
    expect(pwField?.hidden).toBe(true)
  })
})

describe('injectAuthFields()', () => {
  it('adds email and password_hash to auth-enabled collections', () => {
    const users = collection({
      slug: 'users',
      auth: true,
      fields: [field.text({ name: 'name' })]
    })
    const injected = injectAuthFields(users)
    const names = injected.fields.map(f => f.name)
    expect(names).toContain('name')
    expect(names).toContain('email')
    expect(names).toContain('password_hash')
  })

  it('does not duplicate if email already exists', () => {
    const users = collection({
      slug: 'users',
      auth: true,
      fields: [
        field.text({ name: 'name' }),
        field.text({ name: 'email', required: true, unique: true })
      ]
    })
    const injected = injectAuthFields(users)
    const emailCount = injected.fields.filter(f => f.name === 'email').length
    expect(emailCount).toBe(1)
  })

  it('does nothing for non-auth collections', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    const result = injectAuthFields(posts)
    expect(result.fields).toHaveLength(1)
  })
})
