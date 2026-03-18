import type { IncomingMessage, ServerResponse } from 'node:http'
import { ResultAsync } from 'neverthrow'

import type { CmsError } from '../schema/types.js'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import type { RestRouteEntry } from '../api/rest-api.js'
import type { DocumentData } from '../db/query-builder.js'
import { renderLayout } from './layout.js'
import { renderDashboard } from './dashboard.js'
import { renderListView } from './list-view.js'
import { renderEditView } from './edit-view.js'
import { createLocalApi } from '../api/local-api.js'
import { createGlobalRegistry } from '../schema/registry.js'
import { validateSession } from '../auth/session.js'
import { parseCookie } from '../auth/cookie.js'
import { generateCsrfToken, validateCsrfToken } from '../auth/csrf.js'
import { escapeHtml } from './escape.js'
import { readStringBody } from '../api/read-body.js'
import { generateZodSchema } from '../validation/zod-generator.js'

type AdminRouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

interface AdminOptions {
  readonly requireAuth?: boolean | undefined
}

function wrapWithAuth (pool: DbPool, handler: AdminRouteHandler): AdminRouteHandler {
  return async (req, res, ctx) => {
    const cookieHeader = req.headers.cookie ?? ''
    const sessionId = parseCookie(cookieHeader, 'cms_session')
    if (!sessionId) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }
    const result = await validateSession(sessionId, pool)
    if (result.isErr()) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }
    return handler(req, res, ctx)
  }
}

function safeReadFormBody (req: IncomingMessage): ResultAsync<DocumentData, CmsError> {
  return readStringBody(req).map((body) => {
    const params = new URLSearchParams(body)
    const data: Record<string, string> = {}
    for (const [key, value] of params.entries()) {
      data[key] = value
    }
    return data as DocumentData
  })
}

function sendHtml (res: ServerResponse, html: string, statusCode: number = 200): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html)
  })
  res.end(html)
}

export function createAdminRoutes (
  pool: DbPool,
  collections: CollectionRegistry,
  options: AdminOptions = {}
): Map<string, RestRouteEntry> {
  const wrap = options.requireAuth
    ? (handler: AdminRouteHandler): AdminRouteHandler => wrapWithAuth(pool, handler)
    : (handler: AdminRouteHandler): AdminRouteHandler => handler
  const routes = new Map<string, RestRouteEntry>()
  const allCollections = collections.getAll()
  const globals = createGlobalRegistry()
  const api = createLocalApi(pool, collections, globals)
  const CSRF_TTL_MS = 3_600_000
  const csrfTokens = new Map<string, number>()

  function evictExpiredTokens (): void {
    const now = Date.now()
    for (const [token, createdAt] of csrfTokens) {
      if (now - createdAt > CSRF_TTL_MS) csrfTokens.delete(token)
    }
  }

  function validateCsrf (submitted: string): boolean {
    evictExpiredTokens()
    for (const [stored] of csrfTokens) {
      if (validateCsrfToken(submitted, stored)) {
        csrfTokens.delete(stored)
        return true
      }
    }
    return false
  }

  routes.set('/admin', {
    GET: wrap(async (_req, res) => {
      const content = renderDashboard(allCollections)
      const html = renderLayout({ title: 'Dashboard', content, collections: allCollections })
      sendHtml(res, html)
    })
  })

  for (const col of allCollections) {
    routes.set(`/admin/${col.slug}`, {
      GET: wrap(async (_req, res) => {
        const result = await api.find({ collection: col.slug })
        const docs = result.match(
          (rows) => rows as Array<{ id: string, [key: string]: string | number | boolean | null }>,
          () => []
        )
        const content = renderListView(col, docs)
        const html = renderLayout({
          title: col.labels?.plural ?? col.slug,
          content,
          collections: allCollections
        })
        sendHtml(res, html)
      })
    })

    routes.set(`/admin/${col.slug}/new`, {
      GET: wrap(async (_req, res) => {
        const token = generateCsrfToken()
        csrfTokens.set(token, Date.now())
        const content = renderEditView(col, null, token)
        const html = renderLayout({
          title: `New ${col.labels?.singular ?? col.slug}`,
          content,
          collections: allCollections
        })
        sendHtml(res, html)
      }),
      POST: wrap(async (req, res) => {
        const bodyResult = await safeReadFormBody(req)
        if (bodyResult.isErr()) { sendHtml(res, 'Bad request', 400); return }
        const formData = bodyResult.value
        const submittedToken = String(formData._csrf ?? '')
        if (!submittedToken || !validateCsrf(submittedToken)) {
          res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('Forbidden: invalid CSRF token')
          return
        }
        const { _csrf, ...data } = formData
        const zodSchema = generateZodSchema(col.fields)
        const validation = zodSchema.safeParse(data)
        if (!validation.success) {
          const issues = validation.error.issues.map((i: { path: PropertyKey[], message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')
          sendHtml(res, `Validation failed: ${escapeHtml(issues)}`, 400)
          return
        }
        const result = await api.create({ collection: col.slug, data })
        result.match(
          () => {
            res.writeHead(302, { Location: `/admin/${col.slug}` })
            res.end()
          },
          (err) => sendHtml(res, `Error: ${escapeHtml(err.message)}`, 400)
        )
      })
    })
  }

  return routes
}
