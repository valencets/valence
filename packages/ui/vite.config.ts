import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: '.',
  server: {
    port: 5188,
    strictPort: true
  }
})
