import { describe, it, expect } from 'vitest'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { isUploadEnabled, getUploadConfig } from '../media/media-config.js'
import type { UploadConfig, ImageSize } from '../media/media-config.js'

describe('UploadConfig types', () => {
  it('collection accepts boolean upload (backward compat)', () => {
    const media = collection({
      slug: 'media',
      upload: true,
      fields: [field.text({ name: 'alt' })]
    })
    expect(media.upload).toBe(true)
  })

  it('collection accepts UploadConfig object', () => {
    const config: UploadConfig = {
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 5_242_880,
      imageSizes: [
        { name: 'thumbnail', width: 150, height: 150, fit: 'cover' },
        { name: 'medium', width: 800, height: 600, fit: 'inside' }
      ],
      focalPoint: true,
      formats: ['webp']
    }
    const media = collection({
      slug: 'media',
      upload: config,
      fields: [field.text({ name: 'alt' })]
    })
    expect(media.upload).toEqual(config)
  })

  it('collection allows omitting upload', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(posts.upload).toBeUndefined()
  })
})

describe('isUploadEnabled()', () => {
  it('returns true for upload: true', () => {
    const media = collection({
      slug: 'media',
      upload: true,
      fields: [field.text({ name: 'alt' })]
    })
    expect(isUploadEnabled(media)).toBe(true)
  })

  it('returns true for UploadConfig object', () => {
    const media = collection({
      slug: 'media',
      upload: { mimeTypes: ['image/jpeg'] },
      fields: [field.text({ name: 'alt' })]
    })
    expect(isUploadEnabled(media)).toBe(true)
  })

  it('returns false when upload is undefined', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(isUploadEnabled(posts)).toBe(false)
  })
})

describe('getUploadConfig()', () => {
  it('returns empty config for upload: true', () => {
    const media = collection({
      slug: 'media',
      upload: true,
      fields: [field.text({ name: 'alt' })]
    })
    expect(getUploadConfig(media)).toEqual({})
  })

  it('returns the config object for UploadConfig', () => {
    const config: UploadConfig = {
      mimeTypes: ['image/jpeg'],
      imageSizes: [{ name: 'thumb', width: 100, height: 100 }],
      focalPoint: true
    }
    const media = collection({
      slug: 'media',
      upload: config,
      fields: [field.text({ name: 'alt' })]
    })
    expect(getUploadConfig(media)).toEqual(config)
  })

  it('returns null when upload is undefined', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(getUploadConfig(posts)).toBeNull()
  })

  it('ImageSize supports all fit options', () => {
    const sizes: ImageSize[] = [
      { name: 'a', width: 100, height: 100, fit: 'cover' },
      { name: 'b', width: 100, height: 100, fit: 'contain' },
      { name: 'c', width: 100, height: 100, fit: 'fill' },
      { name: 'd', width: 100, height: 100, fit: 'inside' },
      { name: 'e', width: 100, height: 100, fit: 'outside' },
      { name: 'f', width: 100, height: 100 }
    ]
    expect(sizes).toHaveLength(6)
  })
})
