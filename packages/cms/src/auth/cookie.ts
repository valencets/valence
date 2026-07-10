import { getCookie } from '@valencets/core/server'

/**
 * Read a single cookie value, or null when absent. Thin adapter over the
 * framework's one cookie parser (#342) so CMS callers keep their
 * null-returning contract while parsing stays centralized and literal
 * (prefix- and regex-metacharacter-safe).
 */
export function parseCookie (cookieHeader: string, name: string): string | null {
  return getCookie(cookieHeader, name) ?? null
}
