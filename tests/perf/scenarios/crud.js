/**
 * k6 CRUD Scenario — VAL-176
 * Full lifecycle: create -> read -> update -> list -> delete.
 * Uses k6 group() for per-category metrics and thresholds.
 *
 * Performance budgets:
 *   - health p95 < 200ms
 *   - CRUD (create/read/update/delete) p95 < 500ms
 *   - list p95 < 800ms
 *
 * Usage (standalone):
 *   k6 run tests/perf/scenarios/crud.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/perf/scenarios/crud.js
 *
 * Usage (from load.js via import):
 *   import { crudScenario } from './scenarios/crud.js'
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Performance budget metrics (milliseconds, track percentiles)
export const metrics = {
  health: new Trend('health_p95', true),
  create: new Trend('crud_create_p95', true),
  read: new Trend('crud_read_p95', true),
  update: new Trend('crud_update_p95', true),
  list: new Trend('crud_list_p95', true),
  del: new Trend('crud_delete_p95', true),
  errors: new Rate('crud_errors')
}

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<800'],
    crud_errors: ['rate<0.05'],
    health_p95: ['p(95)<200'],
    crud_create_p95: ['p(95)<500'],
    crud_read_p95: ['p(95)<500'],
    crud_update_p95: ['p(95)<500'],
    crud_list_p95: ['p(95)<800'],
    crud_delete_p95: ['p(95)<500']
  }
}

/**
 * Run one full CRUD lifecycle iteration.
 * Call this from the default function or import into load.js.
 *
 * @param {object} opts - Options
 * @param {string|null} opts.seedPostId - An existing post ID for stable reads
 * @param {string} opts.baseUrl - Base URL override
 */
export function crudLifecycle ({ seedPostId = null, baseUrl = BASE_URL } = {}) {
  let createdId = null

  // --- CREATE ---
  group('crud: create', function () {
    const uniqueSlug = `crud-post-${__VU}-${__ITER}-${Date.now()}`
    const payload = JSON.stringify({
      title: `CRUD Post VU${__VU} Iter${__ITER}`,
      slug: uniqueSlug,
      body: 'Full CRUD lifecycle test content.',
      published: false
    })
    const res = http.post(`${baseUrl}/api/posts`, payload, {
      headers: { 'Content-Type': 'application/json' }
    })
    const ok = check(res, {
      'create: status 201': (r) => r.status === 201,
      'create: returns id': (r) => {
        const b = r.json()
        return b !== null && typeof b.id === 'string'
      },
      'create: returns title': (r) => {
        const b = r.json()
        return b !== null && b.title !== undefined
      }
    })
    metrics.errors.add(!ok)
    metrics.create.add(res.timings.duration)

    if (res.status === 201) {
      const body = res.json()
      if (body && body.id) createdId = body.id
    }
  })

  sleep(0.05)

  // --- READ (single, stable seed post) ---
  const readTarget = createdId || seedPostId
  if (readTarget) {
    group('crud: read', function () {
      const res = http.get(`${baseUrl}/api/posts/${readTarget}`)
      const ok = check(res, {
        'read: status 200': (r) => r.status === 200,
        'read: has id field': (r) => {
          const b = r.json()
          return b !== null && b.id !== undefined
        }
      })
      metrics.errors.add(!ok)
      metrics.read.add(res.timings.duration)
    })

    sleep(0.05)
  }

  // --- UPDATE ---
  if (createdId) {
    group('crud: update', function () {
      const payload = JSON.stringify({
        title: `Updated CRUD Post VU${__VU}`,
        published: true
      })
      const res = http.patch(`${baseUrl}/api/posts/${createdId}`, payload, {
        headers: { 'Content-Type': 'application/json' }
      })
      const ok = check(res, {
        'update: status 200': (r) => r.status === 200,
        'update: published is true': (r) => {
          const b = r.json()
          return b !== null && b.published === true
        }
      })
      metrics.errors.add(!ok)
      metrics.update.add(res.timings.duration)
    })

    sleep(0.05)
  }

  // --- LIST ---
  group('crud: list', function () {
    const res = http.get(`${baseUrl}/api/posts?limit=20&page=1`)
    const ok = check(res, {
      'list: status 200': (r) => r.status === 200,
      'list: response is object': (r) => r.json() !== null
    })
    metrics.errors.add(!ok)
    metrics.list.add(res.timings.duration)
  })

  sleep(0.05)

  // --- DELETE ---
  if (createdId) {
    group('crud: delete', function () {
      const res = http.del(`${baseUrl}/api/posts/${createdId}`)
      const ok = check(res, {
        'delete: status 200 or 204': (r) => r.status === 200 || r.status === 204
      })
      metrics.errors.add(!ok)
      metrics.del.add(res.timings.duration)
      // After successful delete the ID is no longer valid
      if (ok) createdId = null
    })

    sleep(0.05)
  }
}

export function setup () {
  // Seed a stable post for read operations
  const payload = JSON.stringify({
    title: 'CRUD Scenario Seed Post',
    slug: `crud-seed-${Date.now()}`,
    body: 'Seed post for stable read checks in CRUD scenario.',
    published: true
  })

  const res = http.post(`${BASE_URL}/api/posts`, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  if (res.status === 201 || res.status === 200) {
    const body = res.json()
    if (body && body.id) return { seedPostId: body.id }
  }

  return { seedPostId: null }
}

export default function (data) {
  const { seedPostId } = data

  // Health check before CRUD lifecycle
  group('health', function () {
    const res = http.get(`${BASE_URL}/`)
    const ok = check(res, {
      'health: not 5xx': (r) => r.status < 500
    })
    metrics.errors.add(!ok)
    metrics.health.add(res.timings.duration)
  })

  sleep(0.05)

  crudLifecycle({ seedPostId, baseUrl: BASE_URL })
}

export function teardown (data) {
  const { seedPostId } = data
  if (seedPostId) {
    http.del(`${BASE_URL}/api/posts/${seedPostId}`)
  }
}
