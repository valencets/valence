import { createSession } from '@inertia/db'
import { safeJsonParse } from '@inertia/ingestion'
import type { RouteHandler } from '../../../server/types.js'
import { readBody, sendJson } from '../../../server/router.js'

export const sessionHandler: RouteHandler = async (req, res, ctx) => {
  // Idempotent: if session already exists, just return ok
  const cookies = req.headers.cookie ?? ''
  if (cookies.includes('session_id=')) {
    sendJson(res, { ok: true })
    return
  }

  // Read referrer from request body (client sends document.referrer)
  // HTTP Referer header always points to the current page, not the external referrer
  const body = await readBody(req)
  const referrer = extractReferrer(body)

  const ua = req.headers['user-agent'] ?? ''
  const deviceType = detectDeviceType(ua)

  const result = await createSession(ctx.pool, {
    referrer,
    device_type: deviceType,
    operating_system: detectOS(ua)
  })

  result.match(
    (session) => {
      // Two cookies:
      // 1. session_id — HttpOnly (secure, not accessible to JS)
      // 2. has_session — readable by JS so telemetry-boot can detect existing session
      res.setHeader('Set-Cookie', [
        `session_id=${session.session_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
        'has_session=1; Path=/; SameSite=Lax; Max-Age=86400'
      ])
      sendJson(res, { session_id: session.session_id })
    },
    (dbError) => {
      console.error('Session creation failed:', dbError.message)
      sendJson(res, { ok: true })
    }
  )
}

const MOBILE_PATTERN = /mobile|android|iphone|ipad|ipod/i
const TABLET_PATTERN = /tablet|ipad/i

function detectDeviceType (ua: string): string {
  if (TABLET_PATTERN.test(ua)) return 'tablet'
  if (MOBILE_PATTERN.test(ua)) return 'mobile'
  return 'desktop'
}

const OS_PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly name: string }> = [
  { pattern: /windows/i, name: 'Windows' },
  { pattern: /macintosh|mac os/i, name: 'macOS' },
  { pattern: /linux/i, name: 'Linux' },
  { pattern: /android/i, name: 'Android' },
  { pattern: /iphone|ipad|ipod/i, name: 'iOS' }
]

function detectOS (ua: string): string | null {
  for (const entry of OS_PATTERNS) {
    if (entry.pattern.test(ua)) {
      return entry.name
    }
  }
  return null
}

function extractReferrer (body: string): string | null {
  if (body.length === 0) return null
  const result = safeJsonParse(body)
  if (result.isErr()) return null
  const data = result.value
  if (data !== null && typeof data === 'object' && 'referrer' in data) {
    const ref = (data as { referrer: unknown }).referrer
    if (typeof ref === 'string' && ref.length > 0) return ref
  }
  return null
}
