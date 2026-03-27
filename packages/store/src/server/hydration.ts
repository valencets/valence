import type { StoreState } from '../types.js'

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/

/**
 * Escape JSON for safe embedding inside an HTML <script> tag.
 * OWASP recommendation: escape <, >, &, U+2028, U+2029 as unicode escapes.
 */
function escapeJsonForHtml (json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * Render a hydration script tag that embeds store state as JSON.
 * The client reads this on page load to seed signals without a fetch.
 */
export function renderStoreHydration (slug: string, state: StoreState): string {
  if (!SLUG_PATTERN.test(slug)) {
    return ''
  }
  const json = JSON.stringify(state)
  const safeJson = escapeJsonForHtml(json)
  return `<script type="application/json" data-store-hydrate="${slug}">${safeJson}</script>`
}
