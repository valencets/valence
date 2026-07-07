import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const testDir = dirname(fileURLToPath(import.meta.url))
const workflow = readFileSync(resolve(testDir, '../../.github/workflows/ci.yml'), 'utf-8')

describe('CI workflow contract', () => {
  const e2eEnvBinding = 'E2E: $' + '{{ needs.e2e.result }}'

  it('runs contract tests through the dedicated contracts config', () => {
    expect(workflow).toContain('pnpm exec vitest run --config vitest.contracts.config.ts')
  })

  it('makes the CI gate depend on the actual e2e shard job', () => {
    expect(workflow).toContain('needs: [unit, integration, e2e, e2e-merge-report, contracts, coverage, security]')
    expect(workflow).toContain(e2eEnvBinding)
  })
})
