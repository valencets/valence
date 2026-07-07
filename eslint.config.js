import neostandard, { plugins } from 'neostandard'
import { opinionated as resultkitStrict } from '@valencets/resultkit/eslint'

const tsPlugin = plugins['typescript-eslint'].plugin

export default [
  { ignores: ['**/dist/', '**/public/js/', '**/storybook-static/'] },
  ...neostandard({ ts: true }),
  // Railway-oriented error handling is enforced by resultkit's own preset.
  // `opinionated` = strict Result rules (no throw/try/switch/enum/.catch/.finally/.unwrap)
  // plus the named-exports rule this repo already requires.
  ...resultkitStrict,
  {
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-redeclare': 'off',
      complexity: ['error', 20],
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  // Tool config files require export default by convention
  {
    files: [
      '**/vitest.config.ts',
      '**/vitest.integration.config.ts',
      'vitest.contracts.config.ts',
      '**/vite.config.ts',
      '**/playwright.config.ts',
      'stryker.config.mjs',
      '**/*.stories.ts',
      'lighthouserc.js',
      'tests/perf/**/*.js',
      'tests/perf/**/*.mjs',
      'tests/e2e/server-start.mjs',
      '**/.storybook/**',
      'vitest.workspace.ts',
      'eslint.config.js',
      'lint-staged.config.js'
    ],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  // Test files may use throw/try to test error boundaries and simulate errors
  {
    files: ['**/__tests__/**/*.ts', '**/tests/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  // k6 performance test scripts use k6's own runtime globals
  {
    files: ['tests/perf/**/*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
        __SCENARIO: 'readonly',
        open: 'readonly'
      }
    }
  }
]
