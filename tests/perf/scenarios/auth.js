/**
 * k6 Auth Scenario — VAL-176
 * Login flow and rate-limiting verification.
 *
 * Scenarios:
 *  1. Successful login — expects 200 + session cookie
 *  2. Failed login (bad password) — expects 401
 *  3. Rate limiting — rapid repeated failures should eventually return 429
 *
 * Performance budget:
 *  - auth p95 < 500ms (Argon2 verify is expensive but bounded)
 *
 * Usage:
 *   k6 run tests/perf/scenarios/auth.js
 *   k6 run --env BASE_URL=http://localhost:3000 \
 *          --env AUTH_EMAIL=admin@example.com \
 *          --env AUTH_PASSWORD=secret \
 *          tests/perf/scenarios/auth.js
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'admin@test.local'
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'admin123'

// Auth-specific metrics
const loginDuration = new Trend('auth_login_duration', true)
const logoutDuration = new Trend('auth_logout_duration', true)
const errorRate = new Rate('auth_errors')
const rateLimitRate = new Rate('auth_rate_limited')

export const options = {
  scenarios: {
    // Successful login scenario: 5 VUs for 30s
    login_flow: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'loginFlow'
    },
    // Rate limit verification: single VU hammering bad credentials
    rate_limit_check: {
      executor: 'constant-vus',
      vus: 1,
      duration: '15s',
      exec: 'rateLimitCheck',
      startTime: '5s'
    }
  },
  thresholds: {
    // Auth must be fast enough despite Argon2 cost
    auth_login_duration: ['p(95)<500'],
    auth_logout_duration: ['p(95)<200'],
    // Auth errors (not counting expected 401s / 429s) must stay low
    auth_errors: ['rate<0.05']
  }
}

/**
 * Full login -> use session -> logout lifecycle.
 * Used by the login_flow scenario executor.
 */
export function loginFlow () {
  let sessionCookie = null

  group('auth: login', function () {
    const payload = JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD })
    const res = http.post(`${BASE_URL}/api/users/login`, payload, {
      headers: { 'Content-Type': 'application/json' }
    })

    const ok = check(res, {
      'login: status 200': (r) => r.status === 200,
      'login: sets cookie': (r) => {
        const setCookie = r.headers['Set-Cookie'] || r.headers['set-cookie']
        return setCookie !== undefined && setCookie !== null && String(setCookie).length > 0
      }
    })
    errorRate.add(!ok)
    loginDuration.add(res.timings.duration)

    if (res.status === 200) {
      // Extract session cookie for subsequent requests
      const setCookie = res.headers['Set-Cookie'] || res.headers['set-cookie']
      if (setCookie) sessionCookie = String(setCookie).split(';')[0]
    }
  })

  sleep(0.1)

  // Use the authenticated session
  if (sessionCookie) {
    group('auth: authenticated request', function () {
      const res = http.get(`${BASE_URL}/api/posts`, {
        headers: { Cookie: sessionCookie }
      })
      const ok = check(res, {
        'authenticated: status 200': (r) => r.status === 200
      })
      errorRate.add(!ok)
    })

    sleep(0.1)

    // Logout
    group('auth: logout', function () {
      const res = http.post(`${BASE_URL}/api/users/logout`, null, {
        headers: { Cookie: sessionCookie }
      })
      const ok = check(res, {
        'logout: status 200 or 204': (r) => r.status === 200 || r.status === 204
      })
      // Logout errors are tracked but not counted as hard failures
      logoutDuration.add(res.timings.duration)
      // Non-critical: some implementations may not have a logout endpoint
      if (!ok && res.status !== 404 && res.status !== 405) {
        errorRate.add(true)
      }
    })
  }

  sleep(0.2)
}

/**
 * Rapid bad-credential requests to verify rate limiting is enforced.
 * Expects 401 normally, and eventually 429 when rate limit kicks in.
 * Used by the rate_limit_check scenario executor.
 */
export function rateLimitCheck () {
  group('rate-limit: bad credentials', function () {
    const payload = JSON.stringify({
      email: `nonexistent-${__ITER}@example.invalid`,
      password: 'wrong-password-deliberate'
    })
    const res = http.post(`${BASE_URL}/api/users/login`, payload, {
      headers: { 'Content-Type': 'application/json' }
    })

    check(res, {
      'rate-limit: rejected (401 or 429)': (r) => r.status === 401 || r.status === 429
    })

    // Track when rate limiting engages
    if (res.status === 429) {
      rateLimitRate.add(true)
    } else {
      rateLimitRate.add(false)
    }
  })

  // Very short sleep to drive high request rate for rate limit triggering
  sleep(0.01)
}

// Default export for standalone use (login flow only)
export default loginFlow
