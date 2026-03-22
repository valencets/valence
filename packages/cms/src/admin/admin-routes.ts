import type { IncomingMessage, ServerResponse } from 'node:http'
import { ResultAsync, fromThrowable, ok } from 'neverthrow'
import type { Result } from 'neverthrow'

import type { CmsError } from '../schema/types.js'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import type { RestRouteEntry } from '../api/rest-api.js'
import type { DocumentData, DocumentRow } from '../db/query-builder.js'
import type { FlashMessage } from './flash.js'
import type { CollectionConfig } from '../schema/collection.js'
import { renderAdminLayout } from './layout.js'
import { renderDashboard } from './dashboard.js'
import { renderListView } from './list-view.js'
import type { ListViewPagination } from './list-view.js'
import { renderEditView, renderFormFieldsFragment } from './edit-view.js'
import type { RelationContext } from './field-renderers.js'
import { createLocalApi } from '../api/local-api.js'
import { createGlobalRegistry } from '../schema/registry.js'
import { createSession, validateSession, destroySession, buildSessionCookie, buildExpiredSessionCookie, DEFAULT_SESSION_MAX_AGE } from '../auth/session.js'
import { verifyPassword } from '../auth/password.js'
import { parseCookie } from '../auth/cookie.js'
import { renderLoginPage } from './login-view.js'
import { renderAnalyticsView } from './analytics-view.js'
import { renderRevisionList, renderRevisionDiff } from './revision-view.js'
import { saveRevision, getRevisions, getRevision } from '../db/revision-queries.js'
import { safeQuery } from '../db/safe-query.js'
import { getValidFieldNames, isAllowedField } from '../db/sql-sanitize.js'
import type { PaginatedResult } from '../db/query-types.js'
import { readStringBody } from '../api/read-body.js'
import { createRateLimiter } from '../auth/rate-limit.js'
import { generateConditionalSchema, generateConditionalPartialSchema } from '../validation/zod-generator.js'
import { setFlashCookie, readFlash, clearFlashCookie } from './flash.js'
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { generateNonce, setSecurityHeaders, CSP_NONCE_PLACEHOLDER, generateCsrfToken, validateCsrfToken } from '@valencets/core/server'
import { fileURLToPath } from 'node:url'

export type AdminRouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

interface AdminOptions {
  readonly requireAuth?: boolean | undefined
  readonly telemetryPool?: DbPool | undefined
  readonly telemetrySiteId?: string | undefined
  readonly sessionMaxAge?: number | undefined
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

/** Strips keys with undefined values from Zod output (e.g. empty date fields parsed as undefined). */
function stripUndefined (data: DocumentData): DocumentData {
  const entries = Object.entries(data).filter((pair): pair is [string, Exclude<DocumentData[string], undefined>] => pair[1] !== undefined)
  return Object.fromEntries(entries) as DocumentData
}

/** Converts DocumentData values to strings for condition evaluation. */
function toStringRecord (data: Omit<DocumentData, '_csrf'>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
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
  return renderAdminLayout({ title, content, collections: allCollections, toast })
}

export function createAdminRoutes (
  pool: DbPool,
  collections: CollectionRegistry,
  options: AdminOptions = {}
): Map<string, RestRouteEntry> {
  const wrap = options.requireAuth !== false
    ? (handler: AdminRouteHandler): AdminRouteHandler => wrapWithAuth(pool, handler)
    : (handler: AdminRouteHandler): AdminRouteHandler => handler
  const routes = new Map<string, RestRouteEntry>()
  const allCollections = collections.getAll()
  const headTags = options.headTags
  const globals = createGlobalRegistry()
  const api = createLocalApi(pool, collections, globals)
  const CSRF_TTL_MS = 3_600_000
  const csrfTokens = new Map<string, number>()
  const loginLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 900_000 })

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
      const displayFieldName = relCol.value.admin?.displayField
      const labelField = displayFieldName
        ? relCol.value.fields.find(rf => rf.name === displayFieldName)
        : relCol.value.fields.find(rf => rf.type === 'text')
      context[f.name] = rows.map(row => ({
        id: String(row.id),
        label: labelField ? String(row[labelField.name] ?? row.id) : String(row.id)
      }))
    }
    return context
  }

  const clientDistDir = resolve(fileURLToPath(new URL('..', import.meta.url)), 'client')

  const ASSET_MIME: Readonly<Record<string, string>> = {
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  }

  const safeReadAdminAsset = (filename: string): Result<string | null, null> => {
    const safe = basename(filename)
    const ext = safe.slice(safe.lastIndexOf('.'))
    if (ASSET_MIME[ext] === undefined) return ok(null)
    return fromThrowable(
      () => readFileSync(resolve(clientDistDir, safe), 'utf-8'),
      () => null
    )()
  }

  // Assets are served publicly — the admin JS/CSS must load before auth is checked
  routes.set('/admin/_assets/:file', {
    GET: (_req, res, ctx) => {
      const file = ctx.file ?? ''
      const result = safeReadAdminAsset(file)
      if (result.isErr() || result.value === null) {
        res.writeHead(404)
        res.end('Not found')
        return Promise.resolve()
      }
      const content = result.value
      const ext = file.slice(file.lastIndexOf('.'))
      const mime = ASSET_MIME[ext] ?? 'application/octet-stream'
      const isHashed = /-.{8}\.(js|css)$/.test(file)
      res.setHeader('Content-Type', mime)
      res.setHeader('Cache-Control', isHashed ? 'public, max-age=31536000, immutable' : 'public, no-cache')
      res.setHeader('Content-Length', Buffer.byteLength(content))
      res.writeHead(200)
      res.end(content)
      return Promise.resolve()
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
      const ip = req.socket.remoteAddress ?? 'unknown'
      if (!loginLimiter.check(ip)) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Too many login attempts. Please try again later.', csrfToken: token })
        sendHtml(res, html, 429)
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
        // Prevent timing-based user enumeration (NEW-06)
        await verifyPassword(password, '$argon2id$v=19$m=65536,t=3,p=4$dummysalt$dummyhash')
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
      const sessionMaxAge = options.sessionMaxAge ?? DEFAULT_SESSION_MAX_AGE
      const sessionResult = await createSession(user.id, pool, sessionMaxAge)
      if (sessionResult.isErr()) {
        const token = freshCsrfToken()
        const html = renderLoginPage({ error: 'Could not create session. Please try again.', csrfToken: token })
        sendHtml(res, html, 500)
        return
      }
      loginLimiter.reset(ip)
      const secure = !!(req.socket as { encrypted?: boolean }).encrypted
      res.setHeader('Set-Cookie', buildSessionCookie(sessionResult.value, sessionMaxAge, secure))
      res.writeHead(302, { Location: '/admin' })
      res.end()
    }
  })

  // Logout CSRF: SameSite=Lax on the session cookie prevents cross-site POST
  // from sending the cookie, so an attacker's form submission arrives without
  // a session — destroySession is a no-op and the redirect is harmless.
  // No additional CSRF token is needed for this endpoint.
  routes.set('/admin/logout', {
    POST: async (req, res) => {
      const cookieHeader = req.headers.cookie ?? ''
      const sessionId = parseCookie(cookieHeader, 'cms_session')
      if (sessionId) {
        await destroySession(sessionId, pool)
      }
      const secure = !!(req.socket as { encrypted?: boolean }).encrypted
      res.setHeader('Set-Cookie', buildExpiredSessionCookie(secure))
      res.writeHead(302, { Location: '/admin/login' })
      res.end()
    }
  })

  routes.set('/admin/analytics', {
    GET: wrap(async (_req, res) => {
      if (!options.telemetryPool) {
        const content = renderAnalyticsView(null)
        const html = renderAdminLayout({ title: 'Analytics', content, collections: allCollections, headTags })
        sendHtml(res, html)
        return
      }
      const telPool = options.telemetryPool
      const analyticsResult = await ResultAsync.fromPromise(
        (async () => {
          const { getDailyBreakdowns, getDailyTrend } = await import('@valencets/telemetry/daily-summary-queries')
          const { getEventCategorySummaries, getPageviewsByPath, getDailyEventCounts } = await import('@valencets/telemetry')
          const now = new Date()
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          const siteId = options.telemetrySiteId ?? 'default'
          const trendResult = await getDailyTrend(telPool, siteId, thirtyDaysAgo, now)
          const breakdownResult = await getDailyBreakdowns(telPool, siteId, thirtyDaysAgo, now)
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
          const [eventCategoriesResult, pageviewsByPathResult, dailyEventsResult] = await Promise.all([
            getEventCategorySummaries(telPool, thirtyDaysAgo, now),
            getPageviewsByPath(telPool, sevenDaysAgo, now),
            getDailyEventCounts(telPool, thirtyDaysAgo, now)
          ])
          const eventCategories = eventCategoriesResult.match(rows => rows, () => [])
          const pageviewsByPath = pageviewsByPathResult.match(rows => rows, () => [])
          const dailyEvents = dailyEventsResult.match(rows => rows, () => [])
          return { sessionCount, pageviewCount, conversionCount, topPages: breakdowns.top_pages, topReferrers: breakdowns.top_referrers, eventCategories, pageviewsByPath, dailyEvents }
        })(),
        () => null
      )
      const analyticsData = analyticsResult.isOk() ? analyticsResult.value : null
      const analyticsContent = analyticsData === null ? renderAnalyticsView(null) : renderAnalyticsView(analyticsData)
      const analyticsHtml = renderAdminLayout({ title: 'Analytics', content: analyticsContent, collections: allCollections, headTags })
      sendHtml(res, analyticsHtml)
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
          recent,
          hidden: col.admin?.hidden === true ? true : undefined
        }
      })
      const stats = await Promise.all(statsPromises)
      const content = renderDashboard({ stats })
      const html = renderAdminLayout({ title: 'Dashboard', content, collections: allCollections, headTags })
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

        const rawUrl = req.url ?? ''
        const qIndex = rawUrl.indexOf('?')
        const qs = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : ''
        const params = new URLSearchParams(qs)

        const query = params.get('q') ?? undefined
        const rawSort = params.get('sort') ?? 'created_at'
        const rawDir = params.get('dir') ?? 'desc'
        const dir: 'asc' | 'desc' = rawDir === 'asc' ? 'asc' : 'desc'
        const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1)
        const perPage = 25

        const allowedFields = getValidFieldNames(col)
        if (!isAllowedField(rawSort, allowedFields)) {
          sendHtml(res, '<p>Invalid sort field</p>', 400)
          return
        }
        const sort = rawSort

        const filters: Record<string, string> = {}
        for (const [key, val] of params.entries()) {
          if (key.startsWith('filter_') && val) {
            const fieldName = key.slice('filter_'.length)
            filters[fieldName] = val
          }
        }

        const findArgs = {
          collection: col.slug,
          search: query,
          orderBy: { field: sort, direction: dir },
          page,
          perPage,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        }

        const result = await api.find(findArgs)

        type DocRow = { id: string; [key: string]: string | number | boolean | null }
        let docs: readonly DocRow[] = []
        let pagination: ListViewPagination | undefined

        result.match(
          (value) => {
            if (value !== null && typeof value === 'object' && 'docs' in value) {
              const paged = value as PaginatedResult<DocRow>
              docs = paged.docs
              pagination = {
                totalDocs: paged.totalDocs,
                page: paged.page,
                totalPages: paged.totalPages,
                hasNextPage: paged.hasNextPage,
                hasPrevPage: paged.hasPrevPage
              }
            } else {
              docs = value as DocRow[]
            }
          },
          () => { docs = [] }
        )

        const listCsrfToken = freshCsrfToken()
        const content = renderListView({
          col,
          docs,
          pagination,
          query,
          sort,
          dir,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          csrfToken: listCsrfToken
        })
        const html = renderAdminLayout({
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
        const html = renderAdminLayout({
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
        const { _csrf, _action, ...data } = formData
        if (!submittedToken || !validateCsrf(submittedToken)) {
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `New ${col.labels?.singular ?? col.slug}`, data as FormSnapshot, token, { type: 'error', text: 'Forbidden: invalid CSRF token' })
          sendHtml(res, html, 403)
          return
        }
        const zodSchema = generateConditionalSchema(col.fields, toStringRecord(data))
        const validation = zodSchema.safeParse(data)
        if (!validation.success) {
          const issues = validation.error.issues.map((i: { path: PropertyKey[], message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `New ${col.labels?.singular ?? col.slug}`, data as FormSnapshot, token, { type: 'error', text: `Validation failed: ${issues}` })
          sendHtml(res, html, 400)
          return
        }
        const isDraft = String(_action ?? 'publish') === 'draft'
        const result = await api.create({ collection: col.slug, data: stripUndefined(validation.data as DocumentData), draft: isDraft })
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

    const hasConditionalFields = col.fields.some(f => f.condition !== undefined)
    if (hasConditionalFields) {
      routes.set(`/admin/${col.slug}/new/form-fields`, {
        POST: wrap(async (req, res) => {
          const bodyResult = await safeReadFormBody(req)
          const formData: Record<string, string> = bodyResult.isOk() ? bodyResult.value as Record<string, string> : {}
          const relationContext = await buildRelationContext(col)
          const fragment = renderFormFieldsFragment(col, formData, relationContext)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('Content-Length', Buffer.byteLength(fragment))
          res.writeHead(200)
          res.end(fragment)
        })
      })

      routes.set(`/admin/${col.slug}/:id/form-fields`, {
        POST: wrap(async (req, res) => {
          const bodyResult = await safeReadFormBody(req)
          const formData: Record<string, string> = bodyResult.isOk() ? bodyResult.value as Record<string, string> : {}
          const relationContext = await buildRelationContext(col)
          const fragment = renderFormFieldsFragment(col, formData, relationContext)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('Content-Length', Buffer.byteLength(fragment))
          res.writeHead(200)
          res.end(fragment)
        })
      })
    }

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

    routes.set(`/admin/${col.slug}/bulk`, {
      POST: wrap(async (req, res) => {
        const bodyResult = await safeReadFormBody(req)
        if (bodyResult.isErr()) {
          res.writeHead(400, { Location: `/admin/${col.slug}` })
          res.end()
          return
        }
        const formData = bodyResult.value
        const submittedToken = String(formData._csrf ?? '')
        if (!submittedToken || !validateCsrf(submittedToken)) {
          res.writeHead(403, { Location: `/admin/${col.slug}` })
          res.end()
          return
        }
        const rawAction = String(formData.action ?? '')
        const rawIds = formData.ids
        const ids: readonly string[] = Array.isArray(rawIds)
          ? (rawIds as string[])
          : rawIds !== undefined && rawIds !== ''
            ? [String(rawIds)]
            : []

        const BULK_HANDLERS: Record<string, (id: string) => ResultAsync<DocumentRow, CmsError>> = {
          delete: (id) => api.delete({ collection: col.slug, id }),
          publish: (id) => api.update({ collection: col.slug, id, data: {}, publish: true }),
          unpublish: (id) => api.unpublish({ collection: col.slug, id })
        }
        const handler = BULK_HANDLERS[rawAction]
        if (!handler) {
          res.writeHead(400, { Location: `/admin/${col.slug}` })
          res.end()
          return
        }
        const results = await Promise.all(ids.map(handler))
        const successCount = results.filter(r => r.isOk()).length
        setFlashCookie(res, { type: 'success', text: `${successCount} item${successCount === 1 ? '' : 's'} updated` })
        res.writeHead(302, { Location: `/admin/${col.slug}` })
        res.end()
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
        const html = renderAdminLayout({
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
        const { _csrf, _action, ...data } = formData
        if (!submittedToken || !validateCsrf(submittedToken)) {
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `Edit ${col.labels?.singular ?? col.slug}`, { id, ...data } as FormSnapshot, token, { type: 'error', text: 'Forbidden: invalid CSRF token' })
          sendHtml(res, html, 403)
          return
        }
        const zodSchema = generateConditionalPartialSchema(col.fields, toStringRecord(data))
        const validation = zodSchema.safeParse(data)
        if (!validation.success) {
          const issues = validation.error.issues.map((i: { path: PropertyKey[], message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')
          const token = freshCsrfToken()
          const html = renderErrorPage(col, allCollections, `Edit ${col.labels?.singular ?? col.slug}`, { id, ...data } as FormSnapshot, token, { type: 'error', text: `Validation failed: ${issues}` })
          sendHtml(res, html, 400)
          return
        }
        const shouldPublish = String(_action ?? '') === 'publish'
        const result = await api.update({ collection: col.slug, id, data: stripUndefined(validation.data as DocumentData), publish: shouldPublish || undefined })
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
        const html = renderAdminLayout({
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
        const html = renderAdminLayout({
          title: `Revision ${rev} — ${col.labels?.singular ?? col.slug}`,
          content,
          collections: allCollections,
          headTags
        })
        sendHtml(res, html)
      })
    })

    if (col.versions?.drafts === true) {
      routes.set(`/admin/${col.slug}/:id/autosave`, {
        POST: wrap(async (req, res, ctx) => {
          const id = ctx.id ?? ''
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          const bodyResult = await safeReadFormBody(req)
          if (bodyResult.isErr()) {
            res.writeHead(400)
            res.end(JSON.stringify({ success: false, error: 'Bad request' }))
            return
          }
          const formData = bodyResult.value
          const submittedToken = String(formData._csrf ?? '')
          if (!submittedToken || !validateCsrf(submittedToken)) {
            res.writeHead(403)
            res.end(JSON.stringify({ success: false, error: 'Invalid CSRF token' }))
            return
          }
          const { _csrf, ...data } = formData
          const zodSchema = generateConditionalPartialSchema(col.fields, toStringRecord(data))
          const validation = zodSchema.safeParse(data)
          const saveData = validation.success
            ? stripUndefined(validation.data as DocumentData)
            : stripUndefined(data as DocumentData)
          const result = await api.update({ collection: col.slug, id, data: saveData })
          result.match(
            () => {
              const savedAt = new Date().toISOString()
              res.writeHead(200)
              res.end(JSON.stringify({ success: true, savedAt }))
            },
            (err) => {
              res.writeHead(500)
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          )
        })
      })
    }
  }

  return routes
}
