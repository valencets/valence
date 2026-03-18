import { describe, it, expect } from 'vitest'
import { isValidSlug, isValidEmail } from '../validation/validators.js'

describe('isValidSlug()', () => {
  it('accepts lowercase alphanumeric with hyphens', () => {
    expect(isValidSlug('hello-world')).toBe(true)
    expect(isValidSlug('my-page-123')).toBe(true)
    expect(isValidSlug('a')).toBe(true)
  })

  it('rejects uppercase', () => {
    expect(isValidSlug('Hello')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(isValidSlug('hello world')).toBe(false)
  })

  it('rejects leading/trailing hyphens', () => {
    expect(isValidSlug('-hello')).toBe(false)
    expect(isValidSlug('hello-')).toBe(false)
  })

  it('rejects consecutive hyphens', () => {
    expect(isValidSlug('hello--world')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(isValidSlug('hello_world')).toBe(false)
    expect(isValidSlug('hello.world')).toBe(false)
    expect(isValidSlug('hello/world')).toBe(false)
  })
})

describe('isValidEmail()', () => {
  it('accepts standard email formats', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('first.last@domain.co.uk')).toBe(true)
    expect(isValidEmail('user+tag@example.com')).toBe(true)
  })

  it('rejects missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects missing local part', () => {
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})
