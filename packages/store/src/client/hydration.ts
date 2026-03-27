import { fromThrowable } from '@valencets/resultkit'
import type { StoreState } from '../types.js'

const safeJsonParse = fromThrowable(
  (text: string) => JSON.parse(text) as StoreState,
  () => ({ code: 'PARSE_ERROR' as const, message: 'Invalid hydration JSON' })
)

/**
 * Read hydration state from a <script data-store-hydrate> tag in the DOM.
 * Removes the tag after reading to avoid stale references.
 * Returns empty object if not found or invalid.
 */
export function readHydrationState (slug: string): StoreState {
  const el = document.querySelector(`script[data-store-hydrate="${slug}"]`)
  if (!el) return {}

  const text = el.textContent
  el.remove()

  if (!text) return {}

  const result = safeJsonParse(text)
  if (result.isErr()) return {}

  const parsed = result.value
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed
  }
  return {}
}
