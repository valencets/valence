import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import { serializeFlash } from '../admin/flash.js'

function makePostsCollection () {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true }),
      field.boolean({ name: 'published' })
    ]
  })
}

function makeMockReq (body: string, cookie: string = ''): Record<string, ReturnType<typeof vi.fn> | Record<string, string> | string> {
  const req: Record<string, ReturnType<typeof vi.fn> | Record<string, string> | string> = {
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    url: '/admin/posts/new',
    method: 'POST',
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === 'data') cb(Buffer.from(body))
      if (event === 'end') cb()
      return req
    }),
    removeAllListeners: vi.fn(() => req)
  }
  return req
}

describe('admin POST error re-rendering', () => {
  it('validation error re-renders form with toast and preserves field values', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)

    // First GET to generate a CSRF token
    const getReq = { headers: {}, url: '/admin/posts/new', method: 'GET' }
    let getBody = ''
    const getRes = { writeHead: vi.fn(), end: vi.fn((data: string) => { getBody = data }), setHeader: vi.fn() }
    await routes.get('/admin/posts/new')!.GET!(getReq as never, getRes as never, {})

    // Extract the CSRF token from the form
    const tokenMatch = getBody.match(/name="_csrf" value="([^"]+)"/)
    const csrfToken = tokenMatch![1]

    // POST with invalid boolean value to trigger Zod validation error
    const postReq = makeMockReq(`_csrf=${csrfToken}&title=My+Post&slug=hello&published=notabool`)
    let postBody = ''
    const postRes = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { postBody = data }),
      setHeader: vi.fn()
    }
    await routes.get('/admin/posts/new')!.POST!(postReq as never, postRes as never, {})

    expect(postRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
    expect(postBody).toContain('toast-error')
    expect(postBody).toContain('Validation failed')
    // Form should be re-rendered with submitted values preserved
    expect(postBody).toContain('value="My Post"')
    // Should contain a new CSRF token for resubmission
    expect(postBody).toContain('name="_csrf"')
  })

  it('CSRF failure re-renders form with toast', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const req = makeMockReq('_csrf=bad-token&title=Test&slug=test')
    let body = ''
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { body = data }),
      setHeader: vi.fn()
    }
    await routes.get('/admin/posts/new')!.POST!(req as never, res as never, {})

    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object))
    expect(body).toContain('toast-error')
    expect(body).toContain('CSRF')
    // Form should be re-rendered with the submitted data preserved
    expect(body).toContain('value="Test"')
  })

  it('success redirect sets flash cookie', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: '1' }])
    const routes = createAdminRoutes(pool, registry)

    // GET to generate CSRF token
    const getReq = { headers: {}, url: '/admin/posts/new', method: 'GET' }
    let getBody = ''
    const getRes = { writeHead: vi.fn(), end: vi.fn((data: string) => { getBody = data }), setHeader: vi.fn() }
    await routes.get('/admin/posts/new')!.GET!(getReq as never, getRes as never, {})
    const tokenMatch = getBody.match(/name="_csrf" value="([^"]+)"/)
    const csrfToken = tokenMatch![1]

    // POST with valid data
    const postReq = makeMockReq(`_csrf=${csrfToken}&title=Hello&slug=hello`)
    const postRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await routes.get('/admin/posts/new')!.POST!(postReq as never, postRes as never, {})

    expect(postRes.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/admin/posts' }))
    expect(postRes.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('cms_flash='))
  })
})

describe('admin GET list page flash cookie', () => {
  it('reads flash cookie and renders toast on list page', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([])
    const routes = createAdminRoutes(pool, registry)

    const flashValue = serializeFlash({ type: 'success', text: 'Post created successfully' })
    const req = { headers: { cookie: `cms_flash=${flashValue}` }, url: '/admin/posts', method: 'GET' }
    let body = ''
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { body = data }),
      setHeader: vi.fn()
    }
    await routes.get('/admin/posts')!.GET!(req as never, res as never, {})

    expect(body).toContain('toast-success')
    expect(body).toContain('Post created successfully')
    // Should clear the flash cookie
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Max-Age=0'))
  })

  it('does not render toast when no flash cookie', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([])
    const routes = createAdminRoutes(pool, registry)

    const req = { headers: {}, url: '/admin/posts', method: 'GET' }
    let body = ''
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { body = data }),
      setHeader: vi.fn()
    }
    await routes.get('/admin/posts')!.GET!(req as never, res as never, {})

    expect(body).not.toContain('class="toast')
  })
})
