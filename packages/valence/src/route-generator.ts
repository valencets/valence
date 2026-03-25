import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CollectionConfig, CmsInstance } from '@valencets/cms'
import type { DbPool } from '@valencets/db'
import type { RouteConfig, RouteHandler, LoaderContext } from './define-config.js'
import { sendHtml } from '@valencets/core/server'
import { executeLoader, serializeLoaderData, injectLoaderData } from './loader.js'
import { executeAction, readRequestBody } from './action.js'

export interface GeneratedRoute {
  readonly path: string
  readonly method: string
  readonly collection: string
  readonly type: 'list' | 'detail'
}

const TEMPLATE_SEGMENT_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

const generatedGetOverridePathSet = (customRoutes: readonly RouteConfig[] | undefined): ReadonlySet<string> => {
  if (customRoutes === undefined) return new Set()
  return new Set(
    customRoutes
      .filter((r) => (r.method ?? 'GET').toUpperCase() === 'GET')
      .map((r) => r.path)
  )
}

export function generateCollectionRoutes (
  collections: readonly CollectionConfig[],
  customRoutes?: readonly RouteConfig[] | undefined
): readonly GeneratedRoute[] {
  const overriddenPaths = generatedGetOverridePathSet(customRoutes)
  const routes: GeneratedRoute[] = []

  for (const col of collections) {
    const listPath = `/${col.slug}`
    const detailPath = `/${col.slug}/:id`

    if (!overriddenPaths.has(listPath)) {
      routes.push({ path: listPath, method: 'GET', collection: col.slug, type: 'list' })
    }

    if (!overriddenPaths.has(detailPath)) {
      routes.push({ path: detailPath, method: 'GET', collection: col.slug, type: 'detail' })
    }
  }

  return routes
}

const listTemplatePath = (projectDir: string, slug: string): string =>
  join(projectDir, 'src', 'pages', slug, 'ui', 'index.html')

const detailTemplatePath = (projectDir: string, slug: string): string =>
  join(projectDir, 'src', 'pages', slug, 'ui', 'detail.html')

const isFragment = (req: IncomingMessage): boolean =>
  req.headers['x-valence-fragment'] === 'true'

function makeGeneratedHandler (route: GeneratedRoute, projectDir: string): RouteHandler {
  const templatePath = route.type === 'list'
    ? listTemplatePath(projectDir, route.collection)
    : detailTemplatePath(projectDir, route.collection)

  return async (req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> => {
    if (existsSync(templatePath)) {
      const content = readFileSync(templatePath, 'utf-8')
      sendHtml(res, content)
      return
    }

    const fragment = isFragment(req)
    const body = JSON.stringify({
      collection: route.collection,
      type: route.type,
      params,
      fragment
    })
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(body)
  }
}

export function buildGeneratedRouteMap (
  routes: readonly GeneratedRoute[],
  projectDir: string
): Map<string, Map<string, RouteHandler>> {
  const routeMap = new Map<string, Map<string, RouteHandler>>()

  for (const route of routes) {
    const handler = makeGeneratedHandler(route, projectDir)
    let methodMap = routeMap.get(route.path)
    if (methodMap === undefined) {
      methodMap = new Map<string, RouteHandler>()
      routeMap.set(route.path, methodMap)
    }
    methodMap.set(route.method.toUpperCase(), handler)
  }

  return routeMap
}

function extractQueryFromReq (req: IncomingMessage): URLSearchParams {
  const rawUrl = req.url ?? '/'
  const qIndex = rawUrl.indexOf('?')
  if (qIndex === -1) return new URLSearchParams()
  return new URLSearchParams(rawUrl.slice(qIndex + 1))
}

function isValidTemplateSegment (segment: string): boolean {
  return TEMPLATE_SEGMENT_PATTERN.test(segment) && !segment.includes('..')
}

function resolveTemplatePath (routePath: string, projectDir: string): string | null {
  // Preserve static route shape for template lookup.
  // Param segments do not become directories; any param selects detail.html.
  const segments = routePath.split('/').filter(s => s.length > 0)
  const hasParam = segments.some(s => s.startsWith(':'))
  const staticSegments = segments.filter(s => !s.startsWith(':'))

  for (const segment of staticSegments) {
    if (!isValidTemplateSegment(segment)) return null
  }

  const pageSegments = staticSegments.length > 0 ? staticSegments : ['page']
  return hasParam
    ? join(projectDir, 'src', 'pages', ...pageSegments, 'ui', 'detail.html')
    : join(projectDir, 'src', 'pages', ...pageSegments, 'ui', 'index.html')
}

function mergeResponseHeaders (
  fixedHeaders: Readonly<Record<string, string>>,
  customHeaders: Record<string, string> | undefined
): Record<string, string> {
  return {
    ...(customHeaders ?? {}),
    ...fixedHeaders
  }
}

function makeLoaderHandler (
  route: RouteConfig,
  projectDir: string,
  pool: DbPool,
  cms: CmsInstance
): RouteHandler {
  const loader = route.loader!
  const templatePath = resolveTemplatePath(route.path, projectDir)

  return async (req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> => {
    const query = extractQueryFromReq(req)
    const ctx: LoaderContext = { params, query, req, pool, cms }
    const loaderResult = await executeLoader(loader, ctx)

    if (loaderResult.isErr()) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Internal Server Error')
      return
    }

    const result = loaderResult.value

    if (result.redirect !== undefined) {
      res.writeHead(302, mergeResponseHeaders({ Location: result.redirect }, result.headers))
      res.end()
      return
    }

    const status = result.status ?? 200
    const script = serializeLoaderData(result.data)

    if (templatePath !== null && existsSync(templatePath)) {
      const templateContent = readFileSync(templatePath, 'utf-8')
      const html = injectLoaderData(templateContent, script)
      res.writeHead(status, mergeResponseHeaders({ 'Content-Type': 'text/html; charset=utf-8' }, result.headers))
      res.end(html)
      return
    }

    // No template -- return minimal HTML with embedded loader data script
    const html = `<!doctype html><html><body>${script}</body></html>`
    res.writeHead(status, mergeResponseHeaders({ 'Content-Type': 'text/html; charset=utf-8' }, result.headers))
    res.end(html)
  }
}

function makeActionHandler (
  route: RouteConfig,
  projectDir: string,
  pool: DbPool,
  cms: CmsInstance
): RouteHandler {
  const action = route.action!
  const templatePath = resolveTemplatePath(route.path, projectDir)

  return async (req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> => {
    const rawBody = await readRequestBody(req)
    const body = new URLSearchParams(rawBody)
    const ctx = { params, body, req, pool, cms }
    const actionResult = await executeAction(action, ctx)

    if (actionResult.isErr()) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Internal Server Error')
      return
    }

    const result = actionResult.value

    if (result.redirect !== undefined) {
      res.writeHead(302, { Location: result.redirect })
      res.end()
      return
    }

    const status = result.status ?? 200

    if (templatePath !== null && existsSync(templatePath)) {
      const templateContent = readFileSync(templatePath, 'utf-8')
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(templateContent)
      return
    }

    // No template -- return action result as JSON
    const responseBody = JSON.stringify({ data: result.data, errors: result.errors })
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(responseBody)
  }
}

export function buildUserRouteMap (
  routes: readonly RouteConfig[] | undefined,
  projectDir: string,
  pool: DbPool,
  cms: CmsInstance
): Map<string, Map<string, RouteHandler>> {
  const routeMap = new Map<string, Map<string, RouteHandler>>()
  if (routes === undefined) return routeMap

  for (const route of routes) {
    let methodMap = routeMap.get(route.path)
    if (methodMap === undefined) {
      methodMap = new Map<string, RouteHandler>()
      routeMap.set(route.path, methodMap)
    }

    const method = (route.method ?? 'GET').toUpperCase()

    if (route.handler !== undefined) {
      methodMap.set(method, route.handler)
    }

    if (route.loader !== undefined) {
      methodMap.set('GET', makeLoaderHandler(route, projectDir, pool, cms))
    }

    if (route.action !== undefined) {
      const actionMethod = (route.method ?? 'POST').toUpperCase()
      if (route.loader !== undefined && actionMethod === 'GET') {
        continue
      }
      methodMap.set(actionMethod, makeActionHandler(route, projectDir, pool, cms))
    }
  }

  return routeMap
}
