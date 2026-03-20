import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Per-package unit test configs (existing)
  'packages/*/vitest.config.ts',

  // Contract tests — unit phase, no external deps
  {
    test: {
      name: 'contracts',
      include: ['tests/contracts/**/*.test.ts'],
      typecheck: {
        enabled: true,
        include: ['tests/contracts/**/*.test-d.ts']
      },
      environment: 'node'
    }
  },

  // Integration tests — sequential pool, real DB
  {
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
      environment: 'node',
      pool: 'forks',
      poolOptions: {
        forks: { singleFork: true }
      },
      testTimeout: 30_000,
      hookTimeout: 30_000,
      setupFiles: ['tests/integration/setup.ts']
    }
  }
])
