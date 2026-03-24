export default {
  '*.{ts,tsx,js,mjs,cjs}': [
    'eslint --fix',
    'bash scripts/check-banned-patterns.sh'
  ],
  '.husky/*': [
    'sh -n'
  ],
  'scripts/*.sh': [
    'bash -n'
  ]
}
