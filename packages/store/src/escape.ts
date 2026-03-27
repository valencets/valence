/**
 * Escape a string for safe interpolation into HTML.
 * Use this in fragment() render functions for all user-supplied values.
 *
 * @example
 * fragment: (state) => `<p>${escapeHtml(String(state.name))}</p>`
 */
export function escapeHtml (str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
