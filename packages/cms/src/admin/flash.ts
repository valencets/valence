import type { ServerResponse } from 'node:http'
import { fromThrowable } from '@valencets/resultkit'
import { parseCookie } from '../auth/cookie.js'

interface FlashMessage {
  readonly type: 'success' | 'error' | 'info'
  readonly text: string
}

function serializeFlash (msg: FlashMessage): string {
  const json = JSON.stringify(msg)
  return Buffer.from(json, 'utf-8').toString('base64url')
}

const safeParseFlash = fromThrowable(
  (encoded: string): FlashMessage | null => {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8')
    const parsed = JSON.parse(json) as { type: string; text: string }
    if (parsed.type !== 'success' && parsed.type !== 'error' && parsed.type !== 'info') return null
    if (typeof parsed.text !== 'string') return null
    return { type: parsed.type as FlashMessage['type'], text: parsed.text }
  },
  () => null
)

function parseFlash (encoded: string): FlashMessage | null {
  return safeParseFlash(encoded).match(v => v, () => null)
}

function setFlashCookie (res: ServerResponse, msg: FlashMessage): void {
  const value = serializeFlash(msg)
  res.setHeader('Set-Cookie', `cms_flash=${value}; Path=/admin; HttpOnly; SameSite=Lax; Secure; Max-Age=30`)
}

function clearFlashCookie (res: ServerResponse): void {
  res.setHeader('Set-Cookie', 'cms_flash=; Path=/admin; HttpOnly; SameSite=Lax; Secure; Max-Age=0')
}

function readFlash (cookieHeader: string): FlashMessage | null {
  const raw = parseCookie(cookieHeader, 'cms_flash')
  if (!raw) return null
  return parseFlash(raw)
}

export { serializeFlash, parseFlash, setFlashCookie, clearFlashCookie, readFlash }
export type { FlashMessage }
