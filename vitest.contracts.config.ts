import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'contracts',
    include: ['tests/contracts/**/*.test.ts'],
    typecheck: {
      enabled: true,
      tsconfig: 'tsconfig.contracts.json',
      include: ['tests/contracts/**/*.test-d.ts']
    },
    environment: 'node'
  }
})
