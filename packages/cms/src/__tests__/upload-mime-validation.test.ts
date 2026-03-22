import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createUploadHandler } from '../media/upload-handler.js'
import { createLocalStorage } from '../media/storage-adapter.js'
import type { UploadConfig } from '../media/media-config.js'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import sharp from 'sharp'

function mockReq (body: Buffer, headers: Record<string, string> = {}): IncomingMessage {
  const readable = new Readable()
  readable.push(body)
  readable.push(null)
  return Object.assign(readable, {
    headers: { 'x-filename': 'test.jpg', ...headers },
    method: 'POST',
    url: '/media/upload'
  }) as IncomingMessage
}

interface MockResponse {
  _status: number
  _body: string
  _headers: Record<string, string | number>
  writeHead: (status: number, headers?: Record<string, string | number>) => void
  end: (body?: string) => void
  setHeader: () => void
}

function mockRes (): MockResponse {
  const res: MockResponse = {
    _status: 0,
    _body: '',
    _headers: {},
    writeHead (status: number, headers?: Record<string, string | number>) {
      res._status = status
      if (headers) Object.assign(res._headers, headers)
    },
    end (body?: string) { res._body = body ?? '' },
    setHeader () {}
  }
  return res
}

// Valid JPEG magic bytes (FF D8 FF)
function validJpegBuffer (): Buffer {
  const buf = Buffer.alloc(64)
  buf[0] = 0xFF
  buf[1] = 0xD8
  buf[2] = 0xFF
  return buf
}

// Valid PNG magic bytes (89 50 4E 47)
function validPngBuffer (): Buffer {
  const buf = Buffer.alloc(64)
  buf[0] = 0x89
  buf[1] = 0x50
  buf[2] = 0x4E
  buf[3] = 0x47
  return buf
}

describe('upload MIME type validation', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-mime-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('rejects .html file upload with 400', async () => {
    const handler = createUploadHandler(testDir)
    const body = Buffer.from('<script>alert("xss")</script>')
    const req = mockReq(body, { 'x-filename': 'malicious.html' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('mime')
  })

  it('rejects .js file upload with 400', async () => {
    const handler = createUploadHandler(testDir)
    const body = Buffer.from('alert("xss")')
    const req = mockReq(body, { 'x-filename': 'exploit.js' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('mime')
  })

  it('rejects .css file upload with 400', async () => {
    const handler = createUploadHandler(testDir)
    const body = Buffer.from('body { background: red }')
    const req = mockReq(body, { 'x-filename': 'evil.css' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('mime')
  })

  it('accepts .jpg upload with valid JPEG magic bytes', async () => {
    const storage = createLocalStorage(testDir)
    const handler = createUploadHandler(testDir, storage)
    const imageBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).jpeg().toBuffer()
    const req = mockReq(imageBuffer, { 'x-filename': 'photo.jpg' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
    const result = JSON.parse(res._body)
    expect(result.mimeType).toBe('image/jpeg')
  })

  it('accepts .pdf upload', async () => {
    const handler = createUploadHandler(testDir)
    const pdfHeader = Buffer.from('%PDF-1.4 fake pdf content')
    const req = mockReq(pdfHeader, { 'x-filename': 'document.pdf' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
    const result = JSON.parse(res._body)
    expect(result.mimeType).toBe('application/pdf')
  })

  it('accepts .mp4 upload', async () => {
    const handler = createUploadHandler(testDir)
    const body = Buffer.alloc(64)
    const req = mockReq(body, { 'x-filename': 'video.mp4' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
    const result = JSON.parse(res._body)
    expect(result.mimeType).toBe('video/mp4')
  })

  it('rejects dangerous MIME types even if explicitly allowed in uploadConfig', async () => {
    const config: UploadConfig = {
      mimeTypes: ['text/html', 'application/javascript']
    }
    const handler = createUploadHandler(testDir, undefined, config)
    const body = Buffer.from('<script>alert("xss")</script>')
    const req = mockReq(body, { 'x-filename': 'page.html' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
  })

  it('respects custom mimeTypes allowlist in uploadConfig', async () => {
    const config: UploadConfig = {
      mimeTypes: ['image/jpeg']
    }
    const handler = createUploadHandler(testDir, undefined, config)
    const pdfBody = Buffer.from('%PDF-1.4 content')
    const req = mockReq(pdfBody, { 'x-filename': 'document.pdf' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('mime')
  })

  it('allows MIME type that is in custom allowlist', async () => {
    const config: UploadConfig = {
      mimeTypes: ['application/pdf']
    }
    const handler = createUploadHandler(testDir, undefined, config)
    const pdfBody = Buffer.from('%PDF-1.4 content')
    const req = mockReq(pdfBody, { 'x-filename': 'document.pdf' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
  })
})

describe('upload magic byte validation', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-magic-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('rejects .jpg file with PNG magic bytes', async () => {
    const handler = createUploadHandler(testDir)
    const pngBytes = validPngBuffer()
    const req = mockReq(pngBytes, { 'x-filename': 'spoofed.jpg' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('magic bytes')
  })

  it('rejects .png file with JPEG magic bytes', async () => {
    const handler = createUploadHandler(testDir)
    const jpegBytes = validJpegBuffer()
    const req = mockReq(jpegBytes, { 'x-filename': 'spoofed.png' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('magic bytes')
  })

  it('rejects .gif file with wrong magic bytes', async () => {
    const handler = createUploadHandler(testDir)
    const randomBytes = Buffer.from('not a gif at all')
    const req = mockReq(randomBytes, { 'x-filename': 'fake.gif' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('magic bytes')
  })

  it('rejects .webp file with wrong magic bytes', async () => {
    const handler = createUploadHandler(testDir)
    const randomBytes = Buffer.from('not a webp file at all!!')
    const req = mockReq(randomBytes, { 'x-filename': 'fake.webp' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('magic bytes')
  })

  it('accepts .jpg file with valid JPEG magic bytes', async () => {
    const handler = createUploadHandler(testDir)
    const imageBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).jpeg().toBuffer()
    const req = mockReq(imageBuffer, { 'x-filename': 'valid.jpg' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
  })

  it('accepts .png file with valid PNG magic bytes', async () => {
    const handler = createUploadHandler(testDir)
    const imageBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toBuffer()
    const req = mockReq(imageBuffer, { 'x-filename': 'valid.png' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
  })

  it('accepts .webp file with valid WebP magic bytes', async () => {
    const handler = createUploadHandler(testDir)
    const imageBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).webp().toBuffer()
    const req = mockReq(imageBuffer, { 'x-filename': 'valid.webp' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
  })

  it('skips magic byte validation for non-image files', async () => {
    const handler = createUploadHandler(testDir)
    const pdfBody = Buffer.from('%PDF-1.4 content')
    const req = mockReq(pdfBody, { 'x-filename': 'document.pdf' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
  })
})

describe('serve handler Content-Disposition', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-serve-cd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('sets Content-Disposition: attachment for non-image files', async () => {
    const { writeFileSync } = await import('node:fs')
    const { createServeHandler } = await import('../media/serve-handler.js')
    writeFileSync(join(testDir, 'doc.pdf'), 'pdf content')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)

    const req = { url: '/media/doc.pdf', method: 'GET', headers: {} } as IncomingMessage
    const res = mockRes()
    await handler(req, res as ServerResponse)

    expect(res._status).toBe(200)
    expect(res._headers['Content-Disposition']).toBe('attachment')
  })

  it('does NOT set Content-Disposition: attachment for image files', async () => {
    const { writeFileSync } = await import('node:fs')
    const { createServeHandler } = await import('../media/serve-handler.js')
    writeFileSync(join(testDir, 'photo.jpg'), 'image data')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)

    const req = { url: '/media/photo.jpg', method: 'GET', headers: {} } as IncomingMessage
    const res = mockRes()
    await handler(req, res as ServerResponse)

    expect(res._status).toBe(200)
    expect(res._headers['Content-Disposition']).toBeUndefined()
  })
})
