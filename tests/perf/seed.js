/**
 * k6 Seed Script — VAL-176
 * Seeds 1000 posts for realistic list / pagination testing.
 * Run this before executing load.js to ensure the database has data.
 *
 * Usage:
 *   k6 run tests/perf/seed.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/perf/seed.js
 *
 * This script uses a single VU to sequentially insert records so that
 * slug uniqueness constraints are never violated.
 */

import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const SEED_COUNT = parseInt(__ENV.SEED_COUNT || '1000', 10)

const seededCount = new Counter('seeds_created')
const seedErrors = new Rate('seed_errors')

export const options = {
  // Single VU, SEED_COUNT iterations for sequential inserts
  vus: 1,
  iterations: SEED_COUNT,
  // Give generous time — Argon2 / DB overhead can be slow under load
  // 1000 posts at ~50ms each = ~50s; allow 3x headroom
  maxDuration: '3m',
  thresholds: {
    // At least 95% of seed operations must succeed
    seed_errors: ['rate<0.05']
  }
}

// Categories and tags for realistic data variation
const CATEGORIES = ['technology', 'design', 'engineering', 'product', 'marketing', 'general']
const BODIES = [
  'This is a standard blog post with interesting content about the topic.',
  'An in-depth analysis covering multiple aspects and perspectives on the subject.',
  'A quick overview of the key points and actionable takeaways for readers.',
  'Detailed technical breakdown with examples, code snippets, and references.',
  'A thought leadership piece exploring future trends and their implications.'
]

export default function () {
  const index = __ITER + 1
  const category = CATEGORIES[index % CATEGORIES.length]
  const body = BODIES[index % BODIES.length]

  const slug = `seed-post-${index}-${category}`
  const payload = JSON.stringify({
    title: `Seed Post ${index}: ${category.charAt(0).toUpperCase() + category.slice(1)}`,
    slug,
    body,
    published: index % 3 !== 0 // ~66% published
  })

  const res = http.post(`${BASE_URL}/api/posts`, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  const ok = check(res, {
    'seed: post created (201)': (r) => r.status === 201,
    'seed: has id': (r) => {
      const b = r.json()
      return b !== null && typeof b.id === 'string'
    }
  })

  seedErrors.add(!ok)

  if (ok) {
    seededCount.add(1)
  } else if (res.status !== 409) {
    // 409 Conflict means the slug already exists — idempotent re-run, not an error
    console.warn(`Seed failed for index ${index}: status=${res.status} body=${res.body}`)
  }
}

export function handleSummary (data) {
  const created = data.metrics.seeds_created ? data.metrics.seeds_created.values.count : 0
  const errorRateVal = data.metrics.seed_errors ? data.metrics.seed_errors.values.rate : 0

  console.log('\nSeed Summary:')
  console.log(`  Posts created: ${created} / ${SEED_COUNT}`)
  console.log(`  Error rate:    ${(errorRateVal * 100).toFixed(2)}%`)

  return {
    stdout: `Seed complete: ${created} posts created, error rate ${(errorRateVal * 100).toFixed(2)}%\n`
  }
}
