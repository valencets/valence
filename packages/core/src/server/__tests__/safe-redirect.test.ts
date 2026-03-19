import { describe, it, expect } from 'vitest'
import { safeRedirect } from '../safe-redirect.js'

describe('safeRedirect', () => {
  it('returns valid relative path unchanged', () => {
    expect(safeRedirect('/admin')).toBe('/admin')
  })

  it('returns path with query string unchanged', () => {
    expect(safeRedirect('/admin?page=2')).toBe('/admin?page=2')
  })

  it('rejects absolute external URL', () => {
    expect(safeRedirect('https://evil.com')).toBe('/')
  })

  it('rejects protocol-relative URL', () => {
    expect(safeRedirect('//evil.com')).toBe('/')
  })

  it('rejects backslash trick', () => {
    expect(safeRedirect('/\\evil.com')).toBe('/')
  })

  it('rejects javascript: protocol', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe('/')
  })

  it('rejects data: protocol', () => {
    expect(safeRedirect('data:text/html,<h1>hi</h1>')).toBe('/')
  })

  it('rejects control characters', () => {
    expect(safeRedirect('/admin\x01')).toBe('/')
    expect(safeRedirect('/admin\x0a')).toBe('/')
    expect(safeRedirect('/admin\x0d')).toBe('/')
  })

  it('returns fallback for empty string', () => {
    expect(safeRedirect('')).toBe('/')
  })

  it('uses custom fallback', () => {
    expect(safeRedirect('https://evil.com', '/dashboard')).toBe('/dashboard')
  })

  it('uses custom fallback for empty string', () => {
    expect(safeRedirect('', '/home')).toBe('/home')
  })
})
