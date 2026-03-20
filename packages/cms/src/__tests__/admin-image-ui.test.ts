import { describe, it, expect } from 'vitest'
import { renderFieldInput } from '../admin/field-renderers.js'
import type { UploadContext } from '../admin/field-renderers.js'

describe('media upload field with image UI', () => {
  const mediaField = { type: 'media' as const, name: 'cover', relationTo: 'media' }

  it('renders focal point selector when focalPoint is enabled', () => {
    const ctx: UploadContext = {
      focalPoint: true,
      focalX: 0.75,
      focalY: 0.25,
      storedPath: 'abc123.jpg'
    }
    const html = renderFieldInput(mediaField, 'abc123', undefined, ctx)
    expect(html).toContain('focal-point-selector')
    expect(html).toContain('focal-point-marker')
    expect(html).toContain('focalX')
    expect(html).toContain('0.75')
  })

  it('renders variant thumbnails when sizes provided', () => {
    const ctx: UploadContext = {
      storedPath: 'abc123.jpg',
      sizes: {
        thumbnail: { filename: 'abc123-thumbnail.jpg', width: 150, height: 150 },
        medium: { filename: 'abc123-medium.jpg', width: 800, height: 600 }
      }
    }
    const html = renderFieldInput(mediaField, 'abc123', undefined, ctx)
    expect(html).toContain('variant-thumbnails')
    expect(html).toContain('abc123-thumbnail.jpg')
    expect(html).toContain('150\u00d7150')
    expect(html).toContain('abc123-medium.jpg')
  })

  it('renders drag-and-drop zone', () => {
    const html = renderFieldInput(mediaField, '', undefined, undefined)
    expect(html).toContain('media-drop-zone')
    expect(html).toContain('Drop file here')
  })

  it('renders basic preview without uploadContext', () => {
    const html = renderFieldInput(mediaField, 'somefile.jpg')
    expect(html).toContain('somefile.jpg')
    expect(html).not.toContain('focal-point')
    expect(html).not.toContain('variant-thumbnails')
  })

  it('renders image preview when storedPath provided without focal point', () => {
    const ctx: UploadContext = {
      storedPath: 'abc123.jpg'
    }
    const html = renderFieldInput(mediaField, 'abc123', undefined, ctx)
    expect(html).toContain('media-preview')
    expect(html).toContain('/media/abc123.jpg')
    expect(html).not.toContain('focal-point-selector')
  })
})
