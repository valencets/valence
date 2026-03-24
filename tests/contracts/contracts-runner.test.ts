import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

describe('contract workspace runner', () => {
  it('loads the contracts project through vitest.contracts.config.ts', async () => {
    const result = await execFileAsync('pnpm', [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.contracts.config.ts',
      'tests/contracts/contracts.test.ts'
    ], {
      cwd: process.cwd(),
      env: process.env
    })

    expect(result.stdout).toContain('tests/contracts/contracts.test.ts')
  })
})
