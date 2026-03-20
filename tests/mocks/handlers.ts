import { http, HttpResponse } from 'msw'

/**
 * Base URL for all API requests. Override via MSW's `baseUrl` option
 * or by adjusting handlers at runtime with `server.use(...)`.
 */
const BASE = ''

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  email: 'admin@test.com',
  name: 'Test Admin'
} as const

const mockDoc = {
  id: 'doc-1',
  title: 'Test Document',
  status: 'draft',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null
} as const

const mockUpload = {
  filename: 'image.png',
  storedPath: 'abc123def456.png',
  mimeType: 'image/png',
  filesize: 12_345
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paginatedResponse (docs: ReadonlyArray<Record<string, unknown>>) {
  return {
    docs,
    totalDocs: docs.length,
    page: 1,
    totalPages: 1,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false
  }
}

// ---------------------------------------------------------------------------
// Handlers — match actual CMS REST API response shapes
// ---------------------------------------------------------------------------

export const handlers = [
  // ── Collection CRUD ────────────────────────────────────────────────

  /** POST /api/:collection — create entry (201) */
  http.post(`${BASE}/api/:collection`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { id: 'doc-new', ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
      { status: 201 }
    )
  }),

  /** GET /api/:collection — list entries (paginated when ?page= present, array otherwise) */
  http.get(`${BASE}/api/:collection`, ({ request }) => {
    const url = new URL(request.url)
    const page = url.searchParams.get('page')
    if (page !== null) {
      return HttpResponse.json(paginatedResponse([mockDoc]))
    }
    return HttpResponse.json([mockDoc])
  }),

  /** GET /api/:collection/:id — single entry */
  http.get(`${BASE}/api/:collection/:id`, () => {
    return HttpResponse.json(mockDoc)
  }),

  /** PATCH /api/:collection/:id — update entry */
  http.patch(`${BASE}/api/:collection/:id`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockDoc, ...body, updated_at: new Date().toISOString() })
  }),

  /** DELETE /api/:collection/:id — delete entry */
  http.delete(`${BASE}/api/:collection/:id`, () => {
    return HttpResponse.json(mockDoc)
  }),

  // ── Auth ───────────────────────────────────────────────────────────

  /** POST /api/users/login — authenticate */
  http.post(`${BASE}/api/users/login`, () => {
    return HttpResponse.json(
      { user: mockUser },
      {
        headers: {
          'Set-Cookie': 'cms_session=mock-session-id; Path=/; HttpOnly; SameSite=Strict'
        }
      }
    )
  }),

  /** POST /api/users/logout — clear session */
  http.post(`${BASE}/api/users/logout`, () => {
    return HttpResponse.json(
      { message: 'Logged out' },
      {
        headers: {
          'Set-Cookie': 'cms_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
        }
      }
    )
  }),

  /** GET /api/users/me — current user */
  http.get(`${BASE}/api/users/me`, () => {
    return HttpResponse.json(mockUser)
  }),

  // ── Media ──────────────────────────────────────────────────────────

  /** POST /media/upload — file upload (201) */
  http.post(`${BASE}/media/upload`, () => {
    return HttpResponse.json(mockUpload, { status: 201 })
  }),

  /** GET /media/:filename — serve file */
  http.get(`${BASE}/media/:filename`, () => {
    return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4E, 0x47]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' }
    })
  })
]
