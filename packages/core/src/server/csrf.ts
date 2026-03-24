import { randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN_PATTERN = /^[0-9a-f]{64}$/i

export function generateCsrfToken (): string {
  return randomBytes(32).toString('hex')
}

export function validateCsrfToken (token: string, expected: string): boolean {
  if (token.length === 0 || expected.length === 0) return false
  if (!TOKEN_PATTERN.test(token) || !TOKEN_PATTERN.test(expected)) return false
  const tokenBuf = Buffer.from(token)
  const expectedBuf = Buffer.from(expected)
  if (tokenBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(tokenBuf, expectedBuf)
}
