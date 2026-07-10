import { describe, it, expect } from 'vitest'
import { resolveStaticPath, resolveMimeType } from '@valencets/core/server'

// resolveStaticPath's containment check joins with POSIX '/', so the Ok-path
// output is POSIX-shaped; assert it only on POSIX hosts (CI runs it). The
// rejection cases below are platform-agnostic and always run (#352).
const isWindows = process.platform === 'win32'

describe('static file serving reuse from core', () => {
  it.skipIf(isWindows)('resolveStaticPath resolves a valid path within root', () => {
    const result = resolveStaticPath('/styles.css', '/tmp/public')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/tmp/public/styles.css')
    }
  })

  it('resolveStaticPath rejects null bytes', () => {
    const result = resolveStaticPath('/file\0.txt', '/tmp/public')
    expect(result.isErr()).toBe(true)
  })

  it('resolveStaticPath rejects backslashes', () => {
    const result = resolveStaticPath('/..\\etc\\passwd', '/tmp/public')
    expect(result.isErr()).toBe(true)
  })

  it('resolveStaticPath rejects control characters', () => {
    const result = resolveStaticPath('/file\x01.txt', '/tmp/public')
    expect(result.isErr()).toBe(true)
  })

  it('resolveMimeType returns correct types', () => {
    expect(resolveMimeType('style.css')).toBe('text/css; charset=utf-8')
    expect(resolveMimeType('app.js')).toBe('application/javascript; charset=utf-8')
    expect(resolveMimeType('image.png')).toBe('image/png')
    expect(resolveMimeType('data.json')).toBe('application/json; charset=utf-8')
  })

  it('resolveMimeType returns octet-stream for unknown', () => {
    expect(resolveMimeType('file.xyz')).toBe('application/octet-stream')
  })
})
