import neostandard from 'neostandard'
export default [
  { ignores: ['**/dist/', '**/public/js/', 'packages/neverthrow/'] },
  ...neostandard({ ts: true }),
  {
    rules: {
      '@typescript-eslint/no-redeclare': 'off',
      complexity: ['error', 20]
    }
  }
]
