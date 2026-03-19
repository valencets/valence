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
import { createSession, validateSession, destroySession, buildSessionCookie, buildExpiredSessionCookie } from '../auth/session.js'
import { verifyPassword } from '../auth/password.js'
import { parseCookie } from '../auth/cookie.js'
import { renderLoginPage } from './login-view.js'
import { renderAnalyticsView } from './analytics-view.js'
import { renderRevisionList, renderRevisionDiff } from './revision-view.js'
import { saveRevision, getRevisions, getRevision } from '../db/revision-queries.js'
import { safeQuery } from '../db/safe-query.js'
import { generateCsrfToken, validateCsrfToken } from '../auth/csrf.js'
import { readStringBody } from '../api/read-body.js'
import { generateZodSchema, generatePartialSchema } from '../validation/zod-generator.js'
import { setFlashCookie, readFlash, clearFlashCookie } from './flash.js'
import { readFileSync } from 'node:fs'
import { generateNonce, setSecurityHeaders, CSP_NONCE_PLACEHOLDER } from '@valencets/core/server'
import { fileURLToPath } from 'node:url'

type AdminRouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

interface AdminOptions {
  readonly requireAuth?: boolean | undefined
  readonly telemetryPool?: DbPool | undefined
  readonly headTags?: readonly string[] | undefined
}

function wrapWithAuth (pool: DbPool, handler: AdminRouteHandler): AdminRouteHandler {
  return async (req, res, ctx) => {
    const cookieHeader = req.headers.cookie ?? ''
    const sessionId = parseCookie(cookieHeader, 'cms_session')
    if (!sessionId) {
      res.writeHead(302, { Location: '/admin/login' })
      res.end()
      return
    }
    const result = await validateSession(sessionId, pool)
    if (result.isErr()) {
      res.writeHead(302, { Location: '/admin/login' })
      res.end()
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

/** Sends HTML with CSP nonce: generates nonce, replaces placeholders, sets security headers. */
function sendHtml (res: ServerResponse, html: string, statusCode: number = 200): void {
  const nonce = generateNonce()
  const finalHtml = html.replaceAll(CSP_NONCE_PLACEHOLDER, nonce)
  setSecurityHeaders(res, { nonce })
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(finalHtml))
  res.writeHead(statusCode)
  res.end(finalHtml)
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
  const headTags = options.headTags
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
        const distDir = fileURLToPath(new URL('..', import.meta.url))
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
  // --- Auth routes (no auth wrap) ---
  routes.set('/admin/login', {
    GET: async (_req, res) => {
      const token = freshCsrfToken()
      const html = renderLoginPage({ csrfToken: token })
      sendHtml(res, html)
    },
    POST: async (req, res) => {
      const bodyResult = await safeReadFormBody(req)
      if (bodyResult.isErr()) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Bad request', csrfToken: token })
        sendHtml(res, html, 400)
        return
      }
      const formData = bodyResult.value
      const submittedToken = String(formData._csrf ?? '')
      if (!submittedToken || !validateCsrf(submittedToken)) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Invalid form submission. Please try again.', csrfToken: token })
        sendHtml(res, html, 403)
        return
      }
      const email = String(formData.email ?? '').trim()
      const password = String(formData.password ?? '')
      if (!email || !password) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Email and password are required.', csrfToken: token })
        sendHtml(res, html, 400)
        return
      }
      interface UserRow { readonly id: string; readonly password_hash: string }
      const userResult = await safeQuery<UserRow[]>(
        pool,
        'SELECT id, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
        [email]
      )
      if (userResult.isErr()) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'An error occurred. Please try again.', csrfToken: token })
        sendHtml(res, html, 500)
        return
      }
      const user = userResult.value[0]
      if (!user) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Invalid email or password.', csrfToken: token })
        sendHtml(res, html, 401)
        return
      }
      const verifyResult = await verifyPassword(password, user.password_hash)
      if (verifyResult.isErr() || !verifyResult.value) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Invalid email or password.', csrfToken: token })
        sendHtml(res, html, 401)
        return
      }
      const sessionResult = await createSession(user.id, pool)
      if (sessionResult.isErr()) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Could not create session. Please try again.', csrfToken: token })
        sendHtml(res, html, 500)
        return
      }
      res.setHeader('Set-Cookie', buildSessionCookie(sessionResult.value))
      res.writeHead(302, { Location: '/admin' })
      res.end()
    }
  })

  routes.set('/admin/logout', {
    POST: async (req, res) => {
      const cookieHeader = req.headers.cookie ?? ''
      const sessionId = parseCookie(cookieHeader, 'cms_session')
      if (sessionId) {
        await destroySession(sessionId, pool)
      }
      res.setHeader('Set-Cookie', buildExpiredSessionCookie())
      res.writeHead(302, { Location: '/admin/login' })
      res.end()
    }
  })

  routes.set('/admin/analytics', {
    GET: wrap(async (_req, res) => {
      if (!options.telemetryPool) {
        const content = renderAnalyticsView(null)
        const html = renderLayout({ title: 'Analytics', content, collections: allCollections, headTags })
        sendHtml(res, html)
        return
      }
      const telPool = options.telemetryPool
      try {
        const { getDailyBreakdowns, getDailyTrend } = await import('@valencets/telemetry/daily-summary-queries')
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const trendResult = await getDailyTrend(telPool, 'default', thirtyDaysAgo, now)
        const breakdownResult = await getDailyBreakdowns(telPool, 'default', thirtyDaysAgo, now)
        const trend = trendResult.match(rows => rows, () => [])
        const breakdowns = breakdownResult.match(b => b, () => ({ top_pages: [], top_referrers: [], intent_counts: {} }))
        let sessionCount = 0
        let pageviewCount = 0
        let conversionCount = 0
        for (const row of trend) {
          sessionCount += row.session_count ?? 0
          pageviewCount += row.pageview_count ?? 0
          conversionCount += row.conversion_count ?? 0
        }
        const content = renderAnalyticsView({
          sessionCount,
          pageviewCount,
          conversionCount,
          topPages: breakdowns.top_pages,
          topReferrers: breakdowns.top_referrers
        })
        const html = renderLayout({ title: 'Analytics', content, collections: allCollections, headTags })
        sendHtml(res, html)
      } catch {
        const content = renderAnalyticsView(null)
        const html = renderLayout({ title: 'Analytics', content, collections: allCollections, headTags })
        sendHtml(res, html)
      }
    })
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
      const html = renderLayout({ title: 'Dashboard', content, collections: allCollections, headTags })
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
          headTags,
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
          collections: allCollections,
          headTags
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
          collections: allCollections,
          headTags
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
          (updated) => {
            // Save revision on successful update
            saveRevision(pool, col.slug, id, updated as Record<string, string | number | boolean | null>)
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

    routes.set(`/admin/${col.slug}/:id/history`, {
      GET: wrap(async (_req, res, ctx) => {
        const id = ctx.id ?? ''
        const result = await getRevisions(pool, col.slug, id)
        const revisions = result.match(rows => rows, () => [])
        const content = renderRevisionList(col.slug, id, revisions)
        const html = renderLayout({
          title: `History — ${col.labels?.singular ?? col.slug}`,
          content,
          collections: allCollections,
          headTags
        })
        sendHtml(res, html)
      })
    })

    routes.set(`/admin/${col.slug}/:id/history/:rev`, {
      GET: wrap(async (_req, res, ctx) => {
        const id = ctx.id ?? ''
        const rev = parseInt(ctx.rev ?? '0', 10)
        const currentResult = await getRevision(pool, col.slug, id, rev)
        const current = currentResult.match(r => r, () => null)
        const prevResult = rev > 1
          ? await getRevision(pool, col.slug, id, rev - 1)
          : null
        const prev = prevResult?.match(r => r, () => null) ?? null
        const oldData = prev?.data ?? {}
        const newData = current?.data ?? {}
        const content = renderRevisionDiff(col.slug, id, rev, oldData, newData)
        const html = renderLayout({
          title: `Revision ${rev} — ${col.labels?.singular ?? col.slug}`,
          content,
          collections: allCollections,
          headTags
        })
        sendHtml(res, html)
      })
    })
  }

  return routes
}
