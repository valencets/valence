import neostandard, { plugins } from 'neostandard'

const tsPlugin = plugins['typescript-eslint'].plugin

export default [
  { ignores: ['**/dist/', '**/public/js/', '**/storybook-static/'] },
  ...neostandard({ ts: true }),
  {
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-redeclare': 'off',
      complexity: ['error', 20],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ThrowStatement',
          message: 'Use Result/ResultAsync instead of throw'
        },
        {
          selector: 'TryStatement',
          message: 'Use Result/ResultAsync instead of try/catch'
        },
        {
          selector: 'TSEnumDeclaration',
          message: 'Use const unions instead of enum'
        },
        {
          selector: 'SwitchStatement',
          message: 'Use dictionary maps instead of switch'
        },
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports instead of export default'
        }
      ]
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
