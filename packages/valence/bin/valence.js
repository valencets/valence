#!/usr/bin/env node

// Use tsx to enable TypeScript imports (for loading valence.config.ts)
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliPath = join(__dirname, '..', 'dist', 'cli.js')

try {
  execFileSync(
    process.execPath,
    ['--import', 'tsx', cliPath, ...process.argv.slice(2)],
    { stdio: 'inherit', cwd: process.cwd() }
  )
} catch (e) {
  // tsx not available, try running directly
  try {
    execFileSync(
      process.execPath,
      [cliPath, ...process.argv.slice(2)],
      { stdio: 'inherit', cwd: process.cwd() }
    )
  } catch {
    process.exit(1)
  }
}
