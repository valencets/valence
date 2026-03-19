import { describe, it, expect } from 'vitest'
import { getMimeType, getMediaFields, isUploadEnabled } from '../media/index.js'

describe('getMimeType', () => {
  it('maps jpg to image/jpeg', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg')
  })

  it('maps png to image/png', () => {
    expect(getMimeType('logo.png')).toBe('image/png')
  })

  it('maps svg to image/svg+xml', () => {
    expect(getMimeType('icon.svg')).toBe('image/svg+xml')
  })

  it('maps pdf to application/pdf', () => {
    expect(getMimeType('doc.pdf')).toBe('application/pdf')
  })

  it('maps webp to image/webp', () => {
    expect(getMimeType('hero.webp')).toBe('image/webp')
  })

  it('maps mp4 to video/mp4', () => {
    expect(getMimeType('clip.mp4')).toBe('video/mp4')
  })

  it('maps css to text/css', () => {
    expect(getMimeType('styles.css')).toBe('text/css')
  })

  it('returns application/octet-stream for unknown extension', () => {
    expect(getMimeType('data.xyz')).toBe('application/octet-stream')
  })

  it('handles filenames with multiple dots', () => {
    expect(getMimeType('my.photo.backup.jpg')).toBe('image/jpeg')
  })
})

describe('getMediaFields', () => {
  it('returns 5 auto-injected fields', () => {
    const fields = getMediaFields()
    expect(fields.length).toBe(5)
  })

  it('includes filename, mimeType, filesize, storedPath, altText', () => {
    const fields = getMediaFields()
    const names = fields.map((f) => f.name)
    expect(names).toContain('filename')
    expect(names).toContain('mimeType')
    expect(names).toContain('filesize')
    expect(names).toContain('storedPath')
    expect(names).toContain('altText')
  })

  it('filename is required', () => {
    const fields = getMediaFields()
    const filename = fields.find((f) => f.name === 'filename')
    expect(filename?.required).toBe(true)
  })

  it('altText is optional', () => {
    const fields = getMediaFields()
    const alt = fields.find((f) => f.name === 'altText')
    expect(alt?.required).not.toBe(true)
  })
})

describe('isUploadEnabled', () => {
  it('returns true when upload is true', () => {
    expect(isUploadEnabled({ slug: 'media', upload: true, fields: [] })).toBe(true)
  })

  it('returns false when upload is undefined', () => {
    expect(isUploadEnabled({ slug: 'posts', fields: [] })).toBe(false)
  })

  it('returns false when upload is false', () => {
    expect(isUploadEnabled({ slug: 'posts', upload: false, fields: [] })).toBe(false)
  })
})

describe('filename security', () => {
  const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

  it('accepts normal filenames', () => {
    expect(SAFE_FILENAME_RE.test('photo.jpg')).toBe(true)
    expect(SAFE_FILENAME_RE.test('my-file.png')).toBe(true)
    expect(SAFE_FILENAME_RE.test('document_v2.pdf')).toBe(true)
  })

  it('rejects path traversal', () => {
    expect(SAFE_FILENAME_RE.test('../etc/passwd')).toBe(false)
    expect(SAFE_FILENAME_RE.test('../../secret')).toBe(false)
  })

  it('rejects hidden files', () => {
    expect(SAFE_FILENAME_RE.test('.env')).toBe(false)
    expect(SAFE_FILENAME_RE.test('.htaccess')).toBe(false)
  })

  it('rejects filenames starting with special chars', () => {
    expect(SAFE_FILENAME_RE.test('-file.txt')).toBe(false)
    expect(SAFE_FILENAME_RE.test('_file.txt')).toBe(false)
  })

  it('rejects null bytes and control characters', () => {
    expect(SAFE_FILENAME_RE.test('file\0.txt')).toBe(false)
    expect(SAFE_FILENAME_RE.test('file\n.txt')).toBe(false)
  })
})
