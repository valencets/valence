// Build-time script: generates dist/client/admin.css from getDeferredCss().
// Called by: node --import tsx dist/admin/build-css.js (after tsc)

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDeferredCss } from './km-theme.js'

const thisDir = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(thisDir, '..', 'client')
mkdirSync(outDir, { recursive: true })

const css = getDeferredCss()
const outPath = resolve(outDir, 'admin.css')
writeFileSync(outPath, css, 'utf-8')
console.log(`  admin.css generated (${Buffer.byteLength(css)} bytes)`)
