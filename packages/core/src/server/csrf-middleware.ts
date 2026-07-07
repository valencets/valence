import type { Middleware } from './middleware-types.js'
import { generateCsrfToken, validateCsrfToken } from './csrf.js'
import { sendJson, readBody } from './http-helpers.js'
import { fromThrowable } from '@valencets/resultkit'

const COOKIE_NAME = '__val_csrf'
const HEADER_NAME = 'x-csrf-token'
const BODY_FIELD = '_csrf'

const SAFE_METHODS: Readonly<Record<string, true>> = {
  GET: true,
  HEAD: true,
  OPTIONS: true
}

const safeDecodeFormComponent = fromThrowable(
  (value: string) => decodeURIComponent(value.replace(/\+/g, ' ')),
  () => undefined
)

function parseCookieValue (cookieHeader: string | undefined, name: string): string | undefined {
  if (cookieHeader === undefined) return undefined
  const prefix = `${name}=`
  const cookies = cookieHeader.split(';')
  for (const raw of cookies) {
    const trimmed = raw.trim()
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length)
    }
  }
  return undefined
}

function extractBodyField (body: string, field: string): string | undefined {
  const pairs = body.split('&')
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1) continue
    const keyResult = safeDecodeFormComponent(pair.slice(0, eqIndex))
    const key = keyResult.isOk() ? keyResult.value : undefined
    if (key === undefined) continue
    if (key === field) {
      const valueResult = safeDecodeFormComponent(pair.slice(eqIndex + 1))
      return valueResult.isOk() ? valueResult.value : undefined
    }
  }
  return undefined
}

export function createCsrfMiddleware (): Middleware {
  return async (req, res, ctx, next) => {
    const cookieHeader = req.headers.cookie
    const existingToken = parseCookieValue(cookieHeader, COOKIE_NAME)

    if (existingToken === undefined) {
      const newToken = generateCsrfToken()
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${newToken}; SameSite=Strict; Path=/`)
    }

    const method = req.method ?? 'GET'
    if (SAFE_METHODS[method] === true) {
      await next()
      return
    }

    const cookieToken = existingToken ?? ''
    const headerToken = req.headers[HEADER_NAME]

    if (typeof headerToken === 'string' && headerToken !== '') {
      if (validateCsrfToken(headerToken, cookieToken)) {
        await next()
        return
      }
      sendJson(res, { error: 'CSRF token mismatch' }, 403)
      return
    }

    const contentType = req.headers['content-type'] ?? ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const bodyResult = await readBody(req)
      const body = bodyResult.isOk() ? bodyResult.value : undefined
      const bodyToken = body !== undefined ? extractBodyField(body, BODY_FIELD) : undefined
      if (bodyToken !== undefined && validateCsrfToken(bodyToken, cookieToken)) {
        await next()
        return
      }
    }

    sendJson(res, { error: 'CSRF token mismatch' }, 403)
  }
}
