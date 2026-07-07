/**
 * Fragments swap into dedicated targets only — a bare data-fragment inside
 * the store's container, or an explicit data-fragment="slug" anywhere. The
 * data-store container itself is never a swap target, so forms and
 * triggers inside it survive fragment updates.
 */
export function fragmentSelector (slug: string): string {
  return `[data-fragment="${slug}"], [data-store="${slug}"] [data-fragment=""]`
}
