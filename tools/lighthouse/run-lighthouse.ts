// Lighthouse score audit — fails on anything less than 100/100/100/100
// Usage: tsx tools/lighthouse/run-lighthouse.ts
// Requires: npx lighthouse, Chrome/Chromium installed

import { execSync, spawn } from 'node:child_process'
import { join } from 'node:path'

const STUDIO_DIR = join(process.cwd(), 'sites', 'studio')
const PORT = 3099
const BASE_URL = `http://localhost:${PORT}`

const PAGES = ['/', '/how-it-works', '/pricing', '/about', '/contact']

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const

interface PageResult {
  readonly page: string
  readonly scores: Record<string, number>
  readonly failing: ReadonlyArray<string>
}

function waitForServer (url: string, maxAttempts: number): boolean {
  for (let i = 0; i < maxAttempts; i++) {
    const result = execSync(
      `curl -s -o /dev/null -w "%{http_code}" ${url}/ 2>/dev/null || echo "000"`,
      { encoding: 'utf-8' }
    ).trim()
    if (result === '200') return true
    execSync('sleep 1')
  }
  return false
}

function runLighthouse (url: string): Record<string, number> {
  const json = execSync(
    `npx lighthouse ${url} --output=json --chrome-flags="--headless --no-sandbox" --quiet 2>/dev/null`,
    { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
  )
  const report = JSON.parse(json)
  const scores: Record<string, number> = {}
  for (const cat of CATEGORIES) {
    scores[cat] = report.categories[cat]?.score ?? 0
  }
  return scores
}

// Start the studio server on a dedicated port
console.log(`[lighthouse] Starting studio server on port ${PORT}...`)
const server = spawn('node', ['dist/server/entry.js'], {
  cwd: STUDIO_DIR,
  env: { ...process.env, STUDIO_PORT: String(PORT) },
  stdio: 'pipe'
})

server.stderr?.on('data', () => {})
server.stdout?.on('data', () => {})

const ready = waitForServer(BASE_URL, 15)
if (!ready) {
  console.error('[lighthouse] Server failed to start within 15 seconds')
  server.kill()
  process.exit(1)
}

console.log('[lighthouse] Server ready. Auditing pages...\n')

const results: PageResult[] = []
let hasFailure = false

for (const page of PAGES) {
  const url = `${BASE_URL}${page}`
  process.stdout.write(`  ${page} ... `)

  const scores = runLighthouse(url)
  const failing = CATEGORIES.filter((cat) => scores[cat] !== 1)

  if (failing.length > 0) hasFailure = true

  const display = CATEGORIES
    .map((cat) => {
      const score = Math.round((scores[cat] ?? 0) * 100)
      const label = cat === 'best-practices' ? 'BP' : cat.slice(0, 4).toUpperCase()
      const mark = score === 100 ? '✓' : '✗'
      return `${label}:${score} ${mark}`
    })
    .join('  ')

  console.log(display)

  results.push({ page, scores, failing })
}

server.kill()

console.log('')

if (hasFailure) {
  console.error('[lighthouse] FAILED — scores below 100:\n')
  for (const r of results) {
    for (const cat of r.failing) {
      const score = Math.round((r.scores[cat] ?? 0) * 100)
      console.error(`  ${r.page}  ${cat}: ${score}/100`)
    }
  }
  process.exit(1)
}

console.log(`[lighthouse] All ${PAGES.length} pages scored 100/100/100/100`)
process.exit(0)
