import { describe, it, expect } from 'vitest'
import { isUploadEnabled, getMediaFields, getMimeType } from '../media/media-config.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('isUploadEnabled()', () => {
  it('returns true for collections with upload: true', () => {
    const media = collection({
      slug: 'media',
      upload: true,
      fields: [field.text({ name: 'alt' })]
    })
    expect(isUploadEnabled(media)).toBe(true)
  })

  it('returns false for collections without upload', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(isUploadEnabled(posts)).toBe(false)
  })
})

describe('getMediaFields()', () => {
  it('returns auto-injected fields for upload collections', () => {
    const fields = getMediaFields()
    const names = fields.map(f => f.name)
    expect(names).toContain('filename')
    expect(names).toContain('mimeType')
    expect(names).toContain('filesize')
    expect(names).toContain('storedPath')
    expect(names).toContain('altText')
  })
})

describe('getMimeType()', () => {
  it('maps common extensions', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg')
    expect(getMimeType('photo.jpeg')).toBe('image/jpeg')
    expect(getMimeType('image.png')).toBe('image/png')
    expect(getMimeType('image.webp')).toBe('image/webp')
    expect(getMimeType('image.gif')).toBe('image/gif')
    expect(getMimeType('image.svg')).toBe('image/svg+xml')
    expect(getMimeType('doc.pdf')).toBe('application/pdf')
    expect(getMimeType('data.json')).toBe('application/json')
  })

  it('returns application/octet-stream for unknown extensions', () => {
    expect(getMimeType('file.xyz')).toBe('application/octet-stream')
  })

  it('handles filenames with multiple dots', () => {
    expect(getMimeType('my.photo.jpg')).toBe('image/jpeg')
  })
})
