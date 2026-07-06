import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Signed anonymous store sessions. The server mints `id.signature` tokens
 * (HMAC-SHA256 over the id with the CMS secret) so anonymous visitors get
 * working session-scoped stores without a database row, while forged or
 * guessed session ids fail verification instead of opening someone else's
 * bucket.
 */

const ID_BYTES = 16
const SIGNATURE_HEX_LENGTH = 64

function sign (secret: string, id: string): string {
  return createHmac('sha256', secret).update(id).digest('hex')
}

export function mintSignedSessionId (secret: string): string {
  const id = randomBytes(ID_BYTES).toString('hex')
  return `${id}.${sign(secret, id)}`
}

/** Returns the session id when the signature verifies, null otherwise */
export function verifySignedSessionId (secret: string, token: string): string | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const id = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (signature.length !== SIGNATURE_HEX_LENGTH) return null

  const expected = Buffer.from(sign(secret, id), 'utf-8')
  const provided = Buffer.from(signature, 'utf-8')
  if (expected.length !== provided.length) return null
  if (!timingSafeEqual(expected, provided)) return null
  return id
}

export function buildStoreSessionCookie (token: string): string {
  return `session_id=${token}; Path=/; HttpOnly; SameSite=Lax`
}
