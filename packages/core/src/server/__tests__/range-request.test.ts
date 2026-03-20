import { describe, it, expect } from 'vitest'
import { parseRangeHeader, serveStaticFile } from '../static-files.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { Writable } from 'node:stream'
import type { ServerResponse } from 'node:http'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpFile (content: Buffer | string): string {
  const dir = join(tmpdir(), `valence-range-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, 'test.mp3')
  writeFileSync(filePath, content)
  return filePath
}

// A Writable stream with observable writeHead, _status, _headers, and written
class MockResponse extends Writable {
  _status: number = 0
  _headers: Record<string, string | number> = {}
  private _chunks: Buffer[] = []

  get written (): Buffer {
    return Buffer.concat(this._chunks)
  }

  writeHead (status: number, headers?: Record<string, string | number>): void {
    this._status = status
    if (headers != null) Object.assign(this._headers, headers)
  }

  override _write (chunk: Buffer, _enc: string, cb: () => void): void {
    this._chunks.push(chunk)
    cb()
  }
}

function mockRes (): MockResponse & ServerResponse {
  return new MockResponse() as MockResponse & ServerResponse
}

// ---------------------------------------------------------------------------
// parseRangeHeader
// ---------------------------------------------------------------------------

describe('parseRangeHeader', () => {
  it('parses a valid byte range', () => {
    const result = parseRangeHeader('bytes=0-499', 1000)
    expect(result.isOk()).toBe(true)
    const range = result._unsafeUnwrap()
    expect(range).not.toBeNull()
    expect(range!.start).toBe(0)
    expect(range!.end).toBe(499)
  })

  it('returns null for no Range header (undefined)', () => {
    const result = parseRangeHeader(undefined, 1000)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('parses an open-ended range (bytes=100-)', () => {
    const result = parseRangeHeader('bytes=100-', 1000)
    expect(result.isOk()).toBe(true)
    const range = result._unsafeUnwrap()
    expect(range!.start).toBe(100)
    expect(range!.end).toBe(999)
  })

  it('parses a suffix range (bytes=-100)', () => {
    const result = parseRangeHeader('bytes=-100', 1000)
    expect(result.isOk()).toBe(true)
    const range = result._unsafeUnwrap()
    expect(range!.start).toBe(900)
    expect(range!.end).toBe(999)
  })

  it('returns Err when start > end', () => {
    const result = parseRangeHeader('bytes=500-100', 1000)
    expect(result.isErr()).toBe(true)
  })

  it('returns Err when start >= fileSize', () => {
    const result = parseRangeHeader('bytes=1000-1999', 1000)
    expect(result.isErr()).toBe(true)
  })

  it('returns Err for malformed Range header', () => {
    const result = parseRangeHeader('invalid', 1000)
    expect(result.isErr()).toBe(true)
  })

  it('clamps end to fileSize - 1', () => {
    const result = parseRangeHeader('bytes=0-9999', 1000)
    expect(result.isOk()).toBe(true)
    const range = result._unsafeUnwrap()
    expect(range!.end).toBe(999)
  })
})

// ---------------------------------------------------------------------------
// serveStaticFile
// ---------------------------------------------------------------------------

describe('serveStaticFile', () => {
  it('serves the full file with 200 and Accept-Ranges when no Range header', async () => {
    const content = Buffer.from('Hello, World! This is test audio content.')
    const filePath = makeTmpFile(content)
    const res = mockRes()

    await serveStaticFile(filePath, 'audio/mpeg', undefined, res)

    expect(res._status).toBe(200)
    expect(res._headers['Accept-Ranges']).toBe('bytes')
    expect(res._headers['Content-Type']).toBe('audio/mpeg')
    expect(res.written.equals(content)).toBe(true)
  })

  it('serves 206 with correct Content-Range for a valid byte range', async () => {
    const content = Buffer.from('ABCDEFGHIJ') // 10 bytes
    const filePath = makeTmpFile(content)
    const res = mockRes()

    await serveStaticFile(filePath, 'audio/mpeg', 'bytes=0-4', res)

    expect(res._status).toBe(206)
    expect(res._headers['Content-Range']).toBe('bytes 0-4/10')
    expect(res._headers['Accept-Ranges']).toBe('bytes')
    expect(res._headers['Content-Length']).toBe(5)
    expect(res.written.toString()).toBe('ABCDE')
  })

  it('serves 206 for open-ended range (bytes=5-)', async () => {
    const content = Buffer.from('ABCDEFGHIJ') // 10 bytes
    const filePath = makeTmpFile(content)
    const res = mockRes()

    await serveStaticFile(filePath, 'audio/mpeg', 'bytes=5-', res)

    expect(res._status).toBe(206)
    expect(res._headers['Content-Range']).toBe('bytes 5-9/10')
    expect(res.written.toString()).toBe('FGHIJ')
  })

  it('serves 206 for suffix range (bytes=-3)', async () => {
    const content = Buffer.from('ABCDEFGHIJ') // 10 bytes
    const filePath = makeTmpFile(content)
    const res = mockRes()

    await serveStaticFile(filePath, 'audio/mpeg', 'bytes=-3', res)

    expect(res._status).toBe(206)
    expect(res._headers['Content-Range']).toBe('bytes 7-9/10')
    expect(res.written.toString()).toBe('HIJ')
  })

  it('responds 416 when range is beyond file size', async () => {
    const content = Buffer.from('ABCDEFGHIJ') // 10 bytes
    const filePath = makeTmpFile(content)
    const res = mockRes()

    await serveStaticFile(filePath, 'audio/mpeg', 'bytes=100-200', res)

    expect(res._status).toBe(416)
    expect(res._headers['Content-Range']).toBe('bytes */10')
  })

  it('responds 416 for malformed Range header', async () => {
    const content = Buffer.from('ABCDEFGHIJ')
    const filePath = makeTmpFile(content)
    const res = mockRes()

    await serveStaticFile(filePath, 'audio/mpeg', 'invalid-range', res)

    expect(res._status).toBe(416)
  })
})
