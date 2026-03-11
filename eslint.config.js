import neostandard from 'neostandard'
export default [
  { ignores: ['**/dist/', '**/public/js/'] },
  ...neostandard({ ts: true }),
  {
    rules: {
      '@typescript-eslint/no-redeclare': 'off'
    }
  }
]
