function hasControlChars (str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 0 && code <= 0x1f) return true
  }
  return false
}

/**
 * Validates a redirect URL is a safe relative path.
 * Rejects absolute URLs, protocol-relative URLs, dangerous protocols,
 * backslashes, and control characters to prevent open redirect attacks.
 */
export function safeRedirect (url: string, fallback: string = '/'): string {
  if (url.length === 0) return fallback
  if (hasControlChars(url)) return fallback
  if (url.startsWith('//')) return fallback
  if (url.includes('\\')) return fallback
  if (!url.startsWith('/')) return fallback

  return url
}
