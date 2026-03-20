import type { CollectionConfig } from '@valencets/cms'
import type { RouteConfig } from '../define-config.js'

const GENERATED_HEADER = '// @generated — regenerated from valence.config.ts. DO NOT EDIT.'

export function extractParams (path: string): readonly string[] {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1))
}

function buildParamsType (params: readonly string[]): string {
  if (params.length === 0) return '{}'
  const entries = params.map((p) => `readonly ${p}: string`).join('; ')
  return `{ ${entries} }`
}

function collectionRouteEntry (path: string, params: readonly string[]): string {
  return `  readonly '${path}': { readonly params: ${buildParamsType(params)} }`
}

export function generateRouteTypes (
  collections: readonly CollectionConfig[],
  customRoutes?: readonly RouteConfig[] | undefined
): string {
  const lines: string[] = []

  for (const col of collections) {
    lines.push(collectionRouteEntry(`/${col.slug}`, []))
    lines.push(collectionRouteEntry(`/${col.slug}/:id`, ['id']))
  }

  if (customRoutes !== undefined) {
    for (const route of customRoutes) {
      const params = extractParams(route.path)
      lines.push(collectionRouteEntry(route.path, params))
    }
  }

  const body = lines.join('\n')

  return `${GENERATED_HEADER}

export interface ValenceRoutes {
${body}
}
`
}
