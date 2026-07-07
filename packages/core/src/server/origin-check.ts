import type { Middleware } from './middleware-types.js'
import { sendJson } from './http-helpers.js'
import { fromThrowable } from '@valencets/resultkit'

export interface OriginCheckConfig {
  readonly allowedOrigins: readonly string[]
  readonly isDev?: boolean
}

const SAFE_METHODS: Readonly<Record<string, true>> = {
  GET: true,
  HEAD: true,
  OPTIONS: true
}

const safeParseOrigin = fromThrowable((value: string) => new URL(value).origin, () => undefined)

function parseOrigin (value: string): string | undefined {
  const result = safeParseOrigin(value)
  return result.isOk() ? result.value : undefined
}

function isLocalhost (origin: string): boolean {
  const parsed = parseOrigin(origin)
  if (parsed === undefined) return false

  const url = new URL(parsed)
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

export function createOriginCheck (config: OriginCheckConfig): Middleware {
  const allowed = new Set(config.allowedOrigins)
  const isDev = config.isDev === true

  return async (req, res, ctx, next) => {
    const method = req.method ?? 'GET'
    if (SAFE_METHODS[method] === true) {
      await next()
      return
    }

    const originHeader = req.headers.origin
    const refererHeader = req.headers.referer

    let requestOrigin: string | undefined

    if (typeof originHeader === 'string' && originHeader !== '') {
      requestOrigin = parseOrigin(originHeader)
    } else if (typeof refererHeader === 'string' && refererHeader !== '') {
      requestOrigin = parseOrigin(refererHeader)
    }

    if (requestOrigin === undefined) {
      sendJson(res, { error: 'Origin not allowed' }, 403)
      return
    }

    if (allowed.has(requestOrigin)) {
      await next()
      return
    }

    if (isDev && isLocalhost(requestOrigin)) {
      await next()
      return
    }

    sendJson(res, { error: 'Origin not allowed' }, 403)
  }
}
