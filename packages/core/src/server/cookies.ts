import type { IncomingMessage } from 'node:http'

/**
 * The single cookie abstraction (#342). Every parser and serializer in the
 * framework routes through here so that quoting, prefix matching, and the
 * standard attribute set live in exactly one audited place — the surface
 * where subtle cookie security bugs otherwise breed.
 *
 * Parsing is literal (a name is a name, never a regular expression) and
 * first-occurrence-wins, matching browser semantics. Serialization emits a
 * fixed, safe attribute order; ordering is cosmetic to clients but keeps
 * output deterministic for tests and diffs.
 */

export type SameSite = 'Strict' | 'Lax' | 'None'

export interface CookieOptions {
  readonly path?: string
  readonly domain?: string
  /** Lifetime in seconds. `0` expires the cookie immediately. */
  readonly maxAge?: number
  readonly httpOnly?: boolean
  /** Set from the transport — see {@link isSecureTransport}. */
  readonly secure?: boolean
  readonly sameSite?: SameSite
}

/** Split a `name` off a single trimmed `name=value` segment, or null. */
function splitPair (segment: string): readonly [string, string] | null {
  const trimmed = segment.trim()
  const eq = trimmed.indexOf('=')
  if (eq <= 0) return null
  const name = trimmed.slice(0, eq).trim()
  if (name === '') return null
  return [name, trimmed.slice(eq + 1).trim()]
}

/**
 * Parse a `Cookie` request header into a name→value map. First occurrence
 * wins; malformed segments (no `=`) are skipped. Returns an empty object for
 * an absent or blank header.
 */
export function parseCookies (header: string | undefined): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  if (header === undefined || header === '') return out
  for (const segment of header.split(';')) {
    const pair = splitPair(segment)
    if (pair === null) continue
    const [name, value] = pair
    if (!Object.prototype.hasOwnProperty.call(out, name)) {
      out[name] = value
    }
  }
  return out
}

/**
 * Read a single cookie value by exact name, or `undefined` when absent.
 * The name is matched literally, so it is immune to the prefix- and
 * regular-expression-metacharacter pitfalls of ad-hoc parsers.
 */
export function getCookie (header: string | undefined, name: string): string | undefined {
  if (header === undefined || header === '') return undefined
  for (const segment of header.split(';')) {
    const pair = splitPair(segment)
    if (pair === null) continue
    if (pair[0] === name) return pair[1]
  }
  return undefined
}

/**
 * Serialize a `Set-Cookie` header value with a fixed attribute order:
 * `name=value; Path; Domain; Max-Age; HttpOnly; SameSite; Secure`.
 */
export function serializeCookie (name: string, value: string, options?: CookieOptions): string {
  let out = `${name}=${value}`
  if (options === undefined) return out
  if (options.path !== undefined) out += `; Path=${options.path}`
  if (options.domain !== undefined) out += `; Domain=${options.domain}`
  if (options.maxAge !== undefined) out += `; Max-Age=${options.maxAge}`
  if (options.httpOnly === true) out += '; HttpOnly'
  if (options.sameSite !== undefined) out += `; SameSite=${options.sameSite}`
  if (options.secure === true) out += '; Secure'
  return out
}

/**
 * Derive the `Secure` flag from the request transport: true only when the
 * connection terminates TLS at this process. Proxy headers are deliberately
 * ignored — a spoofable `X-Forwarded-Proto` must never mark a cookie Secure.
 */
export function isSecureTransport (req: IncomingMessage): boolean {
  return (req.socket as { encrypted?: boolean } | undefined)?.encrypted === true
}
