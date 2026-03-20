/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  vitest: {
    dir: 'packages/cms'
  },
  mutate: [
    'packages/cms/src/**/*.ts',
    '!packages/cms/src/**/__tests__/**',
    '!packages/cms/src/**/index.ts'
  ],
  reporters: ['clear-text', 'progress'],
  thresholds: {
    high: 80,
    low: 70,
    break: 60
  },
  concurrency: 4,
  timeoutMS: 60_000,
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json'
}
