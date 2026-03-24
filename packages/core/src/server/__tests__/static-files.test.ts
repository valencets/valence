import { describe, it, expect } from 'vitest'
import { resolveMimeType, resolveStaticPath } from '../static-files.js'

describe('resolveMimeType', () => {
  it('returns text/html for .html', () => {
    expect(resolveMimeType('page.html')).toBe('text/html; charset=utf-8')
  })

  it('returns text/css for .css', () => {
    expect(resolveMimeType('styles.css')).toBe('text/css; charset=utf-8')
  })

  it('returns application/javascript for .js', () => {
    expect(resolveMimeType('app.js')).toBe('application/javascript; charset=utf-8')
  })

  it('returns application/json for .json', () => {
    expect(resolveMimeType('data.json')).toBe('application/json; charset=utf-8')
  })

  it('returns image/svg+xml for .svg', () => {
    expect(resolveMimeType('logo.svg')).toBe('image/svg+xml')
  })

  it('returns image/png for .png', () => {
    expect(resolveMimeType('photo.png')).toBe('image/png')
  })

  it('returns application/octet-stream for unknown', () => {
    expect(resolveMimeType('file.xyz')).toBe('application/octet-stream')
  })
})

describe('resolveStaticPath', () => {
  it('returns Ok for valid path within root', () => {
    const result = resolveStaticPath('/styles.css', '/srv/public')
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe('/srv/public/styles.css')
  })

  it('resolves traversal attempts safely within root', () => {
    const result = resolveStaticPath('/../../../etc/passwd', '/srv/public')
    expect(result.isOk()).toBe(true)
    // resolve normalizes .. within the root, never escapes
    expect(result.unwrap().startsWith('/srv/public')).toBe(true)
  })

  it('resolves encoded paths safely within root', () => {
    const result = resolveStaticPath('/%2e%2e/secret', '/srv/public')
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().startsWith('/srv/public')).toBe(true)
  })

  it('normalizes slashes', () => {
    const result = resolveStaticPath('/assets/css/main.css', '/srv/public')
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe('/srv/public/assets/css/main.css')
  })

  it('rejects null bytes', () => {
    const result = resolveStaticPath('/file\0.js', '/srv/public')
    expect(result.isErr()).toBe(true)
  })

  it('rejects backslash in path', () => {
    const result = resolveStaticPath('/foo\\bar', '/srv/public')
    expect(result.isErr()).toBe(true)
  })

  it('rejects encoded backslash %5c', () => {
    const result = resolveStaticPath('/foo%5cbar', '/srv/public')
    expect(result.isErr()).toBe(true)
  })

  it('rejects encoded backslash %5C', () => {
    const result = resolveStaticPath('/foo%5Cbar', '/srv/public')
    expect(result.isErr()).toBe(true)
  })

  it('rejects control characters in path', () => {
    const result = resolveStaticPath('/foo\x01bar', '/srv/public')
    expect(result.isErr()).toBe(true)
  })

  it('returns Err for malformed percent-encoding instead of throwing', () => {
    expect(() => resolveStaticPath('/%C0', '/srv/public')).not.toThrow()
    const result = resolveStaticPath('/%C0', '/srv/public')
    expect(result.isErr()).toBe(true)
  })

  it('returns Err for incomplete percent-encoding instead of throwing', () => {
    expect(() => resolveStaticPath('/%', '/srv/public')).not.toThrow()
    const result = resolveStaticPath('/%', '/srv/public')
    expect(result.isErr()).toBe(true)
  })
})
