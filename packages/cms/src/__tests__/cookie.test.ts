import { describe, it, expect } from 'vitest'
import { parseCookie } from '../auth/cookie.js'

describe('parseCookie()', () => {
  it('extracts named cookie value', () => {
    expect(parseCookie('cms_session=abc123', 'cms_session')).toBe('abc123')
  })

  it('returns null when cookie not present', () => {
    expect(parseCookie('other=value', 'cms_session')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCookie('', 'cms_session')).toBeNull()
  })

  it('handles multiple cookies', () => {
    expect(parseCookie('foo=bar; cms_session=xyz; baz=qux', 'cms_session')).toBe('xyz')
  })

  it('handles cookie values containing equals sign', () => {
    expect(parseCookie('token=abc=def=ghi', 'token')).toBe('abc=def=ghi')
  })

  it('handles whitespace around semicolons', () => {
    expect(parseCookie('a=1 ; cms_session=val ; b=2', 'cms_session')).toBe('val')
  })

  it('does not match partial cookie names', () => {
    expect(parseCookie('my_cms_session=fake', 'cms_session')).toBeNull()
  })
})
