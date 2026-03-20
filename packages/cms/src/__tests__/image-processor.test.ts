import { describe, it, expect } from 'vitest'
import { processImageSizes } from '../media/image-processor.js'
import type { FocalPoint } from '../media/image-processor.js'
import type { ImageSize } from '../media/media-config.js'
import sharp from 'sharp'

async function createTestImage (width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  }).png().toBuffer()
}

describe('processImageSizes()', () => {
  it('generates resized variants', async () => {
    const input = await createTestImage(800, 600)
    const sizes: ImageSize[] = [
      { name: 'thumbnail', width: 150, height: 150, fit: 'cover' },
      { name: 'medium', width: 400, height: 300, fit: 'inside' }
    ]
    const result = await processImageSizes(input, sizes)
    expect(result.isOk()).toBe(true)
    const images = result._unsafeUnwrap()
    expect(images).toHaveLength(2)
    expect(images[0]?.name).toBe('thumbnail')
    expect(images[0]?.width).toBe(150)
    expect(images[0]?.height).toBe(150)
    expect(images[1]?.name).toBe('medium')
  })

  it('generates WebP variants when formats includes webp', async () => {
    const input = await createTestImage(400, 300)
    const sizes: ImageSize[] = [
      { name: 'thumb', width: 100, height: 100, fit: 'cover' }
    ]
    const result = await processImageSizes(input, sizes, ['webp'])
    expect(result.isOk()).toBe(true)
    const images = result._unsafeUnwrap()
    expect(images).toHaveLength(2)
    expect(images[0]?.name).toBe('thumb')
    expect(images[1]?.name).toBe('thumb-webp')
    expect(images[1]?.mimeType).toBe('image/webp')
  })

  it('respects the fit option', async () => {
    const input = await createTestImage(800, 400)
    const sizes: ImageSize[] = [
      { name: 'inside', width: 200, height: 200, fit: 'inside' }
    ]
    const result = await processImageSizes(input, sizes)
    expect(result.isOk()).toBe(true)
    const images = result._unsafeUnwrap()
    // 'inside' preserves aspect ratio within bounds
    // 800x400 → fits inside 200x200 → 200x100
    expect(images[0]?.width).toBe(200)
    expect(images[0]?.height).toBe(100)
  })

  it('applies focal point for cover crop', async () => {
    const input = await createTestImage(800, 400)
    const sizes: ImageSize[] = [
      { name: 'square', width: 200, height: 200, fit: 'cover' }
    ]
    const focalPoint: FocalPoint = { x: 0.75, y: 0.25 }
    const result = await processImageSizes(input, sizes, [], focalPoint)
    expect(result.isOk()).toBe(true)
    const images = result._unsafeUnwrap()
    expect(images[0]?.width).toBe(200)
    expect(images[0]?.height).toBe(200)
  })

  it('returns correct filesize and mimeType', async () => {
    const input = await createTestImage(200, 200)
    const sizes: ImageSize[] = [
      { name: 'small', width: 50, height: 50, fit: 'cover' }
    ]
    const result = await processImageSizes(input, sizes)
    expect(result.isOk()).toBe(true)
    const images = result._unsafeUnwrap()
    expect(images[0]?.filesize).toBeGreaterThan(0)
    expect(images[0]?.mimeType).toMatch(/^image\//)
  })

  it('returns Err for invalid input buffer', async () => {
    const badBuffer = Buffer.from('not an image')
    const sizes: ImageSize[] = [
      { name: 'thumb', width: 100, height: 100 }
    ]
    const result = await processImageSizes(badBuffer, sizes)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('INTERNAL')
  })

  it('handles empty sizes array', async () => {
    const input = await createTestImage()
    const result = await processImageSizes(input, [])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })
})
