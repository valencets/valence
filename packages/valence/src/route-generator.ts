import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CollectionConfig } from '@valencets/cms'
import type { RouteConfig, RouteHandler } from './define-config.js'
import { sendHtml } from '@valencets/core/server'

export interface GeneratedRoute {
  readonly path: string
  readonly method: string
  readonly collection: string
  readonly type: 'list' | 'detail'
}

const customPathSet = (customRoutes: readonly RouteConfig[] | undefined): ReadonlySet<string> => {
  if (customRoutes === undefined) return new Set()
  return new Set(customRoutes.map((r) => r.path))
}

export function generateCollectionRoutes (
  collections: readonly CollectionConfig[],
  customRoutes?: readonly RouteConfig[] | undefined
): readonly GeneratedRoute[] {
  const overriddenPaths = customPathSet(customRoutes)
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
