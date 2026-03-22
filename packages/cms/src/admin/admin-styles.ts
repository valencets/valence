// Admin styles — delegates to km-theme.ts (single source of truth).
// This file exists for backwards compatibility with existing imports.

import { getKmPageStyles } from './km-theme.js'

/** Admin layout and component CSS — injected into <style> on admin pages. */
export const ADMIN_THEME_CSS: string = getKmPageStyles()

/** Returns the admin layout CSS for <style> injection. */
export function getAdminStyles (): string {
  return ADMIN_THEME_CSS
}
