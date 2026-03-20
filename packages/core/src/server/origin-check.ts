import type { Middleware } from './middleware-types.js'
import { sendJson } from './http-helpers.js'

export interface OriginCheckConfig {
  readonly allowedOrigins: readonly string[]
  readonly isDev?: boolean
}

const SAFE_METHODS: Readonly<Record<string, true>> = {
  GET: true,
  HEAD: true,
  OPTIONS: true
}

function extractOrigin (url: string): string {
  const idx = url.indexOf('/', url.indexOf('//') + 2)
  if (idx === -1) return url
  return url.slice(0, idx)
}

function isLocalhost (origin: string): boolean {
  return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')
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
      requestOrigin = originHeader
    } else if (typeof refererHeader === 'string' && refererHeader !== '') {
      requestOrigin = extractOrigin(refererHeader)
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
