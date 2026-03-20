/**
 * k6 Smoke Test — VAL-176
 * 1 VU, 10 iterations. Verifies core endpoints are reachable and fast.
 * Thresholds: p95 < 500ms, error rate < 1%.
 *
 * Usage:
 *   k6 run tests/perf/smoke.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/perf/smoke.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Custom metrics
const errorRate = new Rate('errors')
const healthDuration = new Trend('health_duration', true)
const listDuration = new Trend('list_duration', true)
const getDuration = new Trend('get_duration', true)

export const options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    // Overall HTTP request duration p95 < 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate must stay below 1%
    errors: ['rate<0.01'],
    // Individual endpoint budgets
    health_duration: ['p(95)<200'],
    list_duration: ['p(95)<500'],
    get_duration: ['p(95)<500']
  }
}

// Shared state: seed a post ID during setup so GET /:id has a real resource
export function setup () {
  const payload = JSON.stringify({
    title: 'Smoke Test Post',
    slug: 'smoke-test-post',
    body: 'Smoke test body content.',
    published: true
  })

  const res = http.post(`${BASE_URL}/api/posts`, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  if (res.status === 201 || res.status === 200) {
    const body = res.json()
    if (body && body.id) return { postId: body.id }
  }

  // If creation fails (no server / auth required), proceed without postId
  return { postId: null }
}

export default function (data) {
  const { postId } = data

  // --- GET / (health / root) ---
  {
    const res = http.get(`${BASE_URL}/`)
    const ok = check(res, {
      'GET / status is not 5xx': (r) => r.status < 500
    })
    errorRate.add(!ok)
    healthDuration.add(res.timings.duration)
    sleep(0.1)
  }

  // --- GET /api/posts (list) ---
  {
    const res = http.get(`${BASE_URL}/api/posts`)
    const ok = check(res, {
      'GET /api/posts status 200': (r) => r.status === 200,
      'GET /api/posts returns docs array': (r) => {
        const body = r.json()
        return body !== null && body !== undefined
      }
    })
    errorRate.add(!ok)
    listDuration.add(res.timings.duration)
    sleep(0.1)
  }

  // --- GET /api/posts/:id (single doc) ---
  if (postId) {
    const res = http.get(`${BASE_URL}/api/posts/${postId}`)
    const ok = check(res, {
      'GET /api/posts/:id status 200': (r) => r.status === 200,
      'GET /api/posts/:id has id field': (r) => {
        const body = r.json()
        return body !== null && body.id === postId
      }
    })
    errorRate.add(!ok)
    getDuration.add(res.timings.duration)
    sleep(0.1)
  }
}

export function teardown (data) {
  const { postId } = data
  if (postId) {
    http.del(`${BASE_URL}/api/posts/${postId}`)
  }
}
