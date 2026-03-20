import { describe, it, expect } from 'vitest'
import { generateRouteTypes } from '../codegen/route-type-generator.js'
import { collection } from '@valencets/cms'
import type { RouteConfig } from '../define-config.js'

describe('generateRouteTypes', () => {
  it('starts with the @generated comment', () => {
    const output = generateRouteTypes([])
    expect(output).toContain('// @generated — regenerated from valence.config.ts. DO NOT EDIT.')
  })

  it('contains export interface ValenceRoutes', () => {
    const output = generateRouteTypes([])
    expect(output).toContain('export interface ValenceRoutes')
  })

  it('generates list and detail route types for a single collection', () => {
    const col = collection({
      slug: 'posts',
      fields: []
    })
    const output = generateRouteTypes([col])
    expect(output).toContain("readonly '/posts': { readonly params: {} }")
    expect(output).toContain("readonly '/posts/:id': { readonly params: { readonly id: string } }")
  })

  it('generates route types for multiple collections', () => {
    const posts = collection({ slug: 'posts', fields: [] })
    const tags = collection({ slug: 'tags', fields: [] })
    const output = generateRouteTypes([posts, tags])
    expect(output).toContain("readonly '/posts': { readonly params: {} }")
    expect(output).toContain("readonly '/posts/:id': { readonly params: { readonly id: string } }")
    expect(output).toContain("readonly '/tags': { readonly params: {} }")
    expect(output).toContain("readonly '/tags/:id': { readonly params: { readonly id: string } }")
  })

  it('generates custom route types with no params as empty params object', () => {
    const customRoutes: readonly RouteConfig[] = [
      { path: '/about' }
    ]
    const output = generateRouteTypes([], customRoutes)
    expect(output).toContain("readonly '/about': { readonly params: {} }")
  })

  it('generates custom route types with :param segments extracted as typed params', () => {
    const customRoutes: readonly RouteConfig[] = [
      { path: '/blog/:slug' }
    ]
    const output = generateRouteTypes([], customRoutes)
    expect(output).toContain("readonly '/blog/:slug': { readonly params: { readonly slug: string } }")
  })

  it('generates custom route types with multiple :param segments', () => {
    const customRoutes: readonly RouteConfig[] = [
      { path: '/users/:userId/posts/:postId' }
    ]
    const output = generateRouteTypes([], customRoutes)
    expect(output).toContain("readonly '/users/:userId/posts/:postId': { readonly params: { readonly userId: string; readonly postId: string } }")
  })

  it('combines collection routes and custom routes in the interface', () => {
    const col = collection({ slug: 'posts', fields: [] })
    const customRoutes: readonly RouteConfig[] = [
      { path: '/blog/:slug' }
    ]
    const output = generateRouteTypes([col], customRoutes)
    expect(output).toContain("readonly '/posts': { readonly params: {} }")
    expect(output).toContain("readonly '/posts/:id': { readonly params: { readonly id: string } }")
    expect(output).toContain("readonly '/blog/:slug': { readonly params: { readonly slug: string } }")
  })

  it('produces valid TypeScript structure (braces balanced)', () => {
    const col = collection({ slug: 'posts', fields: [] })
    const output = generateRouteTypes([col])
    const openBraces = (output.match(/\{/g) ?? []).length
    const closeBraces = (output.match(/\}/g) ?? []).length
    expect(openBraces).toBe(closeBraces)
  })
})
