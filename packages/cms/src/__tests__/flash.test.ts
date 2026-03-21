import { describe, it, expect, vi } from 'vitest'
import { serializeFlash, parseFlash, setFlashCookie, clearFlashCookie, readFlash } from '../admin/flash.js'
import type { FlashMessage } from '../admin/flash.js'
import type { ServerResponse } from 'node:http'

describe('serializeFlash / parseFlash', () => {
  it('round-trips a success message', () => {
    const msg: FlashMessage = { type: 'success', text: 'Post created' }
    const encoded = serializeFlash(msg)
    expect(parseFlash(encoded)).toEqual(msg)
  })

  it('round-trips an error message', () => {
    const msg: FlashMessage = { type: 'error', text: 'Validation failed: title is required' }
    const encoded = serializeFlash(msg)
    expect(parseFlash(encoded)).toEqual(msg)
  })

  it('round-trips an info message', () => {
    const msg: FlashMessage = { type: 'info', text: 'Draft saved' }
    const encoded = serializeFlash(msg)
    expect(parseFlash(encoded)).toEqual(msg)
  })

  it('produces a cookie-safe base64url string', () => {
    const encoded = serializeFlash({ type: 'success', text: 'OK' })
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns null for invalid base64', () => {
    expect(parseFlash('%%%')).toBeNull()
  })

  it('returns null for valid base64 but invalid JSON', () => {
    const bad = Buffer.from('not json', 'utf-8').toString('base64url')
    expect(parseFlash(bad)).toBeNull()
  })

  it('returns null for JSON with invalid type field', () => {
    const bad = Buffer.from(JSON.stringify({ type: 'warning', text: 'x' }), 'utf-8').toString('base64url')
    expect(parseFlash(bad)).toBeNull()
  })

  it('returns null for JSON missing text field', () => {
    const bad = Buffer.from(JSON.stringify({ type: 'success' }), 'utf-8').toString('base64url')
    expect(parseFlash(bad)).toBeNull()
  })
})

describe('setFlashCookie', () => {
  it('sets Set-Cookie header with correct attributes', () => {
    const res = { setHeader: vi.fn() } as Partial<ServerResponse> as ServerResponse
    setFlashCookie(res, { type: 'success', text: 'Created' })
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('cms_flash='))
    const cookie = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    expect(cookie).toContain('Path=/admin')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Max-Age=30')
  })
})

describe('clearFlashCookie', () => {
  it('sets expired cookie to clear', () => {
    const res = { setHeader: vi.fn() } as Partial<ServerResponse> as ServerResponse
    clearFlashCookie(res)
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Max-Age=0'))
  })
})

describe('readFlash', () => {
  it('reads flash message from cookie header', () => {
    const msg: FlashMessage = { type: 'error', text: 'Something broke' }
    const encoded = serializeFlash(msg)
    const header = `other=abc; cms_flash=${encoded}; session=xyz`
    expect(readFlash(header)).toEqual(msg)
  })

  it('returns null when no cms_flash cookie exists', () => {
    expect(readFlash('session=abc')).toBeNull()
  })

  it('returns null for empty cookie header', () => {
    expect(readFlash('')).toBeNull()
  })
})
