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
import type { RelationContext } from './field-renderers.js'
import { createLocalApi } from '../api/local-api.js'
import { createGlobalRegistry } from '../schema/registry.js'
import { validateSession } from '../auth/session.js'
import { parseCookie } from '../auth/cookie.js'
import { generateCsrfToken, validateCsrfToken } from '../auth/csrf.js'
import { readStringBody } from '../api/read-body.js'
import { generateZodSchema, generatePartialSchema } from '../validation/zod-generator.js'
import { setFlashCookie, readFlash, clearFlashCookie } from './flash.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
  toast: FlashMessage,
  relationContext?: RelationContext
): string {
  const docRow = Object.keys(formData).length > 0
    ? formData as FormSnapshot & { id?: string }
    : null
  const content = renderEditView(col, docRow, csrfToken, relationContext)
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

  async function buildRelationContext (col: CollectionConfig): Promise<RelationContext> {
    const context: Record<string, Array<{ id: string; label: string }>> = {}
    for (const f of col.fields) {
      if (f.type !== 'relation' || !('relationTo' in f)) continue
      const relCol = collections.get(f.relationTo)
      if (relCol.isErr()) continue
      const result = await api.find({ collection: f.relationTo })
      const rows = result.match(
        (r) => r as Array<{ id: string; [key: string]: string | number | boolean | null }>,
        () => []
      )
      const firstTextField = relCol.value.fields.find(rf => rf.type === 'text')
      context[f.name] = rows.map(row => ({
        id: String(row.id),
        label: firstTextField ? String(row[firstTextField.name] ?? row.id) : String(row.id)
      }))
    }
    return context
  }

  routes.set('/admin/_assets/admin-client.js', {
    GET: async (_req, res) => {
      try {
        const distDir = fileURLToPath(new URL('../../..', import.meta.url))
        const jsPath = `${distDir}/admin-client.js`
        const js = readFileSync(jsPath, 'utf-8')
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        res.setHeader('Content-Length', Buffer.byteLength(js))
        res.writeHead(200)
        res.end(js)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    }
  })
  routes.set('/admin', {
    GET: wrap(async (_req, res) => {
      const statsPromises = allCollections.map(async (col) => {
        const countResult = await api.count({ collection: col.slug })
        const count = countResult.match((n) => n, () => 0)
        const recentResult = await api.find({ collection: col.slug, limit: 5 })
        const recent = recentResult.match(
          (rows) => rows as Array<{ id: string; [key: string]: string | number | boolean | null }>,
          () => []
        )
        return {
          slug: col.slug,
          label: col.labels?.plural ?? col.slug,
          count,
          recent
        }
      })
      const stats = await Promise.all(statsPromises)
      const content = renderDashboard({ stats })
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
        const relationContext = await buildRelationContext(col)
        const content = renderEditView(col, null, token, relationContext)
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

    routes.set(`/admin/${col.slug}/:id/delete`, {
      POST: wrap(async (req, res, ctx) => {
        const id = ctx.id ?? ''
        const bodyResult = await safeReadFormBody(req)
        if (bodyResult.isErr()) {
          setFlashCookie(res, { type: 'error', text: 'Bad request' })
          res.writeHead(400, { Location: `/admin/${col.slug}/${id}/edit` })
          res.end()
          return
        }
        const formData = bodyResult.value
        const submittedToken = String(formData._csrf ?? '')
        if (!submittedToken || !validateCsrf(submittedToken)) {
          setFlashCookie(res, { type: 'error', text: 'Forbidden: invalid CSRF token' })
          res.writeHead(403, { Location: `/admin/${col.slug}/${id}/edit` })
          res.end()
          return
        }
        const result = await api.delete({ collection: col.slug, id })
        result.match(
          () => {
            setFlashCookie(res, { type: 'success', text: `${col.labels?.singular ?? col.slug} deleted` })
            res.writeHead(302, { Location: `/admin/${col.slug}` })
            res.end()
          },
          (err) => {
            setFlashCookie(res, { type: 'error', text: err.message })
            res.writeHead(302, { Location: `/admin/${col.slug}/${id}/edit` })
            res.end()
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
        const relationContext = await buildRelationContext(col)
        const content = renderEditView(col, doc, token, relationContext)
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
