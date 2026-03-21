import type { Middleware } from './middleware-types.js'

export interface CorsConfig {
  readonly origins: readonly string[]
  readonly methods?: readonly string[]
  readonly headers?: readonly string[]
  readonly credentials?: boolean
  readonly maxAge?: number
}

export function createCorsMiddleware (config: CorsConfig): Middleware {
  const allowedOrigins = new Set(config.origins)
  const methods = (config.methods ?? ['GET', 'POST', 'PATCH', 'DELETE']).join(', ')
  const headers = (config.headers ?? ['Content-Type', 'Authorization']).join(', ')
  const maxAge = String(config.maxAge ?? 86400)
  const credentials = config.credentials ?? false

  const middleware: Middleware = async (req, res, _ctx, next) => {
    const origin = req.headers.origin
    if (typeof origin !== 'string') {
      await next()
      return
    }

    if (!allowedOrigins.has(origin)) {
      const body = JSON.stringify({ error: 'Origin not allowed' })
      res.writeHead(403, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      })
      res.end(body)
      return
    }

    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', methods)
    res.setHeader('Access-Control-Allow-Headers', headers)
    res.setHeader('Access-Control-Max-Age', maxAge)
    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    await next()
  }

  return middleware
}
