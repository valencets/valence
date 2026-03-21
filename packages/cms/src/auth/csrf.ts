import { randomBytes, timingSafeEqual } from 'node:crypto'

export function generateCsrfToken (): string {
  return randomBytes(32).toString('hex')
}

export function validateCsrfToken (token: string, expected: string): boolean {
  const tokenBuf = Buffer.from(token)
  const expectedBuf = Buffer.from(expected)
  if (tokenBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(tokenBuf, expectedBuf)
}
