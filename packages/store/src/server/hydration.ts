import type { StoreState } from '../types.js'

/**
 * Render a hydration script tag that embeds store state as JSON.
 * The client reads this on page load to seed signals without a fetch.
 */
export function renderStoreHydration (slug: string, state: StoreState): string {
  const json = JSON.stringify(state)
  // Escape </script> to prevent XSS via state values
  const safeJson = json.replace(/<\/script/gi, '<\\/script')
  return `<script type="application/json" data-store-hydrate="${slug}">${safeJson}</script>`
}
