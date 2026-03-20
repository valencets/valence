import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createUploadHandler } from '../media/upload-handler.js'
import { createLocalStorage } from '../media/storage-adapter.js'
import type { UploadConfig } from '../media/media-config.js'
import { mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import sharp from 'sharp'

async function createTestImageBuffer (width = 400, height = 300): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer()
}

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

describe('upload handler with image processing', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-upload-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('processes image sizes when uploadConfig has imageSizes', async () => {
    const storage = createLocalStorage(testDir)
    const config: UploadConfig = {
      imageSizes: [
        { name: 'thumbnail', width: 100, height: 100, fit: 'cover' }
      ]
    }
    const handler = createUploadHandler(testDir, storage, config)
    const imageBuffer = await createTestImageBuffer()
    const req = mockReq(imageBuffer)
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
    const result = JSON.parse(res._body)
    expect(result.sizes).toBeDefined()
    expect(result.sizes.thumbnail).toBeDefined()
    expect(result.sizes.thumbnail.width).toBe(100)
    expect(result.sizes.thumbnail.height).toBe(100)
  })

  it('stores focal point from request headers', async () => {
    const storage = createLocalStorage(testDir)
    const config: UploadConfig = { focalPoint: true }
    const handler = createUploadHandler(testDir, storage, config)
    const imageBuffer = await createTestImageBuffer()
    const req = mockReq(imageBuffer, { 'x-focal-x': '0.75', 'x-focal-y': '0.25' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
    const result = JSON.parse(res._body)
    expect(result.focalX).toBe(0.75)
    expect(result.focalY).toBe(0.25)
  })

  it('writes variant files to disk via storage adapter', async () => {
    const storage = createLocalStorage(testDir)
    const config: UploadConfig = {
      imageSizes: [
        { name: 'thumb', width: 50, height: 50, fit: 'cover' }
      ]
    }
    const handler = createUploadHandler(testDir, storage, config)
    const imageBuffer = await createTestImageBuffer()
    const req = mockReq(imageBuffer)
    const res = mockRes()

    await handler(req, res as ServerResponse)

    // Should have original + 1 variant = at least 2 files
    const files = readdirSync(testDir)
    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  it('works without storage adapter (backward compat)', async () => {
    const handler = createUploadHandler(testDir)
    const imageBuffer = await createTestImageBuffer()
    const req = mockReq(imageBuffer)
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
    const result = JSON.parse(res._body)
    expect(result.filename).toBeDefined()
    expect(result.storedPath).toBeDefined()
  })

  it('skips image processing for non-image files', async () => {
    const storage = createLocalStorage(testDir)
    const config: UploadConfig = {
      imageSizes: [{ name: 'thumb', width: 50, height: 50 }]
    }
    const handler = createUploadHandler(testDir, storage, config)
    const textBuffer = Buffer.from('hello world')
    const req = mockReq(textBuffer, { 'x-filename': 'readme.txt' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(201)
    const result = JSON.parse(res._body)
    expect(result.sizes).toBeUndefined()
  })
})
