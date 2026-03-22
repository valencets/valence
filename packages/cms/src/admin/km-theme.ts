// Kinetic Monolith theme — thin wrapper reading CSS files.
// Theme CSS lives in src/admin/styles/*.css — proper CSS files, not TypeScript strings.
// This module reads them and exports functions for the build pipeline and runtime.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromThrowable } from 'neverthrow'

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)), 'styles')

const safeReadFile = fromThrowable(
  (path: string) => readFileSync(path, 'utf-8'),
  (e: unknown) => e instanceof Error ? e.message : 'Failed to read CSS file'
)

function readStyle (filename: string): string {
  const result = safeReadFile(resolve(stylesDir, filename))
  if (result.isErr()) {
    process.stderr.write(`km-theme: ${result.error} (${filename})\n`)
    return ''
  }
  return result.value
}

// Cache CSS at module load — avoids synchronous I/O on every request
const overridesCache = readStyle('km-overrides.css')
const pageCache = readStyle('km-page.css')
const criticalCache = readStyle('km-critical.css')
const deferredCache = readStyle('km-deferred.css')

/** ValElement token overrides — adopted into shadow DOM via themeManager. */
export function getKmTokenOverrides (): string {
  return overridesCache
}

/** Page-level KM CSS — injected into <style> on admin pages. */
export function getKmPageStyles (): string {
  return pageCache
}

/** Critical CSS shell — inlined for first paint (<14KB budget). */
export function getCriticalCss (): string {
  return criticalCache
}

/** Deferred CSS — served as cacheable /admin/_assets/admin.css. */
export function getDeferredCss (): string {
  return deferredCache
}
