import { createServer } from 'node:http'
import type { Server, IncomingMessage, ServerResponse } from 'node:http'
import { buildCms } from '@valencets/cms'
import type { CmsInstance, CollectionConfig, RestRouteEntry } from '@valencets/cms'
import type { DbPool } from '@valencets/db'

interface RouteMatch {
  readonly entry: Record<string, ((req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>) | undefined>
  readonly params: Record<string, string>
}

function matchRoute (pathname: string, routes: Map<string, RestRouteEntry>): RouteMatch | null {
  const exact = routes.get(pathname)
  if (exact) return { entry: exact as RouteMatch['entry'], params: {} }

  for (const [pattern, entry] of routes) {
    if (!pattern.includes(':')) continue

    const patternParts = pattern.split('/')
    const pathParts = pathname.split('/')
    if (patternParts.length !== pathParts.length) continue

    const params: Record<string, string> = {}
    let match = true
    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i]!
      const up = pathParts[i]!
      if (pp.startsWith(':')) {
        params[pp.slice(1)] = up
      } else if (pp !== up) {
        match = false
        break
      }
    }

    if (match) return { entry: entry as RouteMatch['entry'], params }
  }

  return null
}

export interface TestApp {
  readonly server: Server
  readonly cms: CmsInstance
  readonly baseUrl: string
  close (): Promise<void>
}

export interface TestAppConfig {
  readonly pool: DbPool
  readonly collections: readonly CollectionConfig[]
  readonly secret?: string | undefined
  readonly uploadDir?: string | undefined
}

export function createTestApp (config: TestAppConfig): TestApp {
  const cmsResult = buildCms({
    db: config.pool,
    secret: config.secret ?? 'test-secret',
    collections: config.collections,
    uploadDir: config.uploadDir
  })

  if (cmsResult.isErr()) {
    throw new Error(`Test CMS build failed: ${cmsResult.error.message}`)
  }

  const cms = cmsResult.value

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const method = (req.method ?? 'GET') as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

    const adminMatch = matchRoute(url.pathname, cms.adminRoutes)
    if (adminMatch) {
      const handler = adminMatch.entry[method]
      if (handler) {
        await handler(req, res, adminMatch.params)
        return
      }
    }

    const restMatch = matchRoute(url.pathname, cms.restRoutes)
    if (restMatch) {
      const handler = restMatch.entry[method]
      if (handler) {
        await handler(req, res, restMatch.params)
        return
      }
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method not allowed')
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  return {
    server,
    cms,
    get baseUrl () { return `http://localhost:${(server.address() as { port: number })?.port ?? 0}` },
    close () {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => { err ? reject(err) : resolve() })
      })
    }
  }
}

export function startTestApp (config: TestAppConfig): Promise<TestApp> {
  const app = createTestApp(config)
  return new Promise<TestApp>((resolve) => {
    app.server.listen(0, () => { resolve(app) })
  })
}
