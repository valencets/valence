/**
 * k6 Load Test — VAL-176
 * Ramping VU test: 10 VUs 30s -> 50 VUs 1min -> ramp down 30s.
 * Covers all CRUD endpoints with per-category thresholds.
 *
 * Usage:
 *   k6 run tests/perf/load.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/perf/load.js
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Per-category timing trends
const createDuration = new Trend('crud_create_duration', true)
const readDuration = new Trend('crud_read_duration', true)
const updateDuration = new Trend('crud_update_duration', true)
const listDuration = new Trend('crud_list_duration', true)
const deleteDuration = new Trend('crud_delete_duration', true)
const healthDuration = new Trend('health_duration', true)
const errorRate = new Rate('errors')

export const options = {
  stages: [
    // Ramp up to 10 VUs in 30s
    { duration: '30s', target: 10 },
    // Ramp up to 50 VUs over 1 minute
    { duration: '1m', target: 50 },
    // Sustain 50 VUs for 30s
    { duration: '30s', target: 50 },
    // Ramp down to 0 in 30s
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    // Overall
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    errors: ['rate<0.05'],
    // Per-category budgets
    health_duration: ['p(95)<200'],
    crud_create_duration: ['p(95)<500'],
    crud_read_duration: ['p(95)<500'],
    crud_update_duration: ['p(95)<500'],
    crud_list_duration: ['p(95)<800'],
    crud_delete_duration: ['p(95)<500']
  }
}

export function setup () {
  // Pre-seed a stable post that all VUs can read without creating conflicts
  const payload = JSON.stringify({
    title: 'Load Test Seed Post',
    slug: `load-test-seed-${Date.now()}`,
    body: 'Seed post for read operations during load test.',
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

  // Health check
  group('health', function () {
    const res = http.get(`${BASE_URL}/`)
    const ok = check(res, {
      'health: not 5xx': (r) => r.status < 500
    })
    errorRate.add(!ok)
    healthDuration.add(res.timings.duration)
  })

  sleep(0.05)

  // Create
  let createdId = null
  group('crud_create', function () {
    const uniqueSlug = `load-post-${__VU}-${__ITER}-${Date.now()}`
    const payload = JSON.stringify({
      title: `Load Post VU${__VU} Iter${__ITER}`,
      slug: uniqueSlug,
      body: 'Body content for load test post.',
      published: false
    })
    const res = http.post(`${BASE_URL}/api/posts`, payload, {
      headers: { 'Content-Type': 'application/json' }
    })
    const ok = check(res, {
      'create: status 201': (r) => r.status === 201,
      'create: has id': (r) => {
        const b = r.json()
        return b !== null && b.id !== undefined
      }
    })
    errorRate.add(!ok)
    createDuration.add(res.timings.duration)
    if (res.status === 201) {
      const body = res.json()
      if (body && body.id) createdId = body.id
    }
  })

  sleep(0.05)

  // Read single (use seed post for stable reads)
  if (seedPostId) {
    group('crud_read', function () {
      const res = http.get(`${BASE_URL}/api/posts/${seedPostId}`)
      const ok = check(res, {
        'read: status 200': (r) => r.status === 200
      })
      errorRate.add(!ok)
      readDuration.add(res.timings.duration)
    })

    sleep(0.05)
  }

  // Update the post we created this iteration
  if (createdId) {
    group('crud_update', function () {
      const payload = JSON.stringify({ title: `Updated Load Post VU${__VU}`, published: true })
      const res = http.patch(`${BASE_URL}/api/posts/${createdId}`, payload, {
        headers: { 'Content-Type': 'application/json' }
      })
      const ok = check(res, {
        'update: status 200': (r) => r.status === 200
      })
      errorRate.add(!ok)
      updateDuration.add(res.timings.duration)
    })

    sleep(0.05)
  }

  // List
  group('crud_list', function () {
    const res = http.get(`${BASE_URL}/api/posts?limit=20&page=1`)
    const ok = check(res, {
      'list: status 200': (r) => r.status === 200
    })
    errorRate.add(!ok)
    listDuration.add(res.timings.duration)
  })

  sleep(0.05)

  // Delete the post we created this iteration
  if (createdId) {
    group('crud_delete', function () {
      const res = http.del(`${BASE_URL}/api/posts/${createdId}`)
      const ok = check(res, {
        'delete: status 200 or 204': (r) => r.status === 200 || r.status === 204
      })
      errorRate.add(!ok)
      deleteDuration.add(res.timings.duration)
    })

    sleep(0.05)
  }
}

export function teardown (data) {
  const { seedPostId } = data
  if (seedPostId) {
    http.del(`${BASE_URL}/api/posts/${seedPostId}`)
  }
}
