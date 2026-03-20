import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServeHandler, buildMediaUrl } from '../media/serve-handler.js'
import { createLocalStorage } from '../media/storage-adapter.js'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface MockRequest {
  url: string
  method: string
  headers: Record<string, string>
}

function mockReq (url: string): MockRequest {
  return { url, method: 'GET', headers: {} }
}

interface MockResponse {
  _status: number
  _body: Buffer
  _headers: Record<string, string | number>
  writeHead: (s: number, h?: Record<string, string | number>) => void
  end: (data?: Buffer | string) => void
  setHeader: () => void
}

function mockRes (): MockResponse {
  const chunks: Buffer[] = []
  const res: MockResponse = {
    _status: 0,
    _headers: {},
    get _body () { return Buffer.concat(chunks) },
    writeHead (s: number, h?: Record<string, string | number>) { res._status = s; if (h) Object.assign(res._headers, h) },
    end (data?: Buffer | string) { if (data) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)) },
    setHeader () {}
  }
  return res
}

describe('serve handler with storage adapter', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-serve-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('serves a file via storage adapter', async () => {
    writeFileSync(join(testDir, 'test.jpg'), 'image data')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)
    const req = mockReq('/media/test.jpg')
    const res = mockRes()
    await handler(req as IncomingMessage, res as ServerResponse)
    expect(res._status).toBe(200)
    expect(res._body.toString()).toBe('image data')
    expect(res._headers['Content-Type']).toBe('image/jpeg')
  })

  it('returns 404 for missing file via storage adapter', async () => {
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)
    const req = mockReq('/media/nonexistent.jpg')
    const res = mockRes()
    await handler(req as IncomingMessage, res as ServerResponse)
    expect(res._status).toBe(404)
  })

  it('still works without storage adapter (backward compat)', async () => {
    writeFileSync(join(testDir, 'legacy.jpg'), 'legacy data')
    const handler = createServeHandler(testDir)
    const req = mockReq('/media/legacy.jpg')
    const res = mockRes()
    await handler(req as IncomingMessage, res as ServerResponse)
    expect(res._status).toBe(200)
    expect(res._body.toString()).toBe('legacy data')
  })

  it('sets immutable cache headers', async () => {
    writeFileSync(join(testDir, 'cached.jpg'), 'cached')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)
    const req = mockReq('/media/cached.jpg')
    const res = mockRes()
    await handler(req as IncomingMessage, res as ServerResponse)
    expect(res._headers['Cache-Control']).toContain('immutable')
  })
})

describe('buildMediaUrl()', () => {
  it('returns base media URL without size', () => {
    expect(buildMediaUrl('abc123.jpg')).toBe('/media/abc123.jpg')
  })

  it('returns size-specific URL', () => {
    expect(buildMediaUrl('abc123.jpg', 'thumbnail')).toBe('/media/abc123-thumbnail.jpg')
  })

  it('handles filenames with no extension', () => {
    expect(buildMediaUrl('abc123', 'thumb')).toBe('/media/abc123-thumb')
  })

  it('URL-encodes special characters', () => {
    expect(buildMediaUrl('file name.jpg')).toBe('/media/file%20name.jpg')
  })
})
