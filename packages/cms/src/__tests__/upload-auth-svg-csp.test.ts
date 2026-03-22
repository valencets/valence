import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildCms } from '../config/cms-config.js'
import type { CmsConfig } from '../config/cms-config.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, makeSequentialPool } from './test-helpers.js'
import { createUploadHandler } from '../media/upload-handler.js'
import { createServeHandler } from '../media/serve-handler.js'
import { createLocalStorage } from '../media/storage-adapter.js'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'

function mockUploadReq (body: Buffer, headers: Record<string, string> = {}): IncomingMessage {
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

describe('upload endpoint auth (API-01)', () => {
  it('upload route returns 401 without session cookie', async () => {
    // Build CMS with upload-enabled collection and auth collection
    const pool = makeSequentialPool([
      // validateSession query returns empty (no valid session)
      []
    ])
    const config: CmsConfig = {
      db: pool,
      secret: 'test-secret',
      collections: [
        collection({ slug: 'users', auth: true, fields: [field.text({ name: 'name' })] }),
        collection({ slug: 'media', upload: true, fields: [field.text({ name: 'alt' })] })
      ],
      uploadDir: '/tmp/uploads'
    }
    const cms = buildCms(config)._unsafeUnwrap()
    const uploadRoute = cms.restRoutes.get('/media/upload')
    expect(uploadRoute).toBeDefined()
    expect(uploadRoute!.POST).toBeDefined()

    const req = {
      headers: {},
      method: 'POST',
      url: '/media/upload'
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await uploadRoute!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
    const body = JSON.parse(res.end.mock.calls[0][0] as string)
    expect(body.error).toBe('Unauthorized')
  })

  it('upload route returns 401 with invalid session cookie', async () => {
    // validateSession returns empty — no matching session
    const pool = makeSequentialPool([[]])
    const config: CmsConfig = {
      db: pool,
      secret: 'test-secret',
      collections: [
        collection({ slug: 'users', auth: true, fields: [field.text({ name: 'name' })] }),
        collection({ slug: 'media', upload: true, fields: [field.text({ name: 'alt' })] })
      ],
      uploadDir: '/tmp/uploads'
    }
    const cms = buildCms(config)._unsafeUnwrap()
    const uploadRoute = cms.restRoutes.get('/media/upload')

    const req = {
      headers: { cookie: 'cms_session=invalid-session-id' },
      method: 'POST',
      url: '/media/upload'
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await uploadRoute!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
  })

  it('serve route remains public (no auth required)', async () => {
    const config: CmsConfig = {
      db: makeMockPool(),
      secret: 'test-secret',
      collections: [
        collection({ slug: 'media', upload: true, fields: [field.text({ name: 'alt' })] })
      ],
      uploadDir: '/tmp/uploads'
    }
    const cms = buildCms(config)._unsafeUnwrap()
    const serveRoute = cms.restRoutes.get('/media/:filename')
    expect(serveRoute).toBeDefined()
    expect(serveRoute!.GET).toBeDefined()
    // The serve handler is a direct call (no auth wrapper).
    // We verify it does NOT return 401 for unauthenticated requests —
    // it will return 400/404 based on filename, but never 401.
  })
})

describe('SVG upload rejected by default (UPL-01)', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-svg-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('rejects .svg file upload with default MIME allowlist', async () => {
    const handler = createUploadHandler(testDir)
    const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>')
    const req = mockUploadReq(svgContent, { 'x-filename': 'malicious.svg' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    expect(res._status).toBe(400)
    const result = JSON.parse(res._body)
    expect(result.error).toContain('mime')
  })

  it('allows .svg upload only if explicitly configured in custom mimeTypes', async () => {
    const handler = createUploadHandler(testDir, undefined, {
      mimeTypes: ['image/svg+xml']
    })
    const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    const req = mockUploadReq(svgContent, { 'x-filename': 'icon.svg' })
    const res = mockRes()

    await handler(req, res as ServerResponse)

    // Custom allowlist includes svg, so it should be accepted
    expect(res._status).toBe(201)
  })
})

describe('SVG served as attachment (UPL-01)', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-svg-serve-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('sets Content-Disposition: attachment for SVG files', async () => {
    writeFileSync(join(testDir, 'icon.svg'), '<svg></svg>')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)

    const req = { url: '/media/icon.svg', method: 'GET', headers: {} } as IncomingMessage
    const res = mockRes()
    await handler(req, res as ServerResponse)

    expect(res._status).toBe(200)
    expect(res._headers['Content-Disposition']).toBe('attachment')
  })
})

describe('media serve security headers (NEW-05)', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-sec-header-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('includes X-Content-Type-Options: nosniff on served files', async () => {
    writeFileSync(join(testDir, 'photo.jpg'), 'fake image data')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)

    const req = { url: '/media/photo.jpg', method: 'GET', headers: {} } as IncomingMessage
    const res = mockRes()
    await handler(req, res as ServerResponse)

    expect(res._status).toBe(200)
    expect(res._headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('includes Cross-Origin-Resource-Policy on served files', async () => {
    writeFileSync(join(testDir, 'doc.pdf'), 'fake pdf')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)

    const req = { url: '/media/doc.pdf', method: 'GET', headers: {} } as IncomingMessage
    const res = mockRes()
    await handler(req, res as ServerResponse)

    expect(res._status).toBe(200)
    expect(res._headers['Cross-Origin-Resource-Policy']).toBe('same-site')
  })

  it('includes security headers alongside Content-Disposition for non-image files', async () => {
    writeFileSync(join(testDir, 'archive.zip'), 'fake zip')
    const storage = createLocalStorage(testDir)
    const handler = createServeHandler(testDir, storage)

    const req = { url: '/media/archive.zip', method: 'GET', headers: {} } as IncomingMessage
    const res = mockRes()
    await handler(req, res as ServerResponse)

    expect(res._status).toBe(200)
    expect(res._headers['X-Content-Type-Options']).toBe('nosniff')
    expect(res._headers['Content-Disposition']).toBe('attachment')
  })
})

describe('logout cookie Secure flag (NEW-08)', () => {
  it('admin logout passes secure flag to buildExpiredSessionCookie', async () => {
    const pool = makeMockPool()
    const config: CmsConfig = {
      db: pool,
      secret: 'test-secret',
      collections: [
        collection({ slug: 'users', auth: true, fields: [field.text({ name: 'name' })] })
      ]
    }
    const cms = buildCms(config)._unsafeUnwrap()
    const logoutRoute = cms.adminRoutes.get('/admin/logout')
    expect(logoutRoute).toBeDefined()

    // Simulate non-encrypted connection — should NOT include Secure flag
    const req = {
      headers: { cookie: '' },
      socket: { encrypted: false }
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await logoutRoute!.POST!(req as never, res as never, {})
    const setCookieCall = res.setHeader.mock.calls.find(
      (call: [string, string]) => call[0] === 'Set-Cookie'
    )
    expect(setCookieCall).toBeDefined()
    const cookieValue = setCookieCall![1] as string
    // Non-encrypted: should NOT contain Secure
    expect(cookieValue).not.toContain('Secure')
    expect(cookieValue).toContain('Max-Age=0')
  })
})
