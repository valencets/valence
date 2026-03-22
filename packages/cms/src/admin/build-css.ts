// Build-time script: copies km-deferred.css to dist/client/admin.css.
// Called by: node dist/admin/build-css.js (after tsc)

import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromThrowable } from 'neverthrow'

const safeMkdir = fromThrowable(
  (dir: string) => mkdirSync(dir, { recursive: true }),
  (e: unknown) => e instanceof Error ? e.message : 'mkdir failed'
)

const safeCopy = fromThrowable(
  (src: string, dest: string) => copyFileSync(src, dest),
  (e: unknown) => e instanceof Error ? e.message : 'copy failed'
)

const thisDir = dirname(fileURLToPath(import.meta.url))
const srcFile = resolve(thisDir, 'styles', 'km-deferred.css')
const outDir = resolve(thisDir, '..', 'client')

const mkdirResult = safeMkdir(outDir)
if (mkdirResult.isErr()) {
  console.error(`  build-css: failed to create ${outDir}: ${mkdirResult.error}`)
  process.exit(1)
}

const outPath = resolve(outDir, 'admin.css')
const copyResult = safeCopy(srcFile, outPath)
if (copyResult.isErr()) {
  console.error(`  build-css: failed to copy ${srcFile}: ${copyResult.error}`)
  process.exit(1)
}

console.log('  admin.css copied from km-deferred.css')
