import type { IncomingMessage, ServerResponse } from 'node:http'
import { ResultAsync } from 'neverthrow'

import type { CmsError } from '../schema/types.js'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import type { RestRouteEntry } from '../api/rest-api.js'
import type { DocumentData } from '../db/query-builder.js'
import type { FlashMessage } from './flash.js'
import type { CollectionConfig } from '../schema/collection.js'
import { renderLayout } from './layout.js'
import { renderDashboard } from './dashboard.js'
import { renderListView } from './list-view.js'
import { renderEditView } from './edit-view.js'
import { createLocalApi } from '../api/local-api.js'
import { createGlobalRegistry } from '../schema/registry.js'
import { validateSession } from '../auth/session.js'
import { parseCookie } from '../auth/cookie.js'
import { generateCsrfToken, validateCsrfToken } from '../auth/csrf.js'
import { readStringBody } from '../api/read-body.js'
import { generateZodSchema, generatePartialSchema } from '../validation/zod-generator.js'
import { setFlashCookie, readFlash, clearFlashCookie } from './flash.js'

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

/** Sends HTML using setHeader so previously set headers (e.g. Set-Cookie) are preserved. */
function sendHtml (res: ServerResponse, html: string, statusCode: number = 200): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(html))
  res.writeHead(statusCode)
  res.end(html)
}

interface FormSnapshot {
  readonly [key: string]: string
}

function renderErrorPage (
  col: CollectionConfig,
  allCollections: readonly CollectionConfig[],
  title: string,
  formData: FormSnapshot,
  csrfToken: string,
  toast: FlashMessage
): string {
  const docRow = Object.keys(formData).length > 0
    ? formData as FormSnapshot & { id?: string }
    : null
  const content = renderEditView(col, docRow, csrfToken)
  return renderLayout({ title, content, collections: allCollections, toast })
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

  function freshCsrfToken (): string {
    const token = generateCsrfToken()
    csrfTokens.set(token, Date.now())
    return token
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
      GET: wrap(async (req, res) => {
        const cookieHeader = req.headers.cookie ?? ''
        const flash = readFlash(cookieHeader)
        const toast = flash ?? undefined
        if (flash) clearFlashCookie(res)
        const result = await api.find({ collection: col.slug })
        const docs = result.match(
          (rows) => rows as Array<{ id: string, [key: string]: string | number | boolean | null }>,
          () => []
        )
        const content = renderListView(col, docs)
        const html = renderLayout({
          title: col.labels?.plural ?? col.slug,
          content,
          collections: allCollections,
          toast
        })
        sendHtml(res, html)
      })
    })

    routes.set(`/admin/${col.slug}/new`, {
      GET: wrap(async (_req, res) => {
        const token = freshCsrfToken()
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
        if (bodyResult.isErr()) {
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `New ${col.labels?.singular ?? col.slug}`, {}, token, { type: 'error', text: 'Bad request' })
          sendHtml(res, html, 400)
          return
        }
        const formData = bodyResult.value
        const submittedToken = String(formData._csrf ?? '')
        const { _csrf, ...data } = formData
        if (!submittedToken || !validateCsrf(submittedToken)) {
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `New ${col.labels?.singular ?? col.slug}`, data as FormSnapshot, token, { type: 'error', text: 'Forbidden: invalid CSRF token' })
          sendHtml(res, html, 403)
          return
        }
        const zodSchema = generateZodSchema(col.fields)
        const validation = zodSchema.safeParse(data)
        if (!validation.success) {
          const issues = validation.error.issues.map((i: { path: PropertyKey[], message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `New ${col.labels?.singular ?? col.slug}`, data as FormSnapshot, token, { type: 'error', text: `Validation failed: ${issues}` })
          sendHtml(res, html, 400)
          return
        }
        const result = await api.create({ collection: col.slug, data: validation.data as DocumentData })
        result.match(
          () => {
            setFlashCookie(res, { type: 'success', text: `${col.labels?.singular ?? col.slug} created successfully` })
            res.writeHead(302, { Location: `/admin/${col.slug}` })
            res.end()
          },
          (err) => {
            const token = freshCsrfToken()
            const html = renderErrorPage(col, allCollections, `New ${col.labels?.singular ?? col.slug}`, data as FormSnapshot, token, { type: 'error', text: `Error: ${err.message}` })
            sendHtml(res, html, 400)
          }
        )
      })
    })

    routes.set(`/admin/${col.slug}/:id/edit`, {
      GET: wrap(async (req, res, ctx) => {
        const id = ctx.id ?? ''
        const docResult = await api.findByID({ collection: col.slug, id })
        const doc = docResult.match(
          (row) => row as { id: string, [key: string]: string | number | boolean | null | undefined } | null,
          () => null
        )
        if (!doc) {
          sendHtml(res, 'Not found', 404)
          return
        }
        const token = freshCsrfToken()
        const content = renderEditView(col, doc, token)
        const html = renderLayout({
          title: `Edit ${col.labels?.singular ?? col.slug}`,
          content,
          collections: allCollections
        })
        sendHtml(res, html)
      }),
      POST: wrap(async (req, res, ctx) => {
        const id = ctx.id ?? ''
        const bodyResult = await safeReadFormBody(req)
        if (bodyResult.isErr()) {
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `Edit ${col.labels?.singular ?? col.slug}`, { id }, token, { type: 'error', text: 'Bad request' })
          sendHtml(res, html, 400)
          return
        }
        const formData = bodyResult.value
        const submittedToken = String(formData._csrf ?? '')
        const { _csrf, ...data } = formData
        if (!submittedToken || !validateCsrf(submittedToken)) {
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `Edit ${col.labels?.singular ?? col.slug}`, { id, ...data } as FormSnapshot, token, { type: 'error', text: 'Forbidden: invalid CSRF token' })
          sendHtml(res, html, 403)
          return
        }
        const zodSchema = generatePartialSchema(col.fields)
        const validation = zodSchema.safeParse(data)
        if (!validation.success) {
          const issues = validation.error.issues.map((i: { path: PropertyKey[], message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `Edit ${col.labels?.singular ?? col.slug}`, { id, ...data } as FormSnapshot, token, { type: 'error', text: `Validation failed: ${issues}` })
          sendHtml(res, html, 400)
          return
        }
        const result = await api.update({ collection: col.slug, id, data: validation.data as DocumentData })
        result.match(
          () => {
            setFlashCookie(res, { type: 'success', text: `${col.labels?.singular ?? col.slug} updated successfully` })
            res.writeHead(302, { Location: `/admin/${col.slug}` })
            res.end()
          },
          (err) => {
            const token = freshCsrfToken()
            const html = renderErrorPage(col, allCollections, `Edit ${col.labels?.singular ?? col.slug}`, { id, ...data } as FormSnapshot, token, { type: 'error', text: `Error: ${err.message}` })
            sendHtml(res, html, 400)
          }
        )
      })
    })
  }

  return routes
}
