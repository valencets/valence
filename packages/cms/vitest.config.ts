import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@valencets/reactive', replacement: new URL('../reactive/src/index.ts', import.meta.url).pathname }
    ]
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    server: {
      deps: {
        inline: ['@valencets/reactive']
      }
    }
  }
})
