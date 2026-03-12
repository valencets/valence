export interface BannedPattern {
  readonly id: string
  readonly pattern: RegExp
  readonly message: string
  readonly scope: 'business' | 'public' | 'all'
}

export interface Violation {
  readonly ruleId: string
  readonly file: string
  readonly line: number
  readonly message: string
  readonly match: string
}

// Paths excluded from audit
const EXCLUDED_PATHS = [
  /node_modules\//,
  /dist\//,
  /\.husky\//,
  /__tests__\//,
  /\.test\.(ts|js)$/,
  /test-utils/,
  /tools\/audit\//
]

// Only audit these directories
const BUSINESS_PATHS = [
  /^packages\//,
  /^sites\//,
  /^tools\//
]

// Public-facing code (no React allowed)
const PUBLIC_PATHS = [
  /^sites\/.*\/features\/.*\/components\//,
  /^sites\/.*\/features\/.*\/templates\//,
  /^packages\/components\//,
  /^packages\/core\//
]

export const BANNED_PATTERNS: ReadonlyArray<BannedPattern> = [
  {
    id: 'no-throw',
    pattern: /throw\s+new\s+Error/,
    message: 'AV Rule 208: No exceptions. Use Result monads (errAsync/err) instead of throw.',
    scope: 'business'
  },
  {
    id: 'no-try-catch',
    pattern: /\btry\s*\{/,
    message: 'AV Rule 208: No try/catch. Use Result monads. One exception: safeJsonParse().',
    scope: 'business'
  },
  {
    id: 'no-switch',
    pattern: /\bswitch\s*\(/,
    message: 'AV Rule 3: No switch statements. Use static dictionary maps.',
    scope: 'business'
  },
  {
    id: 'no-enum',
    pattern: /\benum\s+\w+/,
    message: 'No enums. Use const unions: const Foo = [...] as const.',
    scope: 'business'
  },
  {
    id: 'no-zod-parse',
    pattern: /\.parse\s*\(/,
    message: 'Use .safeParse() only, never .parse(). Banned pattern.',
    scope: 'business'
  },
  {
    id: 'no-empty-critical-css',
    pattern: /criticalCSS:\s*['"]['"]/,
    message: 'Pillar 4: Empty criticalCSS. Use ctx.cssPipeline.getCriticalCSS() instead.',
    scope: 'business'
  },
  {
    id: 'no-react-public',
    pattern: /import\s+React/,
    message: 'No React in public-facing code. Use native Web Components.',
    scope: 'public'
  },
  {
    id: 'no-default-export',
    pattern: /export\s+default\s/,
    message: 'Named exports only. No default exports (except Web Component class registrations).',
    scope: 'business'
  },
  {
    id: 'no-record-string-any',
    pattern: /Record<string,\s*any>/,
    message: 'No loose typing. Use explicit interfaces instead of Record<string, any>.',
    scope: 'business'
  },
  {
    id: 'no-localstorage',
    pattern: /\b(localStorage|sessionStorage)\b/,
    message: 'No localStorage/sessionStorage for critical application state.',
    scope: 'business'
  }
]

// Allowlist for specific pattern+file combinations
const ALLOWLIST: ReadonlyArray<{ ruleId: string; filePattern: RegExp }> = [
  // safeJsonParse is the one permitted try/catch boundary
  { ruleId: 'no-try-catch', filePattern: /safe-json-parse/ },
  // querystring .parse() is a Node API, not Zod
  { ruleId: 'no-zod-parse', filePattern: /querystring/ },
  // Handlers that use parseQs — .parse is from node:querystring, not Zod
  { ruleId: 'no-zod-parse', filePattern: /(handler|script)\.ts$/ },
  // CSS parser .parse() is not Zod
  { ruleId: 'no-zod-parse', filePattern: /split-css\.ts$/ },
  // Budget audit tool reads criticalCSS: '' for shell rendering in audit context
  { ruleId: 'no-empty-critical-css', filePattern: /critical-css-pipeline\.ts$/ },
  { ruleId: 'no-empty-critical-css', filePattern: /budget-/ },
  // Vitest config requires export default (third-party API)
  { ruleId: 'no-default-export', filePattern: /vitest\..*config\.ts$/ },
  // Copy map mentions localStorage in a description string, not usage
  { ruleId: 'no-localstorage', filePattern: /copy-map\.ts$/ }
]

function isExcluded (filePath: string): boolean {
  return EXCLUDED_PATHS.some((p) => p.test(filePath))
}

function isBusinessPath (filePath: string): boolean {
  return BUSINESS_PATHS.some((p) => p.test(filePath))
}

function isPublicPath (filePath: string): boolean {
  return PUBLIC_PATHS.some((p) => p.test(filePath))
}

function isAllowlisted (ruleId: string, filePath: string): boolean {
  return ALLOWLIST.some((a) => a.ruleId === ruleId && a.filePattern.test(filePath))
}

export function auditFile (filePath: string, content: string): ReadonlyArray<Violation> {
  if (isExcluded(filePath)) return []
  if (!isBusinessPath(filePath)) return []

  const lines = content.split('\n')
  const violations: Violation[] = []

  for (const rule of BANNED_PATTERNS) {
    if (isAllowlisted(rule.id, filePath)) continue

    if (rule.scope === 'public' && !isPublicPath(filePath)) continue

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const match = rule.pattern.exec(line)
      if (match) {
        violations.push({
          ruleId: rule.id,
          file: filePath,
          line: i + 1,
          message: rule.message,
          match: match[0]
        })
      }
    }
  }

  return violations
}
