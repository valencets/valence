import { describe, it, expect } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { parseCookies, getCookie, serializeCookie, isSecureTransport } from '../cookies.js'

describe('parseCookies()', () => {
  it('returns an empty map for undefined or empty headers', () => {
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
    expect(parseCookies('   ')).toEqual({})
  })

  it('parses a single name=value pair', () => {
    expect(parseCookies('session_id=abc123')).toEqual({ session_id: 'abc123' })
  })

  it('parses multiple pairs separated by "; "', () => {
    expect(parseCookies('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('tolerates arbitrary surrounding whitespace', () => {
    expect(parseCookies('  a = 1 ;b=2   ; c=3')).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('preserves "=" characters inside the value (e.g. base64url padding)', () => {
    expect(parseCookies('token=YWJj==')).toEqual({ token: 'YWJj==' })
  })

  it('keeps the first occurrence when a name repeats', () => {
    expect(parseCookies('dup=first; dup=second')).toEqual({ dup: 'first' })
  })

  it('skips malformed segments that carry no "="', () => {
    expect(parseCookies('a=1; garbage; b=2')).toEqual({ a: '1', b: '2' })
  })

  it('is not fooled by a name that is a prefix of another cookie', () => {
    const parsed = parseCookies('session_id_backup=wrong; session_id=right')
    expect(parsed.session_id).toBe('right')
  })
})

describe('getCookie()', () => {
  it('returns the value for a present cookie', () => {
    expect(getCookie('a=1; cms_session=xyz', 'cms_session')).toBe('xyz')
  })

  it('returns undefined for an absent cookie or empty header', () => {
    expect(getCookie('a=1', 'b')).toBeUndefined()
    expect(getCookie(undefined, 'a')).toBeUndefined()
    expect(getCookie('', 'a')).toBeUndefined()
  })

  it('does not match a cookie whose name is only a prefix of the requested one', () => {
    expect(getCookie('session=short', 'session_id')).toBeUndefined()
  })

  it('does not match a longer cookie name that starts with the requested one', () => {
    // The classic prefix bug: reading "session_id" must not return "session_id_backup".
    expect(getCookie('session_id_backup=wrong; session_id=right', 'session_id')).toBe('right')
  })

  it('treats the requested name literally, not as a regular expression', () => {
    // A naive `new RegExp(name + '=')` would let "a.b" match "axb=2".
    expect(getCookie('axb=2; a.b=1', 'a.b')).toBe('1')
    expect(getCookie('axb=2', 'a.b')).toBeUndefined()
  })
})

describe('serializeCookie()', () => {
  it('serializes a bare name=value with no attributes', () => {
    expect(serializeCookie('a', '1')).toBe('a=1')
  })

  it('emits the standard attribute set when requested', () => {
    const cookie = serializeCookie('cms_session', 'abc', {
      path: '/',
      maxAge: 7200,
      httpOnly: true,
      sameSite: 'Lax',
      secure: true
    })
    expect(cookie).toContain('cms_session=abc')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=7200')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
  })

  it('omits HttpOnly and Secure when their flags are false', () => {
    const cookie = serializeCookie('a', '1', { httpOnly: false, secure: false, sameSite: 'Lax' })
    expect(cookie).not.toContain('HttpOnly')
    expect(cookie).not.toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('emits Max-Age=0 for an expiring cookie', () => {
    expect(serializeCookie('a', '', { maxAge: 0, path: '/' })).toContain('Max-Age=0')
  })

  it('supports a Domain attribute', () => {
    expect(serializeCookie('a', '1', { domain: 'example.com' })).toContain('Domain=example.com')
  })
})

describe('isSecureTransport()', () => {
  const reqWith = (socket: unknown): IncomingMessage =>
    ({ socket } as unknown as IncomingMessage)

  it('reports true when the underlying socket is TLS-encrypted', () => {
    expect(isSecureTransport(reqWith({ encrypted: true }))).toBe(true)
  })

  it('reports false for a plaintext socket', () => {
    expect(isSecureTransport(reqWith({ encrypted: false }))).toBe(false)
    expect(isSecureTransport(reqWith({}))).toBe(false)
  })

  it('reports false when the socket is missing', () => {
    expect(isSecureTransport(reqWith(undefined))).toBe(false)
  })
})

describe('cookie round-trip properties', () => {
  const rand = (n: number): number => Math.floor(Math.random() * n)
  const nameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'
  // Cookie values may include most token/base64url bytes; exclude the ';'
  // delimiter and whitespace which are not valid unquoted cookie-octets.
  const valueChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.=/+'

  const pick = (alphabet: string, len: number): string => {
    let out = ''
    for (let i = 0; i < len; i++) out += alphabet[rand(alphabet.length)]
    return out
  }

  it('reads back any single serialized name=value pair', () => {
    for (let i = 0; i < 300; i++) {
      const name = pick(nameChars, 1 + rand(24))
      const value = pick(valueChars, rand(40))
      const header = serializeCookie(name, value).split(';')[0] ?? ''
      expect(getCookie(header, name)).toBe(value)
    }
  })

  it('parses every pair back out of a multi-cookie header with unique names', () => {
    for (let iter = 0; iter < 100; iter++) {
      const pairs = new Map<string, string>()
      const count = 1 + rand(8)
      for (let i = 0; i < count; i++) {
        pairs.set(`c${i}_${pick(nameChars, 4)}`, pick(valueChars, rand(20)))
      }
      const header = [...pairs].map(([n, v]) => `${n}=${v}`).join('; ')
      const parsed = parseCookies(header)
      for (const [n, v] of pairs) {
        expect(parsed[n]).toBe(v)
        expect(getCookie(header, n)).toBe(v)
      }
    }
  })
})
