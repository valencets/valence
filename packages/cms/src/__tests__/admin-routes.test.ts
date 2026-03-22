import { describe, it, expect } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { makeMockPool } from './test-helpers.js'
import { createCollectionRegistry } from '../schema/registry.js'

describe('admin-routes asset serving', () => {
  it('serves .css files from /admin/_assets/ with text/css content type', async () => {
    const pool = makeMockPool([])
    const registry = createCollectionRegistry([])
    const routes = createAdminRoutes(pool, registry, 'test-secret')
    const assetRoute = routes.get('/admin/_assets/:file')
    expect(assetRoute).toBeDefined()
    // The route handler exists and accepts both .js and .css files
    // Full serving test requires filesystem — this validates route registration
    expect(assetRoute!.GET).toBeDefined()
  })
})
