import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry, GlobalRegistry } from '../schema/registry.js'
import type { ResultAsync } from 'neverthrow'
import { createLocalApi } from './local-api.js'
import { sendApiJson, sendErrorJson, safeReadBody, safeJsonParse } from './http-utils.js'
import type { DocumentData } from '../db/query-builder.js'
import { generateZodSchema, generatePartialSchema, generateDraftSchema } from '../validation/zod-generator.js'
import type { CollectionConfig } from '../schema/collection.js'
import type { PaginatedResult } from '../db/query-types.js'
import type { DocumentRow } from '../db/query-builder.js'
import type { CmsError } from '../schema/types.js'
import { flattenFields } from '../schema/field-utils.js'
import { isAuthEnabled, getAuthFields } from '../auth/auth-config.js'
import { parseCookie } from '../auth/cookie.js'
import { validateSession } from '../auth/session.js'
import { resolveAccess } from '../access/access-resolver.js'

export type RestRouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

export interface RestRouteEntry {
  readonly GET?: RestRouteHandler | undefined
  readonly POST?: RestRouteHandler | undefined
  readonly PATCH?: RestRouteHandler | undefined
  readonly DELETE?: RestRouteHandler | undefined
}

interface LocalizationParam {
  readonly defaultLocale: string
  readonly locales: readonly { readonly code: string }[]
}

interface AuthenticatedUser {
  readonly id: string
}

type Operation = 'read' | 'create' | 'update' | 'delete'

const SYSTEM_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])
const RESERVED_PARAMS = new Set(['search', 'sort', 'dir', 'page', 'limit', 'draft', 'publish', 'locale'])

const BULK_ACTION_OPERATIONS: Readonly<Record<string, Operation>> = {
  delete: 'delete',
  publish: 'update',
  unpublish: 'update'
}

function requireJsonContentType (req: IncomingMessage, res: ServerResponse): boolean {
  const ct = req.headers['content-type'] ?? ''
  if (!ct.includes('application/json')) {
    sendErrorJson(res, 'Content-Type must be application/json', 415)
    return false
  }
  return true
}

function sendPaginatedJson (res: ServerResponse, data: PaginatedResult<DocumentRow>): void {
  const body = JSON.stringify(data)
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function getAllowedFields (col: CollectionConfig): Set<string> {
  const names = flattenFields(col.fields).map(f => f.name)
  const allowed = new Set<string>(names)
  for (const sys of SYSTEM_COLUMNS) allowed.add(sys)
  return allowed
}

function parseUrlParams (url: string): URLSearchParams {
  const qmark = url.indexOf('?')
  const qs = qmark >= 0 ? url.slice(qmark + 1) : ''
  return new URLSearchParams(qs)
}

interface ParsedQueryArgs {
  readonly search: string | undefined
  readonly orderBy: { field: string; direction: 'asc' | 'desc' } | undefined
  readonly page: number
  readonly perPage: number
  readonly filters: Record<string, string> | undefined
  readonly includeDrafts: boolean
  readonly locale: string | undefined
}

function parseQueryParams (
  url: string,
  col: CollectionConfig
): { ok: true; args: ParsedQueryArgs } | { ok: false; message: string } {
  const params = parseUrlParams(url)
  const allowed = getAllowedFields(col)

  const sortField = params.get('sort')
  if (sortField !== null && !allowed.has(sortField)) {
    return { ok: false, message: `Invalid sort field: ${sortField}` }
  }

  const dirRaw = params.get('dir') ?? 'asc'
  const direction = dirRaw === 'desc' ? 'desc' : 'asc'

  const MAX_LIMIT = 100
  const pageRaw = params.get('page')
  const page = pageRaw !== null ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1
  const limitRaw = params.get('limit')
  const rawPerPage = limitRaw !== null ? parseInt(limitRaw, 10) || 25 : 25
  const perPage = Math.min(Math.max(1, rawPerPage), MAX_LIMIT)

  const searchVal = params.get('search') ?? undefined
  const includeDrafts = params.get('draft') === 'true'
  const localeVal = params.get('locale') ?? undefined

  const where: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    if (RESERVED_PARAMS.has(key)) continue
    if (!allowed.has(key)) {
      return { ok: false, message: `Invalid filter field: ${key}` }
    }
    where[key] = value
  }

  return {
    ok: true,
    args: {
      search: searchVal,
      orderBy: sortField !== null ? { field: sortField, direction } : undefined,
      page,
      perPage,
      filters: Object.keys(where).length > 0 ? where : undefined,
      includeDrafts,
      locale: localeVal
    }
  }
}

function parseLocaleFromUrl (url: string): string | undefined {
  const qmark = url.indexOf('?')
  if (qmark < 0) return undefined
  const params = new URLSearchParams(url.slice(qmark + 1))
  return params.get('locale') ?? undefined
}

function validateLocale (
  locale: string | undefined,
  validCodes: ReadonlySet<string> | undefined,
  res: ServerResponse
): boolean {
  if (locale === undefined || validCodes === undefined) return true
  if (!validCodes.has(locale)) {
    sendErrorJson(res, `Invalid locale: ${locale}`, 400)
    return false
  }
  return true
}

async function authenticateRequest (req: IncomingMessage, pool: DbPool): Promise<AuthenticatedUser | null> {
  const cookieHeader = req.headers.cookie ?? ''
  const sessionId = parseCookie(cookieHeader, 'cms_session')
  if (!sessionId) return null
  const result = await validateSession(sessionId, pool)
  if (result.isErr()) return null
  return { id: result.value }
}

async function checkAccess (
  col: CollectionConfig,
  operation: Operation,
  user: AuthenticatedUser | null,
  res: ServerResponse
): Promise<boolean> {
  const accessConfig = col.access
  const accessFn = accessConfig?.[operation]

  if (!accessFn) {
    if (!user) {
      sendErrorJson(res, 'Unauthorized', 401)
      return false
    }
    return true
  }

  const result = await resolveAccess(accessFn, {})
  if (result.isErr()) {
    sendErrorJson(res, 'Access check failed', 500)
    return false
  }

  const access = result.value
  if (access === false) {
    if (!user) {
      sendErrorJson(res, 'Unauthorized', 401)
    } else {
      sendErrorJson(res, 'Forbidden', 403)
    }
    return false
  }

  return true
}

export function createRestRoutes (
  pool: DbPool,
  collections: CollectionRegistry,
  globals: GlobalRegistry,
  localization?: LocalizationParam
): Map<string, RestRouteEntry> {
  const api = createLocalApi(pool, collections, globals, localization?.defaultLocale)
  const routes = new Map<string, RestRouteEntry>()
  const validLocaleCodes = localization
    ? new Set(localization.locales.map(l => l.code))
    : undefined

  for (const col of collections.getAll()) {
    const slug = col.slug
    const zodSchema = generateZodSchema(col.fields)
    const isVersioned = col.versions?.drafts === true
    const draftSchema = isVersioned ? generateDraftSchema(col.fields) : undefined
    const isAuth = isAuthEnabled(col)
    const protectedNames = isAuth
      ? new Set([...getAuthFields().map(af => af.name), 'role'])
      : undefined
    const safeFields = protectedNames !== undefined
      ? col.fields.filter(f => !protectedNames.has(f.name))
      : col.fields
    const safeZodSchema = isAuth ? generateZodSchema(safeFields).strict() : zodSchema
    const safeDraftSchema = protectedNames !== undefined && draftSchema !== undefined
      ? generateDraftSchema(safeFields).strict()
      : draftSchema
    const safePatchSchema = isAuth
      ? generatePartialSchema(safeFields).strict()
      : generatePartialSchema(col.fields)

    routes.set(`/api/${slug}`, {
      GET: async (req, res) => {
        const user = await authenticateRequest(req, pool)
        if (!await checkAccess(col, 'read', user, res)) return
        const url = req.url ?? `/${slug}`
        const parsed = parseQueryParams(url, col)
        if (!parsed.ok) {
          sendErrorJson(res, parsed.message, 400)
          return
        }
        const { search, orderBy, page, perPage, filters, includeDrafts, locale } = parsed.args
        if (!validateLocale(locale, validLocaleCodes, res)) return
        const result = await api.find({
          collection: slug,
          locale,
          search,
          orderBy,
          page,
          perPage,
          filters,
          includeDrafts
        })
        result.match(
          (docs) => {
            sendPaginatedJson(res, docs as PaginatedResult<DocumentRow>)
          },
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      POST: async (req, res) => {
        const user = await authenticateRequest(req, pool)
        if (!await checkAccess(col, 'create', user, res)) return
        if (!requireJsonContentType(req, res)) return
        const url = req.url ?? `/${slug}`
        const locale = parseLocaleFromUrl(url)
        if (!validateLocale(locale, validLocaleCodes, res)) return
        const bodyResult = await safeReadBody(req)
        if (bodyResult.isErr()) { sendErrorJson(res, bodyResult.error.message, 400); return }
        const parseResult = await safeJsonParse(bodyResult.value)
        if (parseResult.isErr()) { sendErrorJson(res, parseResult.error.message, 400); return }
        const urlParams = parseUrlParams(url)
        const isDraft = urlParams.get('draft') === 'true'
        const schema = isDraft && safeDraftSchema !== undefined ? safeDraftSchema : safeZodSchema
        const validation = schema.safeParse(parseResult.value)
        if (!validation.success) {
          const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
          sendErrorJson(res, `Validation failed: ${issues}`, 400)
          return
        }
        const result = await api.create({ collection: slug, data: validation.data as DocumentData, draft: isDraft, locale })
        result.match(
          (doc) => sendApiJson(res, doc as DocumentData, 201),
          (err) => sendErrorJson(res, err.message, 400)
        )
      }
    })

    routes.set(`/api/${slug}/:id`, {
      GET: async (req, res) => {
        const user = await authenticateRequest(req, pool)
        if (!await checkAccess(col, 'read', user, res)) return
        const rawId = req.url?.split('/').pop() ?? ''
        const id = rawId.split('?')[0] ?? ''
        if (!id) { sendErrorJson(res, 'Missing document ID', 400); return }
        const result = await api.findByID({ collection: slug, id })
        result.match(
          (doc) => doc ? sendApiJson(res, doc as DocumentData) : sendErrorJson(res, 'Not found', 404),
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      PATCH: async (req, res) => {
        const user = await authenticateRequest(req, pool)
        if (!await checkAccess(col, 'update', user, res)) return
        if (!requireJsonContentType(req, res)) return
        const rawId = req.url?.split('/').pop() ?? ''
        const id = rawId.split('?')[0] ?? ''
        if (!id) { sendErrorJson(res, 'Missing document ID', 400); return }
        const url = req.url ?? `/${slug}/${id}`
        const locale = parseLocaleFromUrl(url)
        if (!validateLocale(locale, validLocaleCodes, res)) return
        const bodyResult = await safeReadBody(req)
        if (bodyResult.isErr()) { sendErrorJson(res, bodyResult.error.message, 400); return }
        const parseResult = await safeJsonParse(bodyResult.value)
        if (parseResult.isErr()) { sendErrorJson(res, parseResult.error.message, 400); return }
        const validation = safePatchSchema.safeParse(parseResult.value)
        if (!validation.success) {
          const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
          sendErrorJson(res, `Validation failed: ${issues}`, 400)
          return
        }
        const urlParams = parseUrlParams(url)
        const isDraft = urlParams.get('draft') === 'true'
        const isPublish = urlParams.get('publish') === 'true'
        const result = await api.update({
          collection: slug,
          id,
          data: validation.data as DocumentData,
          draft: isDraft,
          publish: isPublish,
          locale
        })
        result.match(
          (doc) => sendApiJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 400)
        )
      },
      DELETE: async (req, res) => {
        const user = await authenticateRequest(req, pool)
        if (!await checkAccess(col, 'delete', user, res)) return
        const rawId = req.url?.split('/').pop() ?? ''
        const id = rawId.split('?')[0] ?? ''
        if (!id) { sendErrorJson(res, 'Missing document ID', 400); return }
        const result = await api.delete({ collection: slug, id })
        result.match(
          (doc) => sendApiJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 500)
        )
      }
    })

    routes.set(`/api/${slug}/:id/unpublish`, {
      POST: async (req, res, ctx) => {
        const user = await authenticateRequest(req, pool)
        if (!await checkAccess(col, 'update', user, res)) return
        const id = ctx.id ?? ''
        if (!id) { sendErrorJson(res, 'Missing document ID', 400); return }
        const result = await api.unpublish({ collection: slug, id })
        result.match(
          (doc) => sendApiJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 400)
        )
      }
    })

    routes.set(`/api/${slug}/bulk`, {
      POST: async (req, res) => {
        const user = await authenticateRequest(req, pool)
        if (!requireJsonContentType(req, res)) return
        const bodyResult = await safeReadBody(req)
        if (bodyResult.isErr()) { sendErrorJson(res, bodyResult.error.message, 400); return }
        const parseResult = await safeJsonParse(bodyResult.value)
        if (parseResult.isErr()) { sendErrorJson(res, parseResult.error.message, 400); return }

        const parsed = parseResult.value
        const action = typeof parsed.action === 'string' ? parsed.action : undefined
        const ids = Array.isArray(parsed.ids) ? (parsed.ids as string[]) : undefined

        if (!action) { sendErrorJson(res, 'Missing action', 400); return }
        if (!ids || ids.length === 0) { sendErrorJson(res, 'ids must be a non-empty array', 400); return }

        const operation = BULK_ACTION_OPERATIONS[action]
        if (!operation) { sendErrorJson(res, `Unknown action: ${action}`, 400); return }

        if (!await checkAccess(col, operation, user, res)) return

        const ACTIONS: Record<string, (id: string) => ResultAsync<DocumentRow, CmsError>> = {
          delete: (id) => api.delete({ collection: slug, id }),
          publish: (id) => api.update({ collection: slug, id, data: {}, publish: true }),
          unpublish: (id) => api.unpublish({ collection: slug, id })
        }

        const handler = ACTIONS[action]!

        const resultPromises = ids.map(async (id) => {
          const opResult = await handler(id)
          return opResult.match(
            (doc): { id: string; success: true; doc: DocumentData } => ({ id, success: true, doc: doc as DocumentData }),
            (err): { id: string; success: false; error: string } => ({ id, success: false, error: err.message })
          )
        })

        const results = await Promise.all(resultPromises)
        const responseBody = JSON.stringify({ results })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(responseBody)
        })
        res.end(responseBody)
      }
    })
  }

  return routes
}
