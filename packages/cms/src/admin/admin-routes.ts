import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import { renderLayout } from './layout.js'
import { renderDashboard } from './dashboard.js'
import { renderListView } from './list-view.js'
import { renderEditView } from './edit-view.js'
import { createLocalApi } from '../api/local-api.js'
import { createGlobalRegistry } from '../schema/registry.js'

type RouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

interface RouteEntry {
  readonly GET?: RouteHandler | undefined
  readonly POST?: RouteHandler | undefined
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
  collections: CollectionRegistry
): Map<string, RouteEntry> {
  const routes = new Map<string, RouteEntry>()
  const allCollections = collections.getAll()
  const globals = createGlobalRegistry()
  const api = createLocalApi(pool, collections, globals)

  routes.set('/admin', {
    GET: async (_req, res) => {
      const content = renderDashboard(allCollections)
      const html = renderLayout({ title: 'Dashboard', content, collections: allCollections })
      sendHtml(res, html)
    }
  })

  for (const col of allCollections) {
    routes.set(`/admin/${col.slug}`, {
      GET: async (_req, res) => {
        const result = await api.find({ collection: col.slug })
        const docs = result.unwrapOr([])
        const content = renderListView(col, docs as Array<{ id: string, [key: string]: string | number | boolean | null }>)
        const html = renderLayout({
          title: col.labels?.plural ?? col.slug,
          content,
          collections: allCollections
        })
        sendHtml(res, html)
      }
    })

    routes.set(`/admin/${col.slug}/new`, {
      GET: async (_req, res) => {
        const content = renderEditView(col, null)
        const html = renderLayout({
          title: `New ${col.labels?.singular ?? col.slug}`,
          content,
          collections: allCollections
        })
        sendHtml(res, html)
      }
    })
  }

  return routes
}
