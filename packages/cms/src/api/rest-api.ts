import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry, GlobalRegistry } from '../schema/registry.js'
import { createLocalApi } from './local-api.js'
import { sendJson, sendErrorJson, safeReadBody, safeJsonParse } from './http-utils.js'
import type { DocumentData } from '../db/query-builder.js'
import { generateZodSchema, generatePartialSchema, generateDraftSchema } from '../validation/zod-generator.js'
import type { CollectionConfig } from '../schema/collection.js'
import type { PaginatedResult } from '../db/query-types.js'
import type { DocumentRow } from '../db/query-builder.js'

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

const SYSTEM_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])
const RESERVED_PARAMS = new Set(['search', 'sort', 'dir', 'page', 'limit', 'draft', 'publish', 'locale'])

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
  const names = col.fields.map(f => f.name)
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
  readonly page: number | undefined
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

  const pageRaw = params.get('page')
  const page = pageRaw !== null ? parseInt(pageRaw, 10) : undefined
  const limitRaw = params.get('limit')
  const perPage = limitRaw !== null ? parseInt(limitRaw, 10) : 25

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

    routes.set(`/api/${slug}`, {
      GET: async (req, res) => {
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
          perPage: page !== undefined ? perPage : undefined,
          filters,
          includeDrafts
        })
        result.match(
          (docs) => {
            if (page !== undefined) {
              sendPaginatedJson(res, docs as PaginatedResult<DocumentRow>)
            } else {
              sendJson(res, docs as DocumentData[])
            }
          },
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      POST: async (req, res) => {
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
        const schema = isDraft && draftSchema !== undefined ? draftSchema : zodSchema
        const validation = schema.safeParse(parseResult.value)
        if (!validation.success) {
          const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
          sendErrorJson(res, `Validation failed: ${issues}`, 400)
          return
        }
        const result = await api.create({ collection: slug, data: parseResult.value, draft: isDraft, locale })
        result.match(
          (doc) => sendJson(res, doc as DocumentData, 201),
          (err) => sendErrorJson(res, err.message, 400)
        )
      }
    })

    routes.set(`/api/${slug}/:id`, {
      GET: async (req, res) => {
        const rawId = req.url?.split('/').pop() ?? ''
        const id = rawId.split('?')[0] ?? ''
        if (!id) { sendErrorJson(res, 'Missing document ID', 400); return }
        const result = await api.findByID({ collection: slug, id })
        result.match(
          (doc) => doc ? sendJson(res, doc as DocumentData) : sendErrorJson(res, 'Not found', 404),
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      PATCH: async (req, res) => {
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
        const partialSchema = generatePartialSchema(col.fields)
        const validation = partialSchema.safeParse(parseResult.value)
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
          data: parseResult.value,
          draft: isDraft,
          publish: isPublish,
          locale
        })
        result.match(
          (doc) => sendJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 400)
        )
      },
      DELETE: async (req, res) => {
        const rawId = req.url?.split('/').pop() ?? ''
        const id = rawId.split('?')[0] ?? ''
        if (!id) { sendErrorJson(res, 'Missing document ID', 400); return }
        const result = await api.delete({ collection: slug, id })
        result.match(
          (doc) => sendJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 500)
        )
      }
    })

    routes.set(`/api/${slug}/:id/unpublish`, {
      POST: async (req, res, ctx) => {
        const id = ctx.id ?? ''
        if (!id) { sendErrorJson(res, 'Missing document ID', 400); return }
        const result = await api.unpublish({ collection: slug, id })
        result.match(
          (doc) => sendJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 400)
        )
      }
    })
  }

  return routes
}
