#!/usr/bin/env tsx
// Banned patterns audit — runs against staged files or all source files
// Usage: tsx tools/audit/run-audit.ts [--staged | --all]

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { auditFile } from './banned-patterns.js'
import type { Violation } from './banned-patterns.js'

const mode = process.argv[2] ?? '--staged'

function getStagedFiles (): string[] {
  const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
  return output.split('\n').filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
}

function getAllSourceFiles (): string[] {
  const output = execSync(
    'git ls-files -- "packages/**/*.ts" "sites/**/*.ts" "tools/**/*.ts"',
    { encoding: 'utf-8' }
  )
  return output.split('\n').filter(Boolean)
}

const files = mode === '--all' ? getAllSourceFiles() : getStagedFiles()

if (files.length === 0) {
  console.log('[audit] No files to audit')
  process.exit(0)
}

const allViolations: Violation[] = []

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const violations = auditFile(file, content)
  allViolations.push(...violations)
}

if (allViolations.length === 0) {
  console.log(`[audit] ${files.length} files audited — no banned patterns found`)
  process.exit(0)
}

console.error(`\n[audit] ${allViolations.length} banned pattern violation(s) found:\n`)

for (const v of allViolations) {
  console.error(`  ${v.file}:${v.line}  ${v.ruleId}`)
  console.error(`    ${v.message}`)
  console.error(`    Match: ${v.match}\n`)
}

process.exit(1)
