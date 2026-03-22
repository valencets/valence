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

/** ValElement token overrides — adopted into shadow DOM via themeManager. */
export function getKmTokenOverrides (): string {
  return readStyle('km-overrides.css')
}

/** Page-level KM CSS — injected into <style> on admin pages. */
export function getKmPageStyles (): string {
  return readStyle('km-page.css')
}

/** Critical CSS shell — inlined for first paint (<14KB budget). */
export function getCriticalCss (): string {
  return readStyle('km-critical.css')
}

/** Deferred CSS — served as cacheable /admin/_assets/admin.css. */
export function getDeferredCss (): string {
  return readStyle('km-deferred.css')
}
