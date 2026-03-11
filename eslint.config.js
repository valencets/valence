import neostandard from 'neostandard'
export default [
  { ignores: ['**/dist/'] },
  ...neostandard({ ts: true }),
  {
    rules: {
      '@typescript-eslint/no-redeclare': 'off'
    }
  }
]
