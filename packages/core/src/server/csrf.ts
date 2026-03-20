import { randomBytes } from 'node:crypto'

export function generateCsrfToken (): string {
  return randomBytes(32).toString('hex')
}

export function validateCsrfToken (token: string, expected: string): boolean {
  if (token.length === 0 || expected.length === 0) return false
  if (token.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= (token.charCodeAt(i) ^ expected.charCodeAt(i))
  }
  return mismatch === 0
}
