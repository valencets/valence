import { randomBytes } from 'node:crypto'
import type { ServerResponse } from 'node:http'

export const CSP_NONCE_PLACEHOLDER = '__CSP_NONCE__'

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; connect-src 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
})

export interface SecurityHeaderOptions {
  readonly nonce?: string
}

export function generateNonce (): string {
  return randomBytes(16).toString('base64')
}

export function setSecurityHeaders (res: ServerResponse, options?: SecurityHeaderOptions): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'Content-Security-Policy' && options?.nonce) {
      res.setHeader(name, value.replace("script-src 'self'", `script-src 'self' 'nonce-${options.nonce}'`))
    } else {
      res.setHeader(name, value)
    }
  }
}
