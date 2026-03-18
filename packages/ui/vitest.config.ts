import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['src/__tests__/setup.ts']
  }
})
