import { describe, it, expect } from 'vitest'
import { resolveStaticPath, resolveMimeType } from '@valencets/core/server'

describe('static file serving reuse from core', () => {
  it('resolveStaticPath resolves a valid path within root', () => {
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
