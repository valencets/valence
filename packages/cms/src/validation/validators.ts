const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export function isValidSlug (value: string): boolean {
  return SLUG_RE.test(value)
}

export function isValidEmail (value: string): boolean {
  return EMAIL_RE.test(value)
}
